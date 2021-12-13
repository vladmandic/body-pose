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

export function moveCamera(camera: BABYLON.ArcRotateCamera, ms: number, target: { x: number, y: number, z: number }, position: { x: number, y: number, z: number }) {
  console.log({ position, target });
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.x', 60, 60 * ms / 1000, camera.target.x, target.x, 0, new BABYLON.BackEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.y', 60, 60 * ms / 1000, camera.target.y, target.y, 0, new BABYLON.BackEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.z', 60, 60 * ms / 1000, camera.target.z, target.z, 0, new BABYLON.BackEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'position.x', 60, 60 * ms / 1000, camera.position.x, position.x, 0, new BABYLON.BackEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'position.y', 60, 60 * ms / 1000, camera.position.y, position.y, 0, new BABYLON.BackEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'position.z', 60, 60 * ms / 1000, camera.position.z, position.z, 0, new BABYLON.BackEase());
  setTimeout(() => {
    camera.target = new BABYLON.Vector3(target.x, target.y, target.z);
    camera.position = new BABYLON.Vector3(position.x, position.y, position.z);
  }, 25 + ms / 1000);
}

export const angles = (pt0: Point3D, pt1: Point3D, pt2: Point3D): BABYLON.Vector3 => {
  // @ts-ignore
  let thetaX: number;
  let thetaY: number;
  let thetaZ: number;
  if (pt1[0] < 1) { // YZX calculation
    if (pt1[0] > -1) {
      thetaZ = Math.asin(pt1[0]);
      thetaY = Math.atan2(-pt2[0], pt0[0]);
      thetaX = Math.atan2(-pt1[2], pt1[1]);
    } else {
      thetaZ = -Math.PI / 2;
      thetaY = -Math.atan2(pt2[1], pt2[2]);
      thetaX = 0;
    }
  } else {
    thetaZ = Math.PI / 2;
    thetaY = Math.atan2(pt2[1], pt2[2]);
    thetaX = 0;
  }
  if (Number.isNaN(thetaX)) thetaX = 0;
  if (Number.isNaN(thetaY)) thetaY = 0;
  if (Number.isNaN(thetaZ)) thetaZ = 0;
  const pitch = 2 * -thetaX;
  const yaw = 2 * -thetaY;
  const roll = 2 * -thetaZ;
  return new BABYLON.Vector3(pitch, yaw, roll);
};
