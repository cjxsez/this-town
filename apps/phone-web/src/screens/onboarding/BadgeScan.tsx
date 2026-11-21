import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { AnimalToken, Button, ButtonRow, Card, Eyebrow, Hint, Screen, TextField, TextLink } from "../../ui";
import { useApp } from "../../state/store";
import { badgeFor } from "../../../shared/catalog";
import { TagGrid } from "../print/tag";
import { JoinSteps, JoinTitle } from "./parts";

type Cam = "idle" | "starting" | "live" | "failed";

const BADGE_MIN = 1;
const BADGE_MAX = 48;
const DEMO_BADGE = 23;

const corner = (pos: CSSProperties, widths: string): CSSProperties => ({
  position: "absolute",
  width: 26,
  height: 26,
  borderStyle: "solid",
  borderColor: "var(--mint)",
  borderWidth: widths,
  zIndex: 2,
  ...pos,
});

/**
 * B7 Get your badge. Opens the rear camera in the viewfinder when it can.
 * Real ArUco decoding isn't built yet, so a live camera offers a demo link
 * that pretends it read #23; typing the number always works.
 * Colour and animal come from the number (badgeFor).
 */
export default function BadgeScan() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const number = state.draft.badge?.number;
  const badge = number ? badgeFor(number) : null;

  const [cam, setCam] = useState<Cam>("idle");
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState(number ? String(number) : "");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const alive = useRef(true);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const openCamera = useCallback(async () => {
    // getUserMedia needs a secure context (HTTPS or localhost) and permission.
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("failed");
      setTyping(true);
      return;
    }
    setCam("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setCam("live");
      // TODO(hardware): run an ArUco 4×4 detector on video frames here and call pick(id).
    } catch {
      if (!alive.current) return;
      setCam("failed");
      setTyping(true);
    }
  }, []);

  // Attach the stream once the <video> exists.
  useEffect(() => {
    const v = videoRef.current;
    if (cam === "live" && v && streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => {});
    }
  }, [cam]);

  // If the rider already granted the camera, open it straight away; otherwise wait for a tap.
  useEffect(() => {
    alive.current = true;
    if (!number) {
      navigator.permissions
        ?.query({ name: "camera" as PermissionName })
        .then((p) => {
          if (p.state === "granted" && alive.current) void openCamera();
        })
        .catch(() => {});
    }
    return () => {
      alive.current = false;
      stopCamera();
    };
    // Mount/unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (n: number) => {
    actions.updateDraft({ badge: badgeFor(n) });
    stopCamera();
    setCam("idle");
  };

  const onType = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 2);
    setTyped(digits);
    const n = Number(digits);
    if (digits && n >= BADGE_MIN && n <= BADGE_MAX) pick(n);
    else actions.updateDraft({ badge: undefined });
  };
  const typedBad = typed !== "" && !(Number(typed) >= BADGE_MIN && Number(typed) <= BADGE_MAX);

  // The 18+ gate lives on B2. Someone who came straight here from "Already
  // have a badge?" still has to pass it, so their badge waits in the draft.
  // TODO(backend): a badge that already belongs to a rider should restore that profile instead.
  const passedGate = state.draft.is18 === true;
  const done = () => {
    if (!number) return;
    if (!passedGate) {
      navigate("/join/name");
      return;
    }
    actions.finishOnboarding(number);
    navigate("/ride");
  };

  const live = cam === "live";

  return (
    <Screen
      label="B7"
      blobs="c"
      footer={
        <>
          <ButtonRow>
            <Button tilt={-0.5} disabled={!number} onClick={done}>
              {passedGate ? "Done · start riding" : "Next · about you"}
            </Button>
          </ButtonRow>
          {!typing && <TextLink onClick={() => setTyping(true)}>Type the number instead</TextLink>}
        </>
      }
    >
      <JoinSteps step={6} />
      <JoinTitle>Grab a badge and scan it</JoinTitle>

      {/* Viewfinder */}
      <div
        style={{
          flex: 1,
          minHeight: 150,
          position: "relative",
          background: "var(--ink-deep)",
          color: "var(--mint)",
          border: "var(--ol) solid var(--ink)",
          borderRadius: "var(--r4)",
          boxShadow: "3px 5px 0 var(--shadow)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div style={corner({ left: 10, top: 10 }, "3px 0 0 3px")} />
        <div style={corner({ right: 10, top: 10 }, "3px 3px 0 0")} />
        <div style={corner({ left: 10, bottom: 10 }, "0 0 3px 3px")} />
        <div style={corner({ right: 10, bottom: 10 }, "0 3px 3px 0")} />

        {live ? (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              aria-label="Camera view"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 14,
                zIndex: 3,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <TextLink
                small
                onClick={() => pick(DEMO_BADGE)}
                style={{ color: "var(--mint)", background: "rgba(22,35,42,.7)", borderRadius: 6, padding: "0 12px" }}
              >
                demo: pretend it read #{DEMO_BADGE}
              </TextLink>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (number) {
                actions.updateDraft({ badge: undefined });
                setTyped("");
              }
              void openCamera();
            }}
            aria-label={number ? `Badge ${number} read. Tap to scan a different badge` : "Open the camera to scan your badge tag"}
            disabled={cam === "starting"}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: 16,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <TagGrid n={number ?? 17} cell="15px" />
            <span style={{ font: "400 11px var(--font-display)", letterSpacing: ".06em" }}>
              {number ? `BADGE #${number} ✓` : "SCAN BADGE TAG"}
            </span>
            {!number && (
              <span style={{ fontSize: 17, opacity: 0.85 }}>
                {cam === "starting"
                  ? "opening camera…"
                  : cam === "failed"
                    ? "no camera here. type the number below"
                    : "tap to open the camera"}
              </span>
            )}
          </button>
        )}

        {!number && cam !== "failed" && (
          <div
            className="anim-scanY"
            aria-hidden
            style={{ position: "absolute", left: 14, right: 14, top: "10%", height: 3, background: "var(--yellow)", zIndex: 2 }}
          />
        )}
      </div>

      {typing && (
        <Card tight className="anim-fadeIn">
          <Eyebrow>Badge number</Eyebrow>
          <TextField label="Badge number, 1 to 48" value={typed} onChange={onType} inputMode="numeric" placeholder="1–48" maxLength={2} autoFocus={cam !== "failed"} />
          <Hint style={typedBad ? { color: "var(--rust)" } : undefined}>
            {typedBad ? "Badges go from 1 to 48." : "It's printed under the tag, 1 to 48."}
          </Hint>
        </Card>
      )}

      {badge && (
        <>
          <Card style={{ borderRadius: "var(--r1)" }} className="anim-fadeIn">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }} aria-live="polite">
              <AnimalToken badge={badge} size={96} style={{ border: "3px solid var(--ink)", boxShadow: "none" }} />
              <div>
                <div style={{ font: "400 19px/1.02 var(--font-display)", textTransform: "uppercase" }}>
                  You're the {badge.color} {badge.animal}
                </div>
                <div style={{ fontSize: 18, lineHeight: 1.2, marginTop: 4 }}>Badge #{badge.number} · wear it outside your coat</div>
              </div>
            </div>
          </Card>
          <p style={{ fontSize: 17, lineHeight: 1.2, textAlign: "center", textWrap: "pretty" }}>
            Other riders will look for this animal. Your face is never used.
          </p>
        </>
      )}
    </Screen>
  );
}
