import { LINES, badgeName } from "../../../shared/catalog";
import type { SocialBattery } from "../../../shared/types";
import { sim } from "../../api";
import { useApp, useRide } from "../../state/store";
import { ArtSlot, Card, Eyebrow, Hint, Screen, Segmented, TextLink, Title } from "../../ui";
import {
  PlatformHouse,
  PlatformPuff,
  PlatformQuestsToggle,
  PlatformStage,
  PlatformTopBar,
  PlatformTree,
  nextStops,
  stationFor,
} from "./parts/PlatformKit";
import { PlatformScene3D, PlatformSign } from "./parts/PlatformScene3D";

const MOODS: { value: SocialBattery; label: string }[] = [
  { value: "nod", label: "Nod" },
  { value: "chat", label: "Chat" },
  { value: "talk", label: "Talk" },
];

/** C2: checked in and in the pool. No "who's here" counter, ever. */
export default function Waiting() {
  const { ride, act } = useRide();
  const { state, actions } = useApp();
  const ghost = state.settings.ghost;

  const turnOff = () => {
    act.checkOut();
    if (ghost) actions.setSettings({ ghost: false }); // ghost was only for this ride
  };

  return (
    <Screen label="C2" tabs blobs="a">
      <PlatformTopBar ride={ride} />
      <WaitingPlatformScene />

      <Card style={{ gap: 8, flex: "none" }}>
        <PlatformQuestsToggle on onToggle={turnOff} label="Quests" />
        {ghost ? (
          <>
            <Title size="sm">Ghost mode</Title>
            <Hint style={{ fontSize: 19, marginTop: -6 }}>you're invisible to matching</Hint>
          </>
        ) : (
          <>
            <Title size="sm">Looking for a good match</Title>
            <Hint style={{ fontSize: 19, marginTop: -6 }}>Pocket it — we'll buzz.</Hint>
          </>
        )}
        <Eyebrow>Tonight's mood</Eyebrow>
        <Segmented label="Tonight's mood" value={ride.mood} onChange={act.setMood} options={MOODS} />
        <div style={{ display: "flex", justifyContent: sim && !ghost ? "space-between" : "flex-end", gap: 10 }}>
          {sim && !ghost && (
            <TextLink small onClick={() => sim?.demo.forceOffer()}>
              demo: simulate a match →
            </TextLink>
          )}
          {ghost ? (
            <TextLink small onClick={() => actions.setSettings({ ghost: false })}>
              Undo ghost mode
            </TextLink>
          ) : (
            <TextLink small onClick={() => actions.setSettings({ ghost: true })}>
              Go ghost for this ride
            </TextLink>
          )}
        </div>
      </Card>
    </Screen>
  );
}

/**
 * The platform, live: you on the platform, the trolley coming round the bend and
 * pulling in. The station sign, the next stops and "you're here" are laid over it.
 */
function WaitingPlatformScene() {
  const { ride, profile } = useRide();
  const c = ride.checkIn;
  const station = stationFor(c?.stationId);
  const line = LINES[c?.line ?? "green"];
  const stops = nextStops(c).map((s) => s.name);
  return (
    <div style={{ flex: "1 0 auto", minHeight: 300, position: "relative", margin: "0 calc(-1 * var(--gutter))" }}>
      <PlatformScene3D line={c?.line} mode="loop" fallback={<WaitingPlatformFlat />} style={{ position: "absolute", inset: 0 }}>
        <PlatformSign name={station.name} color={line.hex} style={{ right: 16, top: 12 }} />
        {stops.length > 0 && (
          <div className="q-scene3d__note" style={{ left: 16, top: 14, fontSize: 16 }}>
            Next: {stops.join(", ")}
          </div>
        )}
        <div className="q-scene3d__note" style={{ left: 16, bottom: 12 }}>
          You're here{profile.badge ? ` · ${badgeName(profile.badge)}` : ""}
        </div>
      </PlatformScene3D>
    </div>
  );
}

