/** The wobbly-outline filter from phone-web (HandDrawnFx), without the reseeding "boil". Put one on every game screen. */
export function Wobble() {
  return (
    <svg className="guess-fx" width="0" height="0" aria-hidden>
      <filter id="guess-wob" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={7} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
