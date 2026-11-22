import { LINES } from "../../../shared/catalog";
import { useRide } from "../../state/store";
import { Body, Button, Screen, Title } from "../../ui";
import { PlatformHouse, PlatformStage, PlatformTopBar, PlatformTree } from "./parts/PlatformKit";

/**
 * D3: the match ended before the mission. Neutral either way: no sad face, no blame, and
 * it never says who skipped. If you pressed "Not now", it confirms what that did.
 */
export default function FellThrough() {
  const { ride, act } = useRide();
  const line = LINES[ride.checkIn?.line ?? "green"];
  return (
    <Screen
      label="D3"
      blobs="b"
      footer={
        <Button onClick={act.dismiss}>
          OK
        </Button>
      }
    >
      <PlatformTopBar ride={ride} />

      <PlatformStage minHeight={150}>
        <div
          style={{
            position: "absolute",
            left: -20,
            right: -20,
            bottom: 30,
            height: 14,
            borderTop: "var(--ol) solid var(--ink)",
            borderBottom: "var(--ol) solid var(--ink)",
            background: `repeating-linear-gradient(90deg, ${line.hex} 0 11px, ${line.dark} 11px 14px)`,
          }}
        />
        <PlatformTree size={34} float style={{ left: 60, bottom: 44 }} />
        <PlatformTree size={28} float delay={900} style={{ left: 300, bottom: 44 }} />
        <PlatformHouse w={52} h={50} roof="#C9A9A6" style={{ left: 170, bottom: 44 }} />
      </PlatformStage>

      <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {ride.fellThroughReason === "you" ? (
          <>
            <Title>Skipped.</Title>
            <Body style={{ fontSize: 23 }}>No matches for the next 10 minutes. Ride Mode stays on.</Body>
          </>
        ) : (
          <>
            <Title>Not this one.</Title>
            <Body style={{ fontSize: 23 }}>Still looking. Ride Mode stays on.</Body>
          </>
        )}
      </div>
    </Screen>
  );
}
