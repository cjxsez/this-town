/**
 * The HTML around the canvas: train doors that cover the scene while it loads
 * and slide apart to reveal it (and shut again after BEGIN), plus a real,
 * focusable <button> laid exactly over the 3D one.
 */
import "./styles.css";
import type { Config } from "./config";
import { clamp01 } from "./core/ease";
import type { HudLayout, Insets } from "./core/layout";
import type { SeaColors } from "./scene/world";

export interface Overlay {
  root: HTMLDivElement;
  canvas: HTMLCanvasElement;
  button: HTMLButtonElement;
  /** 1 = doors shut, 0 = fully open. */
  setCover(cover: number): void;
  /** Loading: doors shut and boiling. */
  setLoading(loading: boolean): void;
  /** Keep the real button over the 3D one. */
  placeButton(layout: HudLayout): void;
  /** How much of the top and bottom of the screen a notch or home bar covers. */
  readInsets(): Insets;
  /** No WebGL: leave the doors shut and show the title and button as plain HTML. */
  showFallback(): void;
  dispose(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: Element): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
};

export function createOverlay(container: HTMLElement, config: Config, sea: SeaColors, name: string): Overlay {
  const C = config.colors;
  const root = el("div", "qls qls--loading", container);
  const vars: Record<string, string> = {
    "--qls-sea": sea.sea,
    "--qls-ink": C.ink,
    "--qls-paper": C.paper,
    "--qls-yellow": C.yellow,
    "--qls-yellow-dk": C.yellowDk,
    "--qls-shadow": C.shadow,
    "--qls-line": config.lineColors[0],
    "--qls-focus": "#6bbde6",
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);

  const canvas = el("canvas", "qls__canvas", root);
  canvas.setAttribute("aria-hidden", "true");

  const heading = el("h1", "qls__title", root);
  heading.textContent = name;

  // Reads the safe-area insets (notch, home bar) the browser reports.
  const probe = el("div", "qls__probe", root);

  const button = el("button", "qls__begin", root);
  button.type = "button";
  button.disabled = true;
  button.textContent = config.buttonLabel.charAt(0) + config.buttonLabel.slice(1).toLowerCase();

  const doors = el("div", "qls__doors", root);
  doors.setAttribute("aria-hidden", "true");
  const makeDoor = (side: "left" | "right", caption: string) => {
    const door = el("div", `qls__door qls__door--${side}`, doors);
    el("div", "qls__window", door);
    el("div", "qls__stripe", door);
    el("div", "qls__handle", door);
    // Half the caption is lettered on each door, so it parts with them.
    el("p", "qls__caption", door).textContent = caption;
    return door;
  };
  const left = makeDoor("left", config.loaderCaption[0]);
  const right = makeDoor("right", config.loaderCaption[1]);

  // The app's wobble filter (HandDrawnFx), for the doors while they wait.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML =
    `<filter id="qls-wobble" x="-2%" y="-2%" width="104%" height="104%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${config.wobble.frequency}" numOctaves="2" seed="${config.wobble.seeds[0]}" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="${config.wobble.amountPx * 2}" xChannelSelector="R" yChannelSelector="G"/>` +
    `</filter>`;
  root.append(svg);
  const turbulence = svg.querySelector("feTurbulence");

  let boil = 0;
  let seed = 0;
  const stopBoil = () => {
    if (boil) clearInterval(boil);
    boil = 0;
  };

  const overlay: Overlay = {
    root,
    canvas,
    button,
    setCover(cover) {
      const shut = clamp01(cover);
      doors.hidden = shut <= 0.0005;
      if (doors.hidden) return;
      const slide = (1 - shut) * 101;
      left.style.transform = `translate3d(${-slide}%, 0, 0)`;
      right.style.transform = `translate3d(${slide}%, 0, 0)`;
    },
    setLoading(loading) {
      root.classList.toggle("qls--loading", loading);
      stopBoil();
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!loading || still) return;
      boil = window.setInterval(() => {
        seed = (seed + 1) % config.wobble.seeds.length;
        turbulence?.setAttribute("seed", String(config.wobble.seeds[seed]));
      }, config.wobble.boilMs);
    },
    readInsets() {
      const style = getComputedStyle(probe);
      const box = root.getBoundingClientRect();
      // Insets only matter where this screen actually reaches the edge of the viewport.
      return {
        top: Math.max(0, (Number.parseFloat(style.paddingTop) || 0) - box.top),
        bottom: Math.max(0, (Number.parseFloat(style.paddingBottom) || 0) - (window.innerHeight - box.bottom)),
      };
    },
    placeButton(layout) {
      const b = layout.button;
      button.style.left = `${layout.viewW / 2 + b.cx}px`;
      button.style.top = `${layout.viewH / 2 - b.cy}px`;
      button.style.width = `${b.w}px`;
      button.style.height = `${b.h}px`;
    },
    showFallback() {
      stopBoil();
      root.classList.remove("qls--loading");
      root.classList.add("qls--fallback");
      overlay.setCover(1);
      button.disabled = false;
    },
    dispose() {
      stopBoil();
      root.remove();
    },
  };
  overlay.setCover(1);
  overlay.setLoading(true);
  return overlay;
}
