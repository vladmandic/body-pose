import * as BABYLON from 'babylonjs';
import 'babylonjs-inspector';
import { PoseScene } from './scene';
import { fov, attachControls, centerCamera } from './utils';
import type { Result, Pose, Point3D } from './types';

let t: PoseScene | null;
let skeletons: Array<BABYLON.Skeleton | null> = [];

const config = {
  showAnchors: true,
  position: false,
  rotation: false,
  scale: false,
  useIK: false,
  useLook: false,
};

export const getScene = () => t;
const getBone = (skeleton: BABYLON.Skeleton, name: string): (BABYLON.Bone | undefined) => skeleton?.bones.find((bone) => bone.name === name) as BABYLON.Bone;

export async function loadSkeleton(person: number): Promise<BABYLON.Skeleton> {
  const modelUrl = 'ybot.babylon';
  return new Promise((resolve) => {
    BABYLON.SceneLoader.ImportMesh('', '../assets/', modelUrl, t ? t.scene as BABYLON.Scene : null, (_skeletonMeshes, _skeletonParticles, skeleton) => {
      if (t && skeleton && skeleton.length > 0) {
        skeletons[person] = skeleton[0];
        skeletons[person]!.name = 'ybot' + person;
        skeletons[person]!.bones.forEach((bone) => { bone.name = bone.name.replace('mixamorig:', ''); }); // remap names from ybot
        skeletons[person]!.returnToRest();
        const ybot = t.scene.meshes.find((mesh) => (mesh.name === 'YBot') || (mesh.name === 'him')) as BABYLON.Mesh;
        t.shadows.addShadowCaster(ybot, true);
        const hips = getBone(skeleton[0], 'Hips') as BABYLON.Bone;
        if (hips) hips.rotation = new BABYLON.Vector3(0, Math.PI, 0); // rotate to face camera
        // debug view
        // const skeletonViewer = new BABYLON.SkeletonViewer(skeleton[0], _skeletonMeshes[0], t.scene);
        // skeletonViewer.displayMode = BABYLON.SkeletonViewer.DISPLAY_SPHERE_AND_SPURS;
        // skeletonViewer.update();
        // skeletonViewer.color = BABYLON.Color3.Green();
        resolve(skeleton[0]);
      }
    });
  });
}

