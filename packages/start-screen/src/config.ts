/**
 * Every number, colour and word the start screen uses lives here.
 *
 * Units:
 * - "world" numbers are scene units (the island is about 60 across).
 * - "of W" / "of H" numbers are fractions of the viewport width / height.
 * - times are seconds on the intro clock, which starts when the scene is ready
 *   (fonts loaded, first frame drawn). `?t=1.2` freezes that clock at 1.2.
 * - angles are degrees unless the name says otherwise.
 *
 * Colours are the phone app's design tokens (apps/phone-web/src/styles/tokens.css)
 * and the easing curves are the ones in its anim.css, so this screen looks and moves
 * like the rest of the app.
 */

/** The game's name, as people read it (page title, screen readers, the loader). */
export const NAME = "In This Town";
/**
 * The letters on the tiles. Words go on one row or stack, whichever gives the
 * biggest tiles on the screen at hand: IN / THIS / TOWN on a phone, one line on
 * a desktop. A single word longer than `maxLettersPerRow` is broken over rows.
 */
export const TITLE = "IN THIS TOWN";

export type Bezier = readonly [number, number, number, number];

/** cubic-bezier() control points, same meaning as in CSS. */
export const EASE = {
  /** q-arrive: lands with a little overshoot. */
  arrive: [0.2, 0.9, 0.3, 1.25],
  /** q-sheetUp: quick start, soft landing, no overshoot. */
  sheet: [0.2, 0.9, 0.3, 1],
  /** q-trainIn: a train pulling in. */
  trainIn: [0.1, 0.6, 0.2, 1],
  /** q-trainIn exit: accelerate away. */
  leave: [0.6, 0, 0.9, 0.4],
  /** Sliding doors: slow, fast, slow. */
  doors: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, Bezier>;

export type TimeOfDay = "Day" | "Dusk" | "Night";

export const CONFIG = {
  name: NAME,
  title: TITLE,
  maxLettersPerRow: 5,
  buttonLabel: "BEGIN",
  /** Hand-lettered on the closed doors while the scene loads: one half on each door. */
  loaderCaption: ["Next stop:", NAME],

  // ---------------------------------------------------------------- colours
  colors: {
    ink: "#26343b",
    inkDeep: "#16232a",
    inkSoft: "#48606d",
    shadow: "#557585",
    paper: "#f4f5ec",
    paperHi: "#fbfbf5",
    paperLo: "#d5d9c7",
    stone: "#b7bfb2",
    stoneDk: "#8f9a8e",
    mint: "#e2f6ec",
    yellow: "#f2c84b",
    yellowDk: "#c9982e",
    leaf: "#8fcf95",
    green: "#3f8f5a",
    greenDk: "#2e6e46",
    red: "#d9453b",
    rust: "#c4472a",
    brick: "#a8360f",
    orange: "#e8893a",
    blue: "#3b74c4",
    sand: "#f3d9b1",
  },
  /** sea / foam / foam2 per time of day, from the app's HandDrawnFx. */
  seas: {
    Day: { sea: "#62c1bc", foam: "#9ae4d6", foam2: "#7fd3c8" },
    Dusk: { sea: "#f0a583", foam: "#fbd3bc", foam2: "#f5ba9c" },
    Night: { sea: "#2b4656", foam: "#4a7286", foam2: "#3a5c70" },
  },
  /** Green, Red, Orange, Blue: tile backs and station roofs cycle through these. */
  lineColors: ["#3f8f5a", "#d9453b", "#e8893a", "#3b74c4"],

  // ---------------------------------------------------------------- drawing
  quality: {
    maxPixelRatio: 2,
    /** Pixel ratio also drops until width x height x ratio² fits under this. */
    maxPixels: 2_600_000,
    shadowMapSize: 1024,
    fxaa: true,
  },
  /** Ink outlines, drawn after the scene from object ids and face angles. */
  ink: {
    widthPx: 2,
    /** Thinner line when the viewport is narrower than `narrowBelowPx`. */
    narrowWidthPx: 1.7,
    narrowBelowPx: 600,
    /** Faces of one object that meet at a sharper angle than this get a line. */
    creaseDeg: 55,
    /** Line weight varies between these multiples, like pen pressure. */
    pressure: [0.8, 1.25],
    pressureFrequency: 0.02,
  },
  /** The app's hand-drawn wobble and "boil" (HandDrawnFx), applied to the whole picture. */
  wobble: {
    amountPx: 1.5,
    /** Cycles per CSS pixel: 0.035 is one wave every ~28px. */
    frequency: 0.035,
    /** The wobble is redrawn with the next seed this often. */
    boilMs: 220,
    seeds: [7, 23, 41],
  },
  /** One sun. Faces turned away from it, and anything in a cast shadow, are tinted. */
  light: {
    /** Direction towards the sun in world space. */
    direction: [-0.55, 0.78, 0.3],
    /** 0 = no tint, 1 = solid `colors.shadow`. */
    shadeMix: 0.4,
    shadowBias: 0.0012,
    shadowNormalBias: 0.14,
    /** The title and button are lit from a direction fixed to the camera instead. */
    hudDirection: [-0.4, 0.75, 0.55],
    hudShadeMix: 0.36,
  },
  /** Background: flat sea with ragged foam blobs, like every screen in the app. */
  sea: {
    /**
     * x, y: centre from the middle of the viewport (of W, of H, y up).
     * rx, ry: of the "blob unit", the smaller of W and `blobUnitOfH` x H, so blobs
     * are the same size on a phone as in the app and do not balloon on a wide screen.
     */
    blobUnitOfH: 0.55,
    blobs: [
      { x: -0.3, y: 0.3, rx: 0.4, ry: 0.22, color: "foam2", phase: 0 },
      { x: 0.36, y: 0.18, rx: 0.34, ry: 0.19, color: "foam2", phase: 0.4 },
      { x: 0.24, y: 0.41, rx: 0.15, ry: 0.075, color: "foam", phase: 0.7 },
      { x: -0.34, y: -0.36, rx: 0.3, ry: 0.15, color: "foam2", phase: 0.2 },
    ],
    /** Edge raggedness, as on the app's blobs (34px at 0.012 on a 402px screen). */
    ragOfUnit: 0.085,
    ragFrequency: 0.012,
    driftOfUnit: 0.025,
    driftSeconds: 7,
  },

  // ---------------------------------------------------------------- camera
  camera: {
    fovDeg: 40,
    near: 5,
    elevationDeg: 35,
    startAzimuthDeg: 24,
    /** The camera circles the island for ever. */
    orbitDegPerSec: 5,
    targetY: 3,
    /** The island is as big as fits both of these. */
    islandDiameterOfW: 0.94,
    islandDiameterOfH: 0.66,
    /** The island sits this far below the middle of the screen (of H). */
    islandCenterBelowMiddle: 0.06,
    /** Moving the pointer nudges the camera this much. */
    parallaxAzimuthDeg: 2.4,
    parallaxElevationDeg: 1.3,
    /** Dragging empty space spins the island. */
    dragDegPerPx: 0.32,
    /** Seconds for a drag fling to lose ~63% of its speed. */
    dragGlideSeconds: 0.7,
  },

  // ---------------------------------------------------------------- world
  world: {
    seed: 11,
    /** Outline lumps: [lobes around the island, size as a fraction of the radius]. */
    outlineLumps: [
      [3, 0.035],
      [5, 0.025],
      [8, 0.015],
    ],
    outlineSegments: 48,
    shore: { radius: 31.8, height: 1.3 },
    grass: { radius: 29.2, top: 2.7 },
    /** Two rings of foam on the water around the island (radii as multiples of the shore). */
    foamRing: { outer: 1.24, inner: 1.1, breathe: 0.018, breatheSeconds: 4.2 },
    track: {
      radius: 21,
      width: 4.2,
      height: 0.25,
      segments: 72,
      ties: 48,
      tieLength: 3.4,
      tieWidth: 0.7,
      railGauge: 1.9,
      railWidth: 0.3,
    },
    stations: {
      /** Where the three stops sit around the loop. The train stops at each. */
      anglesDeg: [30, 150, 270],
      platformLength: 14.5,
      platformWidth: 3,
      platformHeight: 0.75,
      /** Gap between the track bed and the platform edge. */
      platformGap: 0.3,
      /** Yellow tactile strip along the platform edge, as in the app's train scene. */
      stripWidth: 0.55,
      shelterLength: 5.2,
      shelterDepth: 1.9,
      shelterHeight: 2.5,
      roofThickness: 0.34,
      postWidth: 0.3,
      signWidth: 2,
      signHeight: 1.1,
      signPostHeight: 1.9,
      riderHeight: 1.7,
      /** Who is waiting at each stop (colour names). Two riders stand together: a match. */
      riders: [["red", "yellow"], ["blue"], ["orange", "paper"]],
    },
    tunnel: {
      angleDeg: 210,
      length: 12.6,
      width: 6.2,
      height: 5,
      /** Each stone mouth is a block this long; the hill covers the track between them. */
      portalDepth: 2.8,
      portalWidth: 4.1,
      portalHeight: 4.2,
      /**
       * The grassy hill over the tunnel: half-sizes along the track, across it, and its height.
       * It is a little shorter than the tunnel, so the stone mouths poke out of it at each end.
       */
      hillAlong: 6,
      hillAcross: 5.6,
      hillHeight: 6.6,
    },
    tower: {
      x: 1.5,
      z: -1,
      width: 3.3,
      height: 9.5,
      capHeight: 1,
      capOverhang: 0.3,
      roofHeight: 3.4,
      clockRadius: 1.05,
      clockY: 7.5,
    },
    rowhouses: {
      count: 5,
      /** They stand in an arc inside the loop, doors facing the track. */
      arcRadius: 11.5,
      arcFromDeg: -62,
      arcToDeg: 4,
      width: 3.3,
      depth: 3.4,
      heights: [4.2, 5.2, 3.8, 4.8, 4.4],
      colors: ["rust", "brick", "paperLo", "rust", "brick"],
      roofHeight: 1.5,
    },
    pond: { x: -7, z: 5, radius: 4.3 },
    trees: {
      count: 20,
      trunkRadius: 0.38,
      trunkHeight: 1.5,
      canopyRadius: [1.6, 2.4],
      /** Trees grow inside the loop within this radius, and in a band outside it. */
      innerRadius: 16.4,
      outerBand: [24.9, 26.4],
      spacing: 3.1,
    },
    rocks: { count: 7, size: [0.9, 1.8] },
  },
  train: {
    cars: 2,
    carLength: 8.4,
    carWidth: 3,
    carHeight: 3.1,
    skirtHeight: 0.45,
    /** Gap between cars, bridged by the dark bellows. */
    carGap: 0.8,
    stripeHeight: 0.5,
    windows: 3,
    /** Seconds to run from one stop to the next, then seconds waiting there. */
    legSeconds: 4.4,
    dwellSeconds: 1.5,
    /** Where on its timetable the train is when the intro starts. */
    startSeconds: 2.6,
  },

  // ---------------------------------------------------------------- title and button
  hud: {
    /** World distance from the camera to the title plane. */
    distance: 40,
    title: {
      /** Middle of the title block above the middle of the screen (of H). */
      centerAboveMiddle: 0.262,
      /** The title never comes closer than this to the top (of H), below any notch. */
      topMarginOfH: 0.035,
      /** The widest row may take this much of the width (of W). */
      rowWidthOfW: 0.8658,
      /** The whole title block may take this much of the height (of H). */
      blockHeightOfH: 0.32,
      /** And no tile is wider than this (of H). */
      tileWidthOfH: 0.118,
      /** Tile height as a multiple of its width. */
      tileAspect: 1.18,
      /** Gaps and depth as multiples of the tile width. */
      gap: 0.12,
      /** Between two words on the same row. */
      wordGap: 0.55,
      rowGap: 0.17,
      depth: 0.34,
      /** Four corner-radius sets (the app's --r1 to --r4), as multiples of the tile width. */
      corners: [
        [0.07, 0.12, 0.085, 0.135],
        [0.135, 0.085, 0.12, 0.07],
        [0.085, 0.135, 0.07, 0.12],
        [0.12, 0.07, 0.135, 0.085],
      ],
      /** Resting pose: tipped back so the lower edge shows, plus a small random turn per tile. */
      restPitchDeg: -15,
      restYawDeg: 3,
      restRollDeg: 1.6,
      seed: 5,
      /** How much of the tile's width the widest letter takes. */
      letterFill: 0.7,
    },
    button: {
      /** Middle of the button below the middle of the screen (of H). */
      centerBelowMiddle: 0.378,
      /** The button never comes closer than this to the bottom (of H), above any home bar. */
      bottomMarginOfH: 0.035,
      /** Height: as tall as fits both of these. Width as a multiple of that height. */
      heightOfW: 0.1454,
      heightOfH: 0.1086,
      aspect: 3.3,
      /** Depth as a multiple of the button height. */
      depth: 0.5,
      corners: [0.1, 0.16, 0.12, 0.18],
      restPitchDeg: -15,
      restRollDeg: -1.1,
      letterFill: 0.62,
    },
    /** The hard drop shadow behind each tile and the button, as on the app's cards. */
    dropShadow: {
      /** Offset as multiples of the tile width (x right, y up). */
      x: 0.065,
      y: -0.1,
      alpha: 0.62,
    },
    /**
     * The T, as Boston calls the MBTA: the T of TOWN is a round green roundel
     * with a paper ring and letter instead of a square tile. It spins in like a
     * coin and spins again every so often. Our own mark, not the MBTA logo.
     */
    roundel: {
      letters: ["T"],
      /** Only in these words (THIS keeps a plain T). Empty = in every word. */
      words: ["TOWN"],
      /** Diameter in tile widths. */
      diameter: 1.12,
      face: "green",
      side: "greenDk",
      back: "yellow",
      /** Ring and letter colour. */
      light: "paper",
      /** Ring radius and thickness, and the letter's cap height, as fractions of the diameter. */
      ringRadius: 0.4,
      ringWidth: 0.05,
      letterHeight: 0.4,
      /** Extra coin turns while it flips in. */
      introTurns: 1,
      /** After the intro: a coin spin this often, this long, the second T a little later. */
      idleEverySeconds: 5,
      idleSpinSeconds: 1.2,
      idleStaggerSeconds: 0.22,
      idleEase: EASE.arrive,
    },
    /** Pixel size of one letter in the glyph texture. */
    glyphCellPx: 256,
  },

  // ---------------------------------------------------------------- intro
  intro: {
    /** The doors slide apart. */
    doors: { start: 0, dur: 0.95, ease: EASE.doors },
    /** The island comes up out of the sea, growing and turning as it settles. */
    rise: { start: 0.1, dur: 1.35, ease: EASE.arrive },
    grow: { start: 0.1, dur: 1.5, ease: EASE.sheet },
    spin: { start: 0.1, dur: 2.4, ease: EASE.trainIn },
    riseFromY: -24,
    growFromScale: 0.5,
    spinFromDeg: -160,
    /** The foam ring spreads once the island breaks the surface. */
    foam: { start: 0.55, dur: 1, ease: EASE.sheet },
    foamFromScale: 0.55,
    /** Each tile flips over from its coloured back, one after another. */
    tile: { start: 1, dur: 0.72, ease: EASE.arrive },
    tileStagger: 0.07,
    /** A tile grows from nothing during the first part of its flip. */
    tilePopSeconds: 0.2,
    tileFlipFromDeg: -205,
    /** The tile starts this far above its place (multiples of its height). */
    tileDropFrom: 0.45,
    /** The button pops up last. */
    button: { start: 1.85, dur: 0.6, ease: EASE.arrive },
    buttonRollFromDeg: -9,
    /** Pointer and keyboard input turn on here. */
    inputAt: 1.9,
  },

  // ---------------------------------------------------------------- after BEGIN
  outro: {
    /** Tiles flip away, last letter first. */
    tile: { start: 0.08, dur: 0.4, ease: EASE.leave },
    tileStagger: 0.035,
    tileFlipToDeg: 160,
    /** The button drops out. */
    button: { start: 0.18, dur: 0.36, ease: EASE.leave },
    /** ...by this many times its own height. */
    buttonDrop: 1.6,
    /** The camera drops in towards the island. */
    dive: { start: 0.1, dur: 1.3, ease: EASE.doors },
    diveDistance: 0.6,
    diveElevationDeg: 19,
    diveOrbitDeg: 38,
    /** The doors slide shut, then onBegin() is called. */
    doors: { start: 0.72, dur: 0.6, ease: EASE.doors },
    doneAt: 1.4,
  },

  // ---------------------------------------------------------------- touch and pointer
  interaction: {
    /** A hovered tile leans towards the pointer and lifts. */
    tileTiltDeg: 17,
    tileLiftScale: 0.07,
    /** ...and comes towards you by this much of its depth. */
    tileLiftDepth: 0.6,
    /** A tapped tile spins this many full turns. */
    tileFlapTurns: 1,
    buttonHoverScale: 0.05,
    /** A pressed button sinks by this much of its depth and shrinks a touch. */
    buttonPressDepth: 0.55,
    buttonPressScale: 0.035,
    /** Springs: stiffness (pull) and damping (drag). Lower damping bounces more. */
    springs: {
      tilt: { stiffness: 210, damping: 13 },
      lift: { stiffness: 260, damping: 18 },
      flap: { stiffness: 85, damping: 9.5 },
      press: { stiffness: 620, damping: 30 },
      parallax: { stiffness: 38, damping: 12 },
    },
  },

  // ---------------------------------------------------------------- sound hooks
  /**
   * No audio ships yet. `onCue(name)` is called at these moments so sounds can be
   * wired in later. "hover", "flap" and "click" fire from the pointer instead of the clock.
   */
  cues: {
    intro: [
      { name: "whoosh-doors", at: 0 },
      { name: "whoosh-island", at: 0.15 },
      { name: "letters", at: 1 },
      { name: "button", at: 1.85 },
    ],
    outro: [
      { name: "click", at: 0 },
      { name: "doors-close", at: 0.72 },
    ],
  },
} as const;

export type Config = typeof CONFIG;
export type ColorName = keyof Config["colors"];
export type CueName =
  | Config["cues"]["intro"][number]["name"]
  | Config["cues"]["outro"][number]["name"]
  | "hover"
  | "flap"
  | "roundel";
