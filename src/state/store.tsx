import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { badgeFor } from "../../shared/catalog";
import type {
  CheckIn,
  GlassesStatus,
  Memory,
  Person,
  Profile,
  QuestRecap,
  ReportReason,
  SocialBattery,
  Stamp,
  TimeOfDay,
} from "../../shared/types";
import { api, sim } from "../api";
import { initialRide, rideReducer, type RideAction, type RideState } from "./ride";
import { DEMO_PROFILE, SEED_MEMORIES, SEED_PEOPLE, SEED_STAMPS } from "./seed";

export interface Settings {
  timeOfDay: TimeOfDay;
  handDrawn: boolean;
  motion: boolean;
  ghost: boolean;
  /** Floating demo panel (mock mode only). */
  demoPanel: boolean;
}

export type Draft = Partial<Omit<Profile, "id" | "createdAt">>;

export interface AppState {
  profile: Profile | null;
  draft: Draft;
  settings: Settings;
  stamps: Stamp[];
  people: Person[];
  memories: Memory[];
  lastRecap?: QuestRecap;
  ride: RideState;
  glasses: GlassesStatus;
}

const STORAGE_KEY = "questline:v1";

const initialGlasses: GlassesStatus = {
  connected: false,
  model: "Ray-Ban Display",
  battery: 72,
  neuralBand: true,
  readBadges: true,
  nodToAccept: false,
  sessionLive: false,
  cameraPaused: false,
};

const initialState: AppState = {
  profile: null,
  draft: {},
  settings: { timeOfDay: "Day", handDrawn: true, motion: true, ghost: false, demoPanel: !!sim },
  stamps: [],
  people: [],
  memories: [],
  ride: initialRide,
  glasses: initialGlasses,
};

type Action =
  | { type: "ride"; action: RideAction }
  | { type: "draft"; patch: Draft }
  | { type: "createProfile"; profile: Profile; seed: boolean }
  | { type: "updateProfile"; patch: Partial<Profile> }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "stayInTouch"; personId: string; state: Person["stayInTouch"] }
  | { type: "block"; personId: string; blocked: boolean }
  | { type: "memoryVote"; memoryId: string; keep: boolean }
  | { type: "glasses"; patch: Partial<GlassesStatus> }
  | { type: "devRide"; ride: RideState }
  | { type: "reset" };

