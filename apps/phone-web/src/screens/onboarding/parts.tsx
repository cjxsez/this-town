import type { CSSProperties, ReactNode } from "react";
import { Steps } from "../../ui";
import { STATIONS, stationById } from "../../../shared/catalog";

/** B2–B7 share a six-segment progress bar: B2 = 1 … B7 = 6. */
export const JoinSteps = ({ step }: { step: number }) => <Steps total={6} current={step} />;

/** The onboarding titles run at 36px (B2 is the 38px default). */
export const JoinTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <h1 className="q-title" style={{ ...style }}>
    {children}
  </h1>
);

/** The station the rider joined from (the QR deep link), defaulting to Kenmore. */
export const joinStation = (id?: string) => stationById(id ?? "kenmore") ?? STATIONS[0];
