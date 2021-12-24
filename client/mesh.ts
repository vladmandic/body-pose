import * as BABYLON from 'babylonjs';
import 'babylonjs-inspector';
import { PoseScene } from './scene';
import * as utils from './utils';
import { skeletons, exclude } from './constants';
import type { Result, Joint, Edge, Pose, Point3D } from './types';

const numberedJoints = false;

let t: PoseScene | null;
let meshes: Record<string, BABYLON.Mesh> = {};
let parents: Record<string, BABYLON.AbstractMesh> = {};
let persons: Array<BABYLON.AbstractMesh> = [];
let centers: { x: number[], y: number[], z: number[] } = { x: [], y: [], z: [] };

const avg = (num: number[]): number => (num.length > 0 ? num.reduce((prev, curr) => prev + curr, 0) / num.length : 0);
export const getScene = () => t;

function getTexture(index: number, scene: BABYLON.Scene) {
  const texture = new BABYLON.DynamicTexture(`numberedTexture${index}`, { width: 100, height: 100 }, scene, false);
  texture.vAng = (153 / 180) * Math.PI; // rotate text to front
  texture.drawText(`${index}`, null, null, '32px Segoe UI', '#000000', '#80FFFF', false);
  return texture;
}

function head(person: number, pt0: BABYLON.Vector3, diameter: number, drawNumber: boolean) {
  if (!t) return;
  const part = `head${person}`;
  if (!meshes[part] || meshes[part].isDisposed()) { // body part seen for the first time
    meshes[part] = BABYLON.MeshBuilder.CreateSphere(part, { diameter }, t.scene);
    if (drawNumber) { // draw person number if more than one person
      meshes[part].material = t.materialHead.clone(`materialHead${person}`);
      (meshes[part].material as BABYLON.StandardMaterial).diffuseTexture = getTexture(person, t.scene);
    } else {
      meshes[part].material = t.materialHead;
    }
    t.shadows.addShadowCaster(meshes[part], false); // add shadow
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

async function body(frame: number, poses: Pose[][], edges: Edge[], joints: Joint[], skeleton: string) {
  if (!poses[frame] || !t) return;
  if (persons.length > 1) for (const person of persons) person.setEnabled(false); // disable all poses to start with unless we're tracking just one
  centers = { x: [], y: [], z: [] };
  const boneScale = parseInt((document.getElementById('bone') as HTMLInputElement).value);
  const jointScale = parseInt((document.getElementById('joint') as HTMLInputElement).value);
  for (let person = 0; person < poses[frame].length; person++) {
    if (!persons[person]) {
      persons[person] = new BABYLON.AbstractMesh(`pose${person}`, t.scene); // create person placeholder if it doesnt exist
      parents[person + 'center'] = new BABYLON.AbstractMesh(`center${person}`, t.scene);
      parents[person + 'center'].parent = persons[person];
      parents[person + 'left'] = new BABYLON.AbstractMesh(`left${person}`, t.scene);
      parents[person + 'left'].parent = persons[person];
      parents[person + 'right'] = new BABYLON.AbstractMesh(`right${person}`, t.scene);
      parents[person + 'right'].parent = persons[person];
      parents[person + 'ends'] = new BABYLON.AbstractMesh(`ends${person}`, t.scene);
      parents[person + 'ends'].parent = persons[person];
    }
    persons[person].setEnabled(true); // enable person
    const filtered: Edge[] = joints.length === 122 && skeleton !== 'all' // filter if we have all joints and want to display only specific skeleton
      ? edges.filter((_edge, i) => skeletons[skeleton].joints.includes(joints[i])) // does desired skeleton include current joint
      : edges;
    for (let i = 0; i < filtered.length; i++) {
      const pose: Pose = poses[frame][person];
      const pt0 = new BABYLON.Vector3(pose[edges[i][0]][0], pose[edges[i][0]][1], pose[edges[i][0]][2]);
      const pt1 = new BABYLON.Vector3(pose[edges[i][1]][0], pose[edges[i][1]][1], pose[edges[i][1]][2]);
      const distance = BABYLON.Vector3.Distance(pt0, pt1); // edge length
      const depth = Math.min(Math.sqrt(Math.abs(1 / (pt0.z + 0.5))), 2); // z-distance of a point
      if (exclude[skeleton].includes(joints[i])) { // skip some joints around head
        continue;
      } else if (skeleton === 'all' && joints[i].startsWith('head')) { // create single sphere for any possible head object
        const diameter = 1.75 * distance * depth * jointScale / 100;
        head(person, pt0, diameter, poses[frame].length > 1);
      } else { // create tube for all other objects
        const boneRadius = depth * (distance + 0.1) / 20 * boneScale / 100;
        const jointDiameter = depth * (distance + 0.1) / 20 * jointScale / 100 * 2;
        bone(joints[i], person, pt0, pt1, boneRadius, jointDiameter);
      }
      if (joints[i] === 'neck') { // used for camera animation around scene central point
        centers.x.push(pt0.x);
        centers.y.push(pt0.y);
        centers.z.push(pt0.z);
      }
    }
  }
}

async function points(poses: Pose[], joints: Joint[]) {
  if (!poses || !t) return;
  for (let i = 0; i < poses.length; i++) {
    if (!parents[i + 'points']) parents[i + 'points'] = new BABYLON.AbstractMesh(`points${i}`, t.scene);
    for (let j = 0; j < poses[i].length; j++) {
      const pt: Point3D = poses[i][j];
      const name = `${joints[j]}${i}`;
      const material = new BABYLON.StandardMaterial(name, t.scene);
      material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
      material.diffuseTexture = getTexture(j, t.scene);
      meshes[name] = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 0.03 }, t.scene);
      meshes[name].material = material;
      meshes[name].parent = parents[i + 'points'];
      meshes[name].position = new BABYLON.Vector3(pt[0], pt[1], pt[2]);
    }
  }
}

