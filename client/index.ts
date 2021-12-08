import * as mesh from './mesh';
import type { Result } from './types';
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
};

const log = (...msg: unknown[]) => {
  dom.log.innerText += msg.join(' ') + '\n';
  console.log(...msg);
};

async function render() {
  if (!json) return;
  if (json.options.image) {
    log('render | skeleton:', dom.skeleton.options[dom.skeleton.selectedIndex].value, '| joints:', skeletons[dom.skeleton.options[dom.skeleton.selectedIndex].value].joints.length, '| frames:', json.frames);
    await mesh.draw(json, 0, dom.output, dom.skeleton.options[dom.skeleton.selectedIndex].value);
    dom.status.innerText = 'image';
  }
  if (json.options.video) {
    let frame = 0;
    while ((1000 * dom.video.currentTime) > (json.timestamps[frame])) frame++; // find closest frame
    if (frame === 0) log('rendering skeleton:', dom.skeleton.options[dom.skeleton.selectedIndex].value, '| joints:', skeletons[dom.skeleton.options[dom.skeleton.selectedIndex].value].joints.length, '| frames:', json.frames);
    dom.status.innerText = `frame: ${frame}`;
    if (frame >= json.frames) frame = json.frames - 1;
    await mesh.draw(json, frame, dom.output, dom.skeleton.options[dom.skeleton.selectedIndex].value);
    if (dom.video.paused) setTimeout(render, 1000);
    else requestAnimationFrame(render);
  }
}

async function loadVideo(url: string) {
  dom.status.innerText = 'loading video...';
  await new Promise((resolve, reject) => {
    dom.video.onerror = (err) => reject(err);
    dom.video.onloadeddata = () => resolve(true);
    dom.video.src = url;
  });
  dom.image.style.display = 'none';
  dom.video.style.display = 'flex';
  dom.video.controls = true;
  dom.video.width = dom.video.videoWidth;
  dom.video.height = dom.video.videoHeight;
  dom.output.width = dom.video.width;
  dom.output.height = dom.video.height;
  dom.output.style.height = 'auto';
  dom.status.innerText = '';
  log(`video | ${url} | resolution: ${dom.video.videoWidth} x ${dom.video.videoHeight} | duration: ${Math.trunc(dom.video.duration)}`);
}

async function loadImage(url: string) {
  dom.status.innerText = 'loading image...';
  await new Promise((resolve, reject) => {
    dom.image.onload = () => resolve(true);
    dom.image.onerror = (err) => reject(err);
    dom.image.src = url;
  });
  dom.video.style.display = 'none';
  dom.image.style.display = 'flex';
  dom.image.width = dom.image.naturalWidth;
  dom.image.height = dom.image.naturalHeight;
  dom.output.width = dom.video.width;
  dom.output.height = dom.video.height;
  dom.output.style.height = 'auto';
  let poses = '';
  if (json) for (const box of json.boxes[0]) poses += Math.round(1000 * box[4]) / 10 + '% ';
  log(`image | ${url} | resolution: ${dom.image.naturalWidth} x ${dom.image.naturalHeight} | poses: ${poses}`);
}

async function processInput(url: string) {
  dom.status.innerText = 'loading data...';
  const res = await fetch(url);
  if (!res.ok) {
    log(`error loading: ${res.url} code: ${res.status} ${res.statusText !== '' ? 'error:' + res.statusText : ''}`);
    console.log(res);
    return;
  }
  json = await res.json();
  if (!json) return;
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
  console.log({ json });
  for (let i = 0; i < dom.skeleton.options.length; i++) {
    if (json.options.skeleton !== 'all' && dom.skeleton.options.item(i)?.outerText === json.options.skeleton) dom.skeleton.selectedIndex = i;
  }
  if (json.options.image) await loadImage(json.options.image);
  if (json.options.video) await loadVideo(json.options.video);
  await mesh.dispose();
  render();
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
}

async function enumerateOutputs() {
  for (const name of Object.keys(skeletons)) {
    const skeleton = document.createElement('option');
    skeleton.value = name;
    skeleton.innerText = name;
    dom.skeleton.appendChild(skeleton);
  }
  dom.skeleton.onchange = async () => { // event when sample is selected
    if (dom.sample.options.selectedIndex > 0) {
      await mesh.dispose();
      render();
    }
  };
}

async function main() {
  dom.status.innerText = 'ready...';
  await enumerateInputs();
  await enumerateOutputs();
}

window.onload = main;
