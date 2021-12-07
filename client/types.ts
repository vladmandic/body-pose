export type Box = [number, number, number, number, number]; // [x, y, width, height, confidence]
export type Joint = string; // joint name corresponding to a point
export type Point2D = [number, number]; // [x, y]
export type Point3D = [number, number, number]; // [x, y, z]
export type Pose = Point3D[]; // complete set of points in the pose
export type Edge = [number, number]; // edge is defined by a pair of points defined in pose

export type Skeleton = { // each skeleton type defines different joints and edges
  joints: Array<Joint>,
  edges: Array<Edge>,
  suffix: string, // joints suffix to filter by when using `all` skeleton output
}

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
    skeleton: string,
  },
  frames: number, // total number of rendered frames
  resolution: [number, number], // input resolution in pixels
  edges: Array<Edge>, // defined in model output as well as in `constants.ts`
  joints: Array<Joint>, // defined in model output as well as in `constants.ts`
  boxes: Array<Box[]>, // frame x body x [left, top, width, height, confidence]
  poses: Array<Pose[]>, // frame x body x pose [pose is a array of points]
  timestamps: Array<number>, // timestamp of each frame
}
