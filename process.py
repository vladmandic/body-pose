#!/usr/bin/env python3
import os
import time
import json
import argparse
import signal
import cv2
import numpy as np
import tensorflow as tf
from pathlib import Path
from distutils.util import strtobool
import matplotlib


class JSON:
  def __init__(self):
    self.options = None
    self.resolution = [0, 0]
    self.frames = 0
    self.boxes = []
    self.poses = []
    self.joints = None
    self.edges = None
    self.timestamps = []


model = None


def keyboardInterruptHandler(signal, frame):
    print('aborted...')
    exit(0)


def now():
  return time.perf_counter()


def loadModel(args):
  global model
  # os.environ['CUDA_VISIBLE_DEVICES'] = '-1' # disable cuda
  os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2' # reduce tf logging
  os.environ['CUDA_CACHE_DISABLE'] = '0'
  os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
  os.environ['TF_GPU_THREAD_MODE'] = 'gpu_private'
  os.environ['TF_USE_CUDNN_BATCHNORM_SPATIAL_PERSISTENT'] = '1'
  # os.environ['TF_ENABLE_WINOGRAD_NONFUSED'] = '1'
  # os.environ['TF_AUTOTUNE_THRESHOLD'] = '1'
  # os.environ['TF_ENABLE_CUBLAS_TENSOR_OP_MATH_FP32'] = '1'
  # os.environ['TF_ENABLE_CUDNN_TENSOR_OP_MATH_FP32'] = '1'
  # os.environ['TF_ENABLE_CUDNN_RNN_TENSOR_OP_MATH_FP32'] = '1'
  os.environ['TF_NEED_HDFS'] = '0'
  os.environ['TF_NEED_GCP'] = '0'
  os.environ['TF_CUDA_COMPUTE_CAPABILITIES'] = '8.0,8.6'
  os.environ['TF_ENABLE_XLA 1'] = '1'

  print('loaded tensorflow:', tf.version.VERSION)
  sysconfig = tf.sysconfig.get_build_info()
  print('cuda:', sysconfig["cuda_version"], 'cudnn:', sysconfig["cudnn_version"], 'cuda build:', sysconfig["is_cuda_build"], 'tensorrt:', sysconfig["is_tensorrt_build"])
  gpuDevices = tf.config.list_physical_devices('GPU')
  if len(gpuDevices) < 1:
    print('error: no gpu devices found')
    exit(1)
  for gpu in gpuDevices:
    print('gpu device:', gpu.name, tf.config.experimental.get_device_details(gpu)['device_name'])
  t0 = now()
  dir = Path(args.model)
  if dir.is_dir():
    model = tf.saved_model.load(args.model)
    memory = tf.config.experimental.get_memory_info('GPU:0')
    print('loaded model:', args.model, 'in {:.1f}sec'.format(now() - t0), 'memory ', memory['current'])
  else:
    print('model path invalid:', args.model)
    exit(1)


def round(x, decimals = 0):
    multiplier = tf.constant(10**decimals, dtype=x.dtype)
    r = tf.round(x * multiplier) / multiplier
    if decimals == 0:
      return tf.cast(r, tf.int16)
    else:
      return r


def predict(res, args, tensor, timestamp, frame, count, starttime):
  if model is None:
    print(' error: model not loaded')
    return None, None, None, None, None
  t0 = now()
  # run inference
  result = model.detect_poses(tensor,
    default_fov_degrees=args.fov,
    internal_batch_size=args.batch,
    num_aug=args.augmentations,
    average_aug=bool(args.average),
    skeleton=args.skeleton,
    detector_threshold=args.minconfidence,
    detector_nms_iou_threshold=args.iou,
    max_detections=args.maxpeople,
    antialias_factor=1,
    suppress_implausible_poses=bool(args.suppress)
  )
  res.options = vars(args)
  res.resolution = [tensor.shape[1], tensor.shape[0]]
  res.timestamps.append(timestamp)
  if bool(args.round): # round and convert f32 point coordinates to uint16
    points2d = round(result['poses2d']).numpy()
    points3d = round(result['poses3d']).numpy()
    boxes = round(result['boxes'], 2).numpy()
  else:
    points2d = result['poses2d'].numpy()
    points3d = result['poses3d'].numpy()
    boxes = result['boxes'].numpy()
  res.boxes.append(boxes.tolist())
  res.poses.append(points3d.tolist())
  joints = model.per_skeleton_joint_names[args.skeleton].numpy().astype(str)
  edges = model.per_skeleton_joint_edges[args.skeleton].numpy()
  res.joints = joints.tolist()
  res.edges = edges.tolist()
  print(
    '\r process:',
    ' frame: {:.0f}'.format(frame), 'of {:.0f}'.format(count),
    ' timestamp: {:.0f}'.format(timestamp),
    ' time: {:.3f}sec'.format(now() - t0),
    ' progress: {:.0f}%'.format(100 * frame / count),
    ' estimate: {:.0f}sec'.format((count - 1) / frame * (now() - starttime)),
    end='') # overwrite same line
  return boxes, points3d, points2d, joints, edges


