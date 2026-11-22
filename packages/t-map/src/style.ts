// Colours and sizes of the diagram, sampled from the reference drawing.
import type { LineId } from "./stations";

export const COLORS = {
  paper: "#FFFCF7",
  water: "#D1EEFC",
  ink: "#231F20",
  red: "#E43137",
  orange: "#F8941D",
  blue: "#0083CC",
  green: "#009867",
  silver: "#939594",
  rail: "#A790C6",
  ferry: "#1C8CC0",
  /** Not-accessible mark. */
  mark: "#2F8FCC",
  closed: "#D8262C",
  /** A stamped station, in the app's own yellow. */
  stamp: "#F2C84B",
} as const;

export const LINE_COLOR: Record<LineId, string> = {
  red: COLORS.red,
  mattapan: COLORS.red,
  orange: COLORS.orange,
  blue: COLORS.blue,
  green: COLORS.green,
};
export const LINE_WIDTH: Record<LineId, number> = { red: 18, mattapan: 18, orange: 18, blue: 17, green: 17 };
export const RAIL_WIDTH = 9;
export const SILVER_WIDTH = 14;

export const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
/** Commuter rail and Silver Line names. */
export const MINOR_SIZE = 17.6;
export const DOT_R = 4.8;
export const HUB_R = 11.7;
export const HUB_STROKE = 3.6;
