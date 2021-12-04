import * as mesh from './mesh';
import type { Result } from './types';
import { parts } from './types';

const samples = ['', 'media/daz3d-ella.json', 'media/daz3d-selina.json', 'media/daz3d-zoe.json', 'media/baseball-pitch.json'];
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
  dom.status.innerText = '';
  log(`video: ${url} | resolution: ${dom.video.videoWidth} x ${dom.video.videoHeight} | duration: ${Math.trunc(dom.video.duration)}`);
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
  let poses = '';
  if (json) for (const box of json.boxes[0]) poses += Math.round(1000 * box[4]) / 10 + '% ';
  log(`image: ${url} | resolution: ${dom.image.naturalWidth} x ${dom.image.naturalHeight} | poses: ${poses}`);
  dom.status.innerText = 'rendering...';
  await mesh.dispose();
  await mesh.draw(json, 0, dom.output, dom.skeleton.options[dom.skeleton.selectedIndex].value);
  dom.status.innerText = 'done...';
}

async function processInput(url: string) {
  dom.status.innerText = 'loading data...';
  const res = await fetch(url);
  if (!res.ok) {
    log(`error loading: ${res.url} code: ${res.status} error: ${res.statusText}`);
    return;
  }
  json = await res.json();
  if (!json) return;
  log(`loaded: ${res.url}`);
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
  };
  log(`model: ${json.options.model} | options: ${JSON.stringify(options).replace(/"/g, '')}`);
  console.log({ json });
  if (json.options.image) await loadImage(json.options.image);
  if (json.options.video) await loadVideo(json.options.video);
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
  for (const name of Object.keys(parts)) {
    const skeleton = document.createElement('option');
    skeleton.value = name;
    skeleton.innerText = name;
    dom.skeleton.appendChild(skeleton);
  }
  dom.skeleton.onchange = () => { // event when sample is selected
    processInput(dom.sample.options[dom.sample.options.selectedIndex].value);
  };
}

async function main() {
  dom.status.innerText = 'ready...';
  await enumerateInputs();
  await enumerateOutputs();
}

window.onload = main;
