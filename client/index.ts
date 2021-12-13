import * as mesh from './mesh';
import * as avatar from './avatar';
import type { Result } from './types';
import * as utils from './utils';
import { skeletons } from './constants';
import { samples } from './samples';

let json: Result = null;

const dom = { // pointers to dom objects
  video: document.getElementById('input-video') as HTMLVideoElement,
  image: document.getElementById('input-image') as HTMLImageElement,
  status: document.getElementById('status') as HTMLPreElement,
  log: document.getElementById('log') as HTMLPreElement,
  output: document.getElementById('output') as HTMLCanvasElement,
  sample: document.getElementById('input') as HTMLSelectElement,
  skeleton: document.getElementById('skeleton') as HTMLSelectElement,
  model: document.getElementById('model') as HTMLSelectElement,
  split: document.getElementById('split') as HTMLInputElement,
  options: document.getElementById('options') as HTMLDivElement,
  animate: document.getElementById('animate') as HTMLButtonElement,
  center: document.getElementById('center') as HTMLButtonElement,
  bone: document.getElementById('bone') as HTMLInputElement,
  joint: document.getElementById('joint') as HTMLInputElement,
};

const log = (...msg: unknown[]) => {
  dom.log.innerText += msg.join(' ') + '\n';
  dom.log.scrollTop = dom.log.scrollHeight;
  console.log(...msg);
};

let lastFrame = 0;
async function render(_timestamp: number, _metadata?: Record<string, unknown>) {
  if (!json) return;
  if (json.options.image) {
    log('render | skeleton:', dom.skeleton.options[dom.skeleton.selectedIndex].value, '| joints:', skeletons[dom.skeleton.options[dom.skeleton.selectedIndex].value].joints.length, '| frames:', json.frames);
    if (dom.model.options[dom.model.selectedIndex].value === 'avatar') await avatar.draw(json, 0, dom.output);
    else await mesh.draw(json, 0, dom.output, dom.skeleton.options[dom.skeleton.selectedIndex].value);
    dom.status.innerText = 'image';
  }
  if (json.options.video) {
    let frame = 0;
    while ((1000 * dom.video.currentTime) > (json.timestamps[frame])) frame++; // find closest frame
    if (frame === 0) log('rendering skeleton:', dom.skeleton.options[dom.skeleton.selectedIndex].value, '| joints:', skeletons[dom.skeleton.options[dom.skeleton.selectedIndex].value].joints.length, '| frames:', json.frames);
    dom.status.innerText = `frame: ${frame}`;
    if (frame >= json.frames) frame = json.frames - 1;
    if (frame !== lastFrame) await mesh.draw(json, frame, dom.output, dom.skeleton.options[dom.skeleton.selectedIndex].value); // draw only if target frame is different
    lastFrame = frame;
    // console.log({ _timestamp, _metadata }); // can be used for interim animations for inputs with low frame rate
    // @ts-ignore // trigger once on each new frame
    dom.video.requestVideoFrameCallback(render);
  }
}

async function loadVideo(url: string) {
  dom.status.innerText = 'loading video...';
  await new Promise((resolve, reject) => {
    dom.video.onerror = (err) => {
      log(`error loading video specified in json data: ${url}`);
      reject(err);
    };
    dom.video.onloadeddata = () => resolve(true);
    dom.video.src = url;
  });
  dom.image.style.display = 'none';
  dom.video.style.display = 'flex';
  dom.output.style.display = 'flex';
  dom.video.controls = true;
  dom.video.width = dom.video.videoWidth;
  dom.video.height = dom.video.videoHeight;
  dom.output.width = dom.video.width;
  dom.output.height = dom.video.height;
  dom.status.innerText = '';
  log(`video | ${url} | resolution: ${dom.video.videoWidth} x ${dom.video.videoHeight} | duration: ${Math.trunc(dom.video.duration)}`);
}

async function loadImage(url: string) {
  dom.status.innerText = 'loading image...';
  await new Promise((resolve, reject) => {
    dom.image.onload = () => resolve(true);
    dom.image.onerror = (err) => {
      log(`error loading image specified in json data: ${url}`);
      reject(err);
    };
    dom.image.src = url;
  });
  dom.video.style.display = 'none';
  dom.image.style.display = 'flex';
  dom.output.style.display = 'flex';
  dom.image.width = dom.image.naturalWidth;
  dom.image.height = dom.image.naturalHeight;
  dom.output.width = dom.image.width;
  dom.output.height = dom.image.height;
  let poses = '';
  if (json) for (const box of json.boxes[0]) poses += Math.round(1000 * box[4]) / 10 + '% ';
  log(`image | ${url} | resolution: ${dom.image.naturalWidth} x ${dom.image.naturalHeight} | poses: ${poses}`);
}

