// Everything on the diagram that is not a subway line or station: commuter rail, the Silver
// Line, Logan's terminals, terminus badges, the Park St - Downtown Crossing walkway.
// Positions are the reference drawing's, in its pixels. The names are today's: Nubian (was
// Dudley Sq), Lansdowne (was Yawkey), SL3 to Chelsea, the Fall River/New Bedford Line.
import type { Pt } from "./geometry";

export interface Path {
  pts: Pt[];
  radius: number | number[];
}
export interface Note {
  x: number;
  y: number;
  lines: string[];
  anchor: "start" | "end" | "middle";
  bold?: boolean;
  rotate?: number;
  size?: number;
}
const note = (x: number, y: number, anchor: Note["anchor"], text: string | string[], o: Partial<Note> = {}): Note => ({
  x,
  y,
  anchor,
  lines: typeof text === "string" ? [text] : text,
  ...o,
});

// ---------------------------------------------------------------- commuter rail
const TRUNK = 1264.5; // the northside trunk beside the Orange Line
const LOWELL = 893; // x - y

export const RAIL: Path[] = [
  { pts: [[TRUNK, 120], [TRUNK, 372], [1291, 436]], radius: [14] }, // Haverhill, into North Station
  { pts: [[1005.6, 112.6], [TRUNK, TRUNK - LOWELL]], radius: 0 }, // Lowell
  // Fitchburg: along the top of Cambridge, up over Union Sq, crossing the Green Line between
  // East Somerville and Lechmere, then into North Station beside the Lowell Line.
  { pts: [[114, 377], [850, 377], [905, 322], [LOWELL + 322, 322], [TRUNK, TRUNK - LOWELL]], radius: [22, 22, 20] },
  { pts: [[TRUNK, 290], [TRUNK, 251], [1439.5, 251], [1521.5, 333], [1617, 333], [1834, 116]], radius: [18, 30, 30, 30] }, // Newburyport/Rockport
  { pts: [[114, 591], [473.5, 591], [821, 938.5], [821, 1108], [878, 1108]], radius: [40, 40, 30] }, // Worcester
  { pts: [[1297, 936], [1322.5, 1002], [1322.5, 1072], [914, 1072], [614.25, 1371.75], [858, 1615.5]], radius: [0, 45, 40, 14] }, // Back Bay, Forest Hills, Providence
  { pts: [[614.25, 1371.75], [476, 1510], [114, 1510]], radius: [40] }, // Needham
  { pts: [[826, 1586], [768, 1644]], radius: 0 }, // Franklin
  { pts: [[1322.5, 996.2], [1436.6, 1110.3], [969, 1578], [822, 1578]], radius: [20, 20] }, // Fairmount
  { pts: [[1436.6, 1110.3], [1717.5, 1391.2], [1717.5, 1600]], radius: [30] }, // Old Colony
  { pts: [[1700, 1373.7], [1759.3, 1433], [1814, 1433]], radius: [25] }, // Greenbush
  { pts: [[1717.5, 1524], [1813, 1619.5]], radius: 0 }, // Kingston
];

/** Arrowheads where a line runs off the map: tip position and the direction it points. */
export const RAIL_ARROWS: [Pt, Pt][] = [
  [[TRUNK, 104], [0, -1]],
  [[994, 101], [-1, -1]],
  [[98, 378], [-1, 0]],
  [[1846, 104], [1, -1]],
  [[98, 591], [-1, 0]],
  [[98, 1510], [-1, 0]],
  [[870, 1627.5], [1, 1]],
  [[756, 1656], [-1, 1]],
  [[1717.5, 1616], [0, 1]],
  [[1830, 1433], [1, 0]],
  [[1825, 1631.5], [1, 1]],
];

