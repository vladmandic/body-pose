import * as BABYLON from 'babylonjs';
import 'babylonjs-inspector';
import { PoseScene } from './scene';
import { skeletons, exclude } from './constants';
import type { Result, Joint, Edge, Pose, Point3D } from './types';

let t: PoseScene | null;
let meshes: Record<string, BABYLON.Mesh> = {};
let parents: Record<string, BABYLON.AbstractMesh> = {};
let persons: Array<BABYLON.AbstractMesh> = [];
let centers: { x: number[], y: number[], z: number[] } = { x: [], y: [], z: [] };
let fov = 0;

const avg = (num: number[]): number => (num.length > 0 ? num.reduce((prev, curr) => prev + curr, 0) / num.length : 0);

function head(person: number, pt0: BABYLON.Vector3, diameter: number, drawNumber: boolean) {
  if (!t) return;
  const part = `head${person}`;
  if (!meshes[part] || meshes[part].isDisposed()) { // body part seen for the first time
    // const diameter = Math.abs(pt1.x - pt0.x) + Math.abs(pt1.y - pt0.y) + Math.abs(pt1.z - pt0.z); // based on detected head size
    meshes[part] = BABYLON.MeshBuilder.CreateSphere(part, { diameter }, t.scene);
    if (drawNumber) { // draw person number if more than one person
      const headTexture = new BABYLON.DynamicTexture(`headTexture${person}`, { width: 100, height: 100 }, t.scene, false);
      headTexture.vAng = (160 / 180) * Math.PI; // rotate text to front
      headTexture.drawText(`${person}`, null, null, '32px Segoe UI', '#000000', '#80FFFF', false);
      meshes[part].material = t.materialHead.clone(`materialHead${person}`);
      (meshes[part].material as BABYLON.StandardMaterial).diffuseTexture = headTexture;
      t.shadows.addShadowCaster(meshes[part], false); // add shadow to new tube
    } else {
      meshes[part].material = t.materialHead;
    }
    meshes[part].parent = parents[person + 'center'];
  }
  meshes[part].position = pt0; // update head position
}

