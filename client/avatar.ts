import * as BABYLON from 'babylonjs';
import 'babylonjs-inspector';
import { PoseScene } from './scene';
import * as utils from './utils';
import type { Result, Pose, Point3D } from './types';

let t: PoseScene | null;
let skeletons: Array<BABYLON.Skeleton | null> = [];

export const getScene = () => t;
const getBone = (skeleton: BABYLON.Skeleton, name: string): (BABYLON.Bone | undefined) => skeleton?.bones.find((bone) => bone.name === name) as BABYLON.Bone;

export async function loadSkeleton(person: number): Promise<BABYLON.Skeleton> {
  const modelUrl = 'ybot.babylon';
  return new Promise((resolve) => {
    BABYLON.SceneLoader.ImportMesh('', '../assets/', modelUrl, t ? t.scene as BABYLON.Scene : null, (_skeletonMeshes, _skeletonParticles, skeleton) => {
      if (t && skeleton && skeleton.length > 0) {
        skeleton[person].name = 'ybot' + person;
        skeleton[person].bones.forEach((bone) => { bone.name = bone.name.replace('mixamorig:', ''); }); // remap names from ybot
        skeleton[person].returnToRest();
        const ybot = t.scene.meshes.find((mesh) => (mesh.name === 'YBot') || (mesh.name === 'him')) as BABYLON.Mesh;
        t.shadows.addShadowCaster(ybot, true);
        const hips = getBone(skeleton[0], 'Hips') as BABYLON.Bone;
        if (hips) hips.rotation = new BABYLON.Vector3(0, Math.PI, 0); // rotate to face camera
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
    const ik = (boneName: string, target: Point3D, poleTarget: Point3D) => {
      const bone = skeletons[person]!.bones.find((b) => b.name === boneName) as BABYLON.Bone;
      const ikTarget = BABYLON.MeshBuilder.CreateBox(`${boneName}-target`, { size: 0.03 }, t!.scene);
      ikTarget.position = new BABYLON.Vector3(1.6 * -target[0], 1.6 * target[1], -target[2]);
      ikTarget.parent = skeletonMesh;
      // ikTarget.setEnabled(false);
      // ikTarget.addBehavior(new BABYLON.PointerDragBehavior());
      const ikPoleTarget = BABYLON.MeshBuilder.CreateSphere(`${boneName}-poleTarget`, { diameter: 0.03 }, t!.scene);
      ikPoleTarget.position = new BABYLON.Vector3(1.6 * -poleTarget[0], 1.6 * poleTarget[1], -poleTarget[2]);
      ikPoleTarget.parent = skeletonMesh;
      // ikPoleTarget.setEnabled(false);
      // ikPoleTarget.addBehavior(new BABYLON.PointerDragBehavior());
      const ikCtl = new BABYLON.BoneIKController(skeletonMesh, bone, { targetMesh: ikTarget, poleTargetMesh: ikPoleTarget });
      ikCtl.update();
      // t!.scene.registerBeforeRender(() => ikCtl.update());
      console.log({ boneName, target, poleTarget });
    };
    // ik('LeftShoulder', pose[17], pose[14]);
    ik('LeftArm', pose[19], pose[17]);
    ik('LeftForeArm', pose[21], pose[19]);
    ik('LeftHand', pose[23], pose[21]);
  }
}

export async function animate() {
  // tbd
}

export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement) {
  if (!json || frame === null) return;
  if (!t || t.scene.isDisposed) {
    const fov = utils.fov(json.poses);
    t = new PoseScene(canvas, fov, 1000); // create new scene
    t.camera.radius *= 3;
  }
  body(frame || 0, json.poses);
  setTimeout(() => utils.centerCamera((t as PoseScene).camera, 1000, json.poses), 1000);
  // utils.attachControls(t);
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
