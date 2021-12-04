import * as BABYLON from 'babylonjs';

export interface Global extends Window {
  engine: BABYLON.Engine,
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  light: BABYLON.DirectionalLight,
  meshes: BABYLON.AbstractMesh[],
}
declare let window: Global;

export class Scene {
  engine!: BABYLON.Engine;
  canvas!: HTMLCanvasElement;
  scene!: BABYLON.Scene;
  material!: BABYLON.StandardMaterial;
  camera!: BABYLON.ArcRotateCamera;
  light!: BABYLON.DirectionalLight;
  ambient!: BABYLON.HemisphericLight;
  shadows!: BABYLON.ShadowGenerator;
  environment!: BABYLON.EnvironmentHelper;
  skeleton?: BABYLON.Skeleton | undefined;

  constructor(outputCanvas: HTMLCanvasElement) {
    console.log('creating scene:', outputCanvas.id);
    this.canvas = outputCanvas;
    // engine & scene
    this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });
    this.engine.enableOfflineSupport = false;
    BABYLON.Animation.AllowMatricesInterpolation = true;
    this.scene = new BABYLON.Scene(this.engine);
    this.material = new BABYLON.StandardMaterial('material', this.scene);
    this.material.diffuseColor = new BABYLON.Color3(0, 0.85, 1.0);
    // set default environment
    this.defaults();
    // start scene
    this.engine.runRenderLoop(() => this.scene.render());
    window.engine = this.engine;
    window.scene = this.scene;
    window.light = this.light;
    window.meshes = this.scene.meshes;
    window.camera = this.camera;
  }

  defaults() {
    // camera
    if (this.camera) this.camera.dispose();
    this.camera = new BABYLON.ArcRotateCamera('camera1', 0, 0, 0.1, new BABYLON.Vector3(0.5, 0.5, 0.5), this.scene);
    this.camera.attachControl(this.canvas, true);
    this.camera.lowerRadiusLimit = 0.1;
    this.camera.upperRadiusLimit = 10;
    this.camera.wheelDeltaPercentage = 0.01;
    // environment
    if (this.environment) this.environment.dispose();
    this.environment = this.scene.createDefaultEnvironment({
      createSkybox: true,
      skyboxTexture: 'media/backgroundSkybox.dds',
      createGround: true,
      groundTexture: 'media/backgroundGround.png',
      enableGroundShadow: true,
      groundColor: BABYLON.Color3.Red(),
      environmentTexture: 'media/environmentSpecular.env',
    }) as BABYLON.EnvironmentHelper;
    this.environment.setMainColor(BABYLON.Color3.Gray());
    // lights
    if (this.ambient) this.ambient.dispose();
    this.ambient = new BABYLON.HemisphericLight('spheric', new BABYLON.Vector3(0, 1, 0), this.scene);
    this.ambient.intensity = 0.6;
    this.ambient.specular = BABYLON.Color3.Black();
    if (this.light) this.light.dispose();
    this.light = new BABYLON.DirectionalLight('directional', new BABYLON.Vector3(0, -0.5, -1.0), this.scene);
    this.light.position = new BABYLON.Vector3(0, 5, 5);
    if (this.shadows) this.shadows.dispose();
    this.shadows = new BABYLON.ShadowGenerator(1024, this.light);
    this.shadows.useBlurExponentialShadowMap = true;
    this.shadows.blurKernel = 32;
    this.camera.position = new BABYLON.Vector3(0.27, 0.81, -0.26);
    this.camera.target = new BABYLON.Vector3(0.23, 0.83, 0);
    this.light.position = new BABYLON.Vector3(0.0, 2.0, 5.0);
    this.light.direction = new BABYLON.Vector3(-0.5, 1, -2);
  }
}
