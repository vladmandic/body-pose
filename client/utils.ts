import * as BABYLON from '@babylonjs/core';
import type { Point3D, Pose } from './types';
import type { PoseScene } from './scene';

export const dom = { // pointers to dom objects
  video: document.getElementById('input-video') as HTMLVideoElement,
  image: document.getElementById('input-image') as HTMLImageElement,
  status: document.getElementById('status') as HTMLPreElement,
  log: document.getElementById('log') as HTMLPreElement,
  output: document.getElementById('output') as HTMLCanvasElement,
  sample: document.getElementById('input') as HTMLSelectElement,
  skeleton: document.getElementById('skeleton') as HTMLSelectElement,
  split: document.getElementById('split') as HTMLInputElement,
  options: document.getElementById('options') as HTMLDivElement,
  animate: document.getElementById('animate') as HTMLButtonElement,
  center: document.getElementById('center') as HTMLButtonElement,
  bone: document.getElementById('bone') as HTMLInputElement,
  joint: document.getElementById('joint') as HTMLInputElement,
};

export const log = (...msg: unknown[]) => {
  dom.log.innerText += msg.join(' ') + '\n';
  dom.log.scrollTop = dom.log.scrollHeight;
  console.log(...msg);
};

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
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.x', 60, 60 * ms / 1000, camera.target.x, target.x, 0, new BABYLON.SineEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.y', 60, 60 * ms / 1000, camera.target.y, target.y, 0, new BABYLON.SineEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'target.z', 60, 60 * ms / 1000, camera.target.z, target.z, 0, new BABYLON.SineEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'position.x', 60, 60 * ms / 1000, camera.position.x, position.x, 0, new BABYLON.SineEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'position.y', 60, 60 * ms / 1000, camera.position.y, position.y, 0, new BABYLON.SineEase());
  BABYLON.Animation.CreateAndStartAnimation('camera', camera, 'position.z', 60, 60 * ms / 1000, camera.position.z, position.z, 0, new BABYLON.SineEase());
}

export function centerCamera(camera: BABYLON.ArcRotateCamera, ms: number, poses: Pose[][]) {
  const range = maxmin(poses);
  const position = { x: (range.max[0] - range.min[0]) / 2 + range.min[0], y: (range.max[1] - range.min[1]) / 2, z: (range.max[2] - range.min[2]) / 2 };
  const target = { x: 0, y: 2, z: -12 };
  moveCamera(camera, ms, position, target);
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

export async function attachControls(poseScene: PoseScene) {
  const ground = poseScene.scene.meshes.find((mesh) => mesh.name === 'BackgroundPlane');
  if (ground) ground!.isPickable = false;
  const skybox = poseScene.scene.meshes.find((mesh) => mesh.name === 'BackgroundSkybox');
  if (skybox) skybox!.isPickable = false;
  const skin = poseScene.scene.meshes.find((mesh) => mesh.name === 'mixamorig:Skin');
  if (skin) skin!.isPickable = false;
  poseScene.scene.onPointerObservable.add((pointerInfo) => {
    const getGroundPosition = () => {
      const pickinfo = poseScene.scene.pick(poseScene.scene.pointerX, poseScene.scene.pointerY, (mesh) => mesh === ground);
      if (pickinfo && pickinfo.hit) return pickinfo.pickedPoint;
      return null;
    };

    const pointerDown = (mesh: BABYLON.Mesh) => {
      poseScene.currentMesh = mesh;
      poseScene.pointerPosition = getGroundPosition();
      if (poseScene.pointerPosition) poseScene.camera.detachControl();
    };

    const pointerUp = () => {
      if (poseScene.pointerPosition) poseScene.camera.attachControl(poseScene.canvas, true);
      poseScene.pointerPosition = null;
    };

    const pointerMove = () => {
      const pickinfo = poseScene.scene.pick(poseScene.scene.pointerX, poseScene.scene.pointerY, (mesh) => (mesh !== ground && mesh !== skybox && mesh !== skin));
      if (pickinfo && pickinfo.hit) {
        if (pickinfo.pickedMesh !== poseScene.hoverMesh) {
          poseScene.hoverMesh = pickinfo.pickedMesh as BABYLON.Mesh;
          poseScene.highlight.removeAllMeshes();
          poseScene.highlight.addMesh(poseScene.hoverMesh, BABYLON.Color3.Black(), true);
          const position = [];
          if (poseScene.hoverMesh.position.x !== 0) position.push(poseScene.hoverMesh.position.x.toFixed(2), poseScene.hoverMesh.position.y.toFixed(2), poseScene.hoverMesh.position.z.toFixed(2));
          dom.status.innerText = `${poseScene.hoverMesh.name}: ${position.join(',')}`;
        }
      } else {
        if (poseScene.hoverMesh) {
          poseScene.highlight.removeMesh(poseScene.hoverMesh);
          poseScene.hoverMesh = null;
        }
      }
      if (!poseScene.pointerPosition || !poseScene.currentMesh) return;
      const currentPosition = getGroundPosition();
      if (!currentPosition) return;
      const diff = currentPosition.subtract(poseScene.pointerPosition);
      poseScene.currentMesh.position.addInPlace(diff);
      poseScene.pointerPosition = currentPosition;
    };

    switch (pointerInfo.type) {
      case BABYLON.PointerEventTypes.POINTERDOWN:
        if (pointerInfo.pickInfo && pointerInfo.pickInfo.hit
          && pointerInfo.pickInfo.pickedMesh !== ground
          // && pointerInfo.pickInfo.pickedMesh !== skybox
          && pointerInfo.pickInfo.pickedMesh !== skin) pointerDown(pointerInfo.pickInfo.pickedMesh as BABYLON.Mesh);
        break;
      case BABYLON.PointerEventTypes.POINTERUP:
        pointerUp();
        break;
      case BABYLON.PointerEventTypes.POINTERMOVE:
        pointerMove();
        break;
      default:
    }
  });
}
