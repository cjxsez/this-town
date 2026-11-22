// Zod-free constants, safe to import from client bundles via "@questline/protocol/colors".

export const PAIR_COLORS = ["orange", "green", "blue", "pink", "yellow", "purple"] as const;
export type PairColorName = (typeof PAIR_COLORS)[number];

export const PAIR_COLOR_HEX: Record<PairColorName, string> = {
  orange: "#ff8a00",
  green: "#22c55e",
  blue: "#3b82f6",
  pink: "#ec4899",
  yellow: "#facc15",
  purple: "#a855f7",
};

/** Accent for rare / late-bonus missions. Deliberately not a pair color. */
export const RARE_ACCENT_HEX = "#ffd700";

/** WebSocket close codes the worker uses. Clients should not auto-reconnect on 4001/4003. */
export const WS_CLOSE = {
  badAuth: 4001,     // missing or invalid rider token / kiosk key
  tripChanged: 4002, // kiosk's car started a new trip: reconnect
  forbidden: 4003,   // e.g. kiosk key valid but car unknown
  checkedOut: 4000,  // the room checked this rider out (their stop, Ride Mode off): don't reconnect
  noRide: 4009,      // rider has no active check-in: poll GET /api/ride/state instead
} as const;

/**
 * Keepalive. Clients send exactly this string; the TrainRoom answers with WS_PONG via
 * setWebSocketAutoResponse, which doesn't wake a hibernated Durable Object.
 */
export const WS_PING = '{"type":"ping"}';
export const WS_PONG = '{"type":"pong"}';