/** When a quest reaches recap, write its stamp, person and memory into the collections. */
function commitQuest(s: AppState, prev: RideState, next: RideState): AppState {
  const m = next.match ?? prev.match;
  const c = next.checkIn;
  if (!m || !c) return s;
  const stamp = next.stamp;
  const now = new Date().toISOString();
  const kept = next.photo?.taken && next.photo.youKeep;
  const memory: Memory | undefined = kept
    ? {
        id: `m-${Date.now()}`,
        personId: m.id,
        stationId: c.stationId,
        takenAt: now,
        rare: !!stamp?.rare,
        status: "deciding",
        youKept: true,
        expiresAt: new Date(next.photo?.keepDeadline ?? Date.now() + 86_400_000).toISOString(),
      }
    : undefined;
  const existing = s.people.find((p) => p.id === m.id);
  const person: Person = existing
    ? { ...existing, quests: existing.quests + 1, metAt: now, metAtStationId: c.stationId }
    : {
        id: m.id,
        firstName: m.firstName,
        badge: m.badge,
        pronoun: m.pronoun,
        metAtStationId: c.stationId,
        metAt: now,
        quests: 1,
        askMeAbout: m.askMeAbout,
        stayInTouch: "off",
      };
  const mission = next.mission?.mission ?? prev.mission?.mission;
  const recap: QuestRecap | undefined = mission && {
    stationId: c.stationId,
    at: now,
    person: m,
    mission,
    note: next.note,
    photo: next.photo?.taken ? (kept ? "waiting" : "none") : "none",
    streak: 3,
    stampId: stamp?.id ?? "",
  };
  return {
    ...s,
    stamps: stamp && !s.stamps.some((x) => x.id === stamp.id) ? [{ ...stamp, memoryId: memory?.id }, ...s.stamps] : s.stamps,
    people: [person, ...s.people.filter((p) => p.id !== m.id)],
    memories: memory ? [memory, ...s.memories] : s.memories,
    lastRecap: recap ?? s.lastRecap,
  };
}

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "ride": {
      const ride = rideReducer(s.ride, a.action);
      const next = { ...s, ride };
      return s.ride.phase !== "recap" && ride.phase === "recap" ? commitQuest(next, s.ride, ride) : next;
    }
    case "draft":
      return { ...s, draft: { ...s.draft, ...a.patch } };
    case "createProfile":
      return {
        ...s,
        profile: a.profile,
        draft: {},
        ...(a.seed && s.stamps.length === 0 && { stamps: SEED_STAMPS, people: SEED_PEOPLE, memories: SEED_MEMORIES }),
      };
    case "updateProfile":
      return s.profile ? { ...s, profile: { ...s.profile, ...a.patch } } : s;
    case "settings":
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case "stayInTouch":
      return { ...s, people: s.people.map((p) => (p.id === a.personId ? { ...p, stayInTouch: a.state } : p)) };
    case "block":
      return { ...s, people: s.people.map((p) => (p.id === a.personId ? { ...p, blocked: a.blocked } : p)) };
    case "memoryVote":
      // If either deletes, it's gone for both, with no message about who.
      return {
        ...s,
        memories: a.keep
          ? s.memories.map((m) => (m.id === a.memoryId ? { ...m, youKept: true } : m))
          : s.memories.filter((m) => m.id !== a.memoryId),
      };
    case "glasses":
      return { ...s, glasses: { ...s.glasses, ...a.patch } };
    case "devRide": {
      const next = { ...s, ride: a.ride };
      return a.ride.phase === "recap" ? commitQuest(next, a.ride, a.ride) : next;
    }
    case "reset":
      return { ...initialState, settings: s.settings };
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw) as Partial<AppState>;
    return {
      ...initialState,
      ...saved,
      settings: { ...initialState.settings, ...saved.settings },
      glasses: { ...initialGlasses, ...saved.glasses, sessionLive: false },
      ride: initialRide, // a ride never survives a reload; the server is the source of truth
    };
  } catch {
    return initialState;
  }
}

function save(s: AppState) {
  try {
    const { ride: _ride, ...rest } = s;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* private mode / storage blocked: the app still works for this session */
  }
}

// ---------------------------------------------------------------------------