/** The flat platform (line strip, next stops, your rider), shown when the 3D scene cannot run. */
function WaitingPlatformFlat() {
  const { ride, profile } = useRide();
  const c = ride.checkIn;
  const station = stationFor(c?.stationId);
  const line = LINES[c?.line ?? "green"];
  const [near, far] = nextStops(c);
  const stop = (name: string | undefined, bottom: number) =>
    name && (
      <>
        <div style={{ position: "absolute", left: 89, bottom, width: 22, height: 22, borderRadius: "50%", background: "var(--paper)", border: "var(--ol) solid var(--ink)" }} />
        <div style={{ position: "absolute", left: 122, bottom, font: "700 19px/22px var(--font-hand)", whiteSpace: "nowrap" }}>{name}</div>
      </>
    );

  return (
    <PlatformStage minHeight={300}>
      <PlatformPuff style={{ left: 236, top: 30, width: 130, height: 62 }} />
      <PlatformPuff style={{ left: -10, top: 150, width: 84, height: 46 }} delay={1800} />
      {/* line strip */}
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 0,
          bottom: 0,
          width: 16,
          borderLeft: "var(--ol) solid var(--ink)",
          borderRight: "var(--ol) solid var(--ink)",
          background: `repeating-linear-gradient(${line.hex} 0 11px, ${line.dark} 11px 14px)`,
        }}
      />
      {/* island with a house */}
      <div
        style={{
          position: "absolute",
          left: 244,
          bottom: 204,
          width: 132,
          height: 40,
          borderRadius: "50%",
          background: "#6DB574",
          border: "var(--ol) solid var(--ink)",
          boxShadow: "0 6px 0 var(--green-dk)",
          filter: "var(--wob)",
        }}
      />
      <PlatformHouse w={46} h={48} roof="#C9A9A6" style={{ left: 268, bottom: 230 }} />
      <PlatformTree size={32} float delay={600} style={{ left: 328, bottom: 230 }} />
      <PlatformTree size={30} float style={{ left: 26, bottom: 168 }} />
      <PlatformHouse w={42} h={44} roof="#D9604A" style={{ left: 18, bottom: 104 }} />
      {stop(far?.name, 272)}
      {stop(near?.name, 208)}
      {/* platform */}
      <div
        style={{
          position: "absolute",
          left: 130,
          bottom: 44,
          width: 246,
          height: 50,
          background: "var(--stone)",
          border: "var(--ol) solid var(--ink)",
          borderRadius: 6,
          boxShadow: "3px 6px 0 var(--shadow)",
          filter: "var(--wob)",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: "var(--yellow)", borderRight: "2px solid var(--ink)" }} />
      </div>
      <div style={{ position: "absolute", left: 150, bottom: 84, width: 100, height: 110 }}>
        <ArtSlot id="ride-rider" fit="contain" placeholder="your rider" style={{ width: "100%", height: "100%" }} />
      </div>
      {/* station sign */}
      <div style={{ position: "absolute", left: 318, bottom: 92, width: 4, height: 52, background: "var(--ink)" }} />
      <div
        style={{
          position: "absolute",
          right: 26,
          bottom: 138,
          minWidth: 112,
          height: 30,
          padding: "0 8px",
          background: "var(--paper)",
          color: "var(--ink)",
          border: "var(--ol) solid var(--ink)",
          borderTop: `7px solid ${line.hex}`,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "400 12px var(--font-display)",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          filter: "var(--wob)",
        }}
      >
        {station.name}
      </div>
      {/* you're here */}
      <div className="anim-pulse" style={{ position: "absolute", left: 82, bottom: 60, width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--ink)" }} />
      <div style={{ position: "absolute", left: 82, bottom: 60, width: 36, height: 36, borderRadius: "50%", background: "var(--yellow)", border: "3px solid var(--ink)" }} />
      <div style={{ position: "absolute", left: 132, bottom: 10, font: "700 20px var(--font-hand)", whiteSpace: "nowrap" }}>
        You're here{profile.badge ? ` · ${badgeName(profile.badge)}` : ""}
      </div>
      {/* the train, coming up the line */}
      <div
        className="anim-trainUp"
        style={{
          position: "absolute",
          left: 86,
          bottom: -30,
          width: 28,
          height: 72,
          background: "var(--paper)",
          border: "var(--ol) solid var(--ink)",
          borderRadius: "11px 11px 6px 6px",
          boxShadow: "3px 4px 0 var(--shadow)",
        }}
      >
        <div style={{ position: "absolute", left: 4, right: 4, top: 5, height: 12, borderRadius: 5, background: "#62C1BC", border: "2px solid var(--ink)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 26, height: 9, background: line.hex }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 44, height: 9, background: line.hex }} />
      </div>
    </PlatformStage>
  );
}
