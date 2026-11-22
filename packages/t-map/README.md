# @questline/t-map

The T map and the station catalog. Every MBTA subway, light-rail and Mattapan station
(124 of them), drawn as Michael Kvrivishvili's 2013 diagram draws the network, updated to
today's network. The phone's Passport uses it for its overview card and for the full map
at `/passport/map` (H7). It has no dependencies; `renderMap()` returns an SVG string.

## What is on it

- **Subway and light rail**: Red, Mattapan, Orange, Blue, and the Green Line's B, C, D, E
  branches, every station in travel order, from the MBTA V3 API.
- **Since the 2013 reference**: the Green Line Extension (Union Sq, Lechmere to
  Medford/Tufts), Assembly, the B branch consolidation (Amory St, Babcock St), Fairbanks
  St closed (Nov 2026), Symphony shut for construction until 2029, Dudley Sq renamed
  Nubian, Yawkey renamed Lansdowne, Boston Landing, SL3 to Chelsea, the commuter rail
  lines' current names.
- **Also drawn**: Silver Line SL1 to SL5 with stops, the commuter rail lines and stations
  near the core, the harbor ferries, accessibility (from the MBTA's `wheelchair_boarding`),
  terminus badges, the Park St to Downtown Crossing walkway, a key and the credit line.
- **Left out**: the reference's key bus routes (their numbers and paths have changed
  since 2013), and the MBTA's and Amtrak's logos.

## Files

| File | What it is |
|---|---|
| `src/generated/network.ts` | Stations and route patterns from the MBTA V3 API. Generated, never edited by hand |
| `src/stations.ts` | The catalog: app id, map name and ticket label for each MBTA station; `T_STATIONS`, `T_ROUTES`, `stationsOn()`, `tStation()` |
| `src/layout.ts` | Where each station dot and name sits (`SPOTS`) and the subway lines (`TRACKS`) |
| `src/extras.ts` | Silver Line, commuter rail, ferries, badges, captions |
| `src/water.ts` | Harbor and river shapes, traced from the reference |
| `src/style.ts` | Colours and sizes, sampled from the reference |
| `src/render.ts` | `renderMap({ labels, stamped, view, legend })` |
| `src/geometry.ts`, `src/metrics.ts` | Rounded polylines; Helvetica Neue text widths |

Coordinates are pixels of the 1932 x 1932 reference drawing. Every line runs at 0, 45
or 90 degrees, so a straight run is one number in `layout.ts`.

## Commands

```
pnpm --filter @questline/t-map test        # catalog, geometry, layout checks
pnpm --filter @questline/t-map fetch       # re-read stations from the MBTA V3 API
pnpm --filter @questline/t-map svg out.svg # write the map as a standalone SVG
```

The layout tests check that every station has a place on its own line, in travel order,
and that no station name overlaps another name, a subway line, the Silver Line, the
commuter rail or a ferry name. Run them after moving anything.

## When the network changes

1. `pnpm --filter @questline/t-map fetch`. A station the catalog does not know fails the
   tests with its MBTA id. Closures and long suspensions are listed at the top of
   `scripts/fetch-network.mjs`, each with the MBTA alert it comes from.
2. Add the station to `TABLE` in `src/stations.ts` (keep existing ids: stamps are stored
   under them) and give it a spot in `src/layout.ts`.
3. Run the tests and look at the result with `pnpm --filter @questline/t-map svg`.

## Credit

The diagram follows Michael Kvrivishvili's 2013 MBTA map, released under the Creative
Commons Attribution 2.0 licence. The map carries the credit line (`CREDIT` in
`src/render.ts`); keep it when showing the map with names.
