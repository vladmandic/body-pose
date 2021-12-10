#!/usr/bin/env python3
import os
import time
import json
import argparse
import signal
import cv2
import numpy as np
import tensorflow as tf
from distutils.util import strtobool
import tensorflow.python.platform.build_info as build
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


res = JSON()
model = None


def keyboardInterruptHandler(signal, frame):
    print('aborted...')
    exit(0)


def now():
  return time.perf_counter()


def loadModel():
  global model
  # os.environ['CUDA_VISIBLE_DEVICES'] = '-1' # disable cuda
  os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2' # reduce tf logging
  print('loaded tensorflow', tf.version.VERSION)
  if len(tf.config.list_physical_devices('GPU')) < 1:
    print('no gpu devices found')
    exit(0)    
  print('loaded cuda', build.build_info['cuda_version'])
  t0 = now()
  model = tf.saved_model.load(args.model)
  print('loaded model:', args.model, 'in {:.1f}sec'.format(now() - t0))


def predict(tensor, timestamp, frame, count, starttime):
  if model is None:
    print('model not loaded')
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
  res.resolution = [tensor.shape[1], tensor.shape[0]]
  res.timestamps.append(timestamp)
  if bool(args.round): # round and convert f32 point coordinates to uint16
    points2d = tf.cast(tf.math.round(result['poses2d']), tf.int16).numpy()
    points3d = tf.cast(tf.math.round(result['poses3d']), tf.int16).numpy()
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
    '\rprocess:',
    ' frame: {:.0f}'.format(frame), 'of {:.0f}'.format(count),
    ' timestamp: {:.0f}'.format(timestamp),
    ' time: {:.3f}sec'.format(now() - t0),
    ' progress: {:.0f}%'.format(100 * frame / count),
    ' estimate: {:.0f}sec'.format((count - 1) / frame * (now() - starttime)),
    end='') # overwrite same line
  return boxes, points3d, points2d, joints, edges


def predictImage(input):
  tensor = tf.image.decode_jpeg(tf.io.read_file(input))
  res.frames = 1
  print('loaded image:', input, ' resolution: {:.0f}'.format(tensor.shape[1]), 'x {:.0f}'.format(tensor.shape[0]))
  t0 = now()
  boxes, poses3d, poses2d, joints, edges = predict(tensor, 0, 1, 1, t0)
  image = tensor.numpy()
  print('\nprocessed image in {:.1f}sec'.format(now() - t0))
  confidences = ''
  for box in boxes:
    confidences = confidences + '{:.0f}% '.format(100 * box[-1])
  print('detected poses: {:.0f}'.format(len(boxes)), ' confidences:', confidences)
  if bool(args.plot):
    visualize(image, boxes, poses3d, poses2d, joints, edges)


def predictVideo(input):
  count = 0
  vidcap = cv2.VideoCapture(input)
  res.frames = vidcap.get(cv2.CAP_PROP_FRAME_COUNT)
  print('loaded video:', input, ' frames: {:.0f}'.format(res.frames), ' resolution: {:.0f}'.format(vidcap.get(cv2.CAP_PROP_FRAME_WIDTH)), 'x {:.0f}'.format(vidcap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
  success, image = vidcap.read()
  t0 = now()
  while success:
    if args.skipms > 0:
      vidcap.set(cv2.CAP_PROP_POS_MSEC, (count * args.skipms))
    success, image = vidcap.read()
    count = count + 1
    if image is not None:
      tensor = tf.convert_to_tensor(image, dtype=tf.uint8)
      ts = vidcap.get(cv2.CAP_PROP_POS_MSEC)
      detections, poses3d, poses2d, joints, edges = predict(tensor, ts, count, res.frames, t0)
  print('\nprocessed video:', '{:.0f} frames'.format(count), 'in {:.1f}sec'.format(now() - t0))


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
  a.add_argument('--json',          type=str,                               help='write results to json file')
  a.add_argument('--verbose',       type=strtobool, default=1,              help='verbose logging')
  a.add_argument('--model',         type=str,       default='models/small', help='model used for predictions')
  a.add_argument('--skipms',        type=int,       default=0,              help='skip time between frames in miliseconds')
  a.add_argument('--plot',          type=strtobool, default=0,              help='plot output when processing image')
  a.add_argument('--fov',           type=int,       default=55,             help='field-of-view in degrees') # large impact on obscured bodies
  a.add_argument('--batch',         type=int,       default=64,             help='process n detected boxes in parallel')
  a.add_argument('--maxpeople',     type=int,       default=-1,             help='limit processing to n people in the scene')
  a.add_argument('--skeleton',      type=str,       default='',             help='use specific skeleton definition standard')
  a.add_argument('--augmentations', type=int,       default=6,              help='how many variations of detection to run') # higher increases precision but also decreases confidence
  a.add_argument('--average',       type=strtobool, default=1,              help='run avarage on augmentation variations')
  a.add_argument('--suppress',      type=strtobool, default=1,              help='suppress implausible poses')
  a.add_argument('--round',         type=strtobool, default=1,              help='round coordinates')
  a.add_argument('--minify',        type=strtobool, default=1,              help='minify json output')
  a.add_argument('--minconfidence', type=float,     default=0.1,            help='minimum detection confidence')
  a.add_argument('--iou',           type=float,     default=0.7,            help='iou threshold for overlaps') # 0 is any overlap and 1 is ignore overlap, 
  args = a.parse_args()
  options = json.dumps(args.__dict__)
  options = options.replace("\"", "").replace("{", "").replace("}", "").replace(": ", ":").replace(",", "")
  print('options:', options)
  res.options = vars(args)
  if args.image is not None:
    loadModel()
    input = args.image
    predictImage(input)
  elif args.video is not None:
    loadModel()
    input = args.video
    predictVideo(input)
  else:
    print('error: image or video not specified')
  if args.json is not None:
    if bool(args.minify):
      obj = json.dumps(res.__dict__, separators = (',', ':'))
    else:
      obj = json.dumps(res.__dict__, indent = 2)
    if args.json == 'true':
      output = input + '.json'
    else:
      output = args.json
    with open(output, "w") as outfile:
      outfile.write(obj)
      print('results written to:', output)
  print("done...")
