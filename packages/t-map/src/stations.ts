// The station catalog: every MBTA subway and light-rail stop, in the app's own terms.
// Facts (which stops exist, their order, accessibility, position) come from the generated
// MBTA data. The table below adds what the MBTA cannot: the app's stable id, the name the
// map and lists use, and the two-line label printed on a passport ticket.
import { RAW_ROUTES, RAW_STOPS } from "./generated/network";

export type LineId = "red" | "mattapan" | "orange" | "blue" | "green";
export type Branch = "B" | "C" | "D" | "E";
export type RouteId = "Red" | "Mattapan" | "Orange" | "Blue" | "Green-B" | "Green-C" | "Green-D" | "Green-E";

export interface TStation {
  /** The app's id. Stamps are stored under it, so it never changes. */
  id: string;
  /** MBTA parent station id, e.g. "place-kencl". */
  mbtaId: string;
  /** Name for the map and lists, e.g. "BU East". */
  name: string;
  /** The MBTA's full name, e.g. "Boston University East". */
  fullName: string;
  /** Ticket label, split in two at the first hyphen or space: "KEN-MORE". */
  short: string;
  lines: LineId[];
  /** Green Line branches that stop here. */
  branches?: Branch[];
  accessible: boolean;
  /** Set while the station is shut for a long project. */
  suspended?: string;
  lat: number;
  lon: number;
}

