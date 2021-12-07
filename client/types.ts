export type Box = [number, number, number, number, number];
export type Point2D = [number, number];
export type Point3D = [number, number, number];
export type Pose = Point3D[];
export type Edge = [number, number];
export type Joint = string;

export type Result = null | {
  options: { // options used during processing
    image: string,
    video: string,
    model: string,
    augmentations: number,
    average: number,
    batch: number,
    fov: number,
    iou: number,
    maxpeople: number,
    minconfidence: number,
    skipms: number,
    suppress: number,
  },
  frames: number, // total number of rendered frames
  resolution: [number, number],
  edges: Edge[], // each edge instruct which points to connect to create a joint
  joints: Joint[], // names of each joint
  boxes: Box[][], // frame x body x [left, top, width, height, confidence]
  poses: Pose[][], // frame x body x pose [pose is a array of points]
  timestamps: number[], // timestamp of each frame
}