async function body(frame: number, poses: Pose[][]) {
  if (!poses[frame] || !t) return;
  for (let person = 0; person < poses[frame].length; person++) {
    if (!skeletons[person]) skeletons[person] = await loadSkeleton(person);
    const pose = poses[frame][person];
    const skeletonMesh = t!.scene.meshes.find((m) => (m.name === 'YBot') || (m.name === 'him')) as BABYLON.Mesh;

    const position = () => {
      const bone = skeletons[person]!.bones.find((b) => b.name === 'Hips') as BABYLON.Bone;
      const hips = new BABYLON.Vector3(pose[0][0], 0.9 /* pose[0][1] */, pose[0][2]);
      bone.setPosition(hips);
    };

    const scale = () => {
      const bone = skeletons[person]!.bones.find((b) => b.name === 'Hips') as BABYLON.Bone;
      const fact = new BABYLON.Vector3(0.8, 0.9, 0.8);
      bone.setScale(fact);
    };

    const rotate = () => {
      // const radians = (a1: number, a2: number, b1: number, b2: number) => Math.atan2(b2 - a2, b1 - a1);
      const bone = skeletons[person]!.bones.find((b) => b.name === 'Hips') as BABYLON.Bone;
      const x = 0;
      const y = 0;
      const z = 0;
      bone.setRotation(new BABYLON.Vector3(0, Math.PI, 0));
      console.log({ x, y, z });
    };

    const ik = (boneName: string, target: Point3D, poleTarget: Point3D) => {
      const bone = skeletons[person]!.bones.find((b) => b.name === boneName) as BABYLON.Bone;
      const ikTarget = BABYLON.MeshBuilder.CreateBox(`${boneName}-target`, { size: 0.03 }, t!.scene);
      ikTarget.position = new BABYLON.Vector3(1.6 * -target[0], 1.6 * target[1], target[2]);
      ikTarget.parent = skeletonMesh;
      ikTarget.setEnabled(config.showAnchors);
      // ikTarget.addBehavior(new BABYLON.PointerDragBehavior());
      const ikPoleTarget = BABYLON.MeshBuilder.CreateSphere(`${boneName}-poleTarget`, { diameter: 0.03 }, t!.scene);
      ikPoleTarget.position = new BABYLON.Vector3(1.6 * -poleTarget[0], 1.6 * poleTarget[1], poleTarget[2]);
      ikPoleTarget.parent = skeletonMesh;
      ikPoleTarget.setEnabled(config.showAnchors);
      ikPoleTarget.addBehavior(new BABYLON.PointerDragBehavior());
      const ikCtl = new BABYLON.BoneIKController(skeletonMesh, bone, { targetMesh: ikTarget, poleTargetMesh: ikPoleTarget });
      t!.scene.registerBeforeRender(() => ikCtl.update());
    };

    const look = (boneName: string, target: Point3D) => {
      const bone = skeletons[person]!.bones.find((b) => b.name === boneName) as BABYLON.Bone;
      const lookTarget = BABYLON.MeshBuilder.CreateBox(`${boneName}-target`, { size: 0.03 }, t!.scene);
      lookTarget.position = new BABYLON.Vector3(1.6 * -target[0], 1.6 * target[1], target[2]);
      lookTarget.parent = skeletonMesh;
      lookTarget.setEnabled(config.showAnchors);
      // lookTarget.addBehavior(new BABYLON.PointerDragBehavior());
      const yawDirection = boneName.startsWith('Right') ? -1 : 1;
      const adjustYaw = yawDirection * Math.PI / 2;
      const lookCtl = new BABYLON.BoneLookController(skeletonMesh, bone, lookTarget.position, { slerpAmount: 0.5, adjustYaw, adjustPitch: 0, adjustRoll: 0 });
      t!.scene.registerBeforeRender(() => lookCtl.update());
    };

    if (config.position) position();
    if (config.scale) scale();
    if (config.rotation) rotate();

    if (config.useIK) {
      ik('LeftShoulder', pose[17], pose[14]);
      ik('LeftArm', pose[19], pose[17]);
      ik('LeftForeArm', pose[21], pose[19]);
      ik('LeftHand', pose[23], pose[21]);
    }

    if (config.useLook) {
      look('Hips', pose[0]);
      look('Spine', pose[3]);
      look('Spine1', pose[6]);
      look('Spine2', pose[9]);
      look('Neck', pose[12]);
      look('Head', pose[15]);
      look('LeftEye', pose[29]);
      look('RightEye', pose[26]);
      look('RightShoulder', pose[16]);
      look('LeftShoulder', pose[17]);
      look('RightArm', pose[18]);
      look('LeftArm', pose[19]);
      look('RightForeArm', pose[20]);
      look('LeftForeArm', pose[21]);
      look('RightHand', pose[22]);
      look('LeftHand', pose[23]);
      look('RightUpLeg', pose[1]);
      look('RightLeg', pose[4]);
      look('RightFoot', pose[7]);
      look('RightToeBase', pose[10]);
      look('LeftUpLeg', pose[2]);
      look('LeftLeg', pose[5]);
      look('LeftFoot', pose[8]);
      look('LeftToeBase', pose[11]);
    }
  }
}

export async function animate() {
  // tbd
}

export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement) {
  if (!json || frame === null) return;
  if (!t || t.scene.isDisposed) {
    const f = fov(json.poses);
    t = new PoseScene(canvas, f, 1000); // create new scene
    t.camera.radius *= 3;
  }
  await body(frame || 0, json.poses);
  setTimeout(() => centerCamera((t as PoseScene).camera, 1000, json.poses), 1000);
  attachControls(t);
}

export async function inspect() {
  if (t && t.scene) t.inspector();
}

export async function dispose() {
  if (!t || !t.scene || !t.scene.meshes) return;
  t.scene.dispose();
  t.engine.resize();
  t = null;
  skeletons = [];
}

/*
How to pose an Avatar?

- hips is root bone for entire skeleton
- pose points are in `/assets/smpl-head-30.jpg`
- note that skeleton vs pose is inverted
- Set position of hips bone on
  - either based average of pose[1], pose[2] or based on pose[0]
- set scale of hips bone
- Set rotation of hips bone based on euler angles of pose[1], pose[2]
- set target direction for each bone
  - either by setting look controller or by setting ik controller
  - each bone maps to pose point
  - may need to set adjustYaw, adjustPitch, adjustRoll based on orientation
*/