/** [MBTA id without "place-", app id, name, ticket label]. Ids of the first catalog (kenmore, park-st, gov-ctr...) are kept. */
const TABLE: [string, string, string, string][] = [
  // Red Line
  ["alfcl", "alewife", "Alewife", "ALE-WIFE"],
  ["davis", "davis", "Davis", "DAVIS"],
  ["portr", "porter", "Porter", "PORT-ER"],
  ["harsq", "harvard", "Harvard", "HAR-VARD"],
  ["cntsq", "central", "Central", "CEN-TRAL"],
  ["knncl", "kendall-mit", "Kendall/MIT", "KEND-ALL"],
  ["chmnl", "charles-mgh", "Charles/MGH", "CHAS MGH"],
  ["pktrm", "park-st", "Park St", "PARK ST"],
  ["dwnxg", "downtown-crossing", "Downtown Crossing", "DTX"],
  ["sstat", "south-station", "South Station", "SOUTH STA"],
  ["brdwy", "broadway", "Broadway", "BROAD-WAY"],
  ["andrw", "andrew", "Andrew", "AND-REW"],
  ["jfk", "jfk-umass", "JFK/UMass", "JFK UMASS"],
  ["shmnl", "savin-hill", "Savin Hill", "SAVIN HILL"],
  ["fldcr", "fields-corner", "Fields Corner", "FIELDS CNR"],
  ["smmnl", "shawmut", "Shawmut", "SHAW-MUT"],
  ["asmnl", "ashmont", "Ashmont", "ASH-MONT"],
  ["nqncy", "north-quincy", "North Quincy", "NORTH QUINCY"],
  ["wlsta", "wollaston", "Wollaston", "WOLL-ASTON"],
  ["qnctr", "quincy-center", "Quincy Center", "QUINCY CTR"],
  ["qamnl", "quincy-adams", "Quincy Adams", "QUINCY ADAMS"],
  ["brntn", "braintree", "Braintree", "BRAIN-TREE"],
  // Mattapan Line
  ["cedgr", "cedar-grove", "Cedar Grove", "CEDAR GROVE"],
  ["butlr", "butler", "Butler", "BUT-LER"],
  ["miltt", "milton", "Milton", "MIL-TON"],
  ["cenav", "central-ave", "Central Ave", "CTRL AVE"],
  ["valrd", "valley-rd", "Valley Rd", "VALLEY RD"],
  ["capst", "capen-st", "Capen St", "CAPEN ST"],
  ["matt", "mattapan", "Mattapan", "MATT-APAN"],
  // Orange Line
  ["ogmnl", "oak-grove", "Oak Grove", "OAK GROVE"],
  ["mlmnl", "malden-center", "Malden Center", "MALDEN CTR"],
  ["welln", "wellington", "Wellington", "WELL-INGTON"],
  ["astao", "assembly", "Assembly", "ASSEM-BLY"],
  ["sull", "sullivan-sq", "Sullivan Sq", "SULLI-VAN SQ"],
  ["ccmnl", "community-college", "Community College", "COMM. COLL."],
  ["north", "north-station", "North Station", "NORTH STA"],
  ["haecl", "haymarket", "Haymarket", "HAY-MARKET"],
  ["state", "state", "State", "STATE"],
  ["chncl", "chinatown", "Chinatown", "CHINA-TOWN"],
  ["tumnl", "tufts-medical", "Tufts Medical Center", "TUFTS MED"],
  ["bbsta", "back-bay", "Back Bay", "BACK BAY"],
  ["masta", "mass-ave", "Massachusetts Ave", "MASS AVE"],
  ["rugg", "ruggles", "Ruggles", "RUG-GLES"],
  ["rcmnl", "roxbury-crossing", "Roxbury Crossing", "ROX XING"],
  ["jaksn", "jackson-sq", "Jackson Sq", "JACK-SON SQ"],
  ["sbmnl", "stony-brook", "Stony Brook", "STONY BROOK"],
  ["grnst", "green-st", "Green St", "GREEN ST"],
  ["forhl", "forest-hills", "Forest Hills", "FOREST HILLS"],
  // Blue Line
  ["wondl", "wonderland", "Wonderland", "WONDR-LAND"],
  ["rbmnl", "revere-beach", "Revere Beach", "REVERE BEACH"],
  ["bmmnl", "beachmont", "Beachmont", "BEACH-MONT"],
  ["sdmnl", "suffolk-downs", "Suffolk Downs", "SUFF. DOWNS"],
  ["orhte", "orient-heights", "Orient Heights", "ORIENT HTS"],
  ["wimnl", "wood-island", "Wood Island", "WOOD ISLAND"],
  ["aport", "airport", "Airport", "AIR-PORT"],
  ["mvbcl", "maverick", "Maverick", "MAVE-RICK"],
  ["aqucl", "aquarium", "Aquarium", "AQUA-RIUM"],
  ["gover", "gov-ctr", "Government Ctr", "GOV CTR"],
  ["bomnl", "bowdoin", "Bowdoin", "BOW-DOIN"],
  // Green Line: north of downtown
  ["mdftf", "medford-tufts", "Medford/Tufts", "MED-FORD"],
  ["balsq", "ball-sq", "Ball Sq", "BALL SQ"],
  ["mgngl", "magoun-sq", "Magoun Sq", "MAGOUN SQ"],
  ["gilmn", "gilman-sq", "Gilman Sq", "GILMAN SQ"],
  ["esomr", "east-somerville", "East Somerville", "EAST SOM."],
  ["unsqu", "union-sq", "Union Sq", "UNION SQ"],
  ["lech", "lechmere", "Lechmere", "LECH-MERE"],
  ["spmnl", "science-park", "Science Park/West End", "SCI PARK"],
  // Green Line: the tunnel
  ["boyls", "boylston", "Boylston", "BOYL-STON"],
  ["armnl", "arlington", "Arlington", "ARL."],
  ["coecl", "copley", "Copley", "COP-LEY"],
  ["hymnl", "hynes", "Hynes", "HYN-ES"],
  ["kencl", "kenmore", "Kenmore", "KEN-MORE"],
  // Green Line B
  ["bland", "blandford", "Blandford St", "BLAND-FORD"],
  ["buest", "bu-east", "BU East", "BU EAST"],
  ["bucen", "bu-central", "BU Central", "BU CTR"],
  ["amory", "amory", "Amory St", "AMORY"],
  ["babck", "babcock", "Babcock St", "BABC-OCK"],
  ["brico", "packards-corner", "Packard's Corner", "PACK-ARDS"],
  ["harvd", "harvard-ave", "Harvard Ave", "HARV. AVE"],
  ["grigg", "griggs-st", "Griggs St", "GRIGGS ST"],
  ["alsgr", "allston-st", "Allston St", "ALLS-TON ST"],
  ["wrnst", "warren-st", "Warren St", "WARREN ST"],
  ["wascm", "washington-st", "Washington St", "WASH. ST"],
  ["sthld", "sutherland-rd", "Sutherland Rd", "SUTH. RD"],
  ["chswk", "chiswick-rd", "Chiswick Rd", "CHIS-WICK"],
  ["chill", "chestnut-hill-ave", "Chestnut Hill Ave", "C.HILL AVE"],
  ["sougr", "south-st", "South St", "SOUTH ST"],
  ["lake", "boston-college", "Boston College", "BOSTON COLL."],
  // Green Line C
  ["smary", "st-marys-st", "St. Mary's St", "ST MARYS"],
  ["hwsst", "hawes-st", "Hawes St", "HAWES ST"],
  ["kntst", "kent-st", "Kent St", "KENT ST"],
  ["stpul", "st-paul-st", "St. Paul St", "ST PAUL"],
  ["cool", "coolidge-corner", "Coolidge Corner", "COOL-IDGE"],
  ["sumav", "summit-ave", "Summit Ave", "SUMMIT AVE"],
  ["bndhl", "brandon-hall", "Brandon Hall", "BRAND. HALL"],
  ["bcnwa", "washington-sq", "Washington Sq", "WASH. SQ"],
  ["tapst", "tappan-st", "Tappan St", "TAPPAN ST"],
  ["denrd", "dean-rd", "Dean Rd", "DEAN RD"],
  ["engav", "englewood-ave", "Englewood Ave", "ENGLE-WOOD"],
  ["clmnl", "cleveland-circle", "Cleveland Circle", "CLEVE. CIR."],
  // Green Line D
  ["fenwy", "fenway", "Fenway", "FEN-WAY"],
  ["longw", "longwood", "Longwood", "LONG-WOOD"],
  ["bvmnl", "brookline-village", "Brookline Village", "BROOK. VILL."],
  ["brkhl", "brookline-hills", "Brookline Hills", "BROOK. HILLS"],
  ["bcnfd", "beaconsfield", "Beaconsfield", "BEAC-ONSFLD"],
  ["rsmnl", "reservoir", "Reservoir", "RESER-VOIR"],
  ["chhil", "chestnut-hill", "Chestnut Hill", "CHEST. HILL"],
  ["newto", "newton-centre", "Newton Centre", "NEWTON CTR"],
  ["newtn", "newton-highlands", "Newton Highlands", "NEWTON HLDS"],
  ["eliot", "eliot", "Eliot", "ELIOT"],
  ["waban", "waban", "Waban", "WABAN"],
  ["woodl", "woodland", "Woodland", "WOOD-LAND"],
  ["river", "riverside", "Riverside", "RIVER-SIDE"],
  // Green Line E
  ["prmnl", "prudential", "Prudential", "PRU"],
  ["symcl", "symphony", "Symphony", "SYM-PHONY"],
  ["nuniv", "northeastern", "Northeastern", "NORTH-EASTN"],
  ["mfa", "museum-of-fine-arts", "Museum of Fine Arts", "MFA"],
  ["lngmd", "longwood-medical", "Longwood Medical Area", "LONGWD MED"],
  ["brmnl", "brigham-circle", "Brigham Circle", "BRIG. CIR."],
  ["fenwd", "fenwood-rd", "Fenwood Rd", "FENWD RD"],
  ["mispk", "mission-park", "Mission Park", "MISSN PARK"],
  ["rvrwy", "riverway", "Riverway", "RIVER-WAY"],
  ["bckhl", "back-of-the-hill", "Back of the Hill", "BACK HILL"],
  ["hsmnl", "heath-st", "Heath St", "HEATH ST"],
];

