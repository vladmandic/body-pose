import * as BABYLON from 'babylonjs';
import { Scene } from './scene';
import { parts } from './types';
import type { Result, Joint, Edge, Point3D } from './types';

let t: Scene;
let tubes: Record<string, BABYLON.Mesh> = {};

async function body(frame: number, edges: Edge[], joints: Joint[], poses: Point3D[][][], canvas: HTMLCanvasElement, skeleton: string) {
  if (!t.pose || t.pose.isDisposed()) t.pose = BABYLON.MeshBuilder.CreateBox('pose', {}, t.scene);
  for (const pose of poses[frame]) {
    for (let i = 0; i < edges.length; i++) {
      const part = joints[i];
      if (skeleton !== 'all' && !parts[skeleton].includes(part)) continue;
      const pt0 = new BABYLON.Vector3(pose[edges[i][0]][0] / canvas.width, 1 - pose[edges[i][0]][1] / canvas.height, 2 * pose[edges[i][0]][2] / (canvas.width + canvas.height));
      const pt1 = new BABYLON.Vector3(pose[edges[i][1]][0] / canvas.width, 1 - pose[edges[i][1]][1] / canvas.height, 2 * pose[edges[i][1]][2] / (canvas.width + canvas.height));
      const path = [pt0, pt1];
      if (!tubes[part] || !tubes[part].isDisposed()) { // body part seen for the first time
        tubes[part] = BABYLON.MeshBuilder.CreateTube(`pose-${part}`, { path, radius: 0.02, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, t.scene);
        tubes[part].parent = t.pose;
        tubes[part].material = t.material;
        t.shadows.addShadowCaster(tubes[part], false); // add shadow to new tube
      } else { // updating existing body part
        tubes[part] = BABYLON.MeshBuilder.CreateTube(`pose-${part}`, { path, radius: 0.015, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE, instance: tubes[part] }, t.scene); // update existing tube
      }
    }
  }
}

export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement, skeleton: string) {
  if (!t || t.scene.isDisposed) t = new Scene(canvas);
  if (!json || frame === null) return;
  body(frame, json.edges, json.joints, json.poses, canvas, skeleton);
}

export async function dispose() {
  if (!t || !t.scene || !t.scene.meshes) return;
  t.scene.dispose();
  tubes = {};
}
