The app's artwork. Every file here is drawn by the start screen's own renderer
(`packages/start-screen`, flat colour with ink outlines), so the whole app shares one look.

Do not edit these by hand. Change a model, a shot or a colour in
`packages/start-screen/src/studio/` and run `pnpm art` from the repo root.

Each file is named after the `ArtSlot` id it fills:

- hero-art.webp                 landing page: the island
- ride-rider.webp               waiting screen: you, on the platform
- animal-<animal>.webp          badge animals (cat bear frog owl rabbit fox duck deer);
                                the badge colour is the disc drawn behind them
- meet-spot-<station>-<spot>.webp   where two riders meet, e.g. meet-spot-kenmore-system-map
- memory-<id>.webp, memory-photo.webp   stand-ins for the photos riders take
- glasses-art.webp              the glasses
- sprite-*.webp                 trolley, tree and houses for the platform scenes

A slot with no file shows a dashed placeholder. Search the code for `<ArtSlot id=` for the full list.
