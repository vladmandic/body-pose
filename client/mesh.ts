import * as BABYLON from 'babylonjs';
import 'babylonjs-inspector';
import { Scene } from './scene';
import { skeletons } from './constants';
import type { Result, Joint, Edge, Pose, Point3D } from './types';

let t: Scene;
let meshes: Record<string, BABYLON.Mesh> = {};
let persons: Array<BABYLON.AbstractMesh> = [];

const avg = (num: number[]) => num.reduce((prev, curr) => prev + curr, 0) / num.length;

async function body(frame: number, poses: Pose[][], edges: Array<Edge>, joints: Array<Joint>, canvas: HTMLCanvasElement, skeleton: string, dynamicCamera: boolean, animationFrames: number) {
  if (!poses[frame]) return;
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
      if (joints[i].startsWith('htop')) { // skip since we use sphere for head
        continue;
      } else if (joints[i].startsWith('head')) { // create single sphere for any possible head object
        const part = `head${person}`;
        if (!meshes[part] || meshes[part].isDisposed()) { // body part seen for the first time
          const diameter = 1.5 * (Math.abs(pt1.x - pt0.x) + Math.abs(pt1.y - pt0.y) + Math.abs(pt1.z - pt0.z));
          meshes[part] = BABYLON.MeshBuilder.CreateSphere(part, { diameter }, t.scene);
          if (poses[frame].length > 1) { // draw person number if more than one person
            const headTexture = new BABYLON.DynamicTexture(`headTexture${person}`, { width: diameter * canvas.width, height: diameter * canvas.height }, t.scene, false);
            headTexture.vAng = (160 / 180) * Math.PI; // rotate text to front
            headTexture.drawText(`${person}`, null, null, '16px Segoe UI', '#000000', '#80FFFF', false);
            meshes[part].material = t.materialHead.clone(`materialHead${person}`);
            (meshes[part].material as BABYLON.StandardMaterial).diffuseTexture = headTexture;
            t.shadows.addShadowCaster(meshes[part], false); // add shadow to new tube
          } else {
            meshes[part].material = t.materialHead;
          }
          meshes[part].parent = persons[person];
          meshes[part].position = pt0; // update head position
        } else { // just update existing head position
          if (animationFrames === 0 || frame === 0) {
            meshes[part].position = pt0;
          } else { // currently this does not get triggered
            BABYLON.Animation.CreateAndStartAnimation(part, meshes[part], 'position.x', /* FPS */ 80, /* frames */ 3, meshes[part].position.x, pt0.x, 0);
            BABYLON.Animation.CreateAndStartAnimation(part, meshes[part], 'position.y', /* FPS */ 80, /* frames */ 3, meshes[part].position.y, pt0.y, 0);
            BABYLON.Animation.CreateAndStartAnimation(part, meshes[part], 'position.z', /* FPS */ 80, /* frames */ 3, meshes[part].position.z, pt0.z, 0);
          }
        }
      } else { // create tube for all other objects
        const part = `${joints[i]}${person}`;
        const radius = skeleton === 'all' ? 0.0075 : 0.010; // thinner tubes when drawing all skeletons overlaid
        const path = [pt0, pt1];
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
  if (dynamicCamera) t.camera.target = new BABYLON.Vector3(avg(centers.x), avg(centers.y), Math.min(...centers.z));
}

export async function normalize(poses: Pose[][], [width, height]: [number, number], scale: boolean): Promise<Pose[][]> { // frame x body x pose
  const min: Point3D = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  const max: Point3D = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
  for (let j = 0; j < poses[0].length; j++) { // find min/max of all poses/joints based on first frame
    for (let k = 0; k < poses[0][j].length; k++) {
      const pt: Point3D = [poses[0][j][k][0] / width, poses[0][j][k][1] / height, 2 * poses[0][j][k][2] / (width + height)];
      if (pt[0] < min[0]) min[0] = pt[0];
      if (pt[1] < min[1]) min[1] = pt[1];
      if (pt[2] < min[2]) min[2] = pt[2];
      if (pt[0] > max[0]) max[0] = pt[0];
      if (pt[1] > max[1]) max[1] = pt[1];
      if (pt[2] > max[2]) max[2] = pt[2];
    }
  }
  for (let i = 0; i < poses.length; i++) { // frames
    for (let j = 0; j < poses[i].length; j++) { // poses
      for (let k = 0; k < poses[i][j].length; k++) { // joints
        const pt: Point3D = [poses[i][j][k][0] / width, -poses[i][j][k][1] / height, 2 * poses[0][j][k][2] / (width + height)];
        if (scale) {
          poses[i][j][k][0] = (width / height) * (pt[0] - min[0]) / (max[0] - min[0]);
          poses[i][j][k][1] = (pt[1] + min[1]) / (max[1] - min[1]) + 1;
          poses[i][j][k][2] = (pt[2] - min[2]) / (max[2] - min[2]);
        } else {
          poses[i][j][k][0] = pt[0] - min[0];
          poses[i][j][k][1] = pt[1] - min[1];
          poses[i][j][k][2] = pt[2] - min[2];
        }
      }
    }
  }
  console.log('scene box', { min, max });
  return poses;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function draw(json: Result, frame: null | number, canvas: HTMLCanvasElement, skeleton: string, showInspector: boolean, dynamicCamera: boolean, animate: boolean) {
  if (!t || t.scene.isDisposed) t = new Scene(canvas, showInspector);
  if (!json || frame === null) return;
  const animationFrames = animate ? 0 : 0; // should be dynamic based on frame rate, currently disabled
  body(frame, json.poses, json.edges, json.joints, canvas, skeleton, dynamicCamera, animationFrames);
}

export async function dispose() {
  if (!t || !t.scene || !t.scene.meshes) return;
  t.scene.dispose();
  meshes = {};
  persons = [];
}
