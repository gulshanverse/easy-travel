/**
 * Journey Studio — client-side workspace state.
 * Consumes ONLY SDKs (capabilitiesClient, tieClient, aiClient).
 * Never imports server modules or the database directly.
 */
import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from "react";

export type ActivityKind =
  | "flight" | "hotel" | "activity" | "restaurant" | "transport" | "note";

export interface StudioActivity {
  id: string;
  kind: ActivityKind;
  title: string;
  description?: string;
  startTime?: string;
  durationMinutes?: number;
  location?: string;
  costCents?: number;
  currency?: string;
}

export interface StudioDay {
  id: string;
  dayNumber: number;
  title: string;
  date?: string | null;
  activities: StudioActivity[];
}

export interface StudioJourney {
  id: string;
  title: string;
  summary: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  budgetCents: number | null;
  days: StudioDay[];
}

export interface StudioSnapshot {
  id: string;
  at: number;
  label: string;
  journey: StudioJourney;
}

interface State {
  journey: StudioJourney;
  history: StudioSnapshot[];
  future: StudioSnapshot[];
  selectedActivityId: string | null;
  rightPanel: RightPanelTab;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
  thinking: string | null;
}

export type RightPanelTab =
  | "intel" | "budget" | "weather" | "risks" | "recs" | "packing" | "visa" | "safety";

type Action =
  | { type: "REPLACE_JOURNEY"; journey: StudioJourney; label: string }
  | { type: "PATCH_JOURNEY"; patch: Partial<StudioJourney>; label: string }
  | { type: "ADD_ACTIVITY"; dayId: string; activity: StudioActivity }
  | { type: "UPDATE_ACTIVITY"; activityId: string; patch: Partial<StudioActivity> }
  | { type: "REMOVE_ACTIVITY"; activityId: string }
  | { type: "MOVE_ACTIVITY"; activityId: string; toDayId: string; toIndex: number }
  | { type: "SELECT"; id: string | null }
  | { type: "SET_RIGHT"; tab: RightPanelTab }
  | { type: "TOGGLE"; which: "left" | "right" | "bottom" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "THINKING"; message: string | null };

function snapshot(state: State, label: string): StudioSnapshot {
  return {
    id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    label,
    journey: JSON.parse(JSON.stringify(state.journey)) as StudioJourney,
  };
}

function withSnap(state: State, next: StudioJourney, label: string): State {
  return {
    ...state,
    history: [...state.history, snapshot(state, label)].slice(-50),
    future: [],
    journey: next,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REPLACE_JOURNEY":
      return withSnap(state, action.journey, action.label);
    case "PATCH_JOURNEY":
      return withSnap(state, { ...state.journey, ...action.patch }, action.label);
    case "ADD_ACTIVITY": {
      const days = state.journey.days.map((d) =>
        d.id === action.dayId ? { ...d, activities: [...d.activities, action.activity] } : d,
      );
      return withSnap(state, { ...state.journey, days }, `Added ${action.activity.title}`);
    }
    case "UPDATE_ACTIVITY": {
      const days = state.journey.days.map((d) => ({
        ...d,
        activities: d.activities.map((a) => (a.id === action.activityId ? { ...a, ...action.patch } : a)),
      }));
      return withSnap(state, { ...state.journey, days }, `Edited activity`);
    }
    case "REMOVE_ACTIVITY": {
      const days = state.journey.days.map((d) => ({
        ...d,
        activities: d.activities.filter((a) => a.id !== action.activityId),
      }));
      return withSnap(state, { ...state.journey, days }, `Removed activity`);
    }
    case "MOVE_ACTIVITY": {
      let moved: StudioActivity | null = null;
      const stripped = state.journey.days.map((d) => ({
        ...d,
        activities: d.activities.filter((a) => {
          if (a.id === action.activityId) { moved = a; return false; }
          return true;
        }),
      }));
      if (!moved) return state;
      const days = stripped.map((d) => {
        if (d.id !== action.toDayId) return d;
        const next = [...d.activities];
        next.splice(Math.max(0, Math.min(action.toIndex, next.length)), 0, moved!);
        return { ...d, activities: next };
      });
      return withSnap(state, { ...state.journey, days }, `Moved activity`);
    }
    case "SELECT":
      return { ...state, selectedActivityId: action.id };
    case "SET_RIGHT":
      return { ...state, rightPanel: action.tab };
    case "TOGGLE":
      return action.which === "left"
        ? { ...state, leftCollapsed: !state.leftCollapsed }
        : action.which === "right"
          ? { ...state, rightCollapsed: !state.rightCollapsed }
          : { ...state, bottomCollapsed: !state.bottomCollapsed };
    case "UNDO": {
      const prev = state.history[state.history.length - 1];
      if (!prev) return state;
      return {
        ...state,
        history: state.history.slice(0, -1),
        future: [snapshot(state, "Redo"), ...state.future].slice(0, 50),
        journey: prev.journey,
      };
    }
    case "REDO": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        ...state,
        history: [...state.history, snapshot(state, "Undo")].slice(-50),
        future: rest,
        journey: next.journey,
      };
    }
    case "THINKING":
      return { ...state, thinking: action.message };
    default:
      return state;
  }
}

