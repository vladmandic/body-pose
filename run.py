#!/usr/bin/env python3
import os
import time
import json
import argparse
import signal
import cv2
import tensorflow as tf
from distutils.util import strtobool
import matplotlib


class JSON:
  def __init__(self):
    self.options = None
    self.resolution = [0, 0]
    self.frames = 0
    self.boxes = []
    self.poses3d = []
    self.poses2d = []
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
  if bool(args.verbose):
    print('tensorflow', tf.version.VERSION)
    print('cpu devices:', tf.config.list_physical_devices('CPU'))
    print('gpu devices:', tf.config.list_physical_devices('GPU'))
  t0 = now()
  model = tf.saved_model.load(args.model)
  print('model loaded:', args.model, 'in {:.1f}sec'.format(now() - t0))


def predict(tensor, timestamp):
  if model is None:
    print('model not loaded')
    return None, None, None, None, None
  t0 = now()
  # run inference
  pred = model.detect_poses(tensor,
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
  pred = tf.nest.map_structure(lambda x: x.numpy(), pred) # convert tensors to numpy arrays
  res.resolution = [tensor.shape[1], tensor.shape[0]]
  res.timestamps.append(timestamp)
  res.boxes.append(pred['boxes'].tolist())
  res.poses3d.append(pred['poses3d'].tolist())
  res.poses2d.append(pred['poses2d'].tolist())
  joints = model.per_skeleton_joint_names[args.skeleton].numpy().astype(str)
  edges = model.per_skeleton_joint_edges[args.skeleton].numpy()
  res.joints = joints.tolist()
  res.edges = edges.tolist()
  if bool(args.verbose):
    print('process time: {:.3f}sec'.format(now() - t0))
  return pred['boxes'], pred['poses3d'], pred['poses2d'], joints, edges


def predictImage(input):
  tensor = tf.image.decode_jpeg(tf.io.read_file(input))
  res.frames = 1
  print('image loaded:', input, 'resolution: {:.0f}'.format(tensor.shape[1]), 'x {:.0f}'.format(tensor.shape[0]))
  t0 = now()
  boxes, poses3d, poses2d, joints, edges = predict(tensor, 0)
  image = tensor.numpy()
  print('image processed in {:.1f}sec'.format(now() - t0))
  for box in boxes:
    print('detected confidence: {:.2f}'.format(box[-1]))
  if bool(args.plot):
    visualize(image, boxes, poses3d, poses2d, joints, edges)


def predictVideo(input):
  count = 0
  vidcap = cv2.VideoCapture(input)
  res.frames = vidcap.get(cv2.CAP_PROP_FRAME_COUNT)
  print('video loaded:', input, 'frames: {:.0f}'.format(res.frames), 'resolution: {:.0f}'.format(vidcap.get(cv2.CAP_PROP_FRAME_WIDTH)), 'x {:.0f}'.format(vidcap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
  success, image = vidcap.read()
  t0 = now()
  while success:
    if args.skipms > 0:
      vidcap.set(cv2.CAP_PROP_POS_MSEC, (count * args.skipms))
    success, image = vidcap.read()
    if image is not None:
      tensor = tf.convert_to_tensor(image, dtype=tf.uint8)
      ts = vidcap.get(cv2.CAP_PROP_POS_MSEC)
      if bool(args.verbose):
        print('process frame: {:.0f}'.format(count), 'timestamp: {:.0f}'.format(ts))
      detections, poses3d, poses2d, joints, edges = predict(tensor, ts)
    count = count + 1
  print('video processed:', '{:.0f} frames'.format(count), 'in {:.1f}sec'.format(now() - t0))


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
  a.add_argument('--image',         type=str,                    help='image file')
  a.add_argument('--video',         type=str,                    help='video file')
  a.add_argument('--json',          type=str,                    help='write results to json file')
  a.add_argument('--verbose',       type=strtobool, default=1,   help='verbose logging')
  a.add_argument('--model',         type=str,       default='models/metrabs_mob3l_y4t', help='model used for predictions')
  a.add_argument('--skipms',        type=int,       default=0,   help='skip time between frames in miliseconds')
  a.add_argument('--plot',          type=strtobool, default=0,   help='plot output when processing image')
  a.add_argument('--fov',           type=int,       default=55,  help='field-of-view in degrees')
  a.add_argument('--batch',         type=int,       default=64,  help='process n detected people in parallel')
  a.add_argument('--maxpeople',     type=int,       default=-1,  help='limit processing to n people in the scene')
  a.add_argument('--skeleton',      type=str,       default='',  help='use specific skeleton definition standard')
  a.add_argument('--augmentations', type=int,       default=5,   help='how many variations of detection to run')
  a.add_argument('--average',       type=strtobool, default=1,   help='run avarage on augmentation variations')
  a.add_argument('--suppress',      type=strtobool, default=1,   help='suppress implausible poses')
  a.add_argument('--minconfidence', type=float,     default=0.3, help='minimum detection confidence')
  a.add_argument('--iou',           type=float,     default=0.7, help='iou threshold for overlaps')
  args = a.parse_args()
  print('options:', args.__dict__)
  res.options = vars(args)
  if args.image is not None:
    loadModel()
    predictImage(args.image)
  elif args.video is not None:
    loadModel()
    predictVideo(args.video)
  else:
    print('error: image or video not specified')
  if args.json is not None:
    obj = json.dumps(res.__dict__, indent = 2)
    with open(args.json, "w") as outfile:
      outfile.write(obj)
      print('results written to:', args.json)