function bone(joint: string, person: number, pt0: BABYLON.Vector3, pt1: BABYLON.Vector3, radius: number, diameter: number) {
  if (!t) return;
  const path = [pt0, pt1];
  const part = `${joint}${person}`;
  if (!meshes[part] || meshes[part].isDisposed()) { // body part seen for the first time
    meshes[part] = BABYLON.MeshBuilder.CreateTube(part, { path, radius, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, t.scene);
    meshes[part].material = t.materialBody;
    if (part.startsWith('l')) meshes[part].parent = parents[person + 'left'];
    else if (part.startsWith('r')) meshes[part].parent = parents[person + 'right'];
    else meshes[part].parent = parents[person + 'center'];
    t.shadows.addShadowCaster(meshes[part], false); // add shadow to new tube
    meshes[part + 'start'] = BABYLON.MeshBuilder.CreateSphere(part + 'start', { diameter }, t.scene); // rounded edge for bone start
    meshes[part + 'start'].material = t.materialBody;
    meshes[part + 'start'].parent = parents[person + 'ends'];
    meshes[part + 'start'].position = pt0; // update head position
    t.shadows.addShadowCaster(meshes[part + 0], false); // add shadow to new tube
    meshes[part + 'end'] = BABYLON.MeshBuilder.CreateSphere(part + 'end', { diameter }, t.scene); // rounded edge for bone end
    meshes[part + 'end'].material = t.materialBody;
    meshes[part + 'end'].parent = parents[person + 'ends'];
    meshes[part + 'end'].position = pt1; // update head position
    t.shadows.addShadowCaster(meshes[part + 1], false); // add shadow to new tube
  } else { // updating existing body part
    meshes[part + 'start'].position = pt0; // update rounded edge position
    meshes[part + 'end'].position = pt1; // update rounded edge position
    meshes[part] = BABYLON.MeshBuilder.CreateTube(part, { path, radius, updatable: true, cap: 3, sideOrientation: BABYLON.Mesh.DOUBLESIDE, instance: meshes[part] }, t.scene); // update existing tube
  }
}

async function body(frame: number, poses: Pose[][], edges: Array<Edge>, joints: Array<Joint>, skeleton: string) {
  if (!poses[frame] || !t) return;
  if (persons.length > 1) for (const person of persons) person.setEnabled(false); // disable all poses to start with unless we're tracking just one
  centers = { x: [], y: [], z: [] };
  const boneScale = parseInt((document.getElementById('bone') as HTMLInputElement).value);
  const jointScale = parseInt((document.getElementById('joint') as HTMLInputElement).value);
  for (let person = 0; person < poses[frame].length; person++) {
    if (!persons[person]) {
      persons[person] = new BABYLON.AbstractMesh(`pose${person}`, t.scene); // create person placeholder if it doesnt exist
      parents[person + 'center'] = new BABYLON.AbstractMesh(`center${person}`, t.scene); // create person placeholder if it doesnt exist
      parents[person + 'center'].parent = persons[person];
      parents[person + 'left'] = new BABYLON.AbstractMesh(`left${person}`, t.scene); // create person placeholder if it doesnt exist
      parents[person + 'left'].parent = persons[person];
      parents[person + 'right'] = new BABYLON.AbstractMesh(`right${person}`, t.scene); // create person placeholder if it doesnt exist
      parents[person + 'right'].parent = persons[person];
      parents[person + 'ends'] = new BABYLON.AbstractMesh(`ends${person}`, t.scene); // create person placeholder if it doesnt exist
      parents[person + 'ends'].parent = persons[person];
    }
    persons[person].setEnabled(true); // enable person
    const filtered = edges.filter((_edge, i) => { // filter to only edges that match selected skeleton
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
        const diameter = 1.75 * distance * depth * jointScale / 100;
        head(person, pt0, diameter, poses[frame].length > 1);
      } else { // create tube for all other objects
        const boneRadius = depth * (distance + 0.1) / 20 * boneScale / 100;
        const jointDiameter = depth * (distance + 0.1) / 20 * jointScale / 100 * 2;
        bone(joints[i], person, pt0, pt1, boneRadius, jointDiameter);
      }
      if (joints[i] === 'neck') {
        centers.x.push(pt0.x);
        centers.y.push(pt0.y);
        centers.z.push(pt0.z);
      }
    }
  }
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
  for (let j = 0; j < poses[0].length; j++) { // find min/max of all poses/joints based on first frame to calculate fov
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
  if (!t || t.scene.isDisposed) t = new PoseScene(canvas, fov); // create new scene
  body(frame, json.poses, json.edges, json.joints, skeleton);
}

export async function inspect() {
  if (t && t.scene) t.inspector();
}

export async function animate(sec: number) {
  if (!t) return;
  const alpha = t.camera.alpha;
  const beta = t.camera.beta;
  const radius = t.camera.radius;
  const target = { x: t.camera.target.x, y: t.camera.target.y, z: t.camera.target.z };
  const moveTarget = (x: number, y: number, z: number, ms: number) => {
    if (!t) return;
    BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'target.x', 60, 60 * ms / 1000, t.camera.target.x, x, 0, new BABYLON.BackEase());
    BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'target.y', 60, 60 * ms / 1000, t.camera.target.y, y, 0, new BABYLON.BackEase());
    BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'target.z', 60, 60 * ms / 1000, t.camera.target.z, z, 0, new BABYLON.BackEase());
  };
  const zoomCamera = (ms: number) => {
    if (!t) return;
    BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'radius', 60, 60 * ms / 1000 / 3, t.camera.radius, 2.0 * radius, 0, new BABYLON.ElasticEase(), () => {
      if (!t) return;
      BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'radius', 60, 60 * ms / 1000 / 3, t.camera.radius, 0.5 * radius, 0, new BABYLON.ElasticEase(), () => {
        if (!t) return;
        BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'radius', 60, 60 * ms / 1000 / 3, t.camera.radius, 1.0 * radius, 0, new BABYLON.ElasticEase());
      });
    });
  };
  const rotateAlpha = (ms: number) => {
    if (!t) return;
    BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'alpha', 60, 60 * ms / 1000 / 2, alpha, 2 * Math.PI + alpha, 0, new BABYLON.BackEase(), () => {
      if (!t) return;
      BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'alpha', 60, 60 * ms / 1000 / 2, t.camera.alpha, alpha, 0, new BABYLON.BackEase());
    });
  };
  const rotateBeta = (ms: number) => {
    if (!t) return;
    BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'beta', 60, 60 * ms / 1000 / 3, beta, 3 * Math.PI / 4, 0, new BABYLON.BackEase(), () => {
      if (!t) return;
      BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'beta', 60, 60 * ms / 1000 / 3, t.camera.beta, Math.PI / 4, 0, new BABYLON.BackEase(), () => {
        if (!t) return;
        BABYLON.Animation.CreateAndStartAnimation('camera', t.camera, 'beta', 60, 60 * ms / 1000 / 3, t.camera.beta, beta, 0, new BABYLON.BackEase());
      });
    });
  };
  const unit = 1000 * sec / 5;
  const durationTarget = 1000 * Math.random() + 1000;
  const durationZoom = unit * Math.random() + (4 * unit);
  const durationAlpha = unit * Math.random() + (4 * unit);
  const durationBeta = unit * Math.random() + (4 * unit);
  setTimeout(() => moveTarget(avg(centers.x), avg(centers.y), Math.max(...centers.z), durationTarget), 0);
  setTimeout(() => zoomCamera(durationZoom), durationTarget);
  setTimeout(() => rotateAlpha(durationAlpha), durationTarget);
  setTimeout(() => rotateBeta(durationBeta), durationTarget);
  setTimeout(() => moveTarget(target.x, target.y, target.z, durationTarget), durationTarget + Math.max(durationAlpha, durationBeta, durationZoom));
}

export async function dispose() {
  if (!t || !t.scene || !t.scene.meshes) return;
  t.scene.dispose();
  t.engine.resize();
  t = null;
  meshes = {};
  parents = {};
  persons = [];
}