async function enumerateSkeletons(skeleton: string) {
  dom.skeleton.innerHTML = '';
  if (skeleton === 'all') {
    for (const name of Object.keys(skeletons)) {
      const skeletonType = document.createElement('option');
      skeletonType.value = name;
      skeletonType.innerText = name;
      dom.skeleton.appendChild(skeletonType);
    }
  } else {
    const skeletonType = document.createElement('option');
    skeletonType.value = skeleton;
    skeletonType.innerText = skeleton;
    dom.skeleton.appendChild(skeletonType);
  }
}

async function processInput(url: string) {
  dom.status.innerText = 'loading data...';
  const res = await fetch(url);
  if (!res.ok) {
    log(`error loading: ${res.url} code: ${res.status} ${res.statusText !== '' ? 'error:' + res.statusText : ''}`);
    console.error(res);
    return;
  }
  json = await res.json();
  if (!json) return;
  json.poses = await utils.normalize(json.poses, json.resolution[0]); // normalize after we have output canvas resized
  log(`input | ${res.url}`);
  json.options.skeleton = json.options.skeleton === '' ? 'all' : json.options.skeleton.replace('+', '_');
  const options = {
    augmentations: json.options.augmentations,
    average: json.options.average === 1,
    batch: json.options.batch,
    fov: json.options.fov,
    iou: json.options.iou,
    maxpeople: json.options.maxpeople,
    minconfidence: json.options.minconfidence,
    skipms: json.options.skipms,
    suppress: json.options.suppress === 1,
    skeleton: json.options.skeleton,
    joints: json.joints.length,
    edges: json.edges.length,
    model: json.options.model,
  };
  log(`model | ${JSON.stringify(options).replace(/"|{|}/g, '').replace(/,/g, ' | ')}`);
  console.log('json:', { json });
  for (let i = 0; i < dom.skeleton.options.length; i++) {
    if (json.options.skeleton !== 'all' && dom.skeleton.options.item(i)?.outerText === json.options.skeleton) dom.skeleton.selectedIndex = i;
  }
  await avatar.dispose();
  await mesh.dispose();
  if (json.options.image) await loadImage(json.options.image);
  if (json.options.video) await loadVideo(json.options.video);
  enumerateSkeletons(json.options.skeleton);
  dom.split.style.display = 'block';
  dom.options.style.display = 'block';
  render(0);
}

async function refresh() {
  await mesh.dispose();
  await avatar.dispose();
  render(0);
}

async function enumerateInputs() {
  for (const sample of samples) { // enumerate video samples
    const input = document.createElement('option');
    input.value = sample;
    input.innerText = sample;
    dom.sample.appendChild(input);
  }
  dom.sample.onchange = (ev: Event) => { // event when sample is selected
    const opt = (ev.target as HTMLSelectElement).options as HTMLOptionsCollection;
    if (opt[opt.selectedIndex].value && opt[opt.selectedIndex].value.length > 0) processInput(opt[opt.selectedIndex].value);
  };
  dom.status.onclick = () => (dom.model.options[dom.model.selectedIndex].value === 'mesh' ? mesh.inspect() : avatar.inspect());
  dom.split.onchange = () => {
    const val = parseInt(dom.split.value);
    dom.video.style.width = `${100 - val}%`;
    dom.image.style.width = `${100 - val}%`;
    dom.output.style.width = `${val}%`;
  };
  dom.skeleton.onchange = async () => { // event when sample is selected
    if (dom.sample.options.selectedIndex > 0) await refresh();
  };
  dom.bone.onchange = async () => {
    if (json && json.options.image) await refresh(); // force refresh for image as for video it will happen anyhow on next frame
  };
  dom.model.onchange = async () => {
    if (json && json.options.image) await refresh();
  };
  dom.joint.onchange = async () => {
    if (json && json.options.image) await refresh();
  };
  dom.animate.onclick = () => (dom.model.options[dom.model.selectedIndex].value === 'mesh' ? mesh.animate(15) : avatar.animate());
  dom.center.onclick = () => {
    if (!json) return;
    const maxmin = utils.maxmin(json.poses);
    const scene = dom.model.options[dom.model.selectedIndex].value === 'mesh' ? mesh.getScene() : avatar.getScene();
    if (scene) utils.moveCamera(scene.camera, (maxmin.max[0] - maxmin.min[0]) / 2 + maxmin.min[0], (maxmin.max[1] - maxmin.min[1]) / 2, (maxmin.max[2] - maxmin.min[2]) / 2, 500);
  };
}

async function main() {
  dom.status.innerText = 'ready...';
  await enumerateInputs();
  dom.sample.focus();
}

window.onload = main;
