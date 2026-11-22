// The diagram: where every station, line and label sits.
//
// Units are the pixels of the 1932 x 1932 reference drawing (Michael Kvrivishvili's 2013
// MBTA map, CC BY 2.0; see README). Stations that exist in both are exactly where the
// reference has them. The network itself is today's: the Green Line Extension, Assembly,
// Amory St and Babcock St are added, and stops that have closed since are gone.
//
// Every line of the diagram runs at 0, 45 or 90 degrees, so a straight run is one number:
//   d1(c, x)  the point at x on the falling diagonal  x - y = c
//   d2(c, x)  the point at x on the rising diagonal   x + y = c
import type { Pt } from "./geometry";
import type { LineId } from "./stations";

export const MAP_SIZE = 1932;

const d1 = (c: number, x: number): Pt => [x, x - c];
const d2 = (c: number, x: number): Pt => [x, c - x];

// ---- the straight runs, measured from the reference ----
const RED = 368.4; // d1: Alewife to Quincy Adams
const ASHMONT = 2703.4; // d2: JFK/UMass to Ashmont, on to Mattapan
const ORANGE_X = 1294.5; // Oak Grove down to State
const ORANGE = 2027.5; // d2: State to Forest Hills
const BLUE_E = 2027.6; // d2: State to Wonderland
const GREEN = 1834.3; // d2: Haymarket to Heath St
const GREEN_N = 851.3; // d1: Medford/Tufts to North Station
const KENMORE = -48.5; // d1: Copley out to the B branch
const B_TOP = 642.5, B_WEST = 1079.5, B_END = 862.5;
const C_IN = -112, C_TOP = 748, C_WEST = 1321.2, C_END = 1005;
const D_WEST = 1562.6, D_END = 1146.5;
const FORK_Y = 838; // where C and D leave the B branch, west of Kenmore

export type Anchor = "start" | "end" | "middle";
export interface Label {
  lines: string[];
  /** Offset of the first baseline's anchor point from the station. */
  dx: number;
  dy: number;
  anchor: Anchor;
  bold?: boolean;
  /** Degrees; -45 reads up and to the right. */
  rotate?: number;
  /** Baseline to baseline. */
  lineHeight?: number;
  /** Each further line shifts this far along x (labels that step along a diagonal). */
  indent?: number;
  /** Font size; the reference sets minor surface stops a little smaller. */
  size?: number;
  /** Knock the lines behind out with a paper outline, as the reference does where a name crosses the commuter rail. */
  halo?: boolean;
}
export interface Spot {
  x: number;
  y: number;
  /** A transfer station: drawn as a ringed disc. */
  hub?: boolean;
  label: Label;
}

type Side = "E" | "W" | "NE" | "NW" | "SE" | "SW";
/** Where the reference puts a label on each side of its dot. */
const SIDE: Record<Side, { dx: number; dy: number; anchor: Anchor }> = {
  E: { dx: 20, dy: 6, anchor: "start" },
  W: { dx: -20, dy: 6, anchor: "end" },
  NE: { dx: 14, dy: -11.5, anchor: "start" },
  NW: { dx: -13, dy: -11, anchor: "end" },
  SE: { dx: 14, dy: 24.8, anchor: "start" },
  SW: { dx: -12.5, dy: 24.8, anchor: "end" },
};
type LabelOpts = Partial<Omit<Label, "lines" | "anchor">> & { anchor?: Anchor };
const lab = (side: Side, text: string | string[], o: LabelOpts = {}): Label => ({
  lines: typeof text === "string" ? [text] : text,
  ...SIDE[side],
  ...o,
});
/**
 * A label turned 45 degrees, reading up and to the right. "up" starts beside the dot and
 * climbs away from it; "down" hangs below the dot and ends beside it.
 */
const tilt = (way: "up" | "down", text: string | string[], o: LabelOpts = {}): Label => ({
  lines: typeof text === "string" ? [text] : text,
  ...(way === "up" ? { dx: 9, dy: -14, anchor: "start" as const } : { dx: -2, dy: 24, anchor: "end" as const }),
  rotate: -45,
  ...o,
});

/** The reference's two label sizes. */
export const LABEL_SIZE = 21.6;
export const LABEL_SMALL = 19.3;
const small = { size: LABEL_SMALL };

const at = (p: Pt, label: Label, hub = false): Spot => ({ x: p[0], y: p[1], label, ...(hub ? { hub: true } : {}) });

