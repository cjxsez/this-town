import type { CSSProperties, ReactNode } from "react";
import { Steps } from "../../ui";

/** B2–B7 share a six-segment progress bar: name, interests, ask me about, battery, Ride Mode, glasses. */
export const JoinSteps = ({ step }: { step: number }) => <Steps total={6} current={step} />;

/** The onboarding titles run at 36px (B2 is the 38px default). */
export const JoinTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <h1 className="q-title" style={{ fontSize: 36, ...style }}>
    {children}
  </h1>
);
