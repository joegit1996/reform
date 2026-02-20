import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/theme";
import { useCurrentFocus } from "../focus/useCurrentFocus";
import { ChecklistItem } from "./components/ChecklistItem";
import { ProgressCard } from "./components/ProgressCard";
import { MacroCard } from "./components/MacroCard";
import { CircularProgressCard } from "./components/CircularProgressCard";
import { RestDayCard } from "./components/RestDayCard";
import { UiCardioLog, UiDay, UiExercise, UiSet, usePlanWeek } from "./usePlanWeek";
import { fetchDailyMacroTotals, fetchMacroTargets, fetchRecentMeals, getCurrentUserId, type MealRow } from "../nutrition-log/api";

type WeightUnitPreference = "lb" | "kg";
type DistanceUnitPreference = "km" | "mi";

function dateMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function summarizeExercisePills(exercise: UiExercise): string[] {
  if (exercise.isCardio) {
    if (exercise.isStairmaster) return ["Cardio", "Time", "Pace", "Distance", "Floors"];
    return ["Cardio", "Time", "Pace", "Distance"];
  }
  return exercise.sets.map((set) => `Set ${set.setNumber}: ${set.repsLabel}`);
}

function displayLastSet(set: UiSet): string {
  if (set.lastWeightValue == null) return "--";
  const reps = set.lastReps ?? set.repsLabel;
  return `${reps} X ${set.lastWeightValue}${set.lastWeightUnit}`;
}

function updateDayCompletion(day: UiDay): UiDay {
  const done = day.isRestDay || (day.exercises.length > 0 && day.exercises.every((exercise) => exercise.done));
  return { ...day, done };
}