/** Station marks: a stub off the line, [x, y, direction]. */
export const RAIL_STOPS: [number, number, Pt][] = [
  [240, 378, [0, 1]], // Waltham
  [376, 378, [0, -1]], // Waverley
  [512, 378, [0, 1]], // Belmont
  [790, 377, [0, 1]], // Porter
  [1047, 154, [1, -1]], // West Medford
  [TRUNK, 178, [1, 0]], // Malden Center
  [1560, 333, [0, 1]], // Chelsea, where SL3 ends
  [240, 591, [0, 1]], // Newtonville
  [400, 591, [0, -1]], // Boston Landing
  [752, 869.5, [-1, 1]], // Lansdowne
  [878, 1108, [1, 0.4]], // Back Bay
  [796, 1190, [1, 1]], // Ruggles
  [622, 1364, [-1, 1]], // Forest Hills
  [516, 1470, [-1, -1]], // Roslindale Village
  [397, 1510, [0, 1]], // Bellevue
  [298, 1510, [0, -1]], // Highland
  [198, 1510, [0, 1]], // West Roxbury
  [748, 1505.5, [1, -1]], // Hyde Park
  [822, 1579.5, [-1, 1]], // Readville
  [1390, 1156.9, [-1, -1]], // Newmarket
  [1331, 1216, [-1, -1]], // Uphams Corner
  [1165, 1381.9, [-1, -1]], // Four Corners/Geneva
  [1125, 1422, [1, 1]], // Talbot Ave
  [1040, 1506.9, [-1, -1]], // Morton St
  [1003, 1543.9, [-1, -1]], // Blue Hill Ave
  [900, 1578, [0, 1]], // Fairmount
  [1469, 1142.7, [1, -1]], // JFK/UMass
  [1662, 1335.7, [1, -1]], // Quincy Center
  [1717.5, 1470, [1, 0]], // Braintree
];

export const RAIL_NOTES: Note[] = [
  // line names, where each runs off the map
  note(57, 364, "start", ["Fitchburg", "Line"]),
  note(984, 73, "end", ["Lowell", "Line"]),
  note(1250, 73, "end", ["Haverhill", "Line"]),
  note(1889, 73, "end", ["Newburyport/", "Rockport", "Line"]),
  note(57, 560, "start", ["Framingham/", "Worcester", "Line"]),
  note(57, 1478, "start", ["Needham", "Line"]),
  note(748, 1672, "end", ["Franklin/", "Foxboro Line"]),
  note(880, 1654, "start", ["Providence/", "Stoughton Line"]),
  note(1727, 1642, "end", ["Fall River/", "New Bedford", "Line"]),
  note(1889, 1654, "end", ["Kingston", "Line"]),
  note(1883, 1420, "end", ["Greenbush", "Line"]),
  // stations
  note(270, 411, "middle", "Waltham", { bold: true }),
  note(408, 353, "middle", "Waverley", { bold: true }),
  note(542, 411, "middle", "Belmont", { bold: true }),
  note(1070, 138, "start", "West Medford", { bold: true }),
  note(1560, 315, "middle", "Chelsea", { bold: true }),
  note(199, 624, "middle", "Newtonville", { bold: true }),
  note(400, 566, "middle", "Boston Landing", { bold: true }),
  note(737, 890, "end", "Lansdowne", { bold: true, rotate: -45 }),
  note(503, 1440, "end", ["Roslindale", "Village"], { bold: true }),
  note(329, 1488, "middle", "Highland", { bold: true }),
  note(190, 1542, "start", ["West", "Roxbury"], { bold: true }),
  note(427, 1542, "middle", "Bellevue", { bold: true }),
  note(763, 1476, "start", ["Hyde", "Park"], { bold: true }),
  note(797, 1585, "end", "Readville", { bold: true }),
  note(1373, 1146, "end", "Newmarket", { bold: true }),
  note(1307, 1192, "end", ["Uphams", "Corner"], { bold: true }),
  note(1147, 1367, "end", ["Four Corners/", "Geneva"], { bold: true }),
  note(1141, 1448, "start", ["Talbot", "Ave"], { bold: true }),
  note(1023, 1495, "end", "Morton St", { bold: true }),
  note(986, 1532, "end", "Blue Hill Ave", { bold: true }),
  note(912, 1611, "middle", "Fairmount", { bold: true }),
];

// ---------------------------------------------------------------- Silver Line
const WASH = 1004.6; // Washington St, Boylston down to Nubian
const WATERFRONT = 926.5;

