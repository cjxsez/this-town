/**
 * The running start screen: builds the scene, runs the clock, answers the pointer.
 *
 * Two kinds of motion meet here:
 * - the intro and the "after BEGIN" sequence are pure functions of time
 *   (core/timeline.ts), so a frozen clock always draws the same frame;
 * - everything that answers the pointer is a spring (core/spring.ts), layered on top.
 */
import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { CONFIG, type CueName, type TimeOfDay } from "./config";
import { StartClock } from "./core/clock";
import { clamp01, mix } from "./core/ease";
import { computeLayout, hitTest, splitTitle, type HudLayout } from "./core/layout";
import { Spring } from "./core/spring";
import { introEnd, introState, outroState, roundelIdleTurn } from "./core/timeline";
import type { Overlay } from "./dom";
import { createMaterials } from "./render/materials";
import { Pipeline } from "./render/pipeline";
import { IdAllocator } from "./scene/builder";
import { buildGlyphAtlas } from "./scene/glyphs";
import { buildHud } from "./scene/hud";
import { buttonPose, cameraPose, hudUnitsPerPx, islandPose, tilePose } from "./scene/pose";
import { buildWorld } from "./scene/world";

export interface RuntimeOptions {
  /** The letters on the tiles. */
  title: string;
  timeOfDay: TimeOfDay;
  /** Hold the intro clock at this many seconds. null = run normally. */
  freezeAt: number | null;
  /** Hold the "after BEGIN" clock at this many seconds. null = run normally. */
  freezeOutroAt: number | null;
  reducedMotion: boolean;
  onBegin?: () => void;
  onCue?: (cue: CueName) => void;
}

