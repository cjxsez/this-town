/**
 * Draws one frame: shadow map, then the scene into two images, then sea + ink
 * + wobble, then smoothing. See shaders.ts.
 */
import {
  BufferGeometry,
  Camera,
  DepthTexture,
  Float32BufferAttribute,
  GLSL3,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RawShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";
import type { Config, TimeOfDay } from "../config";
import { SHADOW_LAYER } from "../scene/world";
import { type Materials, unit, vec3 } from "./materials";
import { COMPOSITE_FRAG, FXAA_FRAG, SCREEN_VERT } from "./shaders";

/** The phone app's blobs were drawn for a 402px-wide screen; noise scales from that. */
const DESIGN_WIDTH = 402;

export class Pipeline {
  readonly shadowCamera = new OrthographicCamera();
  readonly shadowTarget: WebGLRenderTarget;
  private readonly sceneTarget: WebGLRenderTarget;
  private readonly inkTarget: WebGLRenderTarget;
  private readonly composite: RawShaderMaterial;
  private readonly fxaa: RawShaderMaterial;
  private readonly screen: Mesh<BufferGeometry, RawShaderMaterial>;
  private readonly screenCamera = new Camera();
  private readonly light: Vector3;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly config: Config,
    timeOfDay: TimeOfDay,
  ) {
    const size = config.quality.shadowMapSize;
    this.shadowTarget = new WebGLRenderTarget(size, size, {
      depthTexture: new DepthTexture(size, size),
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    });
    this.shadowCamera.layers.set(SHADOW_LAYER);
    this.light = unit(config.light.direction);

    // Image 0: colour (smooth sampling, so the wobble can read between pixels).
    // Image 1: face direction + object id (exact values, never blended).
    this.sceneTarget = new WebGLRenderTarget(4, 4, { count: 2, minFilter: NearestFilter, magFilter: NearestFilter });
    const color = this.sceneTarget.textures[0]!;
    color.minFilter = LinearFilter;
    color.magFilter = LinearFilter;
    this.inkTarget = new WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });

    const sea = config.seas[timeOfDay];
    const blobs = config.sea.blobs;
    this.composite = new RawShaderMaterial({
      name: "composite",
      glslVersion: GLSL3,
      vertexShader: SCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      defines: { BLOBS: blobs.length },
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: color },
        tNormalId: { value: this.sceneTarget.textures[1]! },
        uResolution: { value: new Vector2(4, 4) },
        uDpr: { value: 1 },
        uTime: { value: 0 },
        uSeed: { value: config.wobble.seeds[0] },
        uInk: { value: vec3(config.colors.ink) },
        uSea: { value: vec3(sea.sea) },
        uFoam: { value: vec3(sea.foam) },
        uFoam2: { value: vec3(sea.foam2) },
        uInkWidth: { value: config.ink.widthPx },
        uPressure: { value: new Vector2(config.ink.pressure[0], config.ink.pressure[1]) },
        uPressureFreq: { value: config.ink.pressureFrequency },
        uCreaseCos: { value: Math.cos((config.ink.creaseDeg * Math.PI) / 180) },
        uWobAmount: { value: config.wobble.amountPx },
        uWobFreq: { value: config.wobble.frequency },
        uBlobs: { value: blobs.map(() => new Vector4()) },
        uBlobLook: { value: blobs.map((b) => new Vector2(b.color === "foam" ? 1 : 0, b.phase)) },
        uRag: { value: 0 },
        uRagFreq: { value: config.sea.ragFrequency },
        uDrift: { value: 0 },
        uDriftSeconds: { value: config.sea.driftSeconds },
      },
    });
    this.fxaa = new RawShaderMaterial({
      name: "fxaa",
      glslVersion: GLSL3,
      vertexShader: SCREEN_VERT,
      fragmentShader: FXAA_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: { tDiffuse: { value: this.inkTarget.texture }, uTexel: { value: new Vector2(1, 1) } },
    });

    // One big triangle that covers the screen.
    const triangle = new BufferGeometry();
    triangle.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.screen = new Mesh(triangle, this.composite);
    this.screen.frustumCulled = false;
  }

  /** `width` and `height` are CSS pixels; `dpr` is device pixels per CSS pixel. */
  setSize(width: number, height: number, dpr: number): void {
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    this.sceneTarget.setSize(w, h);
    this.inkTarget.setSize(w, h);
    const u = this.composite.uniforms;
    (u.uResolution!.value as Vector2).set(w, h);
    u.uDpr!.value = dpr;
    (this.fxaa.uniforms.uTexel!.value as Vector2).set(1 / w, 1 / h);

    const { ink, sea } = this.config;
    u.uInkWidth!.value = width < ink.narrowBelowPx ? ink.narrowWidthPx : ink.widthPx;
    const blobUnit = Math.min(width, height * sea.blobUnitOfH);
    u.uRag!.value = sea.ragOfUnit * blobUnit;
    u.uRagFreq!.value = (sea.ragFrequency * DESIGN_WIDTH) / blobUnit;
    u.uDrift!.value = sea.driftOfUnit * blobUnit;
    sea.blobs.forEach((b, i) => {
      (u.uBlobs!.value as Vector4[])[i]!.set(b.x * width, b.y * height, b.rx * blobUnit, b.ry * blobUnit);
    });
  }

  /** `seconds` drives the drifting foam; `seed` picks the wobble pattern. */
  setTime(seconds: number, seed: number): void {
    this.composite.uniforms.uTime!.value = seconds;
    this.composite.uniforms.uSeed!.value = seed;
  }

  /** Aim the sun's shadow camera at the island, wherever the intro has put it. */
  aimShadow(center: Vector3, radius: number, materials: Materials): void {
    const cam = this.shadowCamera;
    const reach = radius * 3;
    cam.left = cam.bottom = -radius;
    cam.right = cam.top = radius;
    cam.near = radius * 0.5;
    cam.far = reach + radius * 2.5;
    cam.position.copy(center).addScaledVector(this.light, reach);
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // Clip space (-1..1) to texture space (0..1), then projection, then view.
    materials.shadowMatrix
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(cam.projectionMatrix)
      .multiply(cam.matrixWorldInverse);
  }

  render(scene: Scene, camera: Camera, materials: Materials): void {
    const { renderer } = this;

    scene.overrideMaterial = materials.depth;
    renderer.setRenderTarget(this.shadowTarget);
    renderer.render(scene, this.shadowCamera);
    scene.overrideMaterial = null;

    renderer.setRenderTarget(this.sceneTarget);
    renderer.render(scene, camera);

    const smooth = this.config.quality.fxaa;
    this.draw(this.composite, smooth ? this.inkTarget : null);
    if (smooth) this.draw(this.fxaa, null);
  }

  private draw(material: RawShaderMaterial, target: WebGLRenderTarget | null): void {
    this.screen.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.screen as Object3D, this.screenCamera);
  }

  dispose(): void {
    this.shadowTarget.depthTexture?.dispose();
    this.shadowTarget.dispose();
    this.sceneTarget.dispose();
    this.inkTarget.dispose();
    this.composite.dispose();
    this.fxaa.dispose();
    this.screen.geometry.dispose();
  }
}
