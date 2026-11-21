# @questline/protocol

The contract between the worker and every client. Types and zod schemas for:

- `models.ts`: profile, interest tags, pair colors, ride state, mission, stamp
- `events.ts`: every WebSocket message (server to rider, rider to server, server to kiosk, kiosk to server)
- `api.ts`: REST request and response bodies

Rules:
- Change the contract here first, then update the worker and clients in the same PR.
- The Pi agent is Python and can't import this. `apps/kiosk-pi/protocol.md` mirrors the kiosk events it uses. Update it when you change kiosk events.
- Validate incoming messages with the zod schemas on the worker. Clients can trust the worker and just use the types.
