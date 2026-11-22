/**
 * Turns progress numbers (from the timeline and the pointer springs) into where
 * things are. Pure functions: no three.js, no state.
 *
 * Tile and button offsets are in their own sizes so they work at any screen size:
 * dy in heights, dz in depths. Rotations are radians.
 */
import type { Config } from "../config";
import { mix } from "../core/ease";

const RAD = Math.PI / 180;

export interface TilePoseInput {
  rest: { pitch: number; yaw: number; roll: number };
  /** Intro flip progress (overshoots 1), grow-from-nothing progress, outro progress. */
  intro: number;
  pop: number;
  outro: number;
  /** Lean towards the pointer, -1..1 on each axis. */
  tiltX: number;
  tiltY: number;
  /** 0..1 while hovered. */
  lift: number;
  /** Extra spin about the horizontal axis from taps, radians. */
  flap: number;
  /** Extra spin about the upright axis, like a coin (the roundels), radians. */
  coin?: number;
}

export function tilePose(i: TilePoseInput, c: Config) {
  const tilt = c.interaction.tileTiltDeg * RAD;
  return {
    dy: c.intro.tileDropFrom * (1 - i.intro),
    dz: i.lift * c.interaction.tileLiftDepth,
    rotX:
      i.rest.pitch +
      c.intro.tileFlipFromDeg * RAD * (1 - i.intro) +
      c.outro.tileFlipToDeg * RAD * i.outro +
      i.flap +
      i.tiltX * tilt,
    rotY: i.rest.yaw + i.tiltY * tilt + (i.coin ?? 0),
    rotZ: i.rest.roll,
    scale: i.pop * (1 - i.outro) * (1 + c.interaction.tileLiftScale * i.lift),
  };
}

export function buttonPose(i: { intro: number; outro: number; hover: number; press: number }, c: Config) {
  const B = c.hud.button;
  const X = c.interaction;
  return {
    dy: 0 - i.outro * c.outro.buttonDrop,
    dz: 0 - i.press * X.buttonPressDepth,
    rotX: B.restPitchDeg * RAD,
    rotZ: B.restRollDeg * RAD + c.intro.buttonRollFromDeg * RAD * (1 - i.intro),
    scale: Math.max(0, i.intro) * (1 - i.outro) * (1 + X.buttonHoverScale * i.hover - X.buttonPressScale * i.press),
  };
}

export function islandPose(i: { rise: number; grow: number; spin: number }, c: Config) {
  return {
    y: mix(c.intro.riseFromY, 0, i.rise),
    scale: mix(c.intro.growFromScale, 1, i.grow),
    yaw: mix(c.intro.spinFromDeg * RAD, 0, i.spin),
  };
}

export interface CameraPoseInput {
  /** Seconds on the intro clock: the camera has been circling since 0. */
  seconds: number;
  viewW: number;
  viewH: number;
  /** 0..1 after BEGIN. */
  dive: number;
  /** Pointer position, -1..1 from the middle of the screen. */
  parallaxX: number;
  parallaxY: number;
  /** How far the island has been dragged round. */
  dragDeg: number;
}

export function cameraPose(i: CameraPoseInput, c: Config) {
  const C = c.camera;
  const tanHalf = Math.tan((C.fovDeg * RAD) / 2);
  // Far enough back that the island is exactly the wanted width in pixels.
  const diameterPx = Math.min(i.viewW * C.islandDiameterOfW, i.viewH * C.islandDiameterOfH);
  const distance = (c.world.shore.radius * i.viewH) / (diameterPx * tanHalf);
  return {
    azimuthDeg:
      C.startAzimuthDeg +
      C.orbitDegPerSec * i.seconds +
      i.dragDeg +
      i.parallaxX * C.parallaxAzimuthDeg +
      i.dive * c.outro.diveOrbitDeg,
    elevationDeg: mix(C.elevationDeg, c.outro.diveElevationDeg, i.dive) + i.parallaxY * C.parallaxElevationDeg,
    distance: mix(distance, distance * c.outro.diveDistance, i.dive),
    /** Tipping the camera up by this much moves the island down the screen. */
    tiltUpRad: Math.atan(C.islandCenterBelowMiddle * 2 * tanHalf),
  };
}

/** World units per CSS pixel on the plane the title sits on. */
export function hudUnitsPerPx(viewH: number, c: Config): number {
  return (2 * c.hud.distance * Math.tan((c.camera.fovDeg * RAD) / 2)) / viewH;
}
