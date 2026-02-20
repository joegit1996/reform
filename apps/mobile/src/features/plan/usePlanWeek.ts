import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { weekPlans } from "./sampleData";
import { buildPlanSelection } from "../focus/focusScope";

type WeightUnit = "kg" | "lb";
type DistanceUnit = "km" | "mi";

export type UiSet = {
  setNumber: number;
  repsLabel: string;
  repsCompleted: number | null;
  done: boolean;
  weightValue: number | null;
  weightUnit: WeightUnit;
  lastWeightValue: number | null;
  lastWeightUnit: WeightUnit;
  lastReps: number | null;
};

export type UiCardioLog = {
  done: boolean;
  durationMin: number | null;
  pace: string;
  distance: number | null;
  distanceUnit: DistanceUnit;
  floors: number | null;
  lastDurationMin: number | null;
  lastDistance: number | null;
  lastDistanceUnit: DistanceUnit;
};

export type UiExercise = {
  id: string;
  planExerciseId?: string;
  segmentKey: string;
  name: string;
  description: string;
  done: boolean;
  isCardio: boolean;
  isStairmaster: boolean;
  sets: UiSet[];
  cardioLog: UiCardioLog | null;
};

export type UiDay = {
  id: string;
  label: string;
  protocol: string;
  isRestDay: boolean;
  done: boolean;
  notes?: string;
  planDayId?: string;
  exercises: UiExercise[];
};

type WeekState = {
  loading: boolean;
  days: UiDay[];
  error: string | null;
  usingFallback: boolean;
  retry: () => void;
};

