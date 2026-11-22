# @questline/start-screen

The 3D start screen for **In This Town**: train doors slide open on a little island with a trolley running a loop of track, IN THIS TOWN flips in as chunky letter tiles, and a yellow BEGIN button closes the doors again and calls `onBegin()`.

Every T is special: a round green roundel with a paper ring and letter, because the T is what Boston calls the MBTA. It spins in like a coin and spins again every few seconds. It is our own mark, not the MBTA logo.

three.js + Vite + TypeScript. It is a package with its own preview page; the phone app shows it at `/` (see "In the phone app" below).

The look is the app's own. Colours are the phone app's tokens (`apps/phone-web/src/styles/tokens.css`), the lettering is Bungee, the easing curves come from the app's `anim.css`, and the wobbling, "boiling" ink line is the app's `HandDrawnFx` moved into a shader.

## Run

From the repo root:

```bash
pnpm install
pnpm dev:start         # http://localhost:5180
```

It is not part of `pnpm dev` or `pnpm build`. Other scripts (here, or `pnpm --filter @questline/start-screen <script>`):

- `pnpm test`: unit tests (Node's test runner through tsx, no browser needed).
- `pnpm typecheck`
- `pnpm build`: typecheck, then build the preview page to `dist/`.

### Preview page parameters

| Parameter | What it does |
|---|---|
| `?t=1.2` | Freeze the intro at 1.2 seconds and draw that one frame. The same time always gives the same frame. |
| `?out=0.6` | Freeze the sequence after BEGIN at 0.6 seconds. |
| `?tod=Dusk` | Sea colours: `Day` (default), `Dusk` or `Night`, as in the app. |
| `?title=GO+NOW` | Try another title. Words share a row or stack, whichever fits the screen best. |
| `?w=402&h=874` | Show it in a box that size (a phone) instead of the whole window. |

`?t=` and `?out=` are read by the package itself, so they also work wherever it is mounted.

## Use

```ts
import { mountStartScreen } from "@questline/start-screen";

const screen = mountStartScreen(element, {
  onBegin: () => navigate("/join/name"), // called once, after the doors have closed
  onCue: (cue) => sounds[cue]?.play(),   // sound hook, see below
  timeOfDay: "Day",
});
// when leaving:
screen.dispose();
```

`element` needs a size; the screen fills it. All options are documented on `StartScreenOptions` in `src/index.ts`.

### In the phone app

`apps/phone-web/src/screens/onboarding/Start.tsx` mounts it. It loads the package with a dynamic `import()`, so three.js (about 160 kB gzipped) is a separate download and stays out of the app's first load; if that download fails, the rider is sent straight on. It passes the app's time of day and its Motion setting.

`App.tsx` shows it once per visit (tab session) at `/` and `/:stationId`, then the landing page for new riders or Ride Mode for returning ones. `/start` always shows it.

## Change how it looks and moves

Every number, colour and word is in [`src/config.ts`](src/config.ts): the title, the button label, colours, camera, island, train, tile sizes, every intro and after-BEGIN time, the springs, and the sound cue times. Nothing else needs editing to retune it.

- `NAME` is the name as read aloud; `TITLE` sets the letters.
- The title picks its shape per screen: the words go on one row or stack, whichever gives the biggest tiles. IN THIS TOWN is IN / THIS / TOWN on a phone, one line on a desktop, two lines on a phone held sideways. A single word longer than `maxLettersPerRow` is broken over rows (QUESTLINE becomes QUEST / LINE).
- The title stays below a notch and the button above a home bar (`env(safe-area-inset-*)`).
- `hud.roundel` sets which letters become roundels, their colours and their spin.
- Times are seconds from the moment the scene is ready (fonts loaded, first frame drawn).

### Sound hooks

No audio ships yet. `onCue(name)` is called at each moment a sound belongs on:

| Cue | When |
|---|---|
| `whoosh-doors` | 0 s, the doors start to open |
| `whoosh-island` | 0.15 s, the island comes up |
| `letters` | 1.0 s, the first tile flips in |
| `button` | 1.85 s, the button pops up |
| `hover` | the pointer moves onto a tile or the button |
| `flap` | a tile is tapped |
| `roundel` | a T roundel is tapped |
| `click` | BEGIN is pressed |
| `doors-close` | 0.72 s after BEGIN |

The timed ones are listed in `config.ts` under `cues`. They do not fire when a clock is frozen, and the intro ones do not fire under reduced motion (the intro is skipped).

## What the pointer does

- Hover a tile: it lifts and leans towards the pointer. Tap it: it spins once (a roundel plays the `roundel` cue).
- Drag the sea: the island turns, and glides on when you let go.
- The button lifts on hover and sinks when pressed. A real, invisible `<button>` sits exactly on top of it, so Tab, Enter and Space work and screen readers find it.
- With "reduce motion" on, the intro is skipped and the world holds still.
- Without WebGL2, the doors stay shut and the title and button are plain HTML.

## How it is built

| Path | What it is |
|---|---|
| `src/config.ts` | Every number, colour and word. |
| `src/index.ts` | `mountStartScreen`, the public API. |
| `src/app.ts` | The running screen: builds the scene, runs the loop, answers the pointer. |
| `src/dom.ts`, `src/styles.css` | The train doors, the loader caption, the real `<button>`, the HTML fallback. |
| `src/core/` | Pure logic with no three.js: the intro as a function of time, the clocks and freeze rules, springs, layout and hit-testing, the train's timetable, sound cues. |
| `src/scene/` | Geometry: the island and train (`world.ts`), the tiles and button (`hud.ts`), poses (`pose.ts`), the letter texture (`glyphs.ts`). |
| `src/render/` | The shaders and the passes that draw a frame. Start with the comment at the top of `shaders.ts`. |
| `test/` | Tests for everything in `core/` and the parts of `scene/` that do not need a GPU. |

The picture is drawn in three steps: the scene goes into two images at once (flat colours, and "which object and which way does it face" per pixel); a second pass paints the sea behind it and draws an ink line wherever the object changes or one object's faces meet at a sharp angle; a last pass smooths the edges. Pieces that should be outlined have their own id; painted details such as windows and rails share the id of the surface they sit on, which keeps them line-free.

The intro and the after-BEGIN sequence are pure functions of time, which is what makes `?t=` exact. Everything that answers the pointer is a spring layered on top.

What the tests do not cover is the drawing itself (shaders, the render passes, the DOM glue). That is checked by eye from frozen frames: `?t=` at a few times, at phone and desktop sizes.
