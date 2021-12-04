import * as BABYLON from 'babylonjs';
import * as environment from './environment';
import type { Result, Joint, Edge, Point3D } from './types';
import { parts } from './types';

let t: environment.Scene;
const tubes: Record<string, BABYLON.Mesh> = {};

const skeleton = 'smpl';

async function body(frame: number, edges: Edge[], joints: Joint[], poses: Point3D[][][], canvas: HTMLCanvasElement) {
  for (const pose of poses[frame]) {
    for (let i = 0; i < edges.length; i++) {
      const part = joints[i];
      if (!parts[skeleton].includes(part)) continue;
      const pt0 = new BABYLON.Vector3(pose[edges[i][0]][0] / canvas.width, 1 - pose[edges[i][0]][1] / canvas.height, 2 * pose[edges[i][0]][2] / (canvas.width + canvas.height));
      const pt1 = new BABYLON.Vector3(pose[edges[i][1]][0] / canvas.width, 1 - pose[edges[i][1]][1] / canvas.height, 2 * pose[edges[i][1]][2] / (canvas.width + canvas.height));
      const path = [pt0, pt1];
      if (!tubes[part]) { // body part seen for the first time
        tubes[part] = BABYLON.MeshBuilder.CreateTube(part, { path, radius: 0.02, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, t.scene); // create new tube
        tubes[part].material = t.material;
        t.shadows.addShadowCaster(tubes[part], false); // add shadow to new tube
      } else { // updating existing body part
        tubes[part] = BABYLON.MeshBuilder.CreateTube(part, { path, radius: 0.015, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE, instance: tubes[part] }, t.scene); // update existing tube
      }
    }
  }
}

export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement) {
  if (!t) t = new environment.Scene(canvas);
  if (!json || frame === null) return;
  body(frame, json.edges, json.joints, json.poses3d, canvas);
}