export const SPOTS: Record<string, Spot> = {
  // ---- Red Line ----
  alewife: at(d1(RED, 685), lab("SW", "Alewife", { bold: true, dx: -13 })),
  davis: at(d1(RED, 727), lab("SW", "Davis", { halo: true })),
  porter: at(d1(RED, 769), lab("SW", "Porter")),
  harvard: at(d1(RED, 811), lab("SW", "Harvard")),
  central: at(d1(RED, 860), lab("SW", "Central")),
  "kendall-mit": at(d1(RED, 908), lab("SW", ["Kendall", "/MIT"], { lineHeight: 21 })),
  "charles-mgh": at(d1(RED, 1005), lab("SW", ["Charles", "/MGH"], { dy: 23.8, lineHeight: 22 })),
  "park-st": at([1101.4, 733], lab("W", "Park St", { dx: -30, dy: 6.4 }), true),
  "downtown-crossing": at([1198, 829.4], lab("E", "Downtown Crossing", { dx: 33, dy: 6 }), true),
  "south-station": at([1294.5, 926.2], lab("NE", ["South", "Station"], { dy: -41.7, lineHeight: 21 }), true),
  broadway: at(d1(RED, 1391), lab("NE", "Broadway")),
  andrew: at(d1(RED, 1439), lab("NE", "Andrew")),
  "jfk-umass": at(d1(RED, 1488), lab("NE", ["JFK", "/UMass"], { dx: 13, dy: -12, lineHeight: 22, indent: 20 })),
  "north-quincy": at(d1(RED, 1584), lab("NE", "North Quincy")),
  wollaston: at(d1(RED, 1632), lab("NE", "Wollaston")),
  "quincy-center": at(d1(RED, 1681), lab("NE", "Quincy Center")),
  "quincy-adams": at(d1(RED, 1729), lab("NE", ["Quincy", "Adams"], { lineHeight: 22, indent: 18 })),
  braintree: at([1748, 1470], lab("E", "Braintree", { bold: true, dy: 5.4 })),
  "savin-hill": at(d2(ASHMONT, 1476), lab("SE", ["Savin", "Hill"], { lineHeight: 22 })),
  "fields-corner": at(d2(ASHMONT, 1424), lab("SE", ["Fields", "Corner"], { dy: 24, lineHeight: 22 })),
  shawmut: at(d2(ASHMONT, 1373), lab("SE", "Shawmut")),
  ashmont: at([1330.4, 1373], lab("SE", "Ashmont", { bold: true, dx: 21, dy: 24.4 }), true),
  // ---- Mattapan Line ----
  "cedar-grove": at(d2(ASHMONT, 1291), lab("SE", "Cedar Grove")),
  butler: at(d2(ASHMONT, 1258), lab("SE", "Butler", { dy: 25.5, ...small })),
  milton: at(d2(ASHMONT, 1228), lab("SE", "Milton", { dy: 25.5, ...small })),
  "central-ave": at(d2(ASHMONT, 1198), lab("SE", "Central Ave", { dy: 25.5 })),
  "valley-rd": at(d2(ASHMONT, 1168), lab("SE", "Valley Rd", { dx: 13, dy: 26 })),
  "capen-st": at(d2(ASHMONT, 1135), lab("SE", "Capen St", { dx: 13, dy: 26 })),
  mattapan: at(d2(ASHMONT, 1101), lab("SE", "Mattapan", { bold: true, dx: 15, dy: 27 })),
  // ---- Orange Line ----
  "oak-grove": at([ORANGE_X, 129], lab("E", "Oak Grove", { bold: true, dy: 6.4 })),
  "malden-center": at([ORANGE_X, 178], lab("E", "Malden Center", { dx: 22, dy: 6.4 })),
  wellington: at([ORANGE_X, 226], lab("E", "Wellington", { dy: 6.4 })),
  // Assembly opened in 2014, after the reference. It goes below the Newburyport/Rockport
  // Line, which crosses at y 251, so Sullivan Sq moves down to share the gap with it.
  assembly: at([ORANGE_X, 271], lab("E", "Assembly", { dy: 6.4 })),
  "sullivan-sq": at([ORANGE_X, 309], lab("E", "Sullivan Sq", { dy: 5.4 })),
  "community-college": at([ORANGE_X, 347], lab("E", "Community College", { dy: 5.4 })),
  "north-station": at([1294.6, 443.2], lab("E", ["North", "Station"], { dy: -23.8, lineHeight: 21 }), true),
  haymarket: at([1294.5, 539.8], lab("E", "Haymarket", { dy: 24.6 }), true),
  state: at([1294.6, 733], lab("SE", "State", { dy: 30.4 }), true),
  chinatown: at([1101.4, 926.2], lab("SE", "Chinatown", { dx: 11, dy: 33.3 }), true),
  "tufts-medical": at([1004.7, 1022.8], lab("SE", "Tufts Medical", { dx: 19, dy: 33.6 }), true),
  "back-bay": at(d2(ORANGE, 908), lab("SE", ["Back", "Bay"], { dx: 18, dy: 18, lineHeight: 22 })),
  "mass-ave": at(d2(ORANGE, 866), lab("SE", ["Mass.", "Ave"], { dx: 18, dy: 22, lineHeight: 21 })),
  ruggles: at(d2(ORANGE, 824), lab("SE", "Ruggles", { dx: 11, dy: 28 })),
  "roxbury-crossing": at(d2(ORANGE, 778), lab("SE", ["Roxbury", "Crossing"], { dx: 15, dy: 21, lineHeight: 22 })),
  "jackson-sq": at(d2(ORANGE, 733), lab("SE", "Jackson Sq", { dx: 7, dy: 27 })),
  "stony-brook": at(d2(ORANGE, 691), lab("SE", "Stony Brook", { dx: 13 })),
  "green-st": at(d2(ORANGE, 652), lab("SE", "Green St", { dx: 13 })),
  "forest-hills": at(d2(ORANGE, 612), lab("SE", ["Forest", "Hills"], { bold: true, lineHeight: 21, halo: true })),
  // ---- Blue Line ----
  bowdoin: at([1101.4, 539.8], lab("SW", "Bowdoin", { bold: true, dx: -13 })),
  "gov-ctr": at([1198, 636.5], lab("W", ["Government", "Center"], { dx: -31, dy: 6, lineHeight: 22, indent: -19 }), true),
  aquarium: at(d2(BLUE_E, 1391), lab("SE", "Aquarium", { dx: 10, dy: 23.8 })),
  maverick: at(d2(BLUE_E, 1440), lab("SE", "Maverick", { dx: 11, dy: 27.8 })),
  // A transfer now: the Silver Line's SL3 calls here, so the name moves clear of its path.
  airport: at(d2(BLUE_E, 1488), lab("E", "Airport", { dx: 30, dy: 7 }), true),
  "wood-island": at(d2(BLUE_E, 1536), lab("SE", "Wood Island", { dx: 13 })),
  "orient-heights": at(d2(BLUE_E, 1584), lab("SE", "Orient Heights", { dy: 23.8 })),
  "suffolk-downs": at(d2(BLUE_E, 1627), lab("SE", "Suffolk Downs")),
  beachmont: at(d2(BLUE_E, 1669), lab("SE", "Beachmont")),
  "revere-beach": at(d2(BLUE_E, 1711), lab("SE", "Revere Beach", { dx: 15 })),
  wonderland: at(d2(BLUE_E, 1757), lab("SE", "Wonderland", { bold: true, dx: 9, dy: 27.8 })),
  // ---- Green Line: north ----
  // The Green Line Extension is not on the reference. It carries on up Lechmere's diagonal,
  // beside the Lowell Line as it does on the ground, and Union Sq leaves west from Lechmere.
  // The Fitchburg Line crosses between East Somerville and Lechmere, as on the MBTA's map.
  "medford-tufts": at(d1(GREEN_N, 988.3), lab("W", "Medford/Tufts", { bold: true, dx: -24, dy: 9 })),
  "ball-sq": at(d1(GREEN_N, 1028.3), lab("W", "Ball Sq", { dx: -24 })),
  "magoun-sq": at(d1(GREEN_N, 1068.3), lab("W", "Magoun Sq", { dx: -24 })),
  "gilman-sq": at(d1(GREEN_N, 1108.3), lab("W", "Gilman Sq", { dx: -24 })),
  "east-somerville": at(d1(GREEN_N, 1148.3), lab("W", "East Somerville", { dx: -24 })),
  "union-sq": at([1105, 347], lab("W", "Union Sq", { bold: true, dx: -77, dy: 6.5 })),
  lechmere: at(d1(GREEN_N, 1198.3), lab("SW", "Lechmere", { dx: -13, dy: 34 })),
  "science-park": at(d1(GREEN_N, 1246), lab("SW", ["Science Park", "/West End"], { dx: -13, dy: 24.7, lineHeight: 21 })),
  // ---- Green Line: the tunnel ----
  boylston: at([1004.5, 829.4], lab("NW", "Boylston", { dx: -8, dy: -18 }), true),
  arlington: at(d2(GREEN, 957), lab("NW", "Arlington", { dx: -8, dy: -14 })),
  copley: at(d2(GREEN, 908), lab("SE", "Copley", { dx: 8, dy: 27 })),
  hynes: at(d1(KENMORE, 842), lab("SW", "Hynes", { dx: -10, dy: 22, halo: true })),
  kenmore: at(d1(KENMORE, 799), lab("NE", "Kenmore", { dx: 9, dy: -14 })),
  // ---- Green Line B ----
  blandford: at(d1(KENMORE, 767), lab("NE", "Blandford St", { dx: 10, dy: -10, ...small })),
  "bu-east": at(d1(KENMORE, 736), lab("NE", "BU East", { dy: -10, ...small })),
  "bu-central": at(d1(KENMORE, 706), lab("NE", "BU Central", { dy: -10, ...small })),
  amory: at(d1(KENMORE, 661), lab("NE", "Amory St", { dy: -10, ...small })),
  babcock: at([579, B_TOP], tilt("up", "Babcock St", small)),
  "packards-corner": at([537, B_TOP], tilt("up", "Packard's Corner", small)),
  "harvard-ave": at([494, B_TOP], tilt("up", "Harvard Ave", { halo: true })),
  "griggs-st": at([452, B_TOP], lab("NW", "Griggs St", { dx: -6, dy: -16, ...small })),
  "allston-st": at(d2(B_WEST, 416), lab("NW", "Allston St", { dy: -10, ...small })),
  "warren-st": at(d2(B_WEST, 386), lab("NW", "Warren St", { dy: -10, ...small })),
  "washington-st": at(d2(B_WEST, 356), lab("NW", "Washington St", { dy: -10 })),
  "sutherland-rd": at(d2(B_WEST, 325), lab("NW", "Sutherland Rd", { dy: -10, ...small })),
  "chiswick-rd": at(d2(B_WEST, 295), lab("NW", "Chiswick Rd", { dy: -10, ...small })),
  "chestnut-hill-ave": at(d2(B_WEST, 265), lab("NW", "Chestnut Hill Ave", { dy: -10, ...small })),
  "south-st": at(d2(B_WEST, 235), lab("NW", "South St", { dy: -10, ...small })),
  "boston-college": at([154, B_END], tilt("down", ["Boston", "College"], { bold: true, lineHeight: 21, anchor: "middle", dx: -30, dy: 54 })),
  // ---- Green Line C ----
  // Offsets measured off the reference, which tucks these three in above Fenway.
  "st-marys-st": at(d1(C_IN, 688), tilt("down", ["St. Mary's", "St"], { dx: -16, dy: 4, lineHeight: 20, size: 20.3 })),
  "hawes-st": at(d1(C_IN, 660), tilt("down", "Hawes St", { dx: -8, dy: 18, size: 20.3 })),
  "kent-st": at([630, C_TOP], tilt("down", "Kent St", { dx: 0, dy: 20, size: 20.3 })),
  "st-paul-st": at([579, C_TOP], lab("NW", "St. Paul St", { dx: -9, dy: -12.6, ...small })),
  "coolidge-corner": at(d2(C_WEST, 549), lab("NW", "Coolidge Corner", { dx: -9, dy: -10.8 })),
  "summit-ave": at(d2(C_WEST, 511), lab("NW", "Summit Ave", { dy: -10.8, ...small })),
  "brandon-hall": at(d2(C_WEST, 473.5), lab("NW", "Brandon Hall", { dy: -10.8, ...small })),
  "washington-sq": at(d2(C_WEST, 436), lab("NW", "Washington Sq", { dy: -10.8 })),
  "tappan-st": at(d2(C_WEST, 398), lab("NW", "Tappan St", { dy: -10.8, ...small })),
  "dean-rd": at(d2(C_WEST, 368), lab("NW", "Dean Rd", { dy: -10.8, ...small })),
  "englewood-ave": at(d2(C_WEST, 338), lab("NW", "Englewood Ave", { dy: -10.8, ...small })),
  "cleveland-circle": at([283, C_END], tilt("down", ["Cleveland", "Circle"], { bold: true, lineHeight: 21, anchor: "middle", dx: -36, dy: 66 })),
  // ---- Green Line D ----
  fenway: at(d2(D_WEST, 664), lab("NW", "Fenway", { dy: -7.2 })),
  longwood: at(d2(D_WEST, 627), lab("NW", "Longwood", { dx: -12.5, dy: -10.2 })),
  "brookline-village": at(d2(D_WEST, 591), lab("NW", "Brookline Village", { dy: -10.2 })),
  "brookline-hills": at(d2(D_WEST, 555), lab("NW", "Brookline Hills", { dx: -12, dy: -10.2 })),
  beaconsfield: at(d2(D_WEST, 519), lab("NW", "Beaconsfield", { dx: -12.5, dy: -10.2, ...small })),
  reservoir: at(d2(D_WEST, 483), lab("NW", "Reservoir", { dx: -10, dy: -10.2 })),
  "chestnut-hill": at(d2(D_WEST, 446), lab("NW", "Chestnut Hill", { dx: -12.5, dy: -10.2, ...small })),
  "newton-centre": at([374, D_END], tilt("down", "Newton Centre")),
  "newton-highlands": at([329, D_END], tilt("down", "Newton Highlands", small)),
  eliot: at([286, D_END], tilt("down", "Eliot", small)),
  waban: at([244, D_END], tilt("down", "Waban", small)),
  woodland: at([199, D_END], tilt("down", "Woodland")),
  riverside: at([153, D_END], tilt("down", "Riverside", { bold: true })),
  // ---- Green Line E ----
  prudential: at(d2(GREEN, 866), lab("NW", "Prudential", { dy: -11, halo: true })),
  symphony: at(d2(GREEN, 830), lab("NW", "Symphony", { dy: -12 })),
  northeastern: at(d2(GREEN, 793), lab("NW", "Northeastern", { dy: -12 })),
  "museum-of-fine-arts": at(d2(GREEN, 757), lab("NW", "Museum Fine Arts", { dy: -12 })),
  "longwood-medical": at(d2(GREEN, 721), lab("NW", "Longwood Medical", { dy: -12 })),
  "brigham-circle": at(d2(GREEN, 685), lab("NW", "Brigham Circle", { dy: -12 })),
  "fenwood-rd": at(d2(GREEN, 649), lab("NW", "Fenwood Rd", { dy: -11 })),
  "mission-park": at(d2(GREEN, 615), lab("NW", "Mission Park", { dx: -12, dy: -12 })),
  riverway: at(d2(GREEN, 582), lab("NW", "Riverway", { dy: -12 })),
  "back-of-the-hill": at(d2(GREEN, 549), lab("NW", "Back of the Hill", { dy: -12 })),
  "heath-st": at(d2(GREEN, 516), lab("NW", "Heath St", { bold: true, dy: -11 })),
};

