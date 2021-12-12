import * as BABYLON from 'babylonjs';
import 'babylonjs-inspector';
import { PoseScene } from './scene';
import * as utils from './utils';
import type { Result, Pose } from './types';

let t: PoseScene | null;
let persons: Array<BABYLON.Skeleton | null> = [];

const getBone = (skeleton: BABYLON.Skeleton, name: string): (BABYLON.Bone | undefined) => skeleton?.bones.find((bone) => bone.name === name) as BABYLON.Bone;

export async function load(): Promise<BABYLON.Skeleton | null> {
  if (!t) return null;
  const modelUrl = '../assets/ybot.babylon';
  return new Promise((resolve) => {
    BABYLON.SceneLoader.ImportMesh('', '', modelUrl, t ? t.scene as BABYLON.Scene : null, (_meshes, _particles, skel) => {
      if (t && skel && skel.length > 0) {
        skel[0].name = 'ybot';
        skel[0].bones.forEach((bone) => { bone.name = bone.name.replace('mixamorig:', ''); }); // remap names from ybot
        skel[0].returnToRest();
        const ybot = t.scene.meshes.find((mesh) => mesh.name === 'YBot') as BABYLON.Mesh;
        t.shadows.addShadowCaster(ybot, true);
        const hips = getBone(skel[0], 'Hips') as BABYLON.Bone;
        hips.rotation = new BABYLON.Vector3(0, Math.PI, 0); // rotate to face camera
        resolve(skel[0]);
      }
    });
  });
}

async function body(poses: Pose[]) {
  if (!poses || !t) return;
  for (let person = 0; person < poses.length; person++) {
    if (!persons[person]) persons[person] = await load();
    if (!persons[person]) continue;
    const pose = poses[person];
    const skeleton = persons[person];
    if (!skeleton) continue;
    console.log({ pose, skeleton });
    // @ts-ignore;
    window.pose = pose; window.skeleton = skeleton;
    const bones = skeleton.bones.map((bone) => bone.name);
    console.log({ bones });
    /*
    for (let i = 0; i < filtered.length; i++) {
      const pose: Pose = poses[frame][person];
      const pt0 = new BABYLON.Vector3(pose[edges[i][0]][0], pose[edges[i][0]][1], pose[edges[i][0]][2]);
      const pt1 = new BABYLON.Vector3(pose[edges[i][1]][0], pose[edges[i][1]][1], pose[edges[i][1]][2]);
      const distance = BABYLON.Vector3.Distance(pt0, pt1); // edge length
      const depth = Math.min(Math.sqrt(Math.abs(1 / (pt0.z + 0.5))), 2); // z-distance of a point
    }
    */
  }
}

export async function animate() {
  //
}

export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement) {
  if (!json || frame === null) return;
  if (!t || t.scene.isDisposed) {
    const fov = utils.fov(json.poses);
    t = new PoseScene(canvas, fov); // create new scene
    t.camera.radius *= 3;
  }
  body(json.poses[frame]);
}

export async function inspect() {
  if (t && t.scene) t.inspector();
}

export async function dispose() {
  if (!t || !t.scene || !t.scene.meshes) return;
  t.scene.dispose();
  t.engine.resize();
  t = null;
  persons = [];
}
