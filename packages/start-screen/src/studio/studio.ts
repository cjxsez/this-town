/**
 * Renders every shot in shots.ts and shows the results. `scripts/render-art.mjs`
 * opens this page in headless Chrome and saves what it finds in `window.__art`.
 *
 *   /studio.html            all shots
 *   /studio.html?only=fox   shots whose id contains "fox"
 */
import { DataTexture, Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import "@fontsource/bungee/latin-400.css";
import { CONFIG } from "../config";
import { createMaterials } from "../render/materials";
import { Pipeline } from "../render/pipeline";
import { IdAllocator } from "../scene/builder";
import { buildWorld } from "../scene/world";
import { SHOTS, type Shot } from "./shots";

declare global {
  interface Window {
    __art: { done: boolean; shots: Record<string, string>; error?: string };
  }
}
window.__art = { done: false, shots: {} };

const RAD = Math.PI / 180;
const only = new URLSearchParams(location.search).get("only");

const renderer = new WebGLRenderer({
  alpha: true,
  premultipliedAlpha: true,
  preserveDrawingBuffer: true,
  antialias: false,
  depth: false,
  stencil: false,
});
renderer.setClearColor(0x000000, 0);
const pipeline = new Pipeline(renderer, CONFIG, "Day");
const blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
blank.needsUpdate = true;
const materials = createMaterials(CONFIG, pipeline.shadowTarget.depthTexture!, blank);

function render(shot: Shot): string {
  const subject = shot.build({ config: CONFIG, ids: new IdAllocator(), materials });
  const scene = new Scene();
  scene.add(subject.root);

  const { azimuthDeg, elevationDeg, fovDeg, fill } = shot.camera;
  const aspect = shot.width / shot.height;
  const camera = new PerspectiveCamera(fovDeg, aspect, 0.1, 1000);
  // Far enough back that the subject's ball fits the narrower side of the frame.
  const half = Math.min(fovDeg * RAD, 2 * Math.atan(Math.tan((fovDeg * RAD) / 2) * aspect)) / 2;
  const distance = subject.radius / Math.sin(half) / fill;
  const az = azimuthDeg * RAD;
  const el = elevationDeg * RAD;
  camera.position.set(
    subject.center.x + distance * Math.cos(el) * Math.sin(az),
    subject.center.y + distance * Math.sin(el),
    subject.center.z + distance * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(subject.center);
  camera.near = Math.max(0.05, distance - subject.radius * 40);
  camera.far = distance + subject.radius * 40 + 200;
  camera.updateProjectionMatrix();
  scene.add(camera);

  // Light every subject from the viewer's upper left, a little in front, so faces are lit.
  const sun = new Vector3(-0.5, 0.75, 0.55).applyQuaternion(camera.quaternion);
  pipeline.setLight(sun, materials);

  renderer.setPixelRatio(shot.scale);
  renderer.setSize(shot.width, shot.height, false);
  pipeline.setSize(shot.width, shot.height, shot.scale);
  pipeline.setClear(shot.background === "clear");
  pipeline.setTime(0, CONFIG.wobble.seeds[0]);
  pipeline.aimShadow(subject.center, Math.max(subject.radius * 1.6, 4), materials);
  scene.updateMatrixWorld(true);
  pipeline.render(scene, camera, materials);
  return renderer.domElement.toDataURL("image/webp", 0.92);
}

// ?review=cds shows large close-ups of the town from four sides instead (nothing is saved).
const review = new URLSearchParams(location.search).get("review");
const closeUps: Shot[] = [20, 110, 200, 290].map((azimuthDeg) => ({
  id: `review-${azimuthDeg}`,
  width: 520,
  height: 460,
  scale: 2,
  background: "sea" as const,
  camera: { azimuthDeg, elevationDeg: 24, fovDeg: 30, fill: 1.25 },
  build(ctx) {
    const world = buildWorld(ctx.config, ctx.config.seas.Day, ctx.ids, ctx.materials);
    world.update(3);
    const g = new Group();
    g.add(world.group, world.foam);
    return { root: g, center: new Vector3(0, 9, 0), radius: 21 };
  },
}));

const wall = document.getElementById("wall")!;
try {
  for (const shot of review ? closeUps : SHOTS) {
    if (only && !shot.id.includes(only)) continue;
    const url = render(shot);
    window.__art.shots[shot.id] = url;
    const figure = document.createElement("figure");
    figure.innerHTML = `<img width="${shot.width}" height="${shot.height}" alt=""><figcaption></figcaption>`;
    figure.querySelector("img")!.src = url;
    figure.querySelector("figcaption")!.textContent = `${shot.id} · ${shot.width}×${shot.height} @${shot.scale}x`;
    wall.append(figure);
  }
} catch (error) {
  window.__art.error = String(error);
  console.error(error);
}
window.__art.done = true;