export interface Runtime {
  begin(): void;
  dispose(): void;
}

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Throws if WebGL2 is not available; the caller falls back to plain HTML. */
export function createRuntime(overlay: Overlay, o: RuntimeOptions): Runtime {
  const config = CONFIG;
  const { root, canvas, button } = overlay;

  // ---------------------------------------------------------------- scene
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  const pipeline = new Pipeline(renderer, config, o.timeOfDay);

  const chars = Array.from(splitTitle(o.title, config.maxLettersPerRow).join(""));
  const R = config.hud.roundel;
  const atlas = buildGlyphAtlas(chars, config.buttonLabel, config);
  const materials = createMaterials(config, pipeline.shadowTarget.depthTexture!, atlas.texture);
  const ids = new IdAllocator();
  const world = buildWorld(config, config.seas[o.timeOfDay], ids, materials);
  const hud = buildHud(chars, config, ids, atlas, materials);

  const scene = new Scene();
  const camera = new PerspectiveCamera(config.camera.fovDeg, 1, config.camera.near, 1000);
  hud.group.position.z = -config.hud.distance;
  camera.add(hud.group);
  scene.add(camera, world.group, world.foam);

  // ---------------------------------------------------------------- clocks
  const tileCount = chars.length;
  const restAt = introEnd(config.intro, tileCount);
  /** Which roundel each tile is (0, 1, ...), or -1 for a square tile. */
  let roundelCount = 0;
  const roundelIndex = hud.tiles.map((tile) => (tile.roundel ? roundelCount++ : -1));
  const cue = (name: CueName) => o.onCue?.(name);
  const clock = new StartClock(
    {
      freezeAt: o.freezeAt,
      freezeOutroAt: o.freezeOutroAt,
      reducedMotion: o.reducedMotion,
      restAt,
      inputAt: config.intro.inputAt,
      doneAt: config.outro.doneAt,
    },
    config.cues,
    cue,
  );
  /** The wobble is only redrawn while time is actually passing. */
  const still = clock.frozen || o.reducedMotion;

  // ---------------------------------------------------------------- pointer
  const S = config.interaction.springs;
  const tileSprings = hud.tiles.map(() => ({
    tiltX: new Spring(S.tilt),
    tiltY: new Spring(S.tilt),
    lift: new Spring(S.lift),
    flap: new Spring(S.flap),
  }));
  const hover = new Spring(S.lift);
  const press = new Spring(S.press);
  const lookX = new Spring(S.parallax);
  const lookY = new Spring(S.parallax);

  const pointer = { x: 0, y: 0, inside: false, mouse: false };
  let layout: HudLayout = computeLayout(1, 1, o.title, config);
  let viewW = 1;
  let viewH = 1;
  let finished = false;
  let hovered = "";
  let dragging = false;
  let dragDeg = 0;
  let dragSpeed = 0;
  let dragX = 0;
  let dragAt = 0;

  const track = (e: PointerEvent) => {
    const box = root.getBoundingClientRect();
    pointer.x = e.clientX - box.left - box.width / 2;
    pointer.y = box.height / 2 - (e.clientY - box.top);
    pointer.inside = true;
    pointer.mouse = e.pointerType === "mouse";
  };

  const onMove = (e: PointerEvent) => {
    track(e);
    if (!dragging) return;
    // Dragging right pulls the near side of the island right, so the camera goes left.
    const turned = -(e.clientX - dragX) * config.camera.dragDegPerPx;
    const seconds = Math.max(1, e.timeStamp - dragAt) / 1000;
    dragDeg += turned;
    dragSpeed = mix(dragSpeed, turned / seconds, 0.5);
    dragX = e.clientX;
    dragAt = e.timeStamp;
  };

  const onDown = (e: PointerEvent) => {
    track(e);
    if (!clock.inputOn) return;
    const hit = hitTest(layout, pointer.x, pointer.y);
    if (hit?.kind === "tile") {
      // Tap the top half and the tile tips away from you; the bottom half, towards you.
      const away = pointer.y >= layout.tiles[hit.index]!.cy;
      tileSprings[hit.index]!.flap.target += (away ? -1 : 1) * TAU * config.interaction.tileFlapTurns;
      cue(hud.tiles[hit.index]!.roundel ? "roundel" : "flap");
    } else if (hit?.kind === "button") {
      press.target = 1;
    } else {
      dragging = true;
      dragSpeed = 0;
      dragX = e.clientX;
      dragAt = e.timeStamp;
      root.setPointerCapture(e.pointerId);
      root.classList.add("qls--dragging");
    }
  };

  const onUp = (e: PointerEvent) => {
    press.target = 0;
    if (dragging) {
      dragging = false;
      root.classList.remove("qls--dragging");
      // A finger that stopped before lifting should not fling the island.
      if (e.timeStamp - dragAt > 90) dragSpeed = 0;
    }
    // A lifted finger is no longer hovering anything.
    if (e.pointerType !== "mouse") pointer.inside = false;
  };

  const onLeave = () => {
    pointer.inside = false;
    press.target = 0;
  };

  const begin = () => {
    if (!clock.begin()) return;
    button.disabled = true;
    // Keyboard and tap both get a visible push.
    press.value = 1;
    press.target = 0;
  };

  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("pointerleave", onLeave);
  button.addEventListener("click", begin);

  // ---------------------------------------------------------------- one frame
  const shadowCenter = new Vector3();
  const seeds = config.wobble.seeds;

  const step = (dt: number, now: number) => {
    clock.tick(dt);
    const t = clock.t;
    const intro = introState(t, config.intro, tileCount);
    const outro = clock.outT === null ? null : outroState(clock.outT, config.outro, tileCount);

    // What is the pointer over?
    const live = clock.inputOn;
    if (button.disabled === live) button.disabled = !live;
    const hit = live && pointer.inside ? hitTest(layout, pointer.x, pointer.y) : null;
    const over = hit ? (hit.kind === "tile" ? `tile${hit.index}` : "button") : "";
    if (over && over !== hovered) cue("hover");
    hovered = over;
    root.classList.toggle("qls--pointing", hit?.kind === "tile");

    // Camera: circling, plus drag, pointer parallax and the dive after BEGIN.
    lookX.target = live && pointer.inside && pointer.mouse ? clamp(pointer.x / (viewW / 2), -1, 1) : 0;
    lookY.target = live && pointer.inside && pointer.mouse ? clamp(pointer.y / (viewH / 2), -1, 1) : 0;
    lookX.step(dt);
    lookY.step(dt);
    if (!dragging && dt > 0) {
      dragDeg += dragSpeed * dt;
      dragSpeed *= Math.exp(-dt / config.camera.dragGlideSeconds);
    }
    const view = cameraPose(
      { seconds: t, viewW, viewH, dive: outro?.dive ?? 0, parallaxX: lookX.value, parallaxY: lookY.value, dragDeg },
      config,
    );
    const azimuth = view.azimuthDeg * RAD;
    const elevation = view.elevationDeg * RAD;
    const targetY = config.camera.targetY;
    camera.position.set(
      view.distance * Math.cos(elevation) * Math.sin(azimuth),
      targetY + view.distance * Math.sin(elevation),
      view.distance * Math.cos(elevation) * Math.cos(azimuth),
    );
    camera.lookAt(0, targetY, 0);
    camera.rotateX(view.tiltUpRad);
    const far = view.distance + config.world.shore.radius * 4;
    if (Math.abs(camera.far - far) > 1) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }

    // Island, train, foam.
    const island = islandPose(intro, config);
    world.group.position.y = island.y;
    world.group.scale.setScalar(island.scale);
    world.group.rotation.y = island.yaw;
    world.update(t, mix(config.intro.foamFromScale, 1, intro.foam));
    materials.foam.uniforms.uAlpha!.value = clamp01(intro.foam * 1.6);

    // Title tiles.
    hud.tiles.forEach((tile, i) => {
      const spring = tileSprings[i]!;
      const slot = layout.tiles[i]!;
      const k = roundelIndex[i]!;
      const coin =
        k < 0 ? 0 : R.introTurns * TAU * (1 - (intro.tiles[i] ?? 1)) + roundelIdleTurn(t, restAt, k, R);
      const on = hit?.kind === "tile" && hit.index === i;
      spring.lift.target = on ? 1 : 0;
      // Lean as if the pointer pressed that side of the tile back.
      spring.tiltY.target = on ? clamp((pointer.x - slot.cx) / (layout.tileW / 2), -1, 1) : 0;
      spring.tiltX.target = on ? -clamp((pointer.y - slot.cy) / (layout.tileH / 2), -1, 1) : 0;
      hud.poseTile(
        i,
        tilePose(
          {
            rest: tile.rest,
            intro: intro.tiles[i] ?? 1,
            pop: intro.tilePop[i] ?? 1,
            outro: outro?.tiles[i] ?? 0,
            tiltX: spring.tiltX.step(dt),
            tiltY: spring.tiltY.step(dt),
            lift: spring.lift.step(dt),
            flap: spring.flap.step(dt),
            coin,
          },
          config,
        ),
      );
    });

    // Button.
    hover.target = live && (hit?.kind === "button" || button.matches(":focus-visible")) ? 1 : 0;
    hud.poseButton(
      buttonPose({ intro: intro.button, outro: outro?.button ?? 0, hover: hover.step(dt), press: press.step(dt) }, config),
    );

    // The title is lit from a direction that turns with the camera.
    const [hx, hy, hz] = config.light.hudDirection;
    materials.hudLight.set(hx, hy, hz).normalize().applyQuaternion(camera.quaternion);

    shadowCenter.set(0, island.y + targetY, 0);
    pipeline.aimShadow(shadowCenter, config.world.shore.radius * 1.2 * island.scale, materials);

    // Boil: a new wobble pattern a few times a second. Held still when frozen.
    const boil = still ? 0 : Math.floor(now / config.wobble.boilMs) % seeds.length;
    pipeline.setTime(t, seeds[boil] ?? seeds[0]);
    pipeline.render(scene, camera, materials);

    overlay.setCover(outro ? outro.cover : intro.cover);

    if (clock.finished && !finished) {
      finished = true;
      stop();
      o.onBegin?.();
    }
  };

  // ---------------------------------------------------------------- loop and size
  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // A background tab can hand back a huge gap; never jump more than a tenth of a second.
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    step(dt, now);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const resize = () => {
    viewW = Math.max(1, root.clientWidth);
    viewH = Math.max(1, root.clientHeight);
    const q = config.quality;
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio, Math.sqrt(q.maxPixels / (viewW * viewH)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(viewW, viewH, false);
    pipeline.setSize(viewW, viewH, dpr);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    layout = computeLayout(viewW, viewH, o.title, config, overlay.readInsets());
    hud.setLayout(layout, hudUnitsPerPx(viewH, config));
    overlay.placeButton(layout);
  };
  const observer = new ResizeObserver(() => {
    resize();
    // Redraw at once so a resized, stopped screen is never blank.
    step(0, performance.now());
  });

  resize();
  // The first frame compiles the shaders behind the closed doors; then the clock starts.
  step(0, performance.now());
  observer.observe(root);
  overlay.setLoading(false);
  root.dataset.ready = "1";
  if (!finished) raf = requestAnimationFrame(frame);

  return {
    begin,
    dispose() {
      stop();
      observer.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("pointerleave", onLeave);
      button.removeEventListener("click", begin);
      world.dispose();
      hud.dispose();
      atlas.dispose();
      materials.dispose();
      pipeline.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