export const SILVER: Path[] = [
  { pts: [[WASH, 829.4], [WASH, 1337]], radius: 0 },
  { pts: [[WASH, 829.4], [1198, 829.4], [1198, WATERFRONT], [1101.4, WATERFRONT]], radius: [0, 26] }, // SL5 round Downtown Crossing
  // SL4 and SL5 along Essex St, the Waterfront tunnel, then SL1 out to Logan
  { pts: [[WASH, 962], [WASH, WATERFRONT], [1529.5, WATERFRONT], [1659.5, 796.5], [1659.5, 657]], radius: [22, 30, 30] },
  { pts: [[1294.5, WATERFRONT], [1294.5, 1021.8], [WASH, 1021.8]], radius: [24] }, // SL4 back from South Station
  { pts: [[1500, WATERFRONT], [1516.5, WATERFRONT], [1600, 1010]], radius: [10] }, // SL2 to the Design Center
  // SL3: off SL1's ramp, through the Ted Williams Tunnel to Airport, then north through East Boston to Chelsea
  { pts: [[1580, 876], [1635, 821], [1635, 686.6], [1488, 539.6], [1488, 420], [1560, 348]], radius: [20, 30, 20, 24] },
];

/** The Seaport stops between Silver Line Way and the Design Center, on SL2's diagonal (x - y = 590). */
const SL2_STOPS: [number, string][] = [
  [1535, "Northern Ave @ Harbor St"],
  [1548, "Northern Ave @ Tide St"],
  [1561, "23 Drydock Ave"],
  [1574, "27 Drydock Ave"],
  [1587, "Black Falcon Ave"],
];

export const SILVER_STOPS: Pt[] = [
  ...[1095, 1126, 1156, 1186, 1216, 1246, 1276, 1307, 1337].map((y): Pt => [WASH, y]),
  [1427, WATERFRONT], [1464, WATERFRONT], [1500, WATERFRONT],
  ...SL2_STOPS.map(([x]): Pt => [x, x - 590]),
  [1599, 1009],
  ...[661, 691, 715, 727, 751].map((y): Pt => [1659.5, y]),
  [1488, 495], [1488, 452], [1521, 387], [1560, 348],
];

export const SILVER_NOTES: Note[] = [
  ...["Herald St", "East Berkeley St", "Union Park St", "Newton St", "Worcester Sq", "Mass. Ave", "Lenox St", "Melnea Cass Blvd"].map((t, i) =>
    note(1025, [1095, 1126, 1156, 1186, 1216, 1246, 1276, 1307][i]! + 6, "start", t),
  ),
  note(1025, 1343.5, "start", "Nubian", { bold: true }),
  note(1436, 912, "start", "Courthouse", { rotate: -45, size: 19.3 }),
  note(1473, 912, "start", "World Trade Center", { rotate: -45, size: 19.3 }),
  note(1509, 912, "start", "Silver Line Way", { rotate: -45, size: 19.3 }),
  note(1627, 1041, "start", ["Design", "Center"], { bold: true }),
  ...SL2_STOPS.map(([x, name]) => note(x + 11, x - 590 - 2, "start", name, { rotate: -45, size: 12.5 })),
  note(1029, 858, "start", ["Accessible for", "Silver Line only"], { size: 11.5 }),
  // SL3's names run parallel to the Blue Line, in the strip between it and SL3, and
  // Bellingham Sq along SL3's own diagonal, so the Charlestown ferry keeps the water.
  note(1503, 490, "start", "Eastern Ave", { rotate: -45, size: 13 }),
  note(1503, 447, "start", "Box District", { rotate: -45, size: 13 }),
  note(1510, 375, "end", "Bellingham Sq", { rotate: -45, size: 13 }),
  note(1719, 746, "start", ["Logan", "International", "Airport"], { bold: true }),
  note(1719, 803, "start", "Terminals"),
];

/** Route pills: [x, y, text]. */
export const SILVER_PILLS: [number, number, string][] = [
  [1672, 628, "SL1"],
  [1590, 1045, "SL2"],
  [1600, 355, "SL3"],
  [1005, 1380, "SL4"],
  [1005, 1410, "SL5"],
];

/** Logan's terminals, top to bottom. */
export const TERMINALS: [string, number][] = [["E", 661], ["C", 691.5], ["B", 721.5], ["A", 751.5]];

