# scripts

| File | What it does |
|---|---|
| `build-assets.mjs` | Copies the three web app builds into `apps/worker/public/` (`/`, `/g/`, `/kiosk/`). Run through `pnpm build`. |
| `seed.ts` | Creates demo profiles through `POST /api/users` and saves their tokens to `scripts/.seed-tokens.json`. `pnpm seed` |
| `ghost-riders.ts` | Checks seeded users into the demo cars and holds rider sockets so the train looks busy. `pnpm ghosts` |

Both TS scripts default to `http://localhost:8787`. Set `WORKER_URL` to target a deployed worker.
