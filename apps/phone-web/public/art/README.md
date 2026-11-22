The app's artwork. Every file here is drawn by the start screen's own renderer
(`packages/start-screen`, flat colour with ink outlines), so the whole app shares one look.

Do not edit these by hand. Change a model, a shot or a colour in
`packages/start-screen/src/studio/` and run `pnpm art` from the repo root.

Each file is named after the `ArtSlot` id it fills:

- hero-art.webp            landing page: the island (a small Boston University)
- ride-rider.webp          Riding screen, flat fallback: you
- glasses-art.webp         Glasses screen
- sprite-*.webp            trolley (one per line colour), tree and houses for the flat
                           fallback scenes, shown when the 3D platform view cannot run

A slot with no file shows a dashed placeholder. Search the code for `<ArtSlot id=` for the full list.