export function PlanHomeScreen() {
  const insets = useSafeAreaInsets();
  const { currentFocus, currentFocusId } = useCurrentFocus();
  const [weekNumber, setWeekNumber] = useState(1);
  const { days: fetchedDays, loading, error, usingFallback, retry } = usePlanWeek(weekNumber, currentFocusId);
  const [days, setDays] = useState<UiDay[]>(fetchedDays);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [saving, setSaving] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [targetDays, setTargetDays] = useState<Array<{ id: string; week: number; phase: string; label: string }>>([]);
  const [selectedTargetDayIds, setSelectedTargetDayIds] = useState<Record<string, boolean>>({});
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseDescription, setNewExerciseDescription] = useState("");
  const [inlineWeightInputs, setInlineWeightInputs] = useState<Record<string, string>>({});
  const [inlineRepsInputs, setInlineRepsInputs] = useState<Record<string, string>>({});
  const [inlineCardioInputs, setInlineCardioInputs] = useState<
    Record<string, { durationMin: string; secondary: string; pace: string; floors: string }>
  >({});
  const [weightUnitPreference, setWeightUnitPreference] = useState<WeightUnitPreference>("lb");
  const [distanceUnitPreference, setDistanceUnitPreference] = useState<DistanceUnitPreference>("km");
  const [isDayEditMode, setIsDayEditMode] = useState(false);
  const [macroTotals, setMacroTotals] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [macroTargets, setMacroTargets] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [mealHistory, setMealHistory] = useState<MealRow[]>([]);
  const [mealHistoryOpen, setMealHistoryOpen] = useState(false);

  const dayIndex = (new Date().getDay() + 6) % 7;
  const today = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][dayIndex];

  useEffect(() => {
    setDays(fetchedDays);
    const nextInlineWeights: Record<string, string> = {};
    const nextInlineReps: Record<string, string> = {};
    const nextInlineCardio: Record<string, { durationMin: string; secondary: string; pace: string; floors: string }> = {};
    for (const day of fetchedDays) {
      for (const exercise of day.exercises) {
        if (exercise.isCardio) {
          nextInlineCardio[exercise.id] = {
            durationMin: exercise.cardioLog?.durationMin != null ? String(exercise.cardioLog.durationMin) : "",
            secondary: exercise.isStairmaster
              ? (exercise.cardioLog?.floors != null ? String(exercise.cardioLog.floors) : "")
              : (exercise.cardioLog?.distance != null ? String(exercise.cardioLog.distance) : ""),
            pace: exercise.cardioLog?.pace ?? "",
            floors: exercise.cardioLog?.floors != null ? String(exercise.cardioLog.floors) : ""
          };
          continue;
        }
        for (const set of exercise.sets) {
          nextInlineWeights[`${exercise.id}:${set.setNumber}`] =
            set.weightValue != null ? String(set.weightValue) : "";
          nextInlineReps[`${exercise.id}:${set.setNumber}`] =
            set.repsCompleted != null ? String(set.repsCompleted) : "";
        }
      }
    }
    setInlineWeightInputs(nextInlineWeights);
    setInlineRepsInputs(nextInlineReps);
    setInlineCardioInputs(nextInlineCardio);
    setSelectedDayId((current) => {
      if (current && fetchedDays.some((day) => day.id === current)) return current;
      const nextDay = fetchedDays.find((day) => !day.done) ?? fetchedDays[0];
      return nextDay?.id ?? null;
    });
  }, [fetchedDays, today]);

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_weight_unit,preferred_distance_unit")
        .eq("id", user.id)
        .maybeSingle();
      if (!active || !data) return;
      const nextWeight = data.preferred_weight_unit as WeightUnitPreference | null;
      const nextDistance = data.preferred_distance_unit as DistanceUnitPreference | null;
      if (nextWeight === "lb" || nextWeight === "kg") setWeightUnitPreference(nextWeight);
      if (nextDistance === "km" || nextDistance === "mi") setDistanceUnitPreference(nextDistance);
    }
    void loadPreferences();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadStreak() {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) return;
        const fromDate = dateMinusDays(60);
        const { data, error: streakError } = await supabase
          .from("user_day_progress")
          .select("target_date,completed_at")
          .eq("user_id", user.id)
          .gte("target_date", fromDate)
          .not("completed_at", "is", null);
        if (streakError) throw streakError;
        const completedDays = new Set((data ?? []).map((row) => row.target_date));
        let count = 0;
        while (completedDays.has(dateMinusDays(count))) count += 1;
        if (active) setStreak(count);
      } catch {
        if (active) setStreak(0);
      }
    }
    void loadStreak();
    return () => {
      active = false;
    };
  }, [days]);

  useEffect(() => {
    let active = true;
    async function loadMacros() {
      try {
        const uid = await getCurrentUserId();
        if (!uid) return;
        const date = new Date().toISOString().slice(0, 10);
        const [totals, targets, history] = await Promise.all([
          fetchDailyMacroTotals(uid, date),
          fetchMacroTargets(uid),
          fetchRecentMeals(uid, 21)
        ]);
        if (!active) return;
        setMacroTotals(totals);
        setMacroTargets(targets);
        setMealHistory(history);
      } catch {
        if (!active) return;
        setMacroTotals({ calories: 0, protein: 0, carbs: 0, fats: 0 });
      }
    }
    void loadMacros();
    return () => {
      active = false;
    };
  }, [days]);

  const completedDays = useMemo(() => days.filter((day) => day.done).length, [days]);
  const activeDay = days.find((day) => day.id === selectedDayId) ?? days[0];
  const activeDayIndex = Math.max(0, days.findIndex((day) => day.id === activeDay?.id));

  async function loadTargetDays() {
    if (!currentFocusId) {
      setTargetDays([]);
      return;
    }
    const { data: plan } = await supabase
      .from("training_plans")
      .select("id")
      .eq("focus_id", currentFocusId)
      .eq("is_active", true)
      .single();
    if (!plan) return;
    const { data: weeks } = await supabase
      .from("plan_weeks")
      .select("week_number,phase,plan_days(id,label,day_number)")
      .eq("plan_id", plan.id)
      .order("week_number", { ascending: true });
    const rows: Array<{ id: string; week: number; phase: string; label: string }> = [];
    for (const week of (weeks as Array<any>) ?? []) {
      for (const day of (week.plan_days as Array<any>) ?? []) {
        rows.push({
          id: day.id,
          week: week.week_number,
          phase: week.phase ?? "",
          label: day.label ?? `Day ${day.day_number}`
        });
      }
    }
    setTargetDays(rows);
  }

  async function persistDayCompletion(day: UiDay) {
    if (!day.planDayId) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_day_progress").upsert(
      {
        user_id: user.id,
        plan_day_id: day.planDayId,
        target_date: new Date().toISOString().slice(0, 10),
        completed_at: day.done ? new Date().toISOString() : null
      },
      { onConflict: "user_id,plan_day_id,target_date" }
    );
  }

  async function persistSetLog(
    exercise: UiExercise,
    setNumber: number,
    payload: Partial<UiSet & UiCardioLog> & { completedAt?: string | null; repsCompleted?: number | null }
  ) {
    if (!exercise.planExerciseId) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_set_logs").upsert(
      {
        user_id: user.id,
        plan_exercise_id: exercise.planExerciseId,
        segment_key: exercise.segmentKey,
        target_date: new Date().toISOString().slice(0, 10),
        set_number: setNumber,
        reps_completed: exercise.isCardio ? null : payload.repsCompleted ?? null,
        weight_value: payload.weightValue ?? null,
        weight_unit: payload.weightUnit ?? null,
        duration_min: payload.durationMin ?? null,
        pace: payload.pace ?? null,
        distance: payload.distance ?? null,
        distance_unit: payload.distanceUnit ?? null,
        floors: payload.floors ?? null,
        completed_at: payload.completedAt ?? null
      },
      { onConflict: "user_id,plan_exercise_id,segment_key,target_date,set_number" }
    );
  }

  function updateExerciseInDay(dayId: string, exerciseId: string, updater: (exercise: UiExercise) => UiExercise) {
    setDays((prev) =>
      prev.map((day) => {
        if (day.id !== dayId) return day;
        const exercises = day.exercises.map((exercise) => (exercise.id === exerciseId ? updater(exercise) : exercise));
        return updateDayCompletion({ ...day, exercises });
      })
    );
  }

  async function addSetToExercise(exercise: UiExercise) {
    if (exercise.isCardio) return;
    const nextSetNumber = (exercise.sets[exercise.sets.length - 1]?.setNumber ?? 0) + 1;
    const baseReps = exercise.sets[0]?.repsCompleted ?? 8;
    const baseLabel = exercise.sets[0]?.repsLabel ?? "8-12";
    const defaultWeight = exercise.sets[exercise.sets.length - 1]?.weightValue ?? null;
    const defaultUnit = exercise.sets[exercise.sets.length - 1]?.weightUnit ?? weightUnitPreference;

    updateExerciseInDay(activeDay.id, exercise.id, (current) => ({
      ...current,
      sets: [
        ...current.sets,
        {
          setNumber: nextSetNumber,
          repsLabel: baseLabel,
          repsCompleted: baseReps,
          done: false,
          weightValue: defaultWeight,
          weightUnit: defaultUnit,
          lastWeightValue: current.sets[current.sets.length - 1]?.lastWeightValue ?? null,
          lastWeightUnit: current.sets[current.sets.length - 1]?.lastWeightUnit ?? "lb",
          lastReps: current.sets[current.sets.length - 1]?.lastReps ?? null
        }
      ],
      done: false
    }));

    setInlineWeightInputs((prev) => ({
      ...prev,
      [`${exercise.id}:${nextSetNumber}`]: defaultWeight != null ? String(defaultWeight) : ""
    }));
    setInlineRepsInputs((prev) => ({
      ...prev,
      [`${exercise.id}:${nextSetNumber}`]: String(baseReps)
    }));

    try {
      await persistSetLog(exercise, nextSetNumber, {
        repsCompleted: baseReps,
        weightValue: defaultWeight,
        weightUnit: defaultUnit,
        completedAt: null
      });
    } catch {
      // local optimistic add is kept; save action on the set will persist again.
    }
  }

  async function deleteSetFromExercise(exercise: UiExercise, setNumber: number) {
    if (exercise.isCardio || exercise.sets.length <= 1) return;
    const remaining = exercise.sets.filter((set) => set.setNumber !== setNumber);
    const renumberMap = new Map<number, number>();
    const normalized = remaining.map((set, idx) => {
      const nextSetNumber = idx + 1;
      renumberMap.set(set.setNumber, nextSetNumber);
      return { ...set, setNumber: nextSetNumber };
    });

    updateExerciseInDay(activeDay.id, exercise.id, (current) => ({
      ...current,
      sets: normalized,
      done: normalized.every((set) => set.done)
    }));

    setInlineWeightInputs((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${exercise.id}:`)) delete next[key];
      }
      for (const set of remaining) {
        const nextNumber = renumberMap.get(set.setNumber);
        if (!nextNumber) continue;
        next[`${exercise.id}:${nextNumber}`] =
          prev[`${exercise.id}:${set.setNumber}`] ?? (set.weightValue != null ? String(set.weightValue) : "");
      }
      return next;
    });
    setInlineRepsInputs((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${exercise.id}:`)) delete next[key];
      }
      for (const set of remaining) {
        const nextNumber = renumberMap.get(set.setNumber);
        if (!nextNumber) continue;
        next[`${exercise.id}:${nextNumber}`] =
          prev[`${exercise.id}:${set.setNumber}`] ?? (set.repsCompleted != null ? String(set.repsCompleted) : "");
      }
      return next;
    });

    try {
      if (!exercise.planExerciseId) return;
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const targetDate = new Date().toISOString().slice(0, 10);

      await supabase
        .from("user_set_logs")
        .delete()
        .eq("user_id", user.id)
        .eq("plan_exercise_id", exercise.planExerciseId)
        .eq("target_date", targetDate);

      const inserts = normalized.map((set) => ({
        user_id: user.id,
        plan_exercise_id: exercise.planExerciseId,
        segment_key: exercise.segmentKey,
        target_date: targetDate,
        set_number: set.setNumber,
        reps_completed: set.repsCompleted ?? null,
        weight_value: set.weightValue ?? null,
        weight_unit: set.weightUnit ?? null,
        completed_at: set.done ? new Date().toISOString() : null
      }));
      if (inserts.length > 0) await supabase.from("user_set_logs").insert(inserts);
    } catch {
      // keep local state and allow retry through normal save actions
    }
  }

  async function moveExercise(exercise: UiExercise, direction: "up" | "down") {
    if (!exercise.planExerciseId || !activeDay.planDayId) return;
    const { data: rows } = await supabase
      .from("plan_exercises")
      .select("id,sort_order")
      .eq("day_id", activeDay.planDayId)
      .order("sort_order", { ascending: true });
    const list = (rows as Array<{ id: string; sort_order: number }>) ?? [];
    const idx = list.findIndex((r) => r.id === exercise.planExerciseId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const current = list[idx];
    const target = list[swapIdx];
    await supabase.from("plan_exercises").update({ sort_order: target.sort_order }).eq("id", current.id);
    await supabase.from("plan_exercises").update({ sort_order: current.sort_order }).eq("id", target.id);
    retry();
  }

  async function removeExercise(exercise: UiExercise) {
    if (!exercise.planExerciseId) return;
    await supabase.from("plan_exercises").delete().eq("id", exercise.planExerciseId);
    retry();
  }

  async function addExerciseToSelectedDays() {
    const name = newExerciseName.trim();
    if (!name) {
      Alert.alert("Missing name", "Enter exercise name.");
      return;
    }
    const dayIds = Object.keys(selectedTargetDayIds).filter((id) => selectedTargetDayIds[id]);
    if (dayIds.length === 0) {
      Alert.alert("No days selected", "Select at least one day.");
      return;
    }
    const { data: existing } = await supabase
      .from("plan_exercises")
      .select("day_id,sort_order")
      .in("day_id", dayIds);
    const byDayMax = new Map<string, number>();
    for (const row of (existing as Array<any>) ?? []) {
      const prev = byDayMax.get(row.day_id) ?? -1;
      byDayMax.set(row.day_id, Math.max(prev, row.sort_order ?? 0));
    }
    const inserts = dayIds.map((dayId) => ({
      day_id: dayId,
      name,
      description: newExerciseDescription.trim(),
      sort_order: (byDayMax.get(dayId) ?? -1) + 1
    }));
    await supabase.from("plan_exercises").insert(inserts);
    setManageOpen(false);
    setNewExerciseName("");
    setNewExerciseDescription("");
    setSelectedTargetDayIds({});
    retry();
  }

  async function saveStrengthSet(
    exercise: UiExercise,
    setNumber: number,
    rawWeightOverride?: string,
    rawRepsOverride?: string
  ) {
    const existingSet = exercise.sets.find((s) => s.setNumber === setNumber);
    const nextDone = !existingSet?.done;
    const rawWeight = rawWeightOverride ?? inlineWeightInputs[`${exercise.id}:${setNumber}`] ?? "";
    const rawReps = rawRepsOverride ?? inlineRepsInputs[`${exercise.id}:${setNumber}`] ?? "";
    const weight = rawWeight.trim() ? Number(rawWeight) : null;
    const repsCompleted = rawReps.trim() ? Number(rawReps) : null;
    if (rawWeight.trim() && Number.isNaN(weight)) {
      Alert.alert("Invalid weight", "Please enter a valid number.");
      return;
    }
    if (rawReps.trim() && Number.isNaN(repsCompleted)) {
      Alert.alert("Invalid reps", "Please enter a valid number.");
      return;
    }
    if (nextDone && (weight == null || repsCompleted == null)) {
      Alert.alert("Missing values", "Log both reps and weight to complete this set.");
      return;
    }
    const unit: UiSet["weightUnit"] = weightUnitPreference;
    setSaving(true);
    try {
      await persistSetLog(exercise, setNumber, {
        weightValue: weight,
        weightUnit: unit,
        repsCompleted,
        completedAt: nextDone ? new Date().toISOString() : null
      });
      updateExerciseInDay(activeDay.id, exercise.id, (current) => {
        const sets = current.sets.map((set) =>
          set.setNumber === setNumber
            ? { ...set, done: nextDone, weightValue: weight, weightUnit: unit, repsCompleted }
            : set
        );
        return { ...current, sets, done: sets.every((set) => set.done) };
      });
      setInlineWeightInputs((prev) => ({
        ...prev,
        [`${exercise.id}:${setNumber}`]: rawWeight
      }));
      setInlineRepsInputs((prev) => ({
        ...prev,
        [`${exercise.id}:${setNumber}`]: rawReps
      }));
    } catch (err) {
      Alert.alert("Unable to save set", (err as Error).message || "Please run latest Supabase migrations.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCardioLog(
    exercise: UiExercise,
    override?: { durationMin: string; secondary: string; pace?: string; floors?: string }
  ) {
    const src = override
      ? {
        durationMin: override.durationMin,
        secondary: override.secondary,
        pace: override.pace ?? "",
        floors: override.floors ?? ""
      }
      : {
        durationMin: inlineCardioInputs[exercise.id]?.durationMin ?? "",
        secondary: inlineCardioInputs[exercise.id]?.secondary ?? "",
        pace: inlineCardioInputs[exercise.id]?.pace ?? "",
        floors: inlineCardioInputs[exercise.id]?.floors ?? ""
      };
    const durationMin = src.durationMin.trim() ? Number(src.durationMin) : null;
    const secondaryValue = src.secondary.trim() ? Number(src.secondary) : null;
    const pace = src.pace.trim();
    setSaving(true);
    try {
      const nextDone = !(exercise.cardioLog?.done ?? false);
      const floors = exercise.isStairmaster ? secondaryValue : (src.floors.trim() ? Number(src.floors) : null);
      const distance = exercise.isStairmaster ? null : secondaryValue;

      if (nextDone) {
        if (durationMin == null || Number.isNaN(durationMin)) {
          Alert.alert("Missing time", "Log time to complete this cardio set.");
          return;
        }
        if (!pace) {
          Alert.alert("Missing pace", "Log pace to complete this cardio set.");
          return;
        }
        if (exercise.isStairmaster) {
          if (floors == null || Number.isNaN(floors)) {
            Alert.alert("Missing floors", "Log floors to complete this stairmaster set.");
            return;
          }
        } else if (distance == null || Number.isNaN(distance)) {
          Alert.alert("Missing distance", "Log distance to complete this cardio set.");
          return;
        }
      }
      await persistSetLog(exercise, 1, {
        durationMin,
        pace,
        distance,
        distanceUnit: distanceUnitPreference,
        floors: exercise.isStairmaster ? floors : null,
        completedAt: nextDone ? new Date().toISOString() : null
      });
      updateExerciseInDay(activeDay.id, exercise.id, (current) => ({
        ...current,
        done: nextDone,
        cardioLog: {
          done: nextDone,
          durationMin,
          pace,
          distance,
          distanceUnit: distanceUnitPreference,
          floors: exercise.isStairmaster ? floors : null,
          lastDurationMin: current.cardioLog?.lastDurationMin ?? null,
          lastDistance: current.cardioLog?.lastDistance ?? null,
          lastDistanceUnit: current.cardioLog?.lastDistanceUnit ?? "km"
        }
      }));
      setInlineCardioInputs((prev) => ({
        ...prev,
        [exercise.id]: {
          durationMin: src.durationMin,
          secondary: src.secondary,
          pace,
          floors: exercise.isStairmaster ? src.secondary : src.floors
        }
      }));
    } catch (err) {
      Alert.alert("Unable to save cardio log", (err as Error).message || "Please run latest Supabase migrations.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!activeDay) return;
    void persistDayCompletion(activeDay);
  }, [activeDay]);

  if (!activeDay) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.colors.textPrimary }}>No plan data available.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + theme.spacing.sm, paddingBottom: Math.max(120, insets.bottom + 96) }
        ]}
      >
        <Text style={styles.kicker}>{currentFocus?.name ?? "Focus"} Focus</Text>
        <View style={styles.weekNav}>
          <Pressable
            onPress={() => setWeekNumber((w) => Math.max(1, w - 1))}
            style={[styles.navButton, weekNumber === 1 && styles.navButtonDisabled]}
          >
            <Text style={styles.navButtonText}>Prev</Text>
          </Pressable>
          <Text style={styles.title}>Week {weekNumber}</Text>
          <Pressable
            onPress={() => setWeekNumber((w) => Math.min(16, w + 1))}
            style={[styles.navButton, weekNumber === 16 && styles.navButtonDisabled]}
          >
            <Text style={styles.navButtonText}>Next</Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void loadTargetDays();
            setManageOpen(true);
          }}
        >
          <Text style={styles.secondaryButtonText}>Add Exercise To Days</Text>
        </Pressable>

        {loading ? <ActivityIndicator /> : null}
        {!loading && error ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Live plan unavailable</Text>
            <Text style={styles.noticeText}>
              {usingFallback ? "Showing fallback data. " : ""}
              {error}
            </Text>
            <Pressable style={styles.noticeButton} onPress={retry}>
              <Text style={styles.noticeButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          snapToInterval={316}
          decelerationRate="fast"
        >
          <View style={styles.carouselItem}>
            <CircularProgressCard
              title="This Week"
              value={`${completedDays}/${Math.max(1, days.length)}`}
              percent={(completedDays / Math.max(1, days.length)) * 100}
            />
          </View>
          <View style={styles.carouselItem}>
            <ProgressCard title="Streak" value={`${streak} days`} percent={Math.min(100, streak * 10)} />
          </View>
          <View style={styles.carouselItem}>
            <Pressable onPress={() => setMealHistoryOpen(true)}>
              <MacroCard
                protein={macroTotals.protein}
                proteinTarget={macroTargets.protein}
                carbs={macroTotals.carbs}
                carbsTarget={macroTargets.carbs}
                fats={macroTotals.fats}
                fatsTarget={macroTargets.fats}
              />
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {activeDay.label === today ? "Today" : "Selected"}: {activeDay.label}
          </Text>
          <View style={styles.sectionHeaderActions}>
            <Text style={[styles.dayState, activeDay.done && styles.dayStateDone]}>
              {activeDay.done ? "Done" : "In Progress"}
            </Text>
            <Pressable
              style={[styles.editToggle, isDayEditMode && styles.editToggleActive]}
              onPress={() => setIsDayEditMode((value) => !value)}
            >
              <Text style={styles.editToggleText}>{isDayEditMode ? "Done" : "Edit"}</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayNavScroll}
        >
          {days.map((day, index) => {
            const isActive = day.id === activeDay.id;
            return (
              <Pressable
                key={day.id}
                onPress={() => setSelectedDayId(day.id)}
                style={[styles.dayPill, isActive && styles.dayPillActive]}
              >
                <Text style={[styles.dayPillText, isActive && styles.dayPillTextActive]}>
                  Day {index + 1}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.protocol}>{activeDay.protocol}</Text>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            if (!activeDay.done) {
              Alert.alert("Not ready yet", "Complete all sets (or cardio logs) before marking this day done.");
              return;
            }
            Alert.alert("Day complete", "All required work for this day is complete.");
          }}
        >
          <Text style={styles.secondaryButtonText}>Mark Day Done</Text>
        </Pressable>

        <View style={styles.list}>
          {activeDay.isRestDay ? (
            <RestDayCard />
          ) : (
            activeDay.exercises.map((exercise, index) => (
              <ChecklistItem
                key={exercise.id}
                index={index + 1}
                name={exercise.name}
                description={exercise.description}
                pills={summarizeExercisePills(exercise)}
                done={exercise.done}
                previewRows={
                  exercise.isCardio
                    ? [
                      {
                        set: 1,
                        reps: "00",
                        weight: "00",
                        last:
                          exercise.cardioLog?.lastDurationMin != null
                            ? `${exercise.cardioLog.lastDurationMin}m / ${exercise.cardioLog.lastDistance ?? 0}${exercise.cardioLog.lastDistanceUnit ?? "km"}`
                            : "--",
                        done: !!exercise.cardioLog?.done
                      }
                    ]
                    : exercise.sets.map((set) => ({
                      set: set.setNumber,
                      reps: String(set.repsCompleted ?? set.repsLabel.split("-")[0] ?? "8"),
                      weight: set.weightValue != null ? String(set.weightValue) : "00",
                      last: displayLastSet(set),
                      done: set.done
                    }))
                }
                isCardio={exercise.isCardio}
                isStairmaster={exercise.isStairmaster}
                weightUnitLabel={weightUnitPreference}
                distanceUnitLabel={distanceUnitPreference}
                weightInputs={Object.fromEntries(
                  exercise.sets.map((set) => [set.setNumber, inlineWeightInputs[`${exercise.id}:${set.setNumber}`] ?? ""])
                )}
                repsInputs={Object.fromEntries(
                  exercise.sets.map((set) => [set.setNumber, inlineRepsInputs[`${exercise.id}:${set.setNumber}`] ?? ""])
                )}
                onWeightChange={(setNumber, value) =>
                  setInlineWeightInputs((prev) => ({ ...prev, [`${exercise.id}:${setNumber}`]: value }))
                }
                onRepsChange={(setNumber, value) =>
                  setInlineRepsInputs((prev) => ({ ...prev, [`${exercise.id}:${setNumber}`]: value }))
                }
                onSaveSet={(setNumber) =>
                  void saveStrengthSet(
                    exercise,
                    setNumber,
                    inlineWeightInputs[`${exercise.id}:${setNumber}`] ?? "",
                    inlineRepsInputs[`${exercise.id}:${setNumber}`] ?? ""
                  )
                }
                cardioDuration={inlineCardioInputs[exercise.id]?.durationMin ?? ""}
                cardioSecondary={inlineCardioInputs[exercise.id]?.secondary ?? ""}
                cardioPace={inlineCardioInputs[exercise.id]?.pace ?? ""}
                onCardioDurationChange={(value) =>
                  setInlineCardioInputs((prev) => ({
                    ...prev,
                    [exercise.id]: {
                      durationMin: value,
                      secondary: prev[exercise.id]?.secondary ?? "",
                      pace: prev[exercise.id]?.pace ?? "",
                      floors: prev[exercise.id]?.floors ?? ""
                    }
                  }))
                }
                onCardioSecondaryChange={(value) =>
                  setInlineCardioInputs((prev) => ({
                    ...prev,
                    [exercise.id]: {
                      durationMin: prev[exercise.id]?.durationMin ?? "",
                      secondary: value,
                      pace: prev[exercise.id]?.pace ?? "",
                      floors: prev[exercise.id]?.floors ?? ""
                    }
                  }))
                }
                onCardioPaceChange={(value) =>
                  setInlineCardioInputs((prev) => ({
                    ...prev,
                    [exercise.id]: {
                      durationMin: prev[exercise.id]?.durationMin ?? "",
                      secondary: prev[exercise.id]?.secondary ?? "",
                      pace: value,
                      floors: prev[exercise.id]?.floors ?? ""
                    }
                  }))
                }
                onSaveCardio={() =>
                  void saveCardioLog(exercise, {
                    durationMin: inlineCardioInputs[exercise.id]?.durationMin ?? "",
                    secondary: inlineCardioInputs[exercise.id]?.secondary ?? "",
                    pace: inlineCardioInputs[exercise.id]?.pace ?? "",
                    floors: inlineCardioInputs[exercise.id]?.floors ?? ""
                  })
                }
                isEditMode={isDayEditMode}
                showReorderControls={isDayEditMode}
                onAddSet={() => void addSetToExercise(exercise)}
                onMoveUp={() => void moveExercise(exercise, "up")}
                onMoveDown={() => void moveExercise(exercise, "down")}
                onDeleteSet={(setNumber) => void deleteSetFromExercise(exercise, setNumber)}
                onRemoveExercise={() => void removeExercise(exercise)}
                onPress={() => { }}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={mealHistoryOpen} animationType="slide" onRequestClose={() => setMealHistoryOpen(false)}>
        <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.md }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Meal History</Text>
            <Pressable style={styles.inlineClose} onPress={() => setMealHistoryOpen(false)}>
              <Text style={styles.inlineCloseText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + 16, gap: 10 }}>
            {mealHistory.map((meal) => (
              <View key={meal.id} style={styles.mealCard}>
                <Text style={styles.mealDateText}>{new Date(meal.meal_time).toLocaleString()}</Text>
                <Text style={styles.mealMacroText}>
                  {`${Math.round(meal.total_calories)} kcal • P ${Math.round(meal.total_protein_g)} • C ${Math.round(meal.total_carbs_g)} • F ${Math.round(meal.total_fats_g)}`}
                </Text>
                {(meal.items ?? []).map((item) => (
                  <Text key={item.id} style={styles.mealItemText}>
                    {`• ${item.name} (${Math.round(item.calories)} kcal, P ${Math.round(item.protein_g)} / C ${Math.round(item.carbs_g)} / F ${Math.round(item.fats_g)}${item.estimated_weight_g ? `, ${Math.round(item.estimated_weight_g)}g` : ""
                      }${item.quantity_text ? `, ${item.quantity_text}` : ""}${item.confidence != null ? `, conf ${Math.round(item.confidence * 100)}%` : ""})`}
                  </Text>
                ))}
              </View>
            ))}
            {mealHistory.length === 0 ? <Text style={styles.mealItemText}>No meals logged yet.</Text> : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={manageOpen} animationType="slide" onRequestClose={() => setManageOpen(false)}>
        <View style={styles.manageScreen}>
          <Text style={styles.manageTitle}>Add Exercise Across Days</Text>
          <TextInput
            style={styles.input}
            placeholder="Exercise name"
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            placeholderTextColor={theme.colors.textMuted}
          />
          <TextInput
            style={styles.input}
            placeholder="Description (optional)"
            value={newExerciseDescription}
            onChangeText={setNewExerciseDescription}
            placeholderTextColor={theme.colors.textMuted}
          />
          <ScrollView style={{ flex: 1 }}>
            {targetDays.map((day) => (
              <Pressable
                key={day.id}
                style={[styles.targetRow, selectedTargetDayIds[day.id] && styles.targetRowSelected]}
                onPress={() =>
                  setSelectedTargetDayIds((prev) => ({ ...prev, [day.id]: !prev[day.id] }))
                }
              >
                <Text style={styles.targetText}>
                  Week {day.week} ({day.phase}) - {day.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.manageActions}>
            <Pressable style={styles.navButton} onPress={() => setManageOpen(false)}>
              <Text style={styles.navButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.noticeButton} onPress={() => void addExerciseToSelectedDays()}>
              <Text style={styles.noticeButtonText}>Add</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.pill,
    padding: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  navButton: {
    backgroundColor: theme.colors.surfaceHighlighted,
    borderRadius: theme.radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  navButtonDisabled: {
    opacity: 0.4
  },
  navButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: theme.typography.caption
  },
  kicker: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: theme.spacing.xs
  },
  buildMarker: {
    color: "#7FB6FF",
    fontSize: 12,
    fontWeight: "700"
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "800"
  },
  carousel: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xxl
  },
  carouselItem: {
    width: 300
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm
  },
  sectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "800",
    flex: 1
  },
  dayState: {
    color: theme.colors.textMuted,
    fontWeight: "800",
    fontSize: theme.typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  dayStateDone: {
    color: theme.colors.success
  },
  editToggle: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  editToggleActive: {
    backgroundColor: theme.colors.accentLight,
    borderColor: theme.colors.accent
  },
  editToggleText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: theme.typography.caption
  },
  dayNavScroll: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.sm
  },
  dayPill: {
    backgroundColor: theme.colors.surfaceElevated,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  dayPillActive: {
    backgroundColor: theme.colors.accentLight,
    borderColor: theme.colors.accent
  },
  dayPillText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: theme.typography.caption
  },
  dayPillTextActive: {
    color: theme.colors.textPrimary
  },
  protocol: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24,
    paddingHorizontal: theme.spacing.xs
  },
  list: {
    gap: theme.spacing.md
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.body
  },
  noticeCard: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
    padding: theme.spacing.lg,
    gap: theme.spacing.sm
  },
  noticeTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.subtitle
  },
  noticeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22
  },
  noticeButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: theme.spacing.sm
  },
  noticeButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  restCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    minHeight: 200,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10
  },
  restTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title1,
    fontWeight: "900",
    letterSpacing: -0.5
  },
  restCopy: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    marginTop: theme.spacing.sm,
    textAlign: "center",
    lineHeight: 24
  },
  manageScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingTop: 60
  },
  manageTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "900",
    marginBottom: theme.spacing.sm
  },
  targetRow: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: theme.spacing.sm
  },
  targetRowSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentLight
  },
  targetText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: theme.typography.body
  },
  manageActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    paddingBottom: 40
  },
  modalScreen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: theme.colors.borderSubtle,
    borderBottomWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 16,
    backgroundColor: "rgba(9, 10, 15, 0.9)"
  },
  inlineClose: {
    backgroundColor: theme.colors.surfaceHighlighted,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  inlineCloseText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.caption
  },
  mealCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 8
  },
  mealDateText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.subtitle
  },
  mealMacroText: {
    color: theme.colors.accent,
    fontWeight: "700",
    fontSize: theme.typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  mealItemText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22
  },
  closeButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  closeText: {
    color: theme.colors.textSecondary,
    fontWeight: "800"
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "900",
    fontSize: theme.typography.title2,
    flex: 1,
    paddingRight: theme.spacing.sm
  },
  modalContent: {
    padding: theme.spacing.lg,
    gap: 16,
    backgroundColor: theme.colors.background
  },
  modalDescription: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24
  },
  modalSection: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "900",
    marginTop: theme.spacing.md
  },
  editor: {
    gap: 12,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.borderSubtle,
    borderWidth: 1,
    padding: 16
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    color: theme.colors.textPrimary,
    borderColor: theme.colors.borderSubtle,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: theme.typography.body,
    fontWeight: "600"
  }
});
