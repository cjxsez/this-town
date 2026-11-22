// Writes the map as a standalone SVG: tsx scripts/write-svg.ts out.svg [full]
// "full" keeps the reference's whole 1932 square, for laying over the reference image.
import { writeFileSync } from "node:fs";
import { MAP_SIZE, renderMap } from "../src/index";

const out = process.argv[2] ?? "t-map.svg";
const full = process.argv[3] === "full";
writeFileSync(out, renderMap(full ? { view: { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE } } : {}));
console.log(out);
