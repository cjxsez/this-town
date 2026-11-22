/**
 * Preview page for the start screen (pnpm --filter @questline/start-screen dev).
 *
 *   ?t=1.2          freeze the intro at 1.2 seconds
 *   ?out=0.6        freeze the sequence after BEGIN at 0.6 seconds
 *   ?tod=Dusk       sea colours: Day, Dusk or Night
 *   ?title=GO+NOW   try another title (a space starts a new row)
 *   ?w=402&h=874    show it in a box that size (a phone) instead of the whole window
 */
import { mountStartScreen, type StartScreenHandle, type TimeOfDay } from "./index";

const params = new URLSearchParams(location.search);
const stage = document.getElementById("stage")!;
const note = document.getElementById("note")!;
const again = document.getElementById("again")!;

const w = Number(params.get("w"));
const h = Number(params.get("h"));
if (w > 0 && h > 0) {
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
  document.body.classList.add("boxed");
}

const tod = params.get("tod");
const timeOfDay: TimeOfDay = tod === "Dusk" || tod === "Night" ? tod : "Day";

let screen: StartScreenHandle;
const mount = () => {
  note.hidden = true;
  screen = mountStartScreen(stage, {
    timeOfDay,
    title: params.get("title")?.toUpperCase() || undefined,
    // The note mounts behind the shut doors, then the doors open onto it.
    revealAfterBegin: true,
    onBegin: () => {
      note.hidden = false;
    },
    onRevealed: () => {
      screen.dispose();
      again.focus();
    },
    // Sound hook: nothing plays yet, the cues are just logged.
    onCue: (cue) => console.debug("[cue]", cue),
  });
};
mount();

again.addEventListener("click", () => {
  screen.dispose();
  mount();
});
