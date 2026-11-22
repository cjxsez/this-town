/**
 * viewport.ts: keep the app exactly the size of what the rider can see.
 *
 * Why: iOS (Safari, and Chrome on iPhone, which is WebKit too) ignores
 * `interactive-widget=resizes-content`. When the keyboard opens it doesn't resize the page; it
 * scrolls the document to keep the caret visible. The shell was `100dvh`, which also changes
 * whenever Chrome's toolbars slide in or out. Typing an email makes the keyboard's suggestion
 * strip appear and disappear, the visible area changes, iOS scrolls, the toolbar moves, `dvh`
 * changes, and iOS scrolls again: the screen jumps up and down.
 *
 * Fix: size the shell to `visualViewport` (the area above the keyboard, below the toolbars)
 * through `--app-h`, pin the document so there is nothing for iOS to scroll, and if iOS still
 * pans the visual viewport over the pinned page, move the shell with it (`--app-top`). The footer
 * button then sits right above the keyboard, and the content at the top stays put.
 * Only on phone widths; the desktop device frame (min-width: 600px) is unchanged.
 */
export function trackVisualViewport(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let frame = 0;
  const sync = () => {
    frame = 0;
    root.style.setProperty("--app-h", `${Math.round(vv.height)}px`);
    root.style.setProperty("--app-top", `${Math.round(vv.offsetTop)}px`);
    // iOS may still have scrolled the (pinned) document while focusing a field; undo it.
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };
  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  sync();
}
