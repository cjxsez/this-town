/**
 * The five materials the scene is drawn with. See shaders.ts for what they do.
 */
import {
  AddEquation,
  CustomBlending,
  DoubleSide,
  GLSL3,
  Matrix4,
  OneFactor,
  OneMinusSrcAlphaFactor,
  RawShaderMaterial,
  Vector3,
  type Texture,
} from "three";
import type { Config } from "../config";
import { hexToRgb } from "../scene/builder";
import type { SceneMaterials } from "../scene/world";
import { DEPTH_FRAG, DEPTH_VERT, FLAT_FRAG, FLAT_VERT, PAINT_FRAG, PAINT_VERT } from "./shaders";

export interface Materials extends SceneMaterials {
  world: RawShaderMaterial;
  hud: RawShaderMaterial;
  foam: RawShaderMaterial;
  dropShadow: RawShaderMaterial;
  /** Used for everything while the shadow map is drawn. */
  depth: RawShaderMaterial;
  /** World position to shadow-map position. Updated every frame. */
  shadowMatrix: Matrix4;
  /** Direction to the title's light in world space. Updated every frame as the camera turns. */
  hudLight: Vector3;
  dispose(): void;
}

export const vec3 = (hex: string) => new Vector3(...hexToRgb(hex));
export const unit = (v: readonly [number, number, number]) => new Vector3(v[0], v[1], v[2]).normalize();

export function createMaterials(config: Config, shadowMap: Texture, atlas: Texture): Materials {
  const L = config.light;
  const shadowMatrix = new Matrix4();
  const hudLight = unit(L.hudDirection);
  const shade = vec3(config.colors.shadow);

  const world = new RawShaderMaterial({
    name: "world",
    glslVersion: GLSL3,
    vertexShader: FLAT_VERT,
    fragmentShader: FLAT_FRAG,
    defines: { RECEIVE_SHADOW: "" },
    uniforms: {
      uLightDir: { value: unit(L.direction) },
      uShadeColor: { value: shade },
      uShadeMix: { value: L.shadeMix },
      uShadowMap: { value: shadowMap },
      uShadowMatrix: { value: shadowMatrix },
      uShadowBias: { value: L.shadowBias },
      uShadowNormalBias: { value: L.shadowNormalBias },
    },
  });

  const hud = new RawShaderMaterial({
    name: "hud",
    glslVersion: GLSL3,
    vertexShader: FLAT_VERT,
    fragmentShader: FLAT_FRAG,
    defines: { USE_ATLAS: "" },
    uniforms: {
      uLightDir: { value: hudLight },
      uShadeColor: { value: shade },
      uShadeMix: { value: L.hudShadeMix },
      uAtlas: { value: atlas },
      uInk: { value: vec3(config.colors.ink) },
      uLetterLight: { value: vec3(config.colors[config.hud.roundel.light]) },
    },
  });

  const paint = (name: string, alpha: number) =>
    new RawShaderMaterial({
      name,
      glslVersion: GLSL3,
      vertexShader: PAINT_VERT,
      fragmentShader: PAINT_FRAG,
      uniforms: { uAlpha: { value: alpha } },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      // Premultiplied "over". Writing (0,0,0,0) to the second image leaves it untouched.
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
    });
  const foam = paint("foam", 1);
  const dropShadow = paint("dropShadow", config.hud.dropShadow.alpha);

  const depth = new RawShaderMaterial({
    name: "depth",
    glslVersion: GLSL3,
    vertexShader: DEPTH_VERT,
    fragmentShader: DEPTH_FRAG,
    colorWrite: false,
  });

  return {
    world,
    hud,
    foam,
    dropShadow,
    depth,
    shadowMatrix,
    hudLight,
    dispose() {
      for (const material of [world, hud, foam, dropShadow, depth]) material.dispose();
    },
  };
}
