/**
 * The live platform scene for the app's ride screens.
 *
 *   import { mountPlatformScene } from "@questline/start-screen";
 *   const scene = mountPlatformScene(element, { line: "green", mode: "loop" });
 *   // later: scene.dispose();
 *
 * It is the start screen's island seen from one of its platforms: your rider in
 * front of you, the track curving away, the campus beyond, and the trolley
 * coming round the bend and pulling in. Same renderer, same ink, same colours.
 * Every number is in config.ts under `platformScene`.
 */
import { DataTexture, Mesh, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { CONFIG, type Config, type TimeOfDay } from "./config";
import { platformClock } from "./core/platformClock";
import { createMaterials } from "./render/materials";
import { Pipeline } from "./render/pipeline";
import { IdAllocator, place } from "./scene/builder";
import { buildWorld, ringFrame, SHADOW_LAYER } from "./scene/world";
import { figureGeometry } from "./studio/models";

export const LINE_NAMES = ["green", "red", "orange", "blue"] as const;
export type LineName = (typeof LINE_NAMES)[number];

export interface PlatformSceneOptions {
  /** The rider's line: the trolley's stripe and the shelter roof take its colour. Default "green". */
  line?: LineName;
  /**
   * "loop" (default): trolleys keep coming, the first a few seconds after the scene appears.
   * "arrive": one trolley, due at `arriveAt`; it rolls in for the last seconds and stays.
   */
  mode?: "loop" | "arrive";
  /** "arrive": when the train is due, as epoch milliseconds. Without it, it comes in straight away. */
  arriveAt?: number;
  /** Your rider's shirt colour (hex). Default orange. */
  riderColor?: string;
  timeOfDay?: TimeOfDay;
  /** Park the train at the platform and hold everything still. Defaults to the system setting. */
  reducedMotion?: boolean;
  /** Hold the scene at this timetable second (0 = the train stops in front of you). For previews. */
  freezeClock?: number | null;
}

export interface PlatformSceneHandle {
  /** Resolves true once the scene is drawing, false if WebGL is not available. */
  ready: Promise<boolean>;
  /** Update when the train is due ("arrive" mode) without rebuilding the scene. */
  setArriveAt(epochMs: number | undefined): void;
  dispose(): void;
}

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;

export function mountPlatformScene(container: HTMLElement, options: PlatformSceneOptions = {}): PlatformSceneHandle {
  let arriveAt = options.arriveAt;
  let stop: (() => void) | null = null;
  let disposed = false;

  const ready = Promise.resolve().then(() => {
    if (disposed) return false;
    try {
      stop = start(container, options, () => arriveAt);
      return true;
    } catch (error) {
      console.warn("[platform-scene] 3D scene unavailable.", error);
      return false;
    }
  });

  return {
    ready,
    setArriveAt(epochMs) {
      arriveAt = epochMs;
    },
    dispose() {
      disposed = true;
      stop?.();
      stop = null;
    },
  };
}

/** Builds and runs the scene. Returns the function that tears it down. Throws without WebGL2. */
function start(container: HTMLElement, o: PlatformSceneOptions, arriveAt: () => number | undefined): () => void {
  const P = CONFIG.platformScene;
  const timeOfDay = o.timeOfDay ?? "Day";
  const mode = o.mode ?? "loop";
  const reducedMotion = o.reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const freeze = o.freezeClock ?? null;
  const lineHex = CONFIG.lineColors[LINE_NAMES.indexOf(o.line ?? "green")] ?? CONFIG.lineColors[0];

  // The same island, dressed for this rider: their line's colour on the trolley and on
  // this stop's shelter, nobody else waiting, and a timetable with one stop (this one).
  const S = CONFIG.world.stations;
  const config = {
    ...CONFIG,
    lineColors: [lineHex, lineHex, ...CONFIG.lineColors.filter((c) => c !== lineHex)],
    world: { ...CONFIG.world, stations: { ...S, riders: S.riders.map(() => []) } },
    train: { ...CONFIG.train, legSeconds: P.legSeconds, dwellSeconds: P.dwellSeconds, startSeconds: 0 },
  } as unknown as Config;
  const W = config.world;
  const C = config.colors;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;display:block;width:100%;height:100%";
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  container.append(canvas);

  const pipeline = new Pipeline(renderer, config, timeOfDay);
  const blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const materials = createMaterials(config, pipeline.shadowTarget.depthTexture!, blank);
  const ids = new IdAllocator();
  const stopDeg = S.anglesDeg[P.station] ?? S.anglesDeg[0];
  const world = buildWorld(config, config.seas[timeOfDay], ids, materials, { trainStripe: lineHex, stopsDeg: [stopDeg] });
  const scene = new Scene();
  scene.add(world.group, world.foam);

  // Platform space: x along the platform, y above its top, z away from the track.
  const platformRadius = W.track.radius + W.track.width / 2 + S.platformGap + S.platformWidth / 2;
  const platformTop = W.grass.top + S.platformHeight;
  const frame = ringFrame(platformRadius, stopDeg);
  const onPlatform = ([x, y, z]: readonly [number, number, number]) => new Vector3(x, platformTop + y, z).applyMatrix4(frame);

  const rider = new Mesh(figureGeometry({ shirt: o.riderColor ?? C.orange, hair: C.inkSoft, badge: C.paper }, C, ids), materials.world);
  rider.layers.enable(SHADOW_LAYER);
  rider.applyMatrix4(frame.clone().multiply(place(P.rider.x, platformTop, P.rider.z, P.rider.turnDeg * RAD, P.rider.height)));
  scene.add(rider);

  const camera = new PerspectiveCamera(P.fovDeg, 1, 0.3, 400);
  const eye = onPlatform(P.eye);
  const target = onPlatform(P.lookAt);
  camera.position.copy(eye);
  camera.lookAt(target);
  scene.add(camera);
  const sideways = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  // Sun over the viewer's shoulder, so what faces you is lit; shadows aimed at the platform.
  pipeline.setLight(new Vector3(P.sun[0], P.sun[1], P.sun[2]).applyQuaternion(camera.quaternion), materials);
  pipeline.aimShadow(onPlatform([0, 1, -4]), 30, materials);

  const seeds = config.wobble.seeds;
  const began = performance.now();
  let raf = 0;

  const draw = (now: number) => {
    const elapsed = (now - began) / 1000;
    const due = arriveAt();
    const clock =
      freeze ??
      platformClock({ mode, elapsed, untilArrival: due === undefined ? undefined : (due - Date.now()) / 1000, reducedMotion }, P);
    world.update(clock);
    const still = reducedMotion || freeze !== null;
    const sway = still ? 0 : Math.sin((elapsed * TAU) / P.swaySeconds) * P.swayAmount;
    camera.position.copy(eye).addScaledVector(sideways, sway);
    camera.lookAt(target);
    pipeline.setTime(still ? 0 : elapsed, seeds[still ? 0 : Math.floor(now / config.wobble.boilMs) % seeds.length] ?? seeds[0]);
    pipeline.render(scene, camera, materials);
  };
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    draw(now);
  };

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const q = config.quality;
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio, Math.sqrt(q.maxPixels / (w * h)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h, dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw(performance.now());
  };
  const observer = new ResizeObserver(resize);
  resize();
  observer.observe(container);
  // With nothing moving, one frame (redrawn on resize) is enough.
  if (!reducedMotion && freeze === null) raf = requestAnimationFrame(loop);
  container.dataset.ready = "1";

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    world.dispose();
    rider.geometry.dispose();
    materials.dispose();
    pipeline.dispose();
    blank.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    delete container.dataset.ready;
  };
}
