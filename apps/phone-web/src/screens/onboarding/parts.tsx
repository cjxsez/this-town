import type { CSSProperties, ReactNode } from "react";
import { Steps } from "../../ui";

/** B2–B6 share a five-segment progress bar: name, interests, ask me about, battery, Ride Mode. */
export const JoinSteps = ({ step }: { step: number }) => <Steps total={5} current={step} />;

/** The onboarding titles run at 36px (B2 is the 38px default). */
export const JoinTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <h1 className="q-title" style={{ ...style }}>
    {children}
  </h1>
);
