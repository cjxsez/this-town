/**
 * PairIncoming.tsx (kiosk-web): a pair is heading to this kiosk.
 *
 * Driven by pair.incoming: color (full-screen fill, PAIR_COLOR_HEX, matches the LEDs and
 * the glasses swatch), firstNames ["Maya", "Andres"] and arrived (how many have tapped
 * in here). Leaves on mission.show (-> Mission) or pair.cleared (-> Idle).
 *
 * Public screen: first names and color only. pair.incoming carries nothing else, and this
 * component must never be handed interests or the why line.
 */
import { PAIR_COLOR_HEX, type PairColor } from "@questline/protocol";
import { PairToken, Screen } from "../components/Ui";

interface PairIncomingProps {
  color: PairColor;
  firstNames: [string, string];
  arrived: number;
}

export function PairIncoming({ color, firstNames, arrived }: PairIncomingProps) {
  const [a, b] = firstNames;
  return (
    <Screen label="Pair incoming" blobs="b" className="k-pair" style={{ background: PAIR_COLOR_HEX[color] }}>
      <section className="k-card k-pair__card k-in" style={{ borderRadius: "var(--r1)" }}>
        <div className="k-eyebrow">{arrived > 0 ? `${arrived} of 2 here` : "Heading here now"}</div>
        <div className="k-pair__tokens">
          <PairToken color={color} name={a} size={108} style={{ borderWidth: 4 }} />
          <span className="k-pair__amp" aria-hidden>&amp;</span>
          <PairToken color={color} name={b} size={108} style={{ borderWidth: 4 }} />
        </div>
        <h1 className="k-display" style={{ fontSize: 54 }}>
          {a} &amp; {b}
        </h1>
        <p className="k-body" style={{ fontSize: 30 }}>Meet here. This kiosk is glowing {color}.</p>
      </section>
    </Screen>
  );
}