const P = (id: string): Pt => {
  const s = SPOTS[id];
  if (!s) throw new Error(`t-map layout: no spot for ${id}`);
  return [s.x, s.y];
};

export interface Track {
  id: string;
  line: LineId;
  pts: Pt[];
  /** Corner radius, one per bend. */
  radius: number | number[];
}

/** The centre lines, drawn in this order (later ones on top). */
export const TRACKS: Track[] = [
  { id: "green-union", line: "green", pts: [P("union-sq"), P("lechmere")], radius: 0 },
  {
    id: "green-main",
    line: "green",
    pts: [P("medford-tufts"), d1(GREEN_N, 1325), d2(GREEN, 1325), P("heath-st")],
    radius: [42, 42],
  },
  {
    id: "green-b",
    line: "green",
    pts: [P("copley"), [877.5, 926], [594, B_TOP], [437, B_TOP], [217, B_END], P("boston-college")],
    radius: [64, 64, 52, 64],
  },
  {
    id: "green-c",
    line: "green",
    pts: [d1(KENMORE, 789.5), [725.3, FORK_Y], [636, C_TOP], [573.2, C_TOP], [316.2, C_END], P("cleveland-circle")],
    radius: [8, 16, 26, 56],
  },
  { id: "green-d", line: "green", pts: [[760, FORK_Y], [725.3, FORK_Y], [416.1, D_END], P("riverside")], radius: [6, 62] },
  { id: "orange", line: "orange", pts: [P("oak-grove"), P("state"), P("forest-hills")], radius: 0 },
  { id: "blue", line: "blue", pts: [P("bowdoin"), P("state"), P("wonderland")], radius: 0 },
  { id: "mattapan", line: "mattapan", pts: [P("ashmont"), P("mattapan")], radius: 0 },
  { id: "red-ashmont", line: "red", pts: [P("jfk-umass"), [1535.9, 1167.5], P("ashmont")], radius: [38] },
  { id: "red", line: "red", pts: [P("alewife"), [1748, 1379.6], P("braintree")], radius: [78] },
];
