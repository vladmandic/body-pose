import * as BABYLON from 'babylonjs';
import 'babylonjs-inspector';
import { Scene } from './scene';
import { skeletons } from './constants';
import type { Result, Joint, Edge, Point3D, Pose } from './types';

let t: Scene;
let tubes: Record<string, BABYLON.Mesh> = {};

async function body(frame: number, poses: Point3D[][][], edges: Array<Edge>, joints: Array<Joint>, canvas: HTMLCanvasElement, skeleton: string) {
  if (!poses[frame]) return;
  let repositioned = false;
  for (let person = 0; person < poses[frame].length; person++) {
    const filtered = edges.filter((_edge, i) => { // TBD: this should be preprocessed and not inside a loop
      if (joints[i] === skeletons[skeleton].joints[i]) return true; // exact match
      if (joints[i].endsWith(skeletons[skeleton].suffix)) { // skeleton name match
        const joint = joints[i].substring(0, joints[i].indexOf('_')); // find original joint name without suffix
        return skeletons[skeleton].joints.includes(joint); // does target skeleton contain joint
      }
      return false;
    });
    filtered.length = skeletons[skeleton].edges.length;
    for (let i = 0; i < filtered.length; i++) {
      const pose: Pose = poses[frame][person];
      const part = `${joints[i]}${person}`;
      const pt0 = new BABYLON.Vector3(pose[edges[i][0]][0] / canvas.width, 1 - pose[edges[i][0]][1] / canvas.height, 2 * pose[edges[i][0]][2] / (canvas.width + canvas.height));
      const pt1 = new BABYLON.Vector3(pose[edges[i][1]][0] / canvas.width, 1 - pose[edges[i][1]][1] / canvas.height, 2 * pose[edges[i][1]][2] / (canvas.width + canvas.height));
      const path = [pt0, pt1];
      const radius = skeleton === 'all' ? 0.02 : 0.04; // thinner tubes when drawing all skeletons overlaid
      if (!tubes[part] || tubes[part].isDisposed()) { // body part seen for the first time
        tubes[part] = BABYLON.MeshBuilder.CreateTube(`pose-${part}`, { path, radius, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, t.scene);
        tubes[part].material = t.material;
        t.shadows.addShadowCaster(tubes[part], false); // add shadow to new tube
      } else { // updating existing body part
        tubes[part] = BABYLON.MeshBuilder.CreateTube(`pose-${part}`, { path, radius, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE, instance: tubes[part] }, t.scene); // update existing tube
      }
      if (joints[i] === 'neck' && !repositioned) { // reposition camera to look at primary person
        t.camera.target = pt0;
        repositioned = true;
      }
    }
  }
}

export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement, skeleton: string) {
  if (!t || t.scene.isDisposed) t = new Scene(canvas);
  if (!json || frame === null) return;
  body(frame, json.poses, json.edges, json.joints, canvas, skeleton);
}

export async function dispose() {
  if (!t || !t.scene || !t.scene.meshes) return;
  t.scene.dispose();
  tubes = {};
}