export async function demoAnimate(sec: number) {
  if (!t) return;
  const moveTarget = (x: number, y: number, z: number, ms: number) => {
    BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'target.x', 60, 60 * ms / 1000, t!.camera.target.x, x, 0, new BABYLON.BackEase());
    BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'target.y', 60, 60 * ms / 1000, t!.camera.target.y, y, 0, new BABYLON.BackEase());
    BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'target.z', 60, 60 * ms / 1000, t!.camera.target.z, z, 0, new BABYLON.BackEase());
  };
  const zoomCamera = (ms: number) => {
    const radius = t!.camera.radius;
    BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'radius', 60, 60 * ms / 1000 / 3, t!.camera.radius, 2.0 * radius, 0, new BABYLON.ElasticEase(), () => {
      BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'radius', 60, 60 * ms / 1000 / 3, t!.camera.radius, 0.5 * radius, 0, new BABYLON.ElasticEase(), () => {
        BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'radius', 60, 60 * ms / 1000 / 3, t!.camera.radius, 1.0 * radius, 0, new BABYLON.ElasticEase());
      });
    });
  };
  const rotateAlpha = (ms: number) => {
    const alpha = t!.camera.alpha;
    BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'alpha', 60, 60 * ms / 1000 / 2, alpha, 2 * Math.PI + alpha, 0, new BABYLON.BackEase(), () => {
      BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'alpha', 60, 60 * ms / 1000 / 2, t!.camera.alpha, alpha, 0, new BABYLON.BackEase());
    });
  };
  const rotateBeta = (ms: number) => {
    const beta = t!.camera.beta;
    BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'beta', 60, 60 * ms / 1000 / 3, beta, 3 * Math.PI / 4, 0, new BABYLON.BackEase(), () => {
      BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'beta', 60, 60 * ms / 1000 / 3, t!.camera.beta, Math.PI / 4, 0, new BABYLON.BackEase(), () => {
        BABYLON.Animation.CreateAndStartAnimation('camera', t!.camera, 'beta', 60, 60 * ms / 1000 / 3, t!.camera.beta, beta, 0, new BABYLON.BackEase());
      });
    });
  };
  const unit = 1000 * sec / 5;
  const durationTarget = 1000 * Math.random() + 1000;
  const durationZoom = unit * Math.random() + (4 * unit);
  const durationAlpha = unit * Math.random() + (4 * unit);
  const durationBeta = unit * Math.random() + (4 * unit);
  const target = { x: t.camera.target.x, y: t.camera.target.y, z: t.camera.target.z };
  setTimeout(() => moveTarget(avg(centers.x), avg(centers.y), Math.max(...centers.z), durationTarget), 0);
  setTimeout(() => zoomCamera(durationZoom), durationTarget);
  setTimeout(() => rotateAlpha(durationAlpha), durationTarget);
  setTimeout(() => rotateBeta(durationBeta), durationTarget);
  setTimeout(() => moveTarget(target.x, target.y, target.z, durationTarget), durationTarget + Math.max(durationAlpha, durationBeta, durationZoom));
}

export async function inspect() {
  if (t && t.scene) t.inspector();
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

export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement, skeleton: string) {
  if (!json || frame === null) return;
  if (!t || t.scene.isDisposed) {
    const fov = utils.fov(json.poses);
    t = new PoseScene(canvas, fov, 1000); // create new scene
  }
  body(frame, json.poses, json.edges, json.joints, skeleton); // draw body
  if (numberedJoints) points(json.poses[frame], json.joints); // add numbered joints
  setTimeout(() => utils.centerCamera((t as PoseScene).camera, 1000, json.poses), 1000);
  utils.attachControls(t);
}
