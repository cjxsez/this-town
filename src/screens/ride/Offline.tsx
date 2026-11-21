import { useRide } from "../../state/store";
import { Body, Screen, Title } from "../../ui";
import { PlatformStage, PlatformTopBar } from "./parts/PlatformKit";

/** C3: no signal. Still checked in; the countdown runs locally, marked "~". */
export default function Offline() {
  const { ride } = useRide();
  return (
    <Screen label="C3" tabs blobs="b">
      <PlatformTopBar ride={ride} estimated />

      <PlatformStage minHeight={150}>
        <div style={{ position: "absolute", left: 92, top: 0, bottom: 0, width: 0, borderLeft: "4px dashed var(--ink)", opacity: 0.5 }} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            marginLeft: -110,
            top: "50%",
            marginTop: -56,
            width: 220,
            height: 112,
            borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%",
            background: "var(--paper)",
            border: "var(--ol) solid var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {[0, 200, 400].map((d) => (
            <span
              key={d}
              className="anim-hop"
              style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--ink)", animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </PlatformStage>

      <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Title style={{ fontSize: 42 }}>Reconnecting…</Title>
        <Body style={{ fontSize: 21 }}>
          You're still checked in. Offers that arrive while you're offline are dropped, not queued, so you never get a stale one.
        </Body>
        <Body style={{ fontSize: 18 }}>Countdown is estimated until we're back.</Body>
      </div>
    </Screen>
  );
}