function useActions(state: AppState, dispatch: React.Dispatch<Action>) {
  // Actions read the latest state through a ref so their identity stays stable.
  const ref = useRef(state);
  ref.current = state;

  return useMemo(() => {
    const local = (action: RideAction) => dispatch({ type: "ride", action });
    const r = api.ride;
    const ctx = () => ({ profile: ref.current.profile!, mood: ref.current.ride.mood, ghost: ref.current.settings.ghost });

    const ride = {
      checkIn: (c: CheckIn) => r.checkIn(c, ctx()),
      checkOut: () => {
        r.checkOut();
        local({ type: "local/checkOut" });
      },
      setMood: (mood: SocialBattery) => {
        r.setMood(mood);
        local({ type: "local/mood", mood });
      },
      yes: () => {
        local({ type: "local/offerYes" });
        r.respondOffer(true);
      },
      skip: () => r.respondOffer(false),
      withdraw: () => r.withdraw(),
      cantSpot: () => local({ type: "local/cantSpot" }),
      backToMeet: () => local({ type: "local/backToMeet" }),
      atSpot: () => {
        local({ type: "local/atSpot" });
        r.atSpot();
      },
      met: () => {
        local({ type: "local/met", at: Date.now() });
        r.met();
      },
      startQuest: () => r.startQuest(),
      newPrompt: () => r.newPrompt(),
      missionDone: () => {
        local({ type: "local/missionDone", bumpDeadline: Date.now() + 20_000 });
        r.missionDone();
      },
      bump: () => {
        local({ type: "local/bump" });
        r.bump();
      },
      photoVote: (yes: boolean) => {
        local({ type: "local/photoVote", yes });
        r.photoVote(yes);
      },
      takePhoto: () => r.takePhoto(),
      keepVote: (keep: boolean) => {
        local({ type: "local/keepVote", keep });
        r.keepVote(keep);
      },
      setNote: (note: string) => local({ type: "local/note", note }),
      dismissTrainSoon: () => local({ type: "local/dismissTrainSoon" }),
      board: () => r.board(),
      dismiss: () => local({ type: "local/dismiss" }),
      keepOnNextStation: () => r.keepOnNextStation(),
      finish: () => local({ type: "local/finish" }),
    };

    return {
      ride,
      updateDraft: (patch: Draft) => dispatch({ type: "draft", patch }),
      /** B7 "Done · start riding": the draft becomes the profile. */
      finishOnboarding: (badgeNumber: number) => {
        const d = ref.current.draft;
        const profile: Profile = {
          id: `u-${Date.now().toString(36)}`,
          firstName: d.firstName?.trim() || "Rider",
          kind: d.kind ?? "local",
          is18: !!d.is18,
          interests: d.interests ?? [],
          spots: d.spots ?? [],
          askMeAbout: d.askMeAbout || undefined,
          battery: d.battery ?? "chat",
          useAi: !!d.useAi,
          handles: d.handles ?? {},
          badge: badgeFor(badgeNumber),
          homeStation: d.homeStation ?? "kenmore",
          hasGlasses: !!d.hasGlasses,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "createProfile", profile, seed: !!sim });
        dispatch({ type: "ride", action: { type: "local/mood", mood: profile.battery } });
        void api.saveProfile(profile);
      },
      /** "Just play today" with everything pre-filled, for demos. */
      useDemoProfile: () => {
        dispatch({ type: "createProfile", profile: { ...DEMO_PROFILE, createdAt: new Date().toISOString() }, seed: true });
      },
      updateProfile: (patch: Partial<Profile>) => {
        dispatch({ type: "updateProfile", patch });
        const p = ref.current.profile;
        if (p) void api.saveProfile({ ...p, ...patch });
      },
      setSettings: (patch: Partial<Settings>) => {
        dispatch({ type: "settings", patch });
        if (patch.ghost !== undefined) r.setGhost(patch.ghost);
      },
      setStayInTouch: async (personId: string, on: boolean) => {
        dispatch({ type: "stayInTouch", personId, state: on ? "waiting" : "off" });
        const state = await api.setStayInTouch(personId, on);
        dispatch({ type: "stayInTouch", personId, state });
      },
      report: (personId: string, reason: ReportReason, alsoBlock: boolean) => {
        if (alsoBlock) dispatch({ type: "block", personId, blocked: true });
        return api.report(personId, reason, alsoBlock);
      },
      block: (personId: string) => {
        dispatch({ type: "block", personId, blocked: true });
        return api.block(personId);
      },
      unblock: (personId: string) => {
        dispatch({ type: "block", personId, blocked: false });
        return api.unblock(personId);
      },
      voteMemory: (memoryId: string, keep: boolean) => {
        dispatch({ type: "memoryVote", memoryId, keep });
        return api.voteMemory(memoryId, keep);
      },
      /** Dev gallery only: jump straight to a ride state. */
      devSetRide: (ride: RideState) => dispatch({ type: "devRide", ride }),
      setGlasses: (patch: Partial<GlassesStatus>) => dispatch({ type: "glasses", patch }),
      deleteMyData: async () => {
        r.checkOut();
        await api.deleteMyData();
        dispatch({ type: "reset" });
      },
    };
  }, [dispatch]);
}

type Actions = ReturnType<typeof useActions>;
const Ctx = createContext<{ state: AppState; actions: Actions } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const actions = useActions(state, dispatch);

  useEffect(() => api.ride.subscribe((e) => dispatch({ type: "ride", action: e })), []);
  useEffect(() => save(state), [state]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

/** Shorthand for ride screens. */
export function useRide() {
  const { state, actions } = useApp();
  return { ride: state.ride, act: actions.ride, profile: state.profile! };
}
