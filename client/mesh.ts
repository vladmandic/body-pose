import * as BABYLON from 'babylonjs';
import 'babylonjs-inspector';
import { Scene } from './scene';
import { skeletons, exclude } from './constants';
import type { Result, Joint, Edge, Pose, Point3D } from './types';

let t: Scene | null;
let meshes: Record<string, BABYLON.Mesh> = {};
let persons: Array<BABYLON.AbstractMesh> = [];

let fov = 0;

// const avg = (num: number[]): number => (num.length > 0 ? num.reduce((prev, curr) => prev + curr, 0) / num.length : 0);

async function body(frame: number, poses: Pose[][], edges: Array<Edge>, joints: Array<Joint>, skeleton: string) {
  if (!poses[frame] || !t) return;
  if (persons.length > 1) for (const person of persons) person.setEnabled(false); // disable all poses to start with unless we're tracking just one
  const centers: { x: number[], y: number[], z: number[] } = { x: [], y: [], z: [] };
  for (let person = 0; person < poses[frame].length; person++) {
    if (!persons[person]) {
      persons[person] = new BABYLON.AbstractMesh(`pose${person}`, t.scene); // create person if it doesnt exist
      t.shadows.addShadowCaster(persons[person], true);
    }
    persons[person].setEnabled(true); // enable person
    const filtered = edges.filter((_edge, i) => { // TBD: this should be preprocessed and not inside a loop
      if (joints[i] === skeletons[skeleton].joints[i]) return true; // exact match
      if (joints[i].endsWith(skeletons[skeleton].suffix)) { // skeleton name match
        const joint = joints[i].substring(0, joints[i].indexOf('_')); // find original joint name without suffix
        return skeletons[skeleton].joints.includes(joint); // does target skeleton contain joint
      }
      return false;
    });
    filtered.length = skeletons[skeleton].edges.length; // crop length if we have too many joints
    for (let i = 0; i < filtered.length; i++) {
      const pose: Pose = poses[frame][person];
      const pt0 = new BABYLON.Vector3(pose[edges[i][0]][0], pose[edges[i][0]][1], pose[edges[i][0]][2]);
      const pt1 = new BABYLON.Vector3(pose[edges[i][1]][0], pose[edges[i][1]][1], pose[edges[i][1]][2]);
      const distance = BABYLON.Vector3.Distance(pt0, pt1); // edge length
      const depth = Math.min(Math.sqrt(Math.abs(1 / (pt0.z + 0.5))), 2); // z-distance of a point
      if (skeleton === 'all' && exclude.includes(joints[i])) { // skip some joints around head
        continue;
      } else if (joints[i].startsWith('head')) { // create single sphere for any possible head object
        const part = `head${person}`;
        if (!meshes[part] || meshes[part].isDisposed()) { // body part seen for the first time
          // const diameter = Math.abs(pt1.x - pt0.x) + Math.abs(pt1.y - pt0.y) + Math.abs(pt1.z - pt0.z); // based on detected head size
          const diameter = 2 * distance * depth;
          meshes[part] = BABYLON.MeshBuilder.CreateSphere(part, { diameter }, t.scene);
          if (poses[frame].length > 1) { // draw person number if more than one person
            const headTexture = new BABYLON.DynamicTexture(`headTexture${person}`, { width: 100, height: 100 }, t.scene, false);
            headTexture.vAng = (160 / 180) * Math.PI; // rotate text to front
            headTexture.drawText(`${person}`, null, null, '32px Segoe UI', '#000000', '#80FFFF', false);
            meshes[part].material = t.materialHead.clone(`materialHead${person}`);
            (meshes[part].material as BABYLON.StandardMaterial).diffuseTexture = headTexture;
            t.shadows.addShadowCaster(meshes[part], false); // add shadow to new tube
          } else {
            meshes[part].material = t.materialHead;
          }
          meshes[part].parent = persons[person];
          meshes[part].position = pt0; // update head position
        } else { // just update existing head position
          meshes[part].position = pt0;
        }
      } else { // create tube for all other objects
        const part = `${joints[i]}${person}`;
        const path = [pt0, pt1];
        const radius = depth * (distance + 0.1) / 20;
        if (!meshes[part] || meshes[part].isDisposed()) { // body part seen for the first time
          meshes[part] = BABYLON.MeshBuilder.CreateTube(part, { path, radius, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, t.scene);
          meshes[part].material = t.materialBody;
          meshes[part].parent = persons[person];
          t.shadows.addShadowCaster(meshes[part], false); // add shadow to new tube
        } else { // updating existing body part
          meshes[part] = BABYLON.MeshBuilder.CreateTube(part, { path, radius, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE, instance: meshes[part] }, t.scene); // update existing tube
        }
      }
      if (joints[i] === 'neck') {
        centers.x.push(pt0.x);
        centers.y.push(pt0.y);
        centers.z.push(pt0.z);
      }
    }
  }
  // if (cameraFollow) t.camera.target = new BABYLON.Vector3(avg(centers.x), avg(centers.y), Math.min(...centers.z));
}

export async function normalize(poses: Pose[][], scale: number): Promise<Pose[][]> { // frame x body x pose
  let min: Point3D = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  let max: Point3D = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
  for (let j = 0; j < poses[0].length; j++) { // find min/max of all poses/joints based on first frame
    for (let k = 0; k < poses[0][j].length; k++) {
      for (let l = 0; l < poses[0][j][k].length; l++) {
        if (poses[0][j][k][l] < min[l]) min[l] = poses[0][j][k][l];
        if (poses[0][j][k][l] > max[l]) max[l] = poses[0][j][k][l];
      }
    }
  }
  const norm = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / scale;
  for (let i = 0; i < poses.length; i++) { // rescale and invert coordinates // frames
    for (let j = 0; j < poses[i].length; j++) { // poses
      for (let k = 0; k < poses[i][j].length; k++) { // joints
        poses[i][j][k] = [
          (poses[i][j][k][0]) / scale / norm,
          (max[1] - poses[i][j][k][1]) / scale / norm,
          (poses[i][j][k][2] - min[2]) / scale * 1.5 / norm,
        ];
      }
    }
  }
  min = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  max = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
  for (let j = 0; j < poses[0].length; j++) { // find min/max of all poses/joints based on first frame
    for (let k = 0; k < poses[0][j].length; k++) {
      for (let l = 0; l < poses[0][j][k].length; l++) {
        if (poses[0][0][k][l] < min[l]) min[l] = poses[0][j][k][l];
        if (poses[0][0][k][l] > max[l]) max[l] = poses[0][j][k][l];
      }
    }
  }
  fov = 10 * Math.sqrt(((max[0] - min[0]) ** 2) + ((max[1] - min[1]) ** 2));
  return poses;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement, skeleton: string) {
  if (!json || frame === null) return;
  if (!t || t.scene.isDisposed) t = new Scene(canvas, fov); // create new scene
  body(frame, json.poses, json.edges, json.joints, skeleton);
}

export async function inspect() {
  if (t && t.scene) t.inspector();
}

export async function dispose() {
  if (!t || !t.scene || !t.scene.meshes) return;
  t.scene.dispose();
  t = null;
  meshes = {};
  persons = [];
}
