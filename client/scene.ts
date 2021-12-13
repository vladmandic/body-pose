import * as BABYLON from 'babylonjs';

export interface Global extends Window {
  engine: BABYLON.Engine,
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  light: BABYLON.DirectionalLight,
  meshes: BABYLON.AbstractMesh[],
}
declare let window: Global;
export class PoseScene {
  engine!: BABYLON.Engine;
  canvas!: HTMLCanvasElement;
  scene!: BABYLON.Scene;
  materialBody!: BABYLON.StandardMaterial;
  materialHead!: BABYLON.StandardMaterial;
  camera!: BABYLON.ArcRotateCamera;
  light!: BABYLON.DirectionalLight;
  spotlight!: BABYLON.SpotLight;
  ambient!: BABYLON.HemisphericLight;
  shadows!: BABYLON.ShadowGenerator;
  environment!: BABYLON.EnvironmentHelper;
  skybox: BABYLON.Mesh | undefined;
  ground: BABYLON.Mesh | undefined;
  skeleton?: BABYLON.Skeleton | undefined;

  constructor(outputCanvas: HTMLCanvasElement, cameraRadius: number) {
    this.canvas = outputCanvas;
    // engine & scene
    this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false, doNotHandleContextLost: true });
    this.engine.enableOfflineSupport = false;
    BABYLON.Animation.AllowMatricesInterpolation = true;
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearCachedVertexData();
    this.materialBody = new BABYLON.StandardMaterial('materialTube', this.scene);
    this.materialBody.diffuseColor = new BABYLON.Color3(0.0, 0.6, 0.6);
    this.materialBody.alpha = 1.0;
    this.materialBody.useSpecularOverAlpha = true;
    this.materialHead = new BABYLON.StandardMaterial('materialHead', this.scene);
    this.materialHead.diffuseColor = new BABYLON.Color3(0.6, 1.0, 1.0);
    this.materialHead.specularColor = new BABYLON.Color3(0.6, 1.0, 1.0);
    this.materialHead.specularPower = 0;
    // start scene
    this.engine.runRenderLoop(() => this.scene.render());
    window.engine = this.engine;
    window.scene = this.scene;
    // camera
    if (this.camera) this.camera.dispose();
    this.camera = new BABYLON.ArcRotateCamera('camera1', 0, 0, cameraRadius, new BABYLON.Vector3(0.5, 0.5, 0.5), this.scene);
    this.camera.attachControl(this.canvas, false);
    this.camera.lowerRadiusLimit = 0.001;
    this.camera.upperRadiusLimit = 200;
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.position = new BABYLON.Vector3(0, 2.0, -12);
    this.camera.target = new BABYLON.Vector3(0, 0.5, -1); // slightly elevated initial view
    this.camera.alpha = (2 * Math.PI + this.camera.alpha) % (2 * Math.PI); // normalize so its not in negative range
    // environment
    if (this.environment) this.environment.dispose();
    this.environment = this.scene.createDefaultEnvironment({
      createSkybox: true,
      createGround: true,
      skyboxTexture: '../assets/skybox',
      skyboxColor: new BABYLON.Color3(0.7, 0.9, 1.0),
      skyboxSize: 25,
      cameraContrast: 2,
      cameraExposure: 1,
      groundColor: new BABYLON.Color3(0.3, 0.3, 0.3), // new BABYLON.Color3(0.0, 0.3, 0.5),
      groundSize: 5,
      groundShadowLevel: 0.4, // shadow darkness
      groundTexture: '../assets/ground.png',
      enableGroundShadow: true,
      enableGroundMirror: false,
      environmentTexture: '../assets/environment.env',
    }) as BABYLON.EnvironmentHelper;
    // lights
    if (this.ambient) this.ambient.dispose();
    this.ambient = new BABYLON.HemisphericLight('spheric', new BABYLON.Vector3(1, 1, -1), this.scene);
    this.ambient.intensity = 0.5;
    this.ambient.specular = BABYLON.Color3.Black();
    if (this.light) this.light.dispose();
    this.light = new BABYLON.DirectionalLight('directional', new BABYLON.Vector3(0.3, -0.5, 1), this.scene); // new BABYLON.Vector3(-0.5, 1, -2), this.scene);
    this.light.position = new BABYLON.Vector3(-2, 10, -10); // new BABYLON.Vector3(0.0, 2.0, 5.0);
    if (this.shadows) this.shadows.dispose();
    this.shadows = new BABYLON.ShadowGenerator(1024, this.light);
    this.shadows.useBlurExponentialShadowMap = true;
    this.shadows.blurKernel = 8;
    this.shadows.depthScale = 60.0;
    // diag exports
    window.light = this.light;
    window.meshes = this.scene.meshes;
    window.camera = this.camera;
    // animate
    this.intro();
  }

  intro() {
    BABYLON.Animation.CreateAndStartAnimation('camera', this.camera, 'fov', /* FPS */ 60, /* frames */ 120, /* start */ 1.0, /* end */ 0.1, /* loop */ 0, new BABYLON.BackEase());
    BABYLON.Animation.CreateAndStartAnimation('light', this.light, 'direction.x', /* FPS */ 20, /* frames */ 80, /* start */ -0.6, /* end */ 0.3, /* loop */ 0, new BABYLON.CircleEase());
    BABYLON.Animation.CreateAndStartAnimation('light', this.light, 'direction.y', /* FPS */ 25, /* frames */ 100, /* start */ -0.1, /* end */ -0.5, /* loop */ 0, new BABYLON.CircleEase());
  }

  inspector() {
    if (this.scene.debugLayer.isVisible()) this.scene.debugLayer.hide();
    else this.scene.debugLayer.show({ embedMode: false, overlay: true, showExplorer: true, showInspector: true });
  }
}