const ROUTE_LINE: Record<RouteId, { line: LineId; branch?: Branch }> = {
  Red: { line: "red" },
  Mattapan: { line: "mattapan" },
  Orange: { line: "orange" },
  Blue: { line: "blue" },
  "Green-B": { line: "green", branch: "B" },
  "Green-C": { line: "green", branch: "C" },
  "Green-D": { line: "green", branch: "D" },
  "Green-E": { line: "green", branch: "E" },
};
const LINE_ORDER: LineId[] = ["red", "mattapan", "orange", "blue", "green"];
const BRANCH_ORDER: Branch[] = ["B", "C", "D", "E"];

const rowByMbta = new Map(TABLE.map((r) => [`place-${r[0]}`, r]));
const idOf = (mbtaId: string): string => {
  const row = rowByMbta.get(mbtaId);
  if (!row) throw new Error(`t-map: no catalog row for ${mbtaId}. Add it to TABLE in stations.ts.`);
  return row[1];
};

export interface TRoute {
  id: RouteId;
  line: LineId;
  branch?: Branch;
  name: string;
  /** Stop ids in travel order, one list per branch of the route. */
  patterns: string[][];
}

export const T_ROUTES: TRoute[] = RAW_ROUTES.map((r) => ({
  id: r.id as RouteId,
  ...ROUTE_LINE[r.id as RouteId],
  name: r.name,
  patterns: r.patterns.map((p) => p.stops.map(idOf)),
}));

export const T_STATIONS: TStation[] = TABLE.map(([mbta, id, name, short]) => {
  const raw = RAW_STOPS.find((s) => s.mbtaId === `place-${mbta}`);
  if (!raw) throw new Error(`t-map: ${mbta} is in TABLE but not in the MBTA data. Remove it or re-run the fetch.`);
  const on = T_ROUTES.filter((r) => r.patterns.some((p) => p.includes(id)));
  const lines = LINE_ORDER.filter((l) => on.some((r) => r.line === l));
  const branches = BRANCH_ORDER.filter((b) => on.some((r) => r.branch === b));
  return {
    id,
    mbtaId: raw.mbtaId,
    name,
    fullName: raw.name,
    short,
    lines,
    ...(branches.length ? { branches } : {}),
    accessible: raw.accessible,
    ...(raw.suspended ? { suspended: raw.suspended } : {}),
    lat: raw.lat,
    lon: raw.lon,
  };
});

const byId = new Map(T_STATIONS.map((s) => [s.id, s]));
export const tStation = (id: string): TStation | undefined => byId.get(id);

/** Every station on a line, each once, in the order the routes visit them. */
export function stationsOn(line: LineId, branch?: Branch): TStation[] {
  const seen = new Set<string>();
  const out: TStation[] = [];
  for (const r of T_ROUTES) {
    if (r.line !== line || (branch && r.branch !== branch)) continue;
    for (const p of r.patterns) {
      for (const id of p) {
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(byId.get(id)!);
      }
    }
  }
  return out;
}

/** "KEN-MORE" -> ["KEN-", "MORE"], "BU EAST" -> ["BU", "EAST"]: the two lines of a ticket label. */
export function ticketLines(short: string): string[] {
  const hy = short.indexOf("-");
  if (hy > 0) return [short.slice(0, hy + 1), short.slice(hy + 1)];
  const sp = short.indexOf(" ");
  if (sp > 0) return [short.slice(0, sp), short.slice(sp + 1)];
  return [short];
}
