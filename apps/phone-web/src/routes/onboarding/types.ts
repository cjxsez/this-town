/**
 * onboarding/types.ts: shared draft + step props for the onboarding steps.
 *
 * Responsible for: the in-progress profile (looser than protocol Profile so steps can be
 * partially filled) and the props every step component receives from OnboardingFlow.
 * OnboardingFlow validates the finished draft with the protocol Profile schema before
 * POST /api/users.
 *
 * Uses: no routes or events.
 *
 * TODO:
 * - Persist the draft in sessionStorage (try/catch) so a reload mid-onboarding keeps answers.
 */
import type { InterestTag, RiderStatus, SocialBattery } from "@questline/protocol";

export interface ProfileDraft {
  firstName: string;
  is18Plus: boolean;
  interests: InterestTag[];
  askMeAbout: string;
  socialBattery: SocialBattery | null;
  status: RiderStatus | null;
  languages: string[];
}

export const EMPTY_DRAFT: ProfileDraft = {
  firstName: "",
  is18Plus: false,
  interests: [],
  askMeAbout: "",
  socialBattery: null,
  status: null,
  languages: [],
};

export interface StepProps {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  onNext: () => void;
  onBack?: () => void;
  /** True on the last step while POST /api/users is in flight. */
  busy?: boolean;
  isLast?: boolean;
}
