/**
 * OnboardingFlow.tsx: route /onboarding[?next=<path>]. Runs the onboarding steps in order and
 * creates the rider.
 *
 * Responsible for:
 * - Step order: Basics -> Interests -> AskMeAbout -> SocialBattery -> LocalOrVisitor.
 * - Holding the ProfileDraft, validating it with the protocol Profile schema, then
 *   POST /api/users (no auth) and storing the returned token (auth.ts).
 * - Opening the rider socket once the token exists (ensureRideSocket).
 * - Returning to ?next= (e.g. the /k/:car?n= tap that sent us here) or, by default, /link
 *   so the rider pairs their glasses next.
 *
 * Uses: POST /api/users (CreateUserReq = Profile -> CreateUserRes).
 *
 * TODO:
 * - If a token already exists, offer "edit profile" instead of bouncing (needs a worker route).
 * - Progress dots, swipe back.
 */
import { useState, type ComponentType } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Profile } from "@questline/protocol";
import { api, errorMessage } from "../../lib/api";
import { hasToken, readReturnPath, setToken } from "../../lib/auth";
import { ensureRideSocket } from "../../lib/useRide";
import { AskMeAboutStep } from "./AskMeAbout";
import { BasicsStep } from "./Basics";
import { InterestsStep } from "./Interests";
import { LocalOrVisitorStep } from "./LocalOrVisitor";
import { SocialBatteryStep } from "./SocialBattery";
import { EMPTY_DRAFT, type ProfileDraft, type StepProps } from "./types";

const STEPS: ComponentType<StepProps>[] = [
  BasicsStep,
  InterestsStep,
  AskMeAboutStep,
  SocialBatteryStep,
  LocalOrVisitorStep,
];

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = readReturnPath(params.get("next"));

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasToken() && !busy) return <Navigate to={next ?? "/"} replace />;

  const update = (patch: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const isLast = step === STEPS.length - 1;

  async function finish() {
    const parsed = Profile.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your answers");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.createUser(parsed.data);
      setToken(res.token);
      ensureRideSocket();
      navigate(next ?? "/link", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const Step = STEPS[step] ?? BasicsStep;

  return (
    <main className="screen">
      <Step
        draft={draft}
        update={update}
        busy={busy}
        isLast={isLast}
        onBack={step > 0 ? () => setStep(step - 1) : undefined}
        onNext={isLast ? () => void finish() : () => setStep(step + 1)}
      />
      {error && <p className="error">{error}</p>}
    </main>
  );
}