type SetLogRow = {
  plan_exercise_id: string;
  segment_key: string;
  set_number: number;
  reps_completed: number | null;
  weight_value: number | null;
  weight_unit: WeightUnit | null;
  duration_min: number | null;
  pace: string | null;
  distance: number | null;
  distance_unit: DistanceUnit | null;
  floors: number | null;
  completed_at: string | null;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CARDIO_PATTERN = /\b(aerobic|cardio|hike|jog|run|cycling|swimming|stair|treadmill|zone|recovery)\b/i;
const STAIRMASTER_PATTERN = /\b(stairmaster|stairs|floors|incline treadmill)\b/i;

function inferSetPrescription(text: string): { sets: number; repsLabel: string } {
  const normalized = text.replace(/\\\./g, ".");
  const matchA = normalized.match(/(\d+)\s*sets?\s*x\s*(\d+(?:-\d+)?)/i);
  if (matchA) return { sets: Number(matchA[1]), repsLabel: matchA[2] };
  const matchB = normalized.match(/(\d+)\s*x\s*(\d+(?:-\d+)?)/i);
  if (matchB) return { sets: Number(matchB[1]), repsLabel: matchB[2] };
  return { sets: 3, repsLabel: "8-12" };
}

function cleanExerciseName(segment: string): string {
  return segment
    .replace(/[†‡•·]/g, "")
    .replace(/\b(day|day:)\b/gi, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/^core:\s*/i, "")
    .replace(/^[-–—:\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]$/, "");
}

function splitSegments(rawName: string, rawDescription: string, protocol: string, isRestDay: boolean): string[] {
  if (isRestDay) return [rawName || rawDescription || "Rest"];
  const combined = [rawName, rawDescription]
    .filter(Boolean)
    .join(", ")
    .replace(/\\\./g, ".")
    .replace(/\bCore:\s*/gi, "");
  if (CARDIO_PATTERN.test(protocol)) return [combined.trim()];
  return combined
    .replace(/\.\s+/g, ", ")
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapFallbackDays(): UiDay[] {
  return weekPlans.map((day, idx) => ({
    ...day,
    id: `${day.id}-${idx}`,
      done: day.isRestDay || day.exercises.every((exercise) => exercise.done),
      exercises: day.exercises.map((exercise, eidx) => ({
      id: `${exercise.id}-${eidx}`,
      segmentKey: "main",
      name: exercise.name,
      description: exercise.description,
      done: exercise.done,
      isCardio: false,
      isStairmaster: false,
      sets: [
        {
          setNumber: 1,
          repsLabel: "8-12",
          repsCompleted: 8,
          done: exercise.done,
          weightValue: null,
          weightUnit: "kg",
          lastWeightValue: null,
          lastWeightUnit: "kg",
          lastReps: null
        }
      ],
      cardioLog: null
    }))
  }));
}

export function usePlanWeek(weekNumber: number, focusId?: string | null): WeekState {
  const [state, setState] = useState<Omit<WeekState, "retry">>({
    loading: true,
    days: mapFallbackDays(),
    error: null,
    usingFallback: false
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        const planSelection = buildPlanSelection(focusId);
        let planQuery = supabase
          .from("training_plans")
          .select("id")
          .eq("is_active", planSelection.isActive)
          .order("created_at", { ascending: false })
          .limit(1);
        if (planSelection.focusId) planQuery = planQuery.eq("focus_id", planSelection.focusId);
        const { data: plans, error: planError } = await planQuery;
        if (planError) throw planError;
        const plan = (plans as Array<{ id: string }> | null)?.[0];
        if (!plan) throw new Error("No active plan for selected focus.");

        const { data: week, error: weekError } = await supabase
          .from("plan_weeks")
          .select(
            "id,title,plan_days(id,day_number,label,protocol,duration_load,is_rest_day,notes,plan_exercises(id,name,description,sort_order))"
          )
          .eq("plan_id", plan.id)
          .eq("week_number", weekNumber)
          .single();
        if (weekError) throw weekError;

        const today = new Date().toISOString().slice(0, 10);
        const allExerciseIds = (((week?.plan_days as Array<any>) ?? [])
          .flatMap((day) => (day.plan_exercises as Array<any>) ?? [])
          .map((exercise) => `${exercise.id}`));

        let logs: SetLogRow[] = [];
        let previousLogs: SetLogRow[] = [];
        if (user && allExerciseIds.length > 0) {
          const { data: logRows, error: logsError } = await supabase
            .from("user_set_logs")
            .select(
              "plan_exercise_id,segment_key,set_number,reps_completed,weight_value,weight_unit,duration_min,pace,distance,distance_unit,floors,completed_at,target_date"
            )
            .eq("user_id", user.id)
            .eq("target_date", today)
            .in("plan_exercise_id", allExerciseIds);
          if (!logsError) logs = (logRows as SetLogRow[]) ?? [];

          const { data: prevRows, error: prevError } = await supabase
            .from("user_set_logs")
            .select(
              "plan_exercise_id,segment_key,set_number,reps_completed,weight_value,weight_unit,duration_min,pace,distance,distance_unit,floors,completed_at,target_date"
            )
            .eq("user_id", user.id)
            .lt("target_date", today)
            .in("plan_exercise_id", allExerciseIds)
            .order("target_date", { ascending: false })
            .order("completed_at", { ascending: false });
          if (!prevError) previousLogs = (prevRows as SetLogRow[]) ?? [];
        }
        const logByKey = new Map<string, SetLogRow>();
        for (const row of logs) {
          const key = `${row.plan_exercise_id}:${row.segment_key}:${row.set_number}`;
          logByKey.set(key, row);
        }
        const previousByKey = new Map<string, SetLogRow>();
        for (const row of previousLogs) {
          const key = `${row.plan_exercise_id}:${row.segment_key}:${row.set_number}`;
          if (!previousByKey.has(key)) previousByKey.set(key, row);
        }

        const mapped: UiDay[] = ((week?.plan_days as Array<any>) ?? [])
          .sort((a, b) => a.day_number - b.day_number)
          .map((day) => {
            const rawExercises = ((day.plan_exercises as Array<any>) ?? []).sort((a, b) => a.sort_order - b.sort_order);
            const exercises = rawExercises.flatMap((row, rowIndex) => {
              const segments = splitSegments(row.name || "", row.description || "", day.protocol || "", !!day.is_rest_day);
              return segments.map((segment, segIndex) => {
                const segmentKey = segments.length === 1 ? "main" : `seg_${rowIndex}_${segIndex}`;
                const isCardio = CARDIO_PATTERN.test(`${day.protocol || ""} ${segment}`);
                const isStairmaster = STAIRMASTER_PATTERN.test(segment);
                if (isCardio) {
                  const cardioRow = logByKey.get(`${row.id}:${segmentKey}:1`);
                  const previousCardio = previousByKey.get(`${row.id}:${segmentKey}:1`);
                  return {
                    id: `${row.id}:${segmentKey}`,
                    planExerciseId: `${row.id}`,
                    segmentKey,
                    name: cleanExerciseName(segment) || row.name || "Cardio",
                    description: segment,
                    done: !!cardioRow?.completed_at,
                    isCardio: true,
                    isStairmaster,
                    sets: [],
                    cardioLog: {
                      done: !!cardioRow?.completed_at,
                      durationMin: cardioRow?.duration_min ?? null,
                      pace: cardioRow?.pace ?? "",
                      distance: cardioRow?.distance ?? null,
                      distanceUnit: cardioRow?.distance_unit ?? "km",
                      floors: cardioRow?.floors ?? null,
                      lastDurationMin: previousCardio?.duration_min ?? null,
                      lastDistance: previousCardio?.distance ?? null,
                      lastDistanceUnit: previousCardio?.distance_unit ?? "km"
                    }
                  } satisfies UiExercise;
                }

                const prescription = inferSetPrescription(segment);
                const loggedSetCount = Math.max(
                  0,
                  ...logs
                    .filter((r) => r.plan_exercise_id === `${row.id}` && r.segment_key === segmentKey)
                    .map((r) => r.set_number),
                  ...previousLogs
                    .filter((r) => r.plan_exercise_id === `${row.id}` && r.segment_key === segmentKey)
                    .map((r) => r.set_number)
                );
                const totalSets = Math.max(1, prescription.sets, loggedSetCount);
                const sets: UiSet[] = Array.from({ length: totalSets }, (_, idx) => {
                  const setNumber = idx + 1;
                  const log = logByKey.get(`${row.id}:${segmentKey}:${setNumber}`);
                  const previous = previousByKey.get(`${row.id}:${segmentKey}:${setNumber}`);
                  return {
                    setNumber,
                    repsLabel: prescription.repsLabel,
                    repsCompleted:
                      log?.reps_completed != null
                        ? log.reps_completed
                        : Number((prescription.repsLabel.split("-")[0] || "0").trim()) || null,
                    done: !!log?.completed_at,
                    weightValue: log?.weight_value ?? null,
                    weightUnit: log?.weight_unit ?? "kg",
                    lastWeightValue: previous?.weight_value ?? null,
                    lastWeightUnit: previous?.weight_unit ?? "kg",
                    lastReps: previous?.reps_completed ?? null
                  };
                });
                const done = sets.length > 0 && sets.every((set) => set.done);
                return {
                  id: `${row.id}:${segmentKey}`,
                  planExerciseId: `${row.id}`,
                  segmentKey,
                  name: cleanExerciseName(segment) || row.name || "Exercise",
                  description: segment,
                  done,
                  isCardio: false,
                  isStairmaster: false,
                  sets,
                  cardioLog: null
                } satisfies UiExercise;
              });
            });

            const done = !!day.is_rest_day || (exercises.length > 0 && exercises.every((exercise) => exercise.done));
            return {
              id: `${weekNumber}-${day.day_number}`,
              label: day.label || DAY_NAMES[day.day_number - 1],
              protocol: day.protocol || "",
              isRestDay: !!day.is_rest_day,
              done,
              notes: day.notes || "",
              planDayId: day.id,
              exercises
            } satisfies UiDay;
          });

        if (active) {
          const usingFallback = mapped.length === 0;
          setState({
            loading: false,
            days: usingFallback ? mapFallbackDays() : mapped,
            error: usingFallback ? "No week data found in Supabase yet." : null,
            usingFallback
          });
        }
      } catch (err) {
        if (active) {
          setState({
            loading: false,
            days: mapFallbackDays(),
            error: (err as Error).message || "Failed to load plan from Supabase.",
            usingFallback: true
          });
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [weekNumber, reloadKey, focusId]);

  return {
    ...state,
    retry: () => setReloadKey((v) => v + 1)
  };
}