// ---------------------------------------------------------------- badges and small marks
export interface Badge {
  x: number;
  y: number;
  text: string;
  line: "red" | "orange" | "blue" | "green";
  /** Green Line branch letter, in its own disc beside the badge. */
  branch?: string;
}
export const BADGES: Badge[] = [
  { x: 661, y: 293, text: "RL", line: "red" },
  { x: 1748, y: 1503, text: "RL", line: "red" },
  { x: 1077, y: 1627, text: "ML", line: "red" },
  { x: 1294.5, y: 96, text: "OL", line: "orange" },
  { x: 588, y: 1440, text: "OL", line: "orange" },
  { x: 1077, y: 516, text: "BL", line: "blue" },
  { x: 1778, y: 250, text: "BL", line: "blue" },
  { x: 96, y: 862.5, text: "GL", line: "green", branch: "B" },
  { x: 225, y: 1005, text: "GL", line: "green", branch: "C" },
  { x: 96, y: 1146.5, text: "GL", line: "green", branch: "D" },
  { x: 467, y: 1340, text: "GL", line: "green", branch: "E" },
  { x: 937, y: 113, text: "GL", line: "green", branch: "E" },
  { x: 1051, y: 347, text: "GL", line: "green", branch: "D" },
];

/** The line's name printed inside it where lines cross downtown: [text, x, y, rotation]. */
export const CAPTIONS: [string, number, number, number][] = [
  ["RED", 1052, 685, 45], ["RED", 1150, 783, 45], ["RED", 1246, 879, 45],
  ["GREEN", 1246, 588, -45], ["GREEN", 1150, 684, -45], ["GREEN", 1053, 781, -45],
  ["BLUE", 1150, 589, 45], ["BLUE", 1246, 685, 45], ["BLUE", 1342, 684, -45],
  ["ORANGE", 1246, 781, -45],
];

/** The walkway between Park St and Downtown Crossing. */
export const CONCOURSE = "M1112 736C1166 736 1196 770 1196 818";

// ---------------------------------------------------------------- ferries
// The MBTA's own map shows the harbor ferries as dotted lines. Routes from the MBTA V3 API
// (Nov 2026): Charlestown (Navy Yard - Long Wharf), Harbor Loop (Lovejoy Wharf - Central
// Wharf - Seaport - Logan), Hingham/Hull (Long Wharf - Logan - Hull - Hingham), Hingham
// (Rowes Wharf - Hingham), Quincy (Central Wharf - Logan - Squantum Point).
// Long Wharf and Central Wharf are neighbouring piers at Aquarium; the diagram gives the
// Charlestown ferry to Long Wharf and every Logan-bound boat to Central Wharf.
export const FERRY: Path[] = [
  { pts: [[1425, 395], [1425, 588], [1392, 612]], radius: [14] }, // Charlestown
  { pts: [[1360, 468], [1360, 480], [1425, 545]], radius: [10] }, // Harbor Loop, from Lovejoy Wharf
  { pts: [[1392, 680], [1440, 680], [1440, 760], [1462, 782], [1608, 782]], radius: [14, 14, 14] }, // Central Wharf to Logan
  { pts: [[1392, 782], [1530, 782], [1872, 1124]], radius: [24] }, // Hingham, from Rowes Wharf
  { pts: [[1608, 782], [1880, 1054]], radius: 0 }, // Hull and Hingham, from Logan
  { pts: [[1608, 782], [1770, 1185]], radius: 0 }, // Quincy
];
export const FERRY_STOPS: Pt[] = [[1425, 395], [1360, 468], [1392, 612], [1392, 680], [1392, 782], [1608, 782], [1770, 1185]];
export const FERRY_ARROWS: [Pt, Pt][] = [
  [[1884, 1136], [1, 1]],
  [[1892, 1066], [1, 1]],
];
export const FERRY_NOTES: Note[] = [
  note(1418, 381, "end", ["Charlestown", "Navy Yard"], { size: 13 }),
  note(1370, 466, "start", ["Lovejoy", "Wharf"], { size: 13 }),
  note(1384, 597, "end", ["Long", "Wharf"], { size: 13 }),
  note(1384, 709, "end", ["Central", "Wharf"], { size: 13 }),
  note(1384, 794, "end", ["Rowes", "Wharf"], { size: 13 }),
  note(1600, 742, "end", ["Logan", "Ferry", "Terminal"], { size: 13 }),
];
/** Route names where the ferries leave the map, in the ferry colour. */
export const FERRY_NAMES: Note[] = [
  note(1849, 1006, "middle", ["Hull/Hingham", "Ferry"]),
  note(1826, 1154, "middle", ["Hingham", "Ferry"]),
  note(1784, 1190, "start", ["Quincy Ferry", "Squantum Pt"], { size: 15 }),
];
