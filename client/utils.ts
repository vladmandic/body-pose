import * as BABYLON from 'babylonjs';
import type { Point3D, Pose } from './types';

export function maxmin(poses: Pose[][]): { max: [number, number, number], min: [number, number, number] } {
  const min: Point3D = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  const max: Point3D = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
  for (let j = 0; j < poses[0].length; j++) { // find min/max of all poses/joints based on first frame
    for (let k = 0; k < poses[0][j].length; k++) {
      for (let l = 0; l < poses[0][j][k].length; l++) {
        if (poses[0][j][k][l] < min[l]) min[l] = poses[0][j][k][l];
        if (poses[0][j][k][l] > max[l]) max[l] = poses[0][j][k][l];
      }
    }
  }
  return { max, min };
}

export async function normalize(poses: Pose[][], scale: number): Promise<Pose[][]> { // frame x body x pose
  const orig = maxmin(poses);
  const norm = Math.max(orig.max[0] - orig.min[0], orig.max[1] - orig.min[1], orig.max[2] - orig.min[2]) / scale;
  for (let i = 0; i < poses.length; i++) { // rescale and invert coordinates // frames
    for (let j = 0; j < poses[i].length; j++) { // poses
      for (let k = 0; k < poses[i][j].length; k++) { // joints
        poses[i][j][k] = [
          (poses[i][j][k][0]) / scale / norm,
          (orig.max[1] - poses[i][j][k][1]) / scale / norm,
          (poses[i][j][k][2] - orig.min[2]) / scale * 1.5 / norm,
        ];
      }
    }
  }
  return poses;
}

export function fov(poses: Pose[][]): number {
  const scaled = maxmin(poses);
  const res = 10 * Math.sqrt(((scaled.max[0] - scaled.min[0]) ** 2) + ((scaled.max[1] - scaled.min[1]) ** 2));
  return res;
}

export function moveCamera(camera: BABYLON.ArcRotateCamera, x: number, y: number, z: number, ms: number) {
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.x', 60, 60 * ms / 1000, camera.target.x, x, 0, new BABYLON.BackEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.y', 60, 60 * ms / 1000, camera.target.y, y, 0, new BABYLON.BackEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.z', 60, 60 * ms / 1000, camera.target.z, z, 0, new BABYLON.BackEase());
}