def predictImage(args):
  tensor = tf.image.decode_jpeg(tf.io.read_file(args.image))
  print(' loaded image:', args.image, ' resolution: {:.0f}'.format(tensor.shape[1]), 'x {:.0f}'.format(tensor.shape[0]))
  t0 = now()
  res = JSON()
  res.frames = 1
  boxes, poses3d, poses2d, joints, edges = predict(res, args, tensor, 0, 1, 1, t0)
  if boxes is None:
    print(' error: empty result')
    return
  # print('\n processed image in {:.1f}sec'.format(now() - t0))
  confidences = ''
  for box in boxes:
    confidences = confidences + '{:.0f}% '.format(100 * box[-1])
  print(' detected poses: {:.0f}'.format(len(boxes)), ' confidences:', confidences)
  if bool(args.plot):
    visualize(tensor.numpy(), boxes, poses3d, poses2d, joints, edges)
  return res


def predictVideo(args):
  count = 0
  vidcap = cv2.VideoCapture(args.video)
  print(' loaded video:', args.video, ' frames: {:.0f}'.format(vidcap.get(cv2.CAP_PROP_FRAME_COUNT)), ' resolution: {:.0f}'.format(vidcap.get(cv2.CAP_PROP_FRAME_WIDTH)), 'x {:.0f}'.format(vidcap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
  success, image = vidcap.read()
  t0 = now()
  res = JSON()
  res.frames = vidcap.get(cv2.CAP_PROP_FRAME_COUNT)
  while success:
    if args.skipms > 0:
      vidcap.set(cv2.CAP_PROP_POS_MSEC, (count * args.skipms))
    success, image = vidcap.read()
    count = count + 1
    if image is not None:
      tensor = tf.convert_to_tensor(image, dtype=tf.uint8)
      ts = vidcap.get(cv2.CAP_PROP_POS_MSEC)
      detections, poses3d, poses2d, joints, edges = predict(res, args, tensor, ts, count, res.frames, t0)
  print('\n processed video:', '{:.0f} frames'.format(count), 'in {:.1f}sec'.format(now() - t0))
  return res


def overrideProperties(args, job):
  if 'image' in job:
    args.image = job['image']
  else:
    args.image = None
  if 'video' in job:
    args.video = job['video']
  else:
    args.video = None
  if 'verbose' in job:
    args.verbose = job['verbose']
  if 'skipms' in job:
    args.skipms = job['skipms']
  if 'fov' in job:
    args.fov = job['fov']
  if 'batch' in job:
    args.batch = job['batch']
  if 'maxpeople' in job:
    args.maxpeople = job['maxpeople']
  else:
    args.maxpeople = -1
  if 'skeleton' in job:
    args.skeleton = job['skeleton']
  if 'augmentations' in job:
    args.augmentations = job['augmentations']
  if 'average' in job:
    args.average = job['average']
  if 'suppress' in job:
    args.suppress = job['suppress']
  if 'round' in job:
    args.round = job['round']
  if 'minify' in job:
    args.minify = job['minify']
  if 'minconfidence' in job:
    args.minconfidence = job['minconfidence']
  else:
    args.minconfidence = 0.1
  if 'iou' in job:
    args.iou = job['iou']
  if 'json' in job:
    args.json = job['json']
  else:
    args.json = 'true'
  return args


def writeJson(args, data):
  if args.json is not None:
    if bool(args.minify):
      obj = json.dumps(data.__dict__, separators = (',', ':'))
    else:
      obj = json.dumps(data.__dict__, indent = 2)
    if args.json == 'true':
      if args.image is not None:
        input = args.image
      elif args.video is not None:
        input = args.video
      output = input + '.json'
    else:
      output = args.json
    print(' results written to:', output)
    outFile = open(output, "w", encoding='utf-8')
    outFile.write(obj)
    outFile.close()


def processJobs(args):
  print('loading batch jobs definition:', args.jobs)
  jobs = json.loads(open(args.jobs).read())
  for i, job in enumerate(jobs, start=1):
    print('job:', i, 'of', len(jobs))
    args = overrideProperties(args, dict(job))
    options = json.dumps(args.__dict__)
    options = options.replace("\"", "").replace("{", "").replace("}", "").replace(": ", ":").replace(",", "")
    print(' options:', options)
    jobRes = JSON()
    if args.image is not None:
      jobRes = predictImage(args)
    elif args.video is not None:
      jobRes = predictVideo(args)
    writeJson(args, jobRes)


def visualize(image, detections, poses3d, poses2d, joint_names, joint_edges):
  print('visualize matplotlib')
  matplotlib.pyplot.switch_backend('TkAgg')
  fig = matplotlib.pyplot.figure(figsize=(10, 5.2))
  imageAx = fig.add_subplot(1, 2, 1)
  imageAx.imshow(image)
  for x, y, w, h in detections[:, :4]:
    imageAx.add_patch(matplotlib.patches.Rectangle((x, y), w, h, fill=False))
  poseAx = fig.add_subplot(1, 2, 2, projection='3d')
  poseAx.view_init(5, -85)
  poseAx.set_xlim3d(-1500, 1500)
  poseAx.set_zlim3d(-1500, 1500)
  poseAx.set_ylim3d(0, 3000)
  poseAx.set_box_aspect((1, 1, 1))
  # matplotlib plots the Z axis as vertical, but our poses have Y as the vertical axis so we do a 90° rotation around the X axis
  poses3d[..., 1], poses3d[..., 2] = poses3d[..., 2], -poses3d[..., 1]
  for pose3d, pose2d in zip(poses3d, poses2d):
    for i_start, i_end in joint_edges:
      imageAx.plot(*zip(pose2d[i_start], pose2d[i_end]), marker='o', markersize=2)
      poseAx.plot(*zip(pose3d[i_start], pose3d[i_end]), marker='o', markersize=2)
    imageAx.scatter(*pose2d.T, s=2)
    poseAx.scatter(*pose3d.T, s=2)
  fig.tight_layout()
  matplotlib.pyplot.show()


if __name__ == '__main__':
  signal.signal(signal.SIGINT, keyboardInterruptHandler)
  a = argparse.ArgumentParser()
  a.add_argument('--image',         type=str,                               help='image file')
  a.add_argument('--video',         type=str,                               help='video file')
  a.add_argument('--jobs',           type=str,                              help='jobs definition file')
  a.add_argument('--json',          type=str,                               help='write results to json file')
  a.add_argument('--verbose',       type=strtobool, default=1,              help='verbose logging')
  a.add_argument('--model',         type=str,       default='model',        help='model used for predictions')
  a.add_argument('--skipms',        type=int,       default=0,              help='skip time between frames in miliseconds')
  a.add_argument('--plot',          type=strtobool, default=0,              help='plot output when processing image')
  a.add_argument('--fov',           type=int,       default=55,             help='field-of-view in degrees') # large impact on obscured bodies
  a.add_argument('--batch',         type=int,       default=64,             help='process n detected boxes in parallel')
  a.add_argument('--maxpeople',     type=int,       default=-1,             help='limit processing to n people in the scene')
  a.add_argument('--skeleton',      type=str,       default='',             help='use specific skeleton definition standard')
  a.add_argument('--augmentations', type=int,       default=6,              help='how many variations of detection to run') # higher increases precision but also decreases confidence
  a.add_argument('--average',       type=strtobool, default=1,              help='run average on augmentation variations')
  a.add_argument('--suppress',      type=strtobool, default=1,              help='suppress implausible poses')
  a.add_argument('--round',         type=strtobool, default=1,              help='round coordinates')
  a.add_argument('--minify',        type=strtobool, default=1,              help='minify json output')
  a.add_argument('--minconfidence', type=float,     default=0.1,            help='minimum detection confidence')
  a.add_argument('--iou',           type=float,     default=0.7,            help='iou threshold for overlaps') # 0 is any overlap and 1 is ignore overlap, 
  args = a.parse_args()
  options = json.dumps(args.__dict__)
  options = options.replace("\"", "").replace("{", "").replace("}", "").replace(": ", ":").replace(",", "")
  if args.image is not None:
    loadModel(args)
    print('options:', options)
    res = predictImage(args)
    writeJson(args, res)
  elif args.video is not None:
    loadModel(args)
    print('options:', options)
    res = predictVideo(args)
    writeJson(args, res)
  elif args.jobs is not None:
    loadModel(args)
    processJobs(args)
  else:
    print('error: image or video not specified')
  print("done...")
