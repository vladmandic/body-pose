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

export const skeletons = [
  'smpl_24', // SMPL body model
  'coco_19', // COCO joints including pelvis at the midpoint of the hips and neck at the midpoint of the shoulders as in CMU-Panoptic.
  'h36m_17', // Most common Human3.6M joint convention
  'h36m_25', // Extended Human3.6M joint set
  'mpi_inf_3dhp_17', // MPI-INF-3DHP main joints (same as the MuPoTS joints)
  'mpi_inf_3dhp_28', // full MPI-INF-3DHP joint set
  'smpl+head_30', // SMPL joints plus face keypoints from COCO and the head top from MPI-INF-3DHP (recommended for visualization as SMPL_24 has no face keypoints).
  '', // All the joints that the model was trained on.
];

export const parts: Record<string, string[]> = {
  all: [], // use all keypoints
  smpl: [ // smpl 24 keypoints
    'lhip',
    'rhip',
    'bell',
    'lkne',
    'rkne',
    'spin',
    'lank',
    'rank',
    'thor',
    'ltoe',
    'rtoe',
    'neck',
    'lcla',
    'rcla',
    'head',
    'lsho',
    'rsho',
    'lelb',
    'relb',
    'lwri',
    'rwri',
    'lhan',
    'rhan',
    'pelv',
  ],
  h36m: [ // human 3.6m 24 keypoints
    'head_h36m',
    'htop_h36m',
    'lank_h36m',
    'lelb_h36m',
    'lfin_h36m',
    'lfoo_h36m',
    'lhip_h36m',
    'lkne_h36m',
    'lsho_h36m',
    'lthu_h36m',
    'ltoe_h36m',
    'lwri_h36m',
    'neck_h36m',
    'pelv_h36m',
    'rank_h36m',
    'relb_h36m',
    'rfin_h36m',
    'rfoo_h36m',
    'rhip_h36m',
    'rkne_h36m',
    'rsho_h36m',
    'rthu_h36m',
    'rtoe_h36m',
    'rwri_h36m',
  ],
  salivos: [ // sailvos 25 keypoints
    'head_sailvos',
    'htop_sailvos',
    'lank_sailvos',
    'lear_sailvos',
    'lelb_sailvos',
    'leye_sailvos',
    'lhan_sailvos',
    'lhip_sailvos',
    'lkne_sailvos',
    'lsho_sailvos',
    'ltoe_sailvos',
    'lwri_sailvos',
    'neck_sailvos',
    'nose_sailvos',
    'pelv_sailvos',
    'rank_sailvos',
    'rear_sailvos',
    'relb_sailvos',
    'reye_sailvos',
    'rhan_sailvos',
    'rhip_sailvos',
    'rkne_sailvos',
    'rsho_sailvos',
    'rtoe_sailvos',
    'rwri_sailvos',
  ],
  cmu: [ // cmu panoptic 19 keypoints
    'lank_cmu_panoptic',
    'lear_cmu_panoptic',
    'lelb_cmu_panoptic',
    'leye_cmu_panoptic',
    'lhip_cmu_panoptic',
    'lkne_cmu_panoptic',
    'lsho_cmu_panoptic',
    'lwri_cmu_panoptic',
    'neck_cmu_panoptic',
    'nose_cmu_panoptic',
    'pelv_cmu_panoptic',
    'rank_cmu_panoptic',
    'rear_cmu_panoptic',
    'relb_cmu_panoptic',
    'reye_cmu_panoptic',
    'rhip_cmu_panoptic',
    'rkne_cmu_panoptic',
    'rsho_cmu_panoptic',
    'rwri_cmu_panoptic',
  ],
  muco: [ // muco 24 keypoints
    'head_muco',
    'htop_muco',
    'lank_muco',
    'lcla_muco',
    'lelb_muco',
    'lfoo_muco',
    'lhan_muco',
    'lhip_muco',
    'lkne_muco',
    'lsho_muco',
    'ltoe_muco',
    'lwri_muco',
    'neck_muco',
    'pelv_muco',
    'rank_muco',
    'rcla_muco',
    'relb_muco',
    'rfoo_muco',
    'rhan_muco',
    'rhip_muco',
    'rkne_muco',
    'rsho_muco',
    'rtoe_muco',
    'rwri_muco',
  ],
};