function defaultJourney(): StudioJourney {
  const id = `jr_${Date.now().toString(36)}`;
  return {
    id,
    title: "Untitled journey",
    summary: "Describe your trip in the composer to let the AI plan it.",
    destination: null,
    startDate: null,
    endDate: null,
    currency: "USD",
    budgetCents: null,
    days: [
      { id: `${id}_d1`, dayNumber: 1, title: "Day 1", date: null, activities: [] },
    ],
  };
}

export interface StudioApi {
  state: State;
  actions: {
    replaceJourney: (j: StudioJourney, label?: string) => void;
    patchJourney: (patch: Partial<StudioJourney>, label?: string) => void;
    addActivity: (dayId: string, activity: StudioActivity) => void;
    updateActivity: (id: string, patch: Partial<StudioActivity>) => void;
    removeActivity: (id: string) => void;
    moveActivity: (id: string, toDayId: string, toIndex: number) => void;
    select: (id: string | null) => void;
    setRight: (tab: RightPanelTab) => void;
    toggle: (which: "left" | "right" | "bottom") => void;
    undo: () => void;
    redo: () => void;
    setThinking: (msg: string | null) => void;
    nextActivityId: () => string;
  };
}

const StudioCtx = createContext<StudioApi | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    journey: defaultJourney(),
    history: [],
    future: [],
    selectedActivityId: null,
    rightPanel: "intel" as RightPanelTab,
    leftCollapsed: false,
    rightCollapsed: false,
    bottomCollapsed: false,
    thinking: null,
  }));

  const counter = useRef(0);
  const nextActivityId = useCallback(() => {
    counter.current += 1;
    return `act_${Date.now().toString(36)}_${counter.current}`;
  }, []);

  const api: StudioApi = useMemo(() => ({
    state,
    actions: {
      replaceJourney: (j, label = "Replaced journey") => dispatch({ type: "REPLACE_JOURNEY", journey: j, label }),
      patchJourney: (patch, label = "Edited details") => dispatch({ type: "PATCH_JOURNEY", patch, label }),
      addActivity: (dayId, activity) => dispatch({ type: "ADD_ACTIVITY", dayId, activity }),
      updateActivity: (activityId, patch) => dispatch({ type: "UPDATE_ACTIVITY", activityId, patch }),
      removeActivity: (activityId) => dispatch({ type: "REMOVE_ACTIVITY", activityId }),
      moveActivity: (activityId, toDayId, toIndex) => dispatch({ type: "MOVE_ACTIVITY", activityId, toDayId, toIndex }),
      select: (id) => dispatch({ type: "SELECT", id }),
      setRight: (tab) => dispatch({ type: "SET_RIGHT", tab }),
      toggle: (which) => dispatch({ type: "TOGGLE", which }),
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      setThinking: (msg) => dispatch({ type: "THINKING", message: msg }),
      nextActivityId,
    },
  }), [state, nextActivityId]);

  return <StudioCtx.Provider value={api}>{children}</StudioCtx.Provider>;
}

export function useStudio(): StudioApi {
  const ctx = useContext(StudioCtx);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
}

/** Map a planner capability output into Studio's journey shape. */
export function plannerOutputToJourney(
  out: {
    journey: { id: string; title: string; summary: string; destination: string | null; startDate: string | null; endDate: string | null };
    timeline: Array<{ dayNumber: number; date: string | null; title: string; activities: Array<{ id: string; title: string; description: string; startTime?: string; durationMinutes: number; location?: string; estimatedCost?: { amountCents: number; currency: string }; category: string }> }>;
    budgetEstimate: { total: { amountCents: number; currency: string } };
  },
): StudioJourney {
  return {
    id: out.journey.id,
    title: out.journey.title,
    summary: out.journey.summary,
    destination: out.journey.destination,
    startDate: out.journey.startDate,
    endDate: out.journey.endDate,
    currency: out.budgetEstimate.total.currency,
    budgetCents: out.budgetEstimate.total.amountCents,
    days: out.timeline.map((d) => ({
      id: `${out.journey.id}_d${d.dayNumber}`,
      dayNumber: d.dayNumber,
      title: d.title,
      date: d.date,
      activities: d.activities.map((a) => ({
        id: a.id,
        kind: mapKind(a.category),
        title: a.title,
        description: a.description,
        startTime: a.startTime,
        durationMinutes: a.durationMinutes,
        location: a.location,
        costCents: a.estimatedCost?.amountCents,
        currency: a.estimatedCost?.currency,
      })),
    })),
  };
}

function mapKind(cat: string): ActivityKind {
  const c = cat.toLowerCase();
  if (c.includes("flight")) return "flight";
  if (c.includes("hotel") || c.includes("stay") || c.includes("accommod")) return "hotel";
  if (c.includes("restaurant") || c.includes("food") || c.includes("meal")) return "restaurant";
  if (c.includes("transport") || c.includes("transit")) return "transport";
  if (c.includes("note")) return "note";
  return "activity";
}
