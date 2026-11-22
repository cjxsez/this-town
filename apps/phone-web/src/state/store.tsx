import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { Person, Profile, QuestRecap, ReportReason, SocialBattery, Stamp, TimeOfDay } from "../../shared/types";
import { api, sim } from "../api";
import type { TapBody, TapResult } from "../lib/api";
import { initialRide, rideReducer, type RideAction, type RideState } from "./ride";
import { DEMO_PROFILE, SEED_PEOPLE, SEED_STAMPS } from "./seed";

export interface Settings {
  timeOfDay: TimeOfDay;
  handDrawn: boolean;
  motion: boolean;
  /** Ghost mode: Ride Mode stays on but nobody is matched with you. */
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
  lastRecap?: QuestRecap;
  ride: RideState;
}

// v2: the profile shape changed (no badge, spots, handles), so v1 saves are dropped.
const STORAGE_KEY = "questline:v2";

const initialState: AppState = {
  profile: null,
  draft: {},
  settings: { timeOfDay: "Day", handDrawn: true, motion: true, ghost: false, demoPanel: !!sim },
  stamps: [],
  people: [],
  ride: initialRide,
};

type Action =
  | { type: "ride"; action: RideAction }
  | { type: "draft"; patch: Draft }
  | { type: "createProfile"; profile: Profile; seed: boolean }
  | { type: "updateProfile"; patch: Partial<Profile> }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "block"; personId: string; blocked: boolean }
  | { type: "serverStamps"; stamps: Stamp[] }
  | { type: "serverPeople"; people: Person[] }
  | { type: "devRide"; ride: RideState }
  | { type: "reset" };

/** When a quest reaches recap, write its stamp, person and recap into the collections. */
function commitQuest(s: AppState, prev: RideState, next: RideState): AppState {
  const m = next.match ?? prev.match;
  const c = next.checkIn ?? prev.checkIn;
  if (!m || !c) return s;
  const stamp = next.stamp ?? prev.stamp;
  const now = new Date().toISOString();
  const stationId = stamp?.stationId ?? c.nextStationId;
  const existing = s.people.find((p) => p.id === m.id);
  const person: Person = existing
    ? { ...existing, quests: existing.quests + 1, metAt: now, metAtStationId: stationId }
    : { id: m.id, firstName: m.firstName, color: m.color, metAtStationId: stationId, metAt: now, quests: 1 };
  const recap: QuestRecap = {
    stationId,
    at: now,
    person: m,
    mission: next.mission?.mission ?? prev.mission?.mission,
    note: next.note,
    stamped: !!stamp,
    stampId: stamp?.id,
  };
  return {
    ...s,
    stamps: stamp && !s.stamps.some((x) => x.id === stamp.id) ? [stamp, ...s.stamps] : s.stamps,
    people: [person, ...s.people.filter((p) => p.id !== m.id)],
    lastRecap: recap,
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
        ...(a.seed && s.stamps.length === 0 && { stamps: SEED_STAMPS, people: SEED_PEOPLE }),
      };
    case "updateProfile":
      return s.profile ? { ...s, profile: { ...s.profile, ...a.patch } } : s;
    case "settings":
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case "block":
      return { ...s, people: s.people.map((p) => (p.id === a.personId ? { ...p, blocked: a.blocked } : p)) };
    case "serverStamps":
      return { ...s, stamps: a.stamps };
    case "serverPeople": {
      // Keep local fields (blocked, where you met) for people the server also knows.
      const local = new Map(s.people.map((p) => [p.id, p]));
      return { ...s, people: a.people.map((p) => ({ ...p, ...local.get(p.id), firstName: p.firstName, color: p.color })) };
    }
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
      /** A kiosk tag tap (/k/:car). Needs a profile. */
      tapKiosk: (body: TapBody): Promise<TapResult> => r.tapKiosk(body, ctx()),
      /** Turn Ride Mode off. */
      checkOut: () => {
        r.checkOut();
        local({ type: "local/checkOut" });
      },
      setMood: (mood: SocialBattery) => {
        r.setMood(mood);
        local({ type: "local/mood", mood });
        dispatch({ type: "updateProfile", patch: { battery: mood } });
      },
      notNow: () => r.notNow(),
      arrived: () => r.arrived(),
      setNote: (note: string) => local({ type: "local/note", note }),
      dismiss: () => local({ type: "local/dismiss" }),
      toRecap: () => local({ type: "local/toRecap" }),
      finish: () => local({ type: "local/finish" }),
      closeRideOver: () => local({ type: "local/closeRideOver" }),
    };

    return {
      ride,
      updateDraft: (patch: Draft) => dispatch({ type: "draft", patch }),
      /** Last onboarding step: the draft becomes the profile and the rider is created. */
      finishOnboarding: () => {
        const d = ref.current.draft;
        const profile: Profile = {
          id: `u-${Date.now().toString(36)}`,
          firstName: d.firstName?.trim() || "Rider",
          kind: d.kind ?? "local",
          is18: !!d.is18,
          interests: d.interests ?? [],
          askMeAbout: d.askMeAbout || undefined,
          battery: d.battery ?? "chat",
          rulesAccepted: !!d.rulesAccepted,
          glassesLinked: !!d.glassesLinked,
          createdAt: new Date().toISOString(),
          email: d.email,
        };
        dispatch({ type: "createProfile", profile, seed: !!sim });
        dispatch({ type: "ride", action: { type: "local/mood", mood: profile.battery } });
        return api.saveProfile(profile);
      },
      /** Email sign-in found an existing account: its profile becomes this device's. */
      signedIn: (profile: Profile) => {
        dispatch({ type: "createProfile", profile, seed: false });
        dispatch({ type: "ride", action: { type: "local/mood", mood: profile.battery } });
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
      /** Glasses link. Onboarding calls it before the profile exists (the code is checked later). */
      linkGlasses: async (code: string) => {
        await api.linkGlasses(code);
        dispatch({ type: "updateProfile", patch: { glassesLinked: true } });
        dispatch({ type: "draft", patch: { glassesLinked: true } });
      },
      setSettings: (patch: Partial<Settings>) => {
        dispatch({ type: "settings", patch });
        if (patch.ghost !== undefined) r.setGhost(patch.ghost);
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
      /** Pull stamps and people from the server (http mode); mock mode keeps local data. */
      refreshCollections: async () => {
        const [stamps, people] = await Promise.all([api.loadPassport(), api.loadPeople()]).catch(() => [null, null]);
        if (stamps) dispatch({ type: "serverStamps", stamps });
        if (people) dispatch({ type: "serverPeople", people });
      },
      /** Dev gallery only: jump straight to a ride state. */
      devSetRide: (ride: RideState) => dispatch({ type: "devRide", ride }),
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
  // Server collections on load, and again after each stamp.
  useEffect(() => {
    if (state.profile) void actions.refreshCollections();
  }, [state.profile?.id, state.ride.stampsThisRide, actions]);

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
