import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type FocusLite = {
  id: string;
  name: string;
  is_active: boolean;
};

type TrainingPlan = {
  id: string;
  focus_id: string;
  name: string;
  duration_weeks: number;
  is_active: boolean;
  status?: "draft" | "published";
  published_at?: string | null;
  created_at: string;
};

type PlanPhase = {
  id: string;
  plan_id: string;
  phase_number: number;
  title: string;
  description: string | null;
};

type PlanWeek = {
  id: string;
  plan_id: string;
  phase_id: string | null;
  week_number: number;
  title: string;
  phase: string;
};

type PlanDay = {
  id: string;
  week_id: string;
  day_number: number;
  label: string;
  protocol: string | null;
  duration_load: string | null;
  is_rest_day: boolean;
  notes: string | null;
};

type ExerciseType = "weight_lifting" | "cardio" | "stairmaster";

type PlanExercise = {
  id: string;
  day_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  exercise_type: ExerciseType;
  set_count: number | null;
  rep_min: number | null;
  rep_max: number | null;
  target_duration_min: number | null;
  target_distance: number | null;
  target_floors: number | null;
  target_pace: string | null;
};

type CsvRow = {
  phase_number: number;
  phase_title: string;
  phase_description: string | null;
  week_number: number;
  week_title: string;
  phase_label: string;
  day_number: number;
  day_label: string;
  day_notes: string | null;
  is_rest_day: boolean;
  exercise_name: string | null;
  exercise_type: ExerciseType | null;
  exercise_description: string | null;
  set_count: number | null;
  rep_min: number | null;
  rep_max: number | null;
  target_duration_min: number | null;
  target_distance: number | null;
  target_floors: number | null;
  target_pace: string | null;
  sort_order: number | null;
};

type CsvImportPayload = {
  phases: Array<{ phase_number: number; title: string; description: string | null }>;
  weeks: Array<{ phase_number: number; week_number: number; title: string; phase: string }>;
  days: Array<{ week_number: number; day_number: number; label: string; notes: string | null; is_rest_day: boolean }>;
  exercises: Array<{
    week_number: number;
    day_number: number;
    sort_order: number;
    name: string;
    description: string | null;
    exercise_type: ExerciseType;
    set_count: number | null;
    rep_min: number | null;
    rep_max: number | null;
    target_duration_min: number | null;
    target_distance: number | null;
    target_floors: number | null;
    target_pace: string | null;
  }>;
};

type Props = {
  focuses: FocusLite[];
  onError: (message: string | null) => void;
  onNotify?: (kind: "success" | "error" | "info", message: string) => void;
};

const REQUIRED_HEADERS = ["phase_number", "week_number", "day_number", "day_label"];
const TEMPLATE_HEADERS = [
  "phase_number",
  "phase_title",
  "phase_description",
  "week_number",
  "week_title",
  "phase_label",
  "day_number",
  "day_label",
  "day_notes",
  "is_rest_day",
  "exercise_name",
  "exercise_type",
  "exercise_description",
  "set_count",
  "rep_min",
  "rep_max",
  "target_duration_min",
  "target_distance",
  "target_floors",
  "target_pace",
  "sort_order"
];
const TEMPLATE_SAMPLE_ROWS = [
  "1,Base,Foundation work,1,Week 1,Base,1,Lower Body + Core,,false,Squat,weight_lifting,Barbell squat,4,6,8,,,,,0",
  "1,Base,Foundation work,1,Week 1,Base,2,Zone 2 Cardio,,false,Endurance Run,cardio,Steady pace,,,,45,8,,,0",
  "1,Base,Foundation work,1,Week 1,Base,3,Stair Session,,false,Stairmaster Intervals,stairmaster,Moderate effort,,,,30,,40,2:30,0",
  "1,Base,Foundation work,1,Week 1,Base,7,Recovery Day,Full recovery,true,,,,,,,,,,,," 
];

const DAY_TEMPLATES: Array<{
  id: string;
  name: string;
  exercises: Array<{
    name: string;
    exercise_type: ExerciseType;
    description: string;
    set_count: number | null;
    rep_min: number | null;
    rep_max: number | null;
    target_duration_min: number | null;
    target_distance: number | null;
    target_floors: number | null;
    target_pace: string | null;
  }>;
}> = [
  {
    id: "strength-base",
    name: "Strength Base",
    exercises: [
      {
        name: "Back Squat",
        exercise_type: "weight_lifting",
        description: "Main strength lift",
        set_count: 4,
        rep_min: 6,
        rep_max: 8,
        target_duration_min: null,
        target_distance: null,
        target_floors: null,
        target_pace: null
      },
      {
        name: "Romanian Deadlift",
        exercise_type: "weight_lifting",
        description: "Posterior chain",
        set_count: 3,
        rep_min: 8,
        rep_max: 10,
        target_duration_min: null,
        target_distance: null,
        target_floors: null,
        target_pace: null
      }
    ]
  },
  {
    id: "cardio-zone2",
    name: "Zone 2 Cardio",
    exercises: [
      {
        name: "Steady Run",
        exercise_type: "cardio",
        description: "Nasal breathing pace",
        set_count: 1,
        rep_min: null,
        rep_max: null,
        target_duration_min: 45,
        target_distance: 8,
        target_floors: null,
        target_pace: "Zone 2"
      }
    ]
  },
  {
    id: "stair-intervals",
    name: "Stair Intervals",
    exercises: [
      {
        name: "Stairmaster Intervals",
        exercise_type: "stairmaster",
        description: "Work-rest intervals",
        set_count: 1,
        rep_min: null,
        rep_max: null,
        target_duration_min: 30,
        target_distance: null,
        target_floors: 40,
        target_pace: "2:30"
      }
    ]
  }
];

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function parseOptionalInt(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

function parseOptionalNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseBool(raw: string): boolean {
  return ["1", "true", "yes", "y"].includes(raw.trim().toLowerCase());
}

function downloadCsvTemplate() {
  const csv = [TEMPLATE_HEADERS.join(","), ...TEMPLATE_SAMPLE_ROWS].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reform-plan-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function PlanBuilder({ focuses, onError, onNotify }: Props) {
  const [focusId, setFocusId] = useState("");
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [planDraft, setPlanDraft] = useState<{ name: string; duration_weeks: string; is_active: boolean; status: "draft" | "published" }>({
    name: "",
    duration_weeks: "16",
    is_active: true,
    status: "draft"
  });

  const [phases, setPhases] = useState<PlanPhase[]>([]);
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvPayload, setCsvPayload] = useState<CsvImportPayload | null>(null);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [planFieldErrors, setPlanFieldErrors] = useState<{ name?: string; duration_weeks?: string }>({});
  const [phaseFieldErrors, setPhaseFieldErrors] = useState<Record<string, { title?: string }>>({});
  const [weekFieldErrors, setWeekFieldErrors] = useState<Record<string, { title?: string; phase?: string }>>({});
  const [dayFieldErrors, setDayFieldErrors] = useState<Record<string, { label?: string; rest?: string }>>({});
  const [exerciseFieldErrors, setExerciseFieldErrors] = useState<
    Record<string, { name?: string; set_count?: string; rep_min?: string; rep_max?: string; duration?: string; distance?: string; floors?: string }>
  >({});
  const [dayTemplateSelection, setDayTemplateSelection] = useState<Record<string, string>>({});
  const [editorTab, setEditorTab] = useState<"setup" | "structure" | "day">("structure");
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [dirtyDays, setDirtyDays] = useState<Record<string, boolean>>({});
  const [dirtyWeeks, setDirtyWeeks] = useState<Record<string, boolean>>({});
  const [dirtyPhases, setDirtyPhases] = useState<Record<string, boolean>>({});
  const [dirtyExercises, setDirtyExercises] = useState<Record<string, boolean>>({});
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!focuses.length) return;
    if (!focusId || !focuses.some((f) => f.id === focusId)) {
      const active = focuses.find((f) => f.is_active) ?? focuses[0];
      setFocusId(active.id);
    }
  }, [focuses, focusId]);

  useEffect(() => {
    if (!focusId) return;
    void loadPlans(focusId);
  }, [focusId]);

  useEffect(() => {
    if (!planId) {
      setPhases([]);
      setWeeks([]);
      setDays([]);
      setExercises([]);
      setTreeLoading(false);
      return;
    }
    void loadPlanTree(planId);
  }, [planId]);

  const phasesWithWeeks = useMemo(() => {
    return [...phases]
      .sort((a, b) => a.phase_number - b.phase_number)
      .map((phase) => ({
        phase,
        weeks: weeks
          .filter((w) => w.phase_id === phase.id)
          .sort((a, b) => a.week_number - b.week_number)
          .map((week) => ({
            week,
            days: days
              .filter((d) => d.week_id === week.id)
              .sort((a, b) => a.day_number - b.day_number)
              .map((day) => ({
                day,
                exercises: exercises
                  .filter((e) => e.day_id === day.id)
                  .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
              }))
          }))
      }));
  }, [phases, weeks, days, exercises]);

  const selectedDay = useMemo(() => days.find((day) => day.id === selectedDayId) ?? null, [days, selectedDayId]);
  const selectedPhase = useMemo(() => phases.find((phase) => phase.id === selectedPhaseId) ?? null, [phases, selectedPhaseId]);
  const selectedWeek = useMemo(() => weeks.find((week) => week.id === selectedWeekId) ?? null, [weeks, selectedWeekId]);
  const sortedDays = useMemo(() => [...days].sort((a, b) => a.day_number - b.day_number), [days]);

  useEffect(() => {
    if (!days.length) {
      setSelectedDayId(null);
      return;
    }
    if (!selectedDayId || !days.some((day) => day.id === selectedDayId)) {
      const next = [...days].sort((a, b) => a.day_number - b.day_number)[0];
      setSelectedDayId(next?.id ?? null);
    }
  }, [days, selectedDayId]);

  useEffect(() => {
    if (!phases.length) {
      setSelectedPhaseId(null);
      return;
    }
    if (!selectedPhaseId || !phases.some((phase) => phase.id === selectedPhaseId)) {
      const first = [...phases].sort((a, b) => a.phase_number - b.phase_number)[0];
      setSelectedPhaseId(first?.id ?? null);
    }
  }, [phases, selectedPhaseId]);

  useEffect(() => {
    if (!weeks.length) {
      setSelectedWeekId(null);
      return;
    }
    if (!selectedWeekId || !weeks.some((week) => week.id === selectedWeekId)) {
      const first = [...weeks].sort((a, b) => a.week_number - b.week_number)[0];
      setSelectedWeekId(first?.id ?? null);
    }
  }, [weeks, selectedWeekId]);

  async function loadPlans(nextFocusId: string) {
    setPlansLoading(true);
    onError(null);
    const normalizePlans = (rows: TrainingPlan[]) =>
      rows.map((row) => ({
        ...row,
        status: row.status === "published" ? "published" : "draft"
      }));

    let rows: TrainingPlan[] = [];
    const modern = await supabase
      .from("training_plans")
      .select("id,focus_id,name,duration_weeks,is_active,status,published_at,created_at")
      .eq("focus_id", nextFocusId)
      .order("created_at", { ascending: true });
    if (!modern.error) {
      rows = normalizePlans((modern.data as TrainingPlan[]) ?? []);
    } else {
      const legacy = await supabase
        .from("training_plans")
        .select("id,focus_id,name,duration_weeks,is_active,created_at")
        .eq("focus_id", nextFocusId)
        .order("created_at", { ascending: true });
      if (legacy.error) {
        onError(legacy.error.message);
        setPlansLoading(false);
        return;
      }
      rows = normalizePlans((legacy.data as TrainingPlan[]) ?? []);
    }

    setPlans(rows);
    const nextPlan = rows.find((p) => p.is_active) ?? rows[0] ?? null;
    setPlanId(nextPlan?.id ?? "");
    if (nextPlan) {
      setPlanDraft({
        name: nextPlan.name,
        duration_weeks: String(nextPlan.duration_weeks),
        is_active: nextPlan.is_active,
        status: nextPlan.status ?? "draft"
      });
    } else {
      setPlanDraft({ name: "", duration_weeks: "16", is_active: true, status: "draft" });
    }
    setPlansLoading(false);
  }

  async function loadPlanTree(nextPlanId: string) {
    setTreeLoading(true);
    onError(null);
    const { data: ph, error: phErr } = await supabase
      .from("plan_phases")
      .select("id,plan_id,phase_number,title,description")
      .eq("plan_id", nextPlanId);
    if (phErr) {
      onError(phErr.message);
      setTreeLoading(false);
      return;
    }

    const { data: wk, error: wkErr } = await supabase
      .from("plan_weeks")
      .select("id,plan_id,phase_id,week_number,title,phase")
      .eq("plan_id", nextPlanId);
    if (wkErr) {
      onError(wkErr.message);
      setTreeLoading(false);
      return;
    }

    const weekIds = ((wk as PlanWeek[]) ?? []).map((w) => w.id);
    const { data: dy, error: dyErr } = weekIds.length
      ? await supabase
          .from("plan_days")
          .select("id,week_id,day_number,label,protocol,duration_load,is_rest_day,notes")
          .in("week_id", weekIds)
      : { data: [], error: null };
    if (dyErr) {
      onError(dyErr.message);
      setTreeLoading(false);
      return;
    }

    const dayIds = ((dy as PlanDay[]) ?? []).map((d) => d.id);
    const { data: ex, error: exErr } = dayIds.length
      ? await supabase
          .from("plan_exercises")
          .select(
            "id,day_id,name,description,sort_order,exercise_type,set_count,rep_min,rep_max,target_duration_min,target_distance,target_floors,target_pace"
          )
          .in("day_id", dayIds)
      : { data: [], error: null };
    if (exErr) {
      onError(exErr.message);
      setTreeLoading(false);
      return;
    }

    setPhases((ph as PlanPhase[]) ?? []);
    setWeeks((wk as PlanWeek[]) ?? []);
    setDays((dy as PlanDay[]) ?? []);
    setExercises(
      ((ex as PlanExercise[]) ?? []).map((row) => ({
        ...row,
        exercise_type: row.exercise_type ?? "weight_lifting"
      }))
    );
    setExpandedExercises({});
    setTreeLoading(false);
  }

  function currentPlan(): TrainingPlan | null {
    return plans.find((p) => p.id === planId) ?? null;
  }

  function validatePlanDraft(): boolean {
    const durationWeeks = Number(planDraft.duration_weeks);
    const errors: { name?: string; duration_weeks?: string } = {};
    if (!planDraft.name.trim()) errors.name = "Plan name is required.";
    if (!Number.isFinite(durationWeeks) || durationWeeks < 1) errors.duration_weeks = "Duration must be at least 1 week.";
    setPlanFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validatePhase(phase: PlanPhase): boolean {
    const errors: { title?: string } = {};
    if (!phase.title.trim()) errors.title = "Phase title is required.";
    setPhaseFieldErrors((prev) => ({ ...prev, [phase.id]: errors }));
    return Object.keys(errors).length === 0;
  }

  function validateWeek(week: PlanWeek): boolean {
    const errors: { title?: string; phase?: string } = {};
    if (!week.title.trim()) errors.title = "Week title is required.";
    if (!week.phase.trim()) errors.phase = "Phase label is required.";
    setWeekFieldErrors((prev) => ({ ...prev, [week.id]: errors }));
    return Object.keys(errors).length === 0;
  }

  function validateDay(day: PlanDay): boolean {
    const errors: { label?: string; rest?: string } = {};
    if (!day.label.trim()) errors.label = "Day label is required.";
    if (day.is_rest_day) {
      const hasExercises = exercises.some((ex) => ex.day_id === day.id);
      if (hasExercises) errors.rest = "Rest day cannot contain exercises. Delete exercises first.";
    }
    setDayFieldErrors((prev) => ({ ...prev, [day.id]: errors }));
    return Object.keys(errors).length === 0;
  }

  function validateExercise(ex: PlanExercise): boolean {
    const errors: { name?: string; set_count?: string; rep_min?: string; rep_max?: string; duration?: string; distance?: string; floors?: string } = {};
    if (!ex.name.trim()) errors.name = "Exercise name is required.";
    if (ex.exercise_type === "weight_lifting") {
      if (!ex.set_count || ex.set_count < 1) errors.set_count = "Set count must be at least 1.";
      if (ex.rep_min == null || ex.rep_min < 1) errors.rep_min = "Rep min must be at least 1.";
      if (ex.rep_max == null || ex.rep_max < 1) errors.rep_max = "Rep max must be at least 1.";
      if (ex.rep_min != null && ex.rep_max != null && ex.rep_min > ex.rep_max) errors.rep_max = "Rep max must be greater than or equal to rep min.";
    } else {
      if (ex.target_duration_min == null || ex.target_duration_min <= 0) errors.duration = "Duration must be greater than 0.";
      if (ex.exercise_type === "cardio" && (ex.target_distance == null || ex.target_distance <= 0)) {
        errors.distance = "Distance must be greater than 0.";
      }
      if (ex.exercise_type === "stairmaster" && (ex.target_floors == null || ex.target_floors < 1)) {
        errors.floors = "Floors must be at least 1.";
      }
    }
    setExerciseFieldErrors((prev) => ({ ...prev, [ex.id]: errors }));
    return Object.keys(errors).length === 0;
  }

  async function createPlan() {
    if (!focusId) return;
    setBusyKey("create-plan");
    onError(null);
    try {
      const { data, error } = await supabase
        .from("training_plans")
        .insert({
          focus_id: focusId,
          name: "New Plan",
          duration_weeks: 16,
          is_active: plans.length === 0,
          status: plans.length === 0 ? "published" : "draft",
          published_at: plans.length === 0 ? new Date().toISOString() : null
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Failed to create plan.");
      await loadPlans(focusId);
      setPlanId((data as { id: string }).id);
      onNotify?.("success", "Plan created.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function savePlan(nextStatus?: "draft" | "published") {
    const plan = currentPlan();
    if (!plan) return;
    if (!validatePlanDraft()) {
      onError("Plan name and duration must be valid.");
      return;
    }
    const durationWeeks = Number(planDraft.duration_weeks);
    const status = nextStatus ?? planDraft.status;
    const shouldBeActive = status === "published" ? true : planDraft.is_active;
    setBusyKey("save-plan");
    onError(null);
    try {
      const updatePayload = {
        name: planDraft.name.trim(),
        duration_weeks: durationWeeks,
        is_active: shouldBeActive,
        status,
        published_at: status === "published" ? new Date().toISOString() : null
      };
      let { error } = await supabase
        .from("training_plans")
        .update(updatePayload)
        .eq("id", plan.id);
      if (error && /status|published_at/i.test(error.message)) {
        const fallback = await supabase
          .from("training_plans")
          .update({
            name: planDraft.name.trim(),
            duration_weeks: durationWeeks,
            is_active: shouldBeActive
          })
          .eq("id", plan.id);
        error = fallback.error;
      }
      if (error) throw error;
      await loadPlans(focusId);
      setPlanId(plan.id);
      onNotify?.("success", status === "published" ? "Plan published." : "Plan saved as draft.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function deletePlan() {
    const plan = currentPlan();
    if (!plan) return;
    if (plans.length <= 1) {
      onError("Cannot delete the only plan for this focus.");
      return;
    }

    const confirmed = window.confirm(
      `Delete plan "${plan.name}"?\nThis permanently removes all linked phases, weeks, days, and exercises.`
    );
    if (!confirmed) return;

    setBusyKey("delete-plan");
    onError(null);
    try {
      const { error: deleteErr } = await supabase.from("training_plans").delete().eq("id", plan.id);
      if (deleteErr) throw deleteErr;

      const { data: remaining, error: remainingErr } = await supabase
        .from("training_plans")
        .select("id,is_active,created_at")
        .eq("focus_id", focusId)
        .order("created_at", { ascending: true });
      if (remainingErr) throw remainingErr;

      const remainingPlans = (remaining as Array<{ id: string; is_active: boolean; created_at: string }>) ?? [];
      if (remainingPlans.length > 0 && !remainingPlans.some((row) => row.is_active)) {
        const nextActive = remainingPlans[0];
        let { error: activateErr } = await supabase
          .from("training_plans")
          .update({ is_active: true, status: "published", published_at: new Date().toISOString() })
          .eq("id", nextActive.id);

        if (activateErr && /status|published_at/i.test(activateErr.message)) {
          const fallback = await supabase.from("training_plans").update({ is_active: true }).eq("id", nextActive.id);
          activateErr = fallback.error;
        }
        if (activateErr) throw activateErr;
      }

      await loadPlans(focusId);
      onNotify?.("success", "Plan deleted.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function addPhase() {
    if (!planId) return;
    const nextNumber = (phases.reduce((m, p) => Math.max(m, p.phase_number), 0) || 0) + 1;
    setBusyKey("add-phase");
    onError(null);
    try {
      const { error } = await supabase.from("plan_phases").insert({
        plan_id: planId,
        phase_number: nextNumber,
        title: `Phase ${nextNumber}`,
        description: ""
      });
      if (error) throw error;
      await loadPlanTree(planId);
      onNotify?.("success", "Phase added.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function savePhase(phase: PlanPhase) {
    if (!validatePhase(phase)) {
      onError("Phase title is required.");
      return;
    }
    setBusyKey(`save-phase-${phase.id}`);
    onError(null);
    try {
      const { error } = await supabase
        .from("plan_phases")
        .update({ title: phase.title.trim(), description: phase.description?.trim() ?? null })
        .eq("id", phase.id);
      if (error) throw error;
      setDirtyPhases((prev) => ({ ...prev, [phase.id]: false }));
      onNotify?.("success", "Phase saved.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function deletePhase(phase: PlanPhase) {
    const confirmed = window.confirm(
      `Delete Phase ${phase.phase_number} "${phase.title}"?\nThis will permanently delete all linked weeks, days, and exercises.`
    );
    if (!confirmed) return;
    setBusyKey(`delete-phase-${phase.id}`);
    onError(null);
    try {
      const { error } = await supabase.from("plan_phases").delete().eq("id", phase.id);
      if (error) throw error;
      await loadPlanTree(planId);
      onNotify?.("success", "Phase deleted.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function addWeek(phaseId: string) {
    if (!planId) return;
    const nextWeek = (weeks.reduce((m, w) => Math.max(m, w.week_number), 0) || 0) + 1;
    setBusyKey(`add-week-${phaseId}`);
    onError(null);
    try {
      const { error } = await supabase.from("plan_weeks").insert({
        plan_id: planId,
        phase_id: phaseId,
        week_number: nextWeek,
        title: `Week ${nextWeek}`,
        phase: "Build"
      });
      if (error) throw error;
      await loadPlanTree(planId);
      onNotify?.("success", "Week added.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function saveWeek(week: PlanWeek) {
    if (!validateWeek(week)) {
      onError("Week title and phase label are required.");
      return;
    }
    setBusyKey(`save-week-${week.id}`);
    onError(null);
    try {
      const { error } = await supabase.from("plan_weeks").update({ title: week.title, phase: week.phase }).eq("id", week.id);
      if (error) throw error;
      setDirtyWeeks((prev) => ({ ...prev, [week.id]: false }));
      onNotify?.("success", "Week saved.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteWeek(week: PlanWeek) {
    const confirmed = window.confirm(
      `Delete Week ${week.week_number} "${week.title}"?\nThis will permanently delete all linked days and exercises.`
    );
    if (!confirmed) return;
    setBusyKey(`delete-week-${week.id}`);
    onError(null);
    try {
      const { error } = await supabase.from("plan_weeks").delete().eq("id", week.id);
      if (error) throw error;
      await loadPlanTree(planId);
      onNotify?.("success", "Week deleted.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function addDay(weekId: string) {
    const used = new Set(days.filter((d) => d.week_id === weekId).map((d) => d.day_number));
    const nextDay = [1, 2, 3, 4, 5, 6, 7].find((n) => !used.has(n));
    if (!nextDay) {
      onError("Week already has 7 days.");
      return;
    }
    setBusyKey(`add-day-${weekId}`);
    onError(null);
    try {
      const { error } = await supabase.from("plan_days").insert({
        week_id: weekId,
        day_number: nextDay,
        label: `Day ${nextDay}`,
        is_rest_day: false
      });
      if (error) throw error;
      await loadPlanTree(planId);
      onNotify?.("success", "Day added.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function duplicateWeek(week: PlanWeek) {
    if (!planId) return;
    const sourceDays = days
      .filter((day) => day.week_id === week.id)
      .sort((a, b) => a.day_number - b.day_number);

    setBusyKey(`duplicate-week-${week.id}`);
    onError(null);
    try {
      const nextWeekNumber = (weeks.reduce((m, row) => Math.max(m, row.week_number), 0) || 0) + 1;
      const { data: newWeek, error: weekErr } = await supabase
        .from("plan_weeks")
        .insert({
          plan_id: planId,
          phase_id: week.phase_id,
          week_number: nextWeekNumber,
          title: `${week.title} Copy`,
          phase: week.phase
        })
        .select("id")
        .single();
      if (weekErr || !newWeek) throw weekErr ?? new Error("Could not create duplicated week.");

      if (sourceDays.length > 0) {
        const { data: newDays, error: dayErr } = await supabase
          .from("plan_days")
          .insert(
            sourceDays.map((day) => ({
              week_id: (newWeek as { id: string }).id,
              day_number: day.day_number,
              label: day.label,
              notes: day.notes,
              is_rest_day: day.is_rest_day
            }))
          )
          .select("id,day_number");
        if (dayErr) throw dayErr;

        const newDayIdByDayNumber = new Map<number, string>();
        for (const row of (newDays as Array<{ id: string; day_number: number }>) ?? []) {
          newDayIdByDayNumber.set(row.day_number, row.id);
        }

        const sourceExercises = sourceDays.flatMap((day) => exercises.filter((exercise) => exercise.day_id === day.id));
        if (sourceExercises.length > 0) {
          const exerciseInserts = sourceExercises
            .map((exercise) => {
              const sourceDay = sourceDays.find((day) => day.id === exercise.day_id);
              if (!sourceDay) return null;
              const newDayId = newDayIdByDayNumber.get(sourceDay.day_number);
              if (!newDayId) return null;
              return {
                day_id: newDayId,
                name: exercise.name,
                description: exercise.description,
                sort_order: exercise.sort_order,
                exercise_type: exercise.exercise_type,
                set_count: exercise.set_count,
                rep_min: exercise.rep_min,
                rep_max: exercise.rep_max,
                target_duration_min: exercise.target_duration_min,
                target_distance: exercise.target_distance,
                target_floors: exercise.target_floors,
                target_pace: exercise.target_pace
              };
            })
            .filter(Boolean);

          if (exerciseInserts.length > 0) {
            const { error: exErr } = await supabase.from("plan_exercises").insert(exerciseInserts);
            if (exErr) throw exErr;
          }
        }
      }

      await loadPlanTree(planId);
      onNotify?.("success", "Week duplicated.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function saveDay(day: PlanDay, options?: { silent?: boolean }) {
    if (!validateDay(day)) {
      onError("Day has validation errors.");
      return;
    }
    setBusyKey(`save-day-${day.id}`);
    onError(null);
    try {
      const { error } = await supabase
        .from("plan_days")
        .update({
          label: day.label.trim(),
          is_rest_day: day.is_rest_day,
          notes: day.notes?.trim() || null
        })
        .eq("id", day.id);
      if (error) throw error;
      setDirtyDays((prev) => ({ ...prev, [day.id]: false }));
      if (!options?.silent) onNotify?.("success", "Day saved.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteDay(day: PlanDay) {
    const confirmed = window.confirm(
      `Delete Day ${day.day_number} "${day.label}"?\nThis will permanently delete all linked exercises.`
    );
    if (!confirmed) return;
    setBusyKey(`delete-day-${day.id}`);
    onError(null);
    try {
      const { error } = await supabase.from("plan_days").delete().eq("id", day.id);
      if (error) throw error;
      await loadPlanTree(planId);
      onNotify?.("success", "Day deleted.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function duplicateDay(day: PlanDay) {
    const used = new Set(days.filter((row) => row.week_id === day.week_id).map((row) => row.day_number));
    const nextDayNumber = [1, 2, 3, 4, 5, 6, 7].find((n) => !used.has(n));
    if (!nextDayNumber) {
      onError("Week already has 7 days.");
      return;
    }

    setBusyKey(`duplicate-day-${day.id}`);
    onError(null);
    try {
      const { data: newDay, error: dayErr } = await supabase
        .from("plan_days")
        .insert({
          week_id: day.week_id,
          day_number: nextDayNumber,
          label: `${day.label} Copy`,
          notes: day.notes,
          is_rest_day: day.is_rest_day
        })
        .select("id")
        .single();
      if (dayErr || !newDay) throw dayErr ?? new Error("Could not duplicate day.");

      if (!day.is_rest_day) {
        const sourceExercises = exercises.filter((exercise) => exercise.day_id === day.id);
        if (sourceExercises.length > 0) {
          const { error: exErr } = await supabase.from("plan_exercises").insert(
            sourceExercises.map((exercise) => ({
              day_id: (newDay as { id: string }).id,
              name: exercise.name,
              description: exercise.description,
              sort_order: exercise.sort_order,
              exercise_type: exercise.exercise_type,
              set_count: exercise.set_count,
              rep_min: exercise.rep_min,
              rep_max: exercise.rep_max,
              target_duration_min: exercise.target_duration_min,
              target_distance: exercise.target_distance,
              target_floors: exercise.target_floors,
              target_pace: exercise.target_pace
            }))
          );
          if (exErr) throw exErr;
        }
      }

      await loadPlanTree(planId);
      onNotify?.("success", "Day duplicated.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function addExercise(dayId: string, type: ExerciseType) {
    const nextSort = (exercises.filter((e) => e.day_id === dayId).reduce((m, e) => Math.max(m, e.sort_order), -1) || -1) + 1;
    setBusyKey(`add-ex-${dayId}`);
    onError(null);
    try {
      const payload: Partial<PlanExercise> = {
        day_id: dayId,
        name: type === "weight_lifting" ? "New Lift" : type === "cardio" ? "New Cardio" : "New Stairmaster",
        exercise_type: type,
        sort_order: nextSort,
        set_count: type === "weight_lifting" ? 3 : 1,
        rep_min: type === "weight_lifting" ? 8 : null,
        rep_max: type === "weight_lifting" ? 12 : null,
        target_duration_min: type === "weight_lifting" ? null : 30,
        target_distance: type === "cardio" ? 5 : null,
        target_floors: type === "stairmaster" ? 20 : null,
        target_pace: null,
        description: ""
      };
      const { error } = await supabase.from("plan_exercises").insert(payload);
      if (error) throw error;
      await loadPlanTree(planId);
      onNotify?.("success", "Exercise added.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function applyDayTemplate(day: PlanDay, templateId: string) {
    const template = DAY_TEMPLATES.find((row) => row.id === templateId);
    if (!template) {
      onError("Template not found.");
      return;
    }
    if (day.is_rest_day) {
      onError("Cannot apply a template to a rest day.");
      return;
    }
    const currentExercises = exercises.filter((exercise) => exercise.day_id === day.id);
    const startSort = (currentExercises.reduce((max, exercise) => Math.max(max, exercise.sort_order), -1) || -1) + 1;

    setBusyKey(`apply-template-${day.id}`);
    onError(null);
    try {
      const payload = template.exercises.map((exercise, index) => ({
        day_id: day.id,
        name: exercise.name,
        description: exercise.description,
        sort_order: startSort + index,
        exercise_type: exercise.exercise_type,
        set_count: exercise.exercise_type === "weight_lifting" ? exercise.set_count : 1,
        rep_min: exercise.exercise_type === "weight_lifting" ? exercise.rep_min : null,
        rep_max: exercise.exercise_type === "weight_lifting" ? exercise.rep_max : null,
        target_duration_min: exercise.exercise_type === "weight_lifting" ? null : exercise.target_duration_min,
        target_distance: exercise.exercise_type === "cardio" ? exercise.target_distance : null,
        target_floors: exercise.exercise_type === "stairmaster" ? exercise.target_floors : null,
        target_pace: exercise.exercise_type === "weight_lifting" ? null : exercise.target_pace
      }));
      const { error } = await supabase.from("plan_exercises").insert(payload);
      if (error) throw error;
      await loadPlanTree(planId);
      onNotify?.("success", `Template applied: ${template.name}`);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function saveExercise(ex: PlanExercise, options?: { silent?: boolean }) {
    if (!validateExercise(ex)) {
      onError("Exercise has validation errors.");
      return;
    }
    setBusyKey(`save-ex-${ex.id}`);
    onError(null);
    try {
      const payload = {
        name: ex.name.trim(),
        description: ex.description?.trim() || null,
        exercise_type: ex.exercise_type,
        set_count: ex.exercise_type === "weight_lifting" ? ex.set_count : 1,
        rep_min: ex.exercise_type === "weight_lifting" ? ex.rep_min : null,
        rep_max: ex.exercise_type === "weight_lifting" ? ex.rep_max : null,
        target_duration_min: ex.exercise_type === "weight_lifting" ? null : ex.target_duration_min,
        target_distance: ex.exercise_type === "cardio" ? ex.target_distance : null,
        target_floors: ex.exercise_type === "stairmaster" ? ex.target_floors : null,
        target_pace: ex.exercise_type === "weight_lifting" ? null : ex.target_pace
      };
      const { error } = await supabase.from("plan_exercises").update(payload).eq("id", ex.id);
      if (error) throw error;
      setDirtyExercises((prev) => ({ ...prev, [ex.id]: false }));
      if (!options?.silent) onNotify?.("success", "Exercise saved.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteExercise(exercise: PlanExercise) {
    const confirmed = window.confirm(`Delete exercise "${exercise.name}"?\nThis action cannot be undone.`);
    if (!confirmed) return;
    setBusyKey(`delete-ex-${exercise.id}`);
    onError(null);
    try {
      const { error } = await supabase.from("plan_exercises").delete().eq("id", exercise.id);
      if (error) throw error;
      setExercises((prev) => prev.filter((e) => e.id !== exercise.id));
      setDirtyExercises((prev) => ({ ...prev, [exercise.id]: false }));
      setExpandedExercises((prev) => ({ ...prev, [exercise.id]: false }));
      onNotify?.("success", "Exercise deleted.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  function buildCsvImport(text: string): { rows: CsvRow[]; errors: string[]; payload: CsvImportPayload | null } {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return { rows: [], errors: ["CSV must include a header row and at least one data row."], payload: null };
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length) {
      return { rows: [], errors: [`Missing required headers: ${missing.join(", ")}`], payload: null };
    }

    const errors: string[] = [];
    const rows: CsvRow[] = [];
    const phaseMap = new Map<number, { phase_number: number; title: string; description: string | null }>();
    const weekMap = new Map<number, { phase_number: number; week_number: number; title: string; phase: string }>();
    const dayMap = new Map<string, { week_number: number; day_number: number; label: string; notes: string | null; is_rest_day: boolean }>();
    const exercisesOut: CsvImportPayload["exercises"] = [];
    const perDaySort = new Map<string, number>();

    for (let i = 1; i < lines.length; i += 1) {
      const values = parseCsvLine(lines[i]);
      const source: Record<string, string> = {};
      headers.forEach((h, idx) => {
        source[h] = (values[idx] ?? "").trim();
      });

      const phaseNumber = parseOptionalInt(source.phase_number ?? "");
      const weekNumber = parseOptionalInt(source.week_number ?? "");
      const dayNumber = parseOptionalInt(source.day_number ?? "");
      const dayLabel = (source.day_label ?? "").trim();
      if (!phaseNumber || phaseNumber < 1) errors.push(`Row ${i + 1}: phase_number must be >= 1.`);
      if (!weekNumber || weekNumber < 1) errors.push(`Row ${i + 1}: week_number must be >= 1.`);
      if (!dayNumber || dayNumber < 1 || dayNumber > 7) errors.push(`Row ${i + 1}: day_number must be between 1 and 7.`);
      if (!dayLabel) errors.push(`Row ${i + 1}: day_label is required.`);
      if (!phaseNumber || !weekNumber || !dayNumber || !dayLabel) continue;

      const isRestDay = parseBool(source.is_rest_day ?? "");
      const phaseTitle = (source.phase_title ?? "").trim() || `Phase ${phaseNumber}`;
      const phaseDescription = (source.phase_description ?? "").trim() || null;
      const weekTitle = (source.week_title ?? "").trim() || `Week ${weekNumber}`;
      const phaseLabel = (source.phase_label ?? "").trim() || "Build";
      const dayNotes = (source.day_notes ?? "").trim() || null;

      if (!phaseMap.has(phaseNumber)) phaseMap.set(phaseNumber, { phase_number: phaseNumber, title: phaseTitle, description: phaseDescription });
      if (!weekMap.has(weekNumber)) weekMap.set(weekNumber, { phase_number: phaseNumber, week_number: weekNumber, title: weekTitle, phase: phaseLabel });
      const dayKey = `${weekNumber}:${dayNumber}`;
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, { week_number: weekNumber, day_number: dayNumber, label: dayLabel, notes: dayNotes, is_rest_day: isRestDay });

      const rawType = (source.exercise_type ?? "").trim();
      const exerciseType =
        rawType === "weight_lifting" || rawType === "cardio" || rawType === "stairmaster"
          ? (rawType as ExerciseType)
          : null;
      const exerciseName = (source.exercise_name ?? "").trim() || null;
      const setCount = parseOptionalInt(source.set_count ?? "");
      const repMin = parseOptionalInt(source.rep_min ?? "");
      const repMax = parseOptionalInt(source.rep_max ?? "");
      const targetDuration = parseOptionalNumber(source.target_duration_min ?? "");
      const targetDistance = parseOptionalNumber(source.target_distance ?? "");
      const targetFloors = parseOptionalInt(source.target_floors ?? "");
      const targetPace = (source.target_pace ?? "").trim() || null;
      const explicitSort = parseOptionalInt(source.sort_order ?? "");

      if (!isRestDay) {
        if (!exerciseName) errors.push(`Row ${i + 1}: exercise_name required when is_rest_day is false.`);
        if (!exerciseType) errors.push(`Row ${i + 1}: exercise_type must be weight_lifting, cardio, or stairmaster.`);
        if (exerciseType === "weight_lifting" && (setCount == null || repMin == null || repMax == null)) {
          errors.push(`Row ${i + 1}: weight_lifting rows require set_count, rep_min, rep_max.`);
        }
        if (exerciseType === "cardio" && (targetDuration == null || targetDistance == null)) {
          errors.push(`Row ${i + 1}: cardio rows require target_duration_min and target_distance.`);
        }
        if (exerciseType === "stairmaster" && (targetDuration == null || targetFloors == null)) {
          errors.push(`Row ${i + 1}: stairmaster rows require target_duration_min and target_floors.`);
        }
      }

      const nextSort = explicitSort ?? ((perDaySort.get(dayKey) ?? -1) + 1);
      perDaySort.set(dayKey, Math.max(perDaySort.get(dayKey) ?? -1, nextSort));

      const row: CsvRow = {
        phase_number: phaseNumber,
        phase_title: phaseTitle,
        phase_description: phaseDescription,
        week_number: weekNumber,
        week_title: weekTitle,
        phase_label: phaseLabel,
        day_number: dayNumber,
        day_label: dayLabel,
        day_notes: dayNotes,
        is_rest_day: isRestDay,
        exercise_name: exerciseName,
        exercise_type: exerciseType,
        exercise_description: (source.exercise_description ?? "").trim() || null,
        set_count: setCount,
        rep_min: repMin,
        rep_max: repMax,
        target_duration_min: targetDuration,
        target_distance: targetDistance,
        target_floors: targetFloors,
        target_pace: targetPace,
        sort_order: nextSort
      };
      rows.push(row);

      if (!isRestDay && exerciseName && exerciseType) {
        exercisesOut.push({
          week_number: weekNumber,
          day_number: dayNumber,
          sort_order: nextSort,
          name: exerciseName,
          description: row.exercise_description,
          exercise_type: exerciseType,
          set_count: row.set_count,
          rep_min: row.rep_min,
          rep_max: row.rep_max,
          target_duration_min: row.target_duration_min,
          target_distance: row.target_distance,
          target_floors: row.target_floors,
          target_pace: row.target_pace
        });
      }
    }

    if (errors.length) return { rows, errors, payload: null };
    return {
      rows,
      errors: [],
      payload: {
        phases: [...phaseMap.values()].sort((a, b) => a.phase_number - b.phase_number),
        weeks: [...weekMap.values()].sort((a, b) => a.week_number - b.week_number),
        days: [...dayMap.values()].sort((a, b) => a.week_number - b.week_number || a.day_number - b.day_number),
        exercises: exercisesOut.sort((a, b) => a.week_number - b.week_number || a.day_number - b.day_number || a.sort_order - b.sort_order)
      }
    };
  }

  async function handleCsvFile(file: File | null) {
    setCsvFileName("");
    setCsvRows([]);
    setCsvErrors([]);
    setCsvPayload(null);
    if (!file) return;
    setCsvFileName(file.name);
    const parsed = buildCsvImport(await file.text());
    setCsvRows(parsed.rows);
    setCsvErrors(parsed.errors);
    setCsvPayload(parsed.payload);
  }

  async function applyCsvImport() {
    if (!planId || !csvPayload) return;
    if (replaceOnImport) {
      const confirmed = window.confirm("Replace existing plan structure with CSV data? This will overwrite current phases, weeks, days, and exercises.");
      if (!confirmed) return;
    }
    setBusyKey("apply-csv");
    onError(null);
    try {
      if (replaceOnImport) {
        const { error: delWeeksErr } = await supabase.from("plan_weeks").delete().eq("plan_id", planId);
        if (delWeeksErr) throw delWeeksErr;
        const { error: delPhErr } = await supabase.from("plan_phases").delete().eq("plan_id", planId);
        if (delPhErr) throw delPhErr;
      }

      const { data: phaseRows, error: phaseErr } = await supabase
        .from("plan_phases")
        .insert(csvPayload.phases.map((phase) => ({ plan_id: planId, ...phase })))
        .select("id,phase_number");
      if (phaseErr) throw phaseErr;
      const phaseIdByNumber = new Map<number, string>();
      for (const row of (phaseRows as Array<{ id: string; phase_number: number }>) ?? []) {
        phaseIdByNumber.set(row.phase_number, row.id);
      }

      const { data: weekRows, error: weekErr } = await supabase
        .from("plan_weeks")
        .insert(
          csvPayload.weeks.map((week) => ({
            plan_id: planId,
            week_number: week.week_number,
            title: week.title,
            phase: week.phase,
            phase_id: phaseIdByNumber.get(week.phase_number) ?? null
          }))
        )
        .select("id,week_number");
      if (weekErr) throw weekErr;
      const weekIdByNumber = new Map<number, string>();
      for (const row of (weekRows as Array<{ id: string; week_number: number }>) ?? []) {
        weekIdByNumber.set(row.week_number, row.id);
      }

      const { data: dayRows, error: dayErr } = await supabase
        .from("plan_days")
        .insert(
          csvPayload.days.map((day) => ({
            week_id: weekIdByNumber.get(day.week_number),
            day_number: day.day_number,
            label: day.label,
            notes: day.notes,
            is_rest_day: day.is_rest_day
          }))
        )
        .select("id,day_number,week_id,plan_weeks!inner(week_number)");
      if (dayErr) throw dayErr;

      const dayIdByKey = new Map<string, string>();
      for (const row of (dayRows as Array<{ id: string; day_number: number; plan_weeks?: { week_number: number } }>) ?? []) {
        const weekNumber = row.plan_weeks?.week_number;
        if (typeof weekNumber === "number") dayIdByKey.set(`${weekNumber}:${row.day_number}`, row.id);
      }

      if (csvPayload.exercises.length > 0) {
        const { error: exErr } = await supabase.from("plan_exercises").insert(
          csvPayload.exercises.map((ex) => ({
            day_id: dayIdByKey.get(`${ex.week_number}:${ex.day_number}`),
            sort_order: ex.sort_order,
            name: ex.name,
            description: ex.description,
            exercise_type: ex.exercise_type,
            set_count: ex.exercise_type === "weight_lifting" ? ex.set_count : 1,
            rep_min: ex.exercise_type === "weight_lifting" ? ex.rep_min : null,
            rep_max: ex.exercise_type === "weight_lifting" ? ex.rep_max : null,
            target_duration_min: ex.exercise_type === "weight_lifting" ? null : ex.target_duration_min,
            target_distance: ex.exercise_type === "cardio" ? ex.target_distance : null,
            target_floors: ex.exercise_type === "stairmaster" ? ex.target_floors : null,
            target_pace: ex.exercise_type === "weight_lifting" ? null : ex.target_pace
          }))
        );
        if (exErr) throw exErr;
      }

      await loadPlanTree(planId);
      setCsvErrors([]);
      onError(null);
      onNotify?.("success", "CSV import applied.");
    } catch (err) {
      const message = (err as Error).message;
      onError(message);
      onNotify?.("error", message);
    } finally {
      setBusyKey(null);
    }
  }

  function focusFieldById(id: string) {
    const element = document.getElementById(id) as HTMLElement | null;
    element?.focus();
  }

  async function saveAndNextDay() {
    if (!selectedDay) return;
    await saveDay(selectedDay);
    const currentIndex = sortedDays.findIndex((day) => day.id === selectedDay.id);
    if (currentIndex >= 0 && currentIndex < sortedDays.length - 1) {
      setSelectedDayId(sortedDays[currentIndex + 1].id);
    }
  }

  async function saveAllInDay(day: PlanDay, dayExercises: PlanExercise[]) {
    setBusyKey(`save-all-day-${day.id}`);
    onError(null);
    try {
      await saveDay(day, { silent: true });

      const dirtyExerciseRows = dayExercises.filter((exercise) => dirtyExercises[exercise.id]);
      for (const exercise of dirtyExerciseRows) {
        await saveExercise(exercise, { silent: true });
      }

      onNotify?.("success", `Saved day and ${dirtyExerciseRows.length} exercise change(s).`);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  function getFocusedIssues(day: PlanDay, dayExercises: PlanExercise[]) {
    const issues: Array<{ key: string; message: string; targetId: string }> = [];
    const dayIssues = dayFieldErrors[day.id];
    if (dayIssues?.label) issues.push({ key: `${day.id}-label`, message: dayIssues.label, targetId: `day-label-${day.id}` });
    if (dayIssues?.rest) issues.push({ key: `${day.id}-rest`, message: dayIssues.rest, targetId: `day-rest-${day.id}` });

    for (const exercise of dayExercises) {
      const exIssues = exerciseFieldErrors[exercise.id];
      if (!exIssues) continue;
      if (exIssues.name) issues.push({ key: `${exercise.id}-name`, message: exIssues.name, targetId: `exercise-name-${exercise.id}` });
      if (exIssues.set_count) issues.push({ key: `${exercise.id}-set`, message: exIssues.set_count, targetId: `exercise-name-${exercise.id}` });
      if (exIssues.rep_min) issues.push({ key: `${exercise.id}-rep-min`, message: exIssues.rep_min, targetId: `exercise-name-${exercise.id}` });
      if (exIssues.rep_max) issues.push({ key: `${exercise.id}-rep-max`, message: exIssues.rep_max, targetId: `exercise-name-${exercise.id}` });
      if (exIssues.duration) issues.push({ key: `${exercise.id}-duration`, message: exIssues.duration, targetId: `exercise-name-${exercise.id}` });
      if (exIssues.distance) issues.push({ key: `${exercise.id}-distance`, message: exIssues.distance, targetId: `exercise-name-${exercise.id}` });
      if (exIssues.floors) issues.push({ key: `${exercise.id}-floors`, message: exIssues.floors, targetId: `exercise-name-${exercise.id}` });
    }
    return issues;
  }

  function renderFocusedDayEditor(day: PlanDay) {
    const dayExercises = exercises
      .filter((exercise) => exercise.day_id === day.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const issues = getFocusedIssues(day, dayExercises);
    const hasDirty =
      Boolean(dirtyDays[day.id]) ||
      dayExercises.some((exercise) => dirtyExercises[exercise.id]);

    return (
      <>
        <div className="editor-command-bar">
          <span className="focus-meta">{hasDirty ? "Unsaved changes" : "All changes saved"}</span>
          <div className="phase-actions">
            <button className="ghost-btn" type="button" onClick={() => void saveDay(day)} disabled={busyKey === `save-day-${day.id}`}>
              {busyKey === `save-day-${day.id}` ? "Saving..." : "Save"}
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => void saveAllInDay(day, dayExercises)}
              disabled={busyKey === `save-all-day-${day.id}`}
            >
              {busyKey === `save-all-day-${day.id}` ? "Saving All..." : "Save All in Day"}
            </button>
            <button className="ghost-btn" type="button" onClick={() => void saveAndNextDay()} disabled={busyKey === `save-day-${day.id}`}>
              Save & Next Day
            </button>
          </div>
        </div>

        <div className="plan-grid">
          <label>
            Day Label
            <input
              id={`day-label-${day.id}`}
              value={day.label}
              onChange={(e) => {
                setDays((prev) => prev.map((row) => (row.id === day.id ? { ...row, label: e.target.value } : row)));
                setDirtyDays((prev) => ({ ...prev, [day.id]: true }));
              }}
            />
          </label>
          <label className="checkbox-row">
            <input
              id={`day-rest-${day.id}`}
              type="checkbox"
              checked={day.is_rest_day}
              onChange={(e) => {
                if (e.target.checked && dayExercises.length > 0) {
                  const restMessage = "Rest day cannot contain exercises. Delete all exercises first.";
                  setDayFieldErrors((prev) => ({ ...prev, [day.id]: { ...prev[day.id], rest: restMessage } }));
                  onError(restMessage);
                  return;
                }
                setDays((prev) => prev.map((row) => (row.id === day.id ? { ...row, is_rest_day: e.target.checked } : row)));
                setDirtyDays((prev) => ({ ...prev, [day.id]: true }));
              }}
            />
            Rest day
          </label>
          <label>
            Notes
            <input
              id={`day-notes-${day.id}`}
              value={day.notes ?? ""}
              onChange={(e) => {
                setDays((prev) => prev.map((row) => (row.id === day.id ? { ...row, notes: e.target.value } : row)));
                setDirtyDays((prev) => ({ ...prev, [day.id]: true }));
              }}
            />
          </label>
        </div>
        {issues.length > 0 ? (
          <div className="issues-panel">
            <strong>Issues</strong>
            {issues.map((issue) => (
              <button key={issue.key} className="ghost-btn issue-item" type="button" onClick={() => focusFieldById(issue.targetId)}>
                {issue.message}
              </button>
            ))}
          </div>
        ) : null}

        {!day.is_rest_day ? (
          <>
            <div className="exercise-add-row">
              <select
                value={dayTemplateSelection[day.id] ?? DAY_TEMPLATES[0].id}
                onChange={(e) => setDayTemplateSelection((prev) => ({ ...prev, [day.id]: e.target.value }))}
              >
                {DAY_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => void applyDayTemplate(day, dayTemplateSelection[day.id] ?? DAY_TEMPLATES[0].id)}
                disabled={busyKey === `apply-template-${day.id}`}
              >
                {busyKey === `apply-template-${day.id}` ? "Applying..." : "Apply Template"}
              </button>
              <button className="ghost-btn" onClick={() => void addExercise(day.id, "weight_lifting")}>
                + Weight Lift
              </button>
              <button className="ghost-btn" onClick={() => void addExercise(day.id, "cardio")}>
                + Cardio
              </button>
              <button className="ghost-btn" onClick={() => void addExercise(day.id, "stairmaster")}>
                + Stairmaster
              </button>
            </div>

            <div className="compact-exercise-list">
              {dayExercises.map((exercise) => (
                <div key={exercise.id} className="compact-exercise-row">
                  <div className="compact-exercise-main">
                    <input
                      id={`exercise-name-${exercise.id}`}
                      value={exercise.name}
                      onChange={(e) => {
                        setExercises((prev) =>
                          prev.map((row) => (row.id === exercise.id ? { ...row, name: e.target.value } : row))
                        );
                        setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                      }}
                      placeholder="Exercise name"
                    />
                    <select
                      value={exercise.exercise_type}
                      onChange={(e) => {
                        setExercises((prev) =>
                          prev.map((row) =>
                            row.id === exercise.id ? { ...row, exercise_type: e.target.value as ExerciseType } : row
                          )
                        );
                        setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                      }}
                    >
                      <option value="weight_lifting">weight_lifting</option>
                      <option value="cardio">cardio</option>
                      <option value="stairmaster">stairmaster</option>
                    </select>
                    <button className="ghost-btn" type="button" onClick={() => void saveExercise(exercise)}>
                      Save
                    </button>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() =>
                        setExpandedExercises((prev) => ({ ...prev, [exercise.id]: !prev[exercise.id] }))
                      }
                    >
                      {expandedExercises[exercise.id] ? "Collapse" : "Expand"}
                    </button>
                    <button className="danger-btn" type="button" onClick={() => void deleteExercise(exercise)}>
                      Delete
                    </button>
                  </div>

                  {expandedExercises[exercise.id] ? (
                    <div className="compact-exercise-details">
                      <label>
                        Description
                        <input
                          value={exercise.description ?? ""}
                          onChange={(e) => {
                            setExercises((prev) =>
                              prev.map((row) => (row.id === exercise.id ? { ...row, description: e.target.value } : row))
                            );
                            setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                          }}
                        />
                      </label>
                      {exercise.exercise_type === "weight_lifting" ? (
                        <>
                          <label>
                            Sets
                            <input
                              type="number"
                              min={1}
                              value={exercise.set_count ?? ""}
                              onChange={(e) => {
                                setExercises((prev) =>
                                  prev.map((row) =>
                                    row.id === exercise.id ? { ...row, set_count: Number(e.target.value || 0) || null } : row
                                  )
                                );
                                setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                              }}
                            />
                          </label>
                          <label>
                            Rep Min
                            <input
                              type="number"
                              min={1}
                              value={exercise.rep_min ?? ""}
                              onChange={(e) => {
                                setExercises((prev) =>
                                  prev.map((row) =>
                                    row.id === exercise.id ? { ...row, rep_min: Number(e.target.value || 0) || null } : row
                                  )
                                );
                                setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                              }}
                            />
                          </label>
                          <label>
                            Rep Max
                            <input
                              type="number"
                              min={1}
                              value={exercise.rep_max ?? ""}
                              onChange={(e) => {
                                setExercises((prev) =>
                                  prev.map((row) =>
                                    row.id === exercise.id ? { ...row, rep_max: Number(e.target.value || 0) || null } : row
                                  )
                                );
                                setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                              }}
                            />
                          </label>
                        </>
                      ) : (
                        <>
                          <label>
                            Duration (min)
                            <input
                              type="number"
                              min={1}
                              value={exercise.target_duration_min ?? ""}
                              onChange={(e) => {
                                setExercises((prev) =>
                                  prev.map((row) =>
                                    row.id === exercise.id
                                      ? { ...row, target_duration_min: Number(e.target.value || 0) || null }
                                      : row
                                  )
                                );
                                setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                              }}
                            />
                          </label>
                          {exercise.exercise_type === "cardio" ? (
                            <label>
                              Distance
                              <input
                                type="number"
                                min={0}
                                step="0.1"
                                value={exercise.target_distance ?? ""}
                                onChange={(e) => {
                                  setExercises((prev) =>
                                    prev.map((row) =>
                                      row.id === exercise.id
                                        ? { ...row, target_distance: Number(e.target.value || 0) || null }
                                        : row
                                    )
                                  );
                                  setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                                }}
                              />
                            </label>
                          ) : (
                            <label>
                              Floors
                              <input
                                type="number"
                                min={1}
                                value={exercise.target_floors ?? ""}
                                onChange={(e) => {
                                  setExercises((prev) =>
                                    prev.map((row) =>
                                      row.id === exercise.id ? { ...row, target_floors: Number(e.target.value || 0) || null } : row
                                    )
                                  );
                                  setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                                }}
                              />
                            </label>
                          )}
                          <label>
                            Pace
                            <input
                              value={exercise.target_pace ?? ""}
                              onChange={(e) => {
                                setExercises((prev) =>
                                  prev.map((row) => (row.id === exercise.id ? { ...row, target_pace: e.target.value } : row))
                                );
                                setDirtyExercises((prev) => ({ ...prev, [exercise.id]: true }));
                              }}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              {dayExercises.length === 0 ? <p className="focus-meta">No exercises yet.</p> : null}
            </div>
          </>
        ) : (
          <p className="focus-meta">This is a rest day. Switch off rest day to edit exercises.</p>
        )}
      </>
    );
  }

  return (
    <section className="panel">
      <h2>Plan Builder</h2>
      <p className="focus-meta">Configure focus plans by phase, week, day, and exercise type.</p>
      {plansLoading ? (
        <div className="empty-state-card" aria-live="polite">
          <p>Loading plans...</p>
        </div>
      ) : null}

      <div className="plan-builder-toolbar plan-builder-toolbar-sticky">
        <label>
          Focus
          <select id="plan-focus" name="plan_focus_id" value={focusId} onChange={(e) => setFocusId(e.target.value)}>
            {focuses.map((focus) => (
              <option key={focus.id} value={focus.id}>
                {focus.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Plan
          <select
            id="plan-select"
            name="plan_id"
            value={planId}
            onChange={(e) => {
              const next = plans.find((p) => p.id === e.target.value);
              setPlanId(e.target.value);
              if (next) {
                setPlanDraft({
                  name: next.name,
                  duration_weeks: String(next.duration_weeks),
                  is_active: next.is_active,
                  status: next.status ?? "draft"
                });
              }
            }}
            disabled={plansLoading || plans.length === 0}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>

        <div className="phase-actions">
          <button onClick={() => void createPlan()} disabled={busyKey === "create-plan"}>
            {busyKey === "create-plan" ? "Creating..." : "New Plan"}
          </button>
          <button
            className="danger-btn"
            type="button"
            onClick={() => void deletePlan()}
            disabled={!planId || busyKey === "delete-plan"}
          >
            {busyKey === "delete-plan" ? "Deleting..." : "Delete Plan"}
          </button>
        </div>
      </div>

      <div className="plan-editor-tabs">
        <button className={editorTab === "setup" ? "ghost-btn active-tab" : "ghost-btn"} type="button" onClick={() => setEditorTab("setup")}>
          Plan Setup
        </button>
        <button
          className={editorTab === "structure" ? "ghost-btn active-tab" : "ghost-btn"}
          type="button"
          onClick={() => setEditorTab("structure")}
        >
          Structure
        </button>
        <button className={editorTab === "day" ? "ghost-btn active-tab" : "ghost-btn"} type="button" onClick={() => setEditorTab("day")}>
          Day Editor
        </button>
      </div>

      {planId ? (
        <>
          {treeLoading ? (
            <div className="empty-state-card" aria-live="polite">
              <p>Loading plan structure...</p>
            </div>
          ) : null}
          {editorTab === "setup" ? (
            <>
          <div className="plan-card">
            <div className="plan-grid">
              <label>
                Plan Name
                <input
                  id="plan-name"
                  name="plan_name"
                  type="text"
                  value={planDraft.name}
                  onChange={(e) => {
                    setPlanDraft((prev) => ({ ...prev, name: e.target.value }));
                    if (planFieldErrors.name) setPlanFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Plan name"
                  autoComplete="off"
                  aria-invalid={Boolean(planFieldErrors.name)}
                  aria-describedby={planFieldErrors.name ? "plan-name-error" : undefined}
                />
              </label>
              {planFieldErrors.name ? (
                <p id="plan-name-error" className="error" aria-live="polite">
                  {planFieldErrors.name}
                </p>
              ) : null}
              <label>
                Duration (weeks)
                <input
                  id="plan-duration-weeks"
                  name="plan_duration_weeks"
                  type="number"
                  min={1}
                  value={planDraft.duration_weeks}
                  onChange={(e) => {
                    setPlanDraft((prev) => ({ ...prev, duration_weeks: e.target.value }));
                    if (planFieldErrors.duration_weeks) setPlanFieldErrors((prev) => ({ ...prev, duration_weeks: undefined }));
                  }}
                  inputMode="numeric"
                  aria-invalid={Boolean(planFieldErrors.duration_weeks)}
                  aria-describedby={planFieldErrors.duration_weeks ? "plan-duration-error" : undefined}
                />
              </label>
              {planFieldErrors.duration_weeks ? (
                <p id="plan-duration-error" className="error" aria-live="polite">
                  {planFieldErrors.duration_weeks}
                </p>
              ) : null}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={planDraft.is_active}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Active Plan
              </label>
              <label>
                Publish State
                <select
                  value={planDraft.status}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, status: e.target.value as "draft" | "published" }))}
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
              </label>
            </div>
            <div className="phase-actions">
              <button className="ghost-btn" onClick={() => void savePlan("draft")} disabled={busyKey === "save-plan"}>
                {busyKey === "save-plan" ? "Saving..." : "Save Draft"}
              </button>
              <button onClick={() => void savePlan("published")} disabled={busyKey === "save-plan"}>
                {busyKey === "save-plan" ? "Saving..." : "Publish Plan"}
              </button>
            </div>
          </div>

          <div className="plan-card">
            <div className="phase-top">
              <strong>CSV Import</strong>
              <label className="checkbox-row">
                <input type="checkbox" checked={replaceOnImport} onChange={(e) => setReplaceOnImport(e.target.checked)} />
                Replace existing structure
              </label>
            </div>
            <div className="csv-helper-actions">
              <button className="ghost-btn" type="button" onClick={downloadCsvTemplate}>
                Download Template
              </button>
            </div>
            <p className="focus-meta">
              Columns: phase_number, phase_title, week_number, week_title, day_number, day_label, is_rest_day, exercise_name,
              exercise_type, set_count, rep_min, rep_max, target_duration_min, target_distance, target_floors, target_pace, sort_order.
            </p>
            <div className="csv-helper-box">
              <strong>Sample rows</strong>
              <pre>{TEMPLATE_SAMPLE_ROWS.join("\n")}</pre>
            </div>
            <label className="file-input-wrap">
              <input type="file" accept=".csv,text/csv" onChange={(e) => void handleCsvFile(e.target.files?.[0] ?? null)} />
              <span>{csvFileName ? `Selected: ${csvFileName}` : "Choose CSV file"}</span>
            </label>
            {csvErrors.length ? (
              <div className="csv-errors">
                {csvErrors.slice(0, 8).map((err, idx) => (
                  <p key={idx} className="error">
                    {err}
                  </p>
                ))}
                {csvErrors.length > 8 ? <p className="error">...and {csvErrors.length - 8} more errors</p> : null}
              </div>
            ) : null}
            {csvPayload ? (
              <div className="csv-summary">
                <span>{csvPayload.phases.length} phases</span>
                <span>{csvPayload.weeks.length} weeks</span>
                <span>{csvPayload.days.length} days</span>
                <span>{csvPayload.exercises.length} exercises</span>
              </div>
            ) : null}
            {csvRows.length ? (
              <div className="csv-preview-wrap">
                <table className="csv-preview">
                  <thead>
                    <tr>
                      <th>Phase</th>
                      <th>Week</th>
                      <th>Day</th>
                      <th>Rest</th>
                      <th>Exercise</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.phase_number}</td>
                        <td>{row.week_number}</td>
                        <td>{row.day_number}</td>
                        <td>{row.is_rest_day ? "yes" : "no"}</td>
                        <td>{row.exercise_name ?? "-"}</td>
                        <td>{row.exercise_type ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <button
              onClick={() => void applyCsvImport()}
              disabled={!csvPayload || csvErrors.length > 0 || busyKey === "apply-csv" || treeLoading}
            >
              {busyKey === "apply-csv" ? "Applying..." : "Apply CSV To Plan"}
            </button>
          </div>
            </>
          ) : null}

          {editorTab === "structure" ? (
            <>
          <div className="plan-structure-workspace">
            <aside className="plan-tree">
              <h4>Hierarchy</h4>
              <div className="plan-tree-scroll">
                {phasesWithWeeks.map(({ phase, weeks: phaseWeeks }) => (
                  <div key={phase.id} className="plan-tree-phase">
                    <button
                      type="button"
                      className={selectedPhaseId === phase.id ? "plan-tree-item selected" : "plan-tree-item"}
                      onClick={() => {
                        setSelectedPhaseId(phase.id);
                        setSelectedWeekId(null);
                        setSelectedDayId(null);
                      }}
                    >
                      {`Phase ${phase.phase_number}: ${phase.title}`}
                    </button>
                    <div className="plan-tree-children">
                      {phaseWeeks.map(({ week, days: weekDays }) => (
                        <div key={week.id}>
                          <button
                            type="button"
                            className={selectedWeekId === week.id ? "plan-tree-item selected" : "plan-tree-item"}
                            onClick={() => {
                              setSelectedWeekId(week.id);
                              setSelectedPhaseId(phase.id);
                              setSelectedDayId(null);
                            }}
                          >
                            {`Week ${week.week_number}: ${week.title}`}
                          </button>
                          <div className="plan-tree-children">
                            {weekDays.map(({ day }) => (
                              <button
                                key={day.id}
                                type="button"
                                className={selectedDayId === day.id ? "plan-tree-item selected" : "plan-tree-item"}
                                onClick={() => {
                                  setSelectedDayId(day.id);
                                  setSelectedWeekId(week.id);
                                  setSelectedPhaseId(phase.id);
                                }}
                              >
                                {`Day ${day.day_number}: ${day.label}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <div className="plan-detail-pane">
              {selectedDay ? (
                <div className="plan-card">
                  <div className="phase-top">
                    <strong>{`Day ${selectedDay.day_number} Editor`}</strong>
                    <span className="focus-meta">{selectedWeek ? `Week ${selectedWeek.week_number}` : ""}</span>
                  </div>
                  {renderFocusedDayEditor(selectedDay)}
                </div>
              ) : selectedWeek ? (
                <div className="plan-card">
                  <div className="phase-top">
                    <strong>{`Week ${selectedWeek.week_number}`}</strong>
                    <div className="phase-actions">
                      <button className="ghost-btn" onClick={() => void duplicateWeek(selectedWeek)} disabled={busyKey === `duplicate-week-${selectedWeek.id}`}>
                        {busyKey === `duplicate-week-${selectedWeek.id}` ? "Duplicating..." : "Duplicate"}
                      </button>
                      <button className="danger-btn" onClick={() => void deleteWeek(selectedWeek)} disabled={busyKey === `delete-week-${selectedWeek.id}`}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="editor-command-bar">
                    <span className="focus-meta">{dirtyWeeks[selectedWeek.id] ? "Unsaved changes" : "All changes saved"}</span>
                    <button className="ghost-btn" type="button" onClick={() => void saveWeek(selectedWeek)} disabled={busyKey === `save-week-${selectedWeek.id}`}>
                      {busyKey === `save-week-${selectedWeek.id}` ? "Saving..." : "Save"}
                    </button>
                  </div>
                  {weekFieldErrors[selectedWeek.id]?.title || weekFieldErrors[selectedWeek.id]?.phase ? (
                    <div className="issues-panel">
                      <strong>Issues</strong>
                      {weekFieldErrors[selectedWeek.id]?.title ? (
                        <button className="ghost-btn issue-item" type="button" onClick={() => focusFieldById(`week-title-${selectedWeek.id}`)}>
                          {weekFieldErrors[selectedWeek.id]?.title}
                        </button>
                      ) : null}
                      {weekFieldErrors[selectedWeek.id]?.phase ? (
                        <button className="ghost-btn issue-item" type="button" onClick={() => focusFieldById(`week-phase-${selectedWeek.id}`)}>
                          {weekFieldErrors[selectedWeek.id]?.phase}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="plan-grid">
                    <label>
                      Week Title
                      <input
                        id={`week-title-${selectedWeek.id}`}
                        value={selectedWeek.title}
                        onChange={(e) => {
                          setWeeks((prev) => prev.map((row) => (row.id === selectedWeek.id ? { ...row, title: e.target.value } : row)));
                          setDirtyWeeks((prev) => ({ ...prev, [selectedWeek.id]: true }));
                        }}
                      />
                    </label>
                    <label>
                      Phase Label
                      <input
                        id={`week-phase-${selectedWeek.id}`}
                        value={selectedWeek.phase}
                        onChange={(e) => {
                          setWeeks((prev) => prev.map((row) => (row.id === selectedWeek.id ? { ...row, phase: e.target.value } : row)));
                          setDirtyWeeks((prev) => ({ ...prev, [selectedWeek.id]: true }));
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : selectedPhase ? (
                <div className="plan-card">
                  <div className="phase-top">
                    <strong>{`Phase ${selectedPhase.phase_number}`}</strong>
                    <div className="phase-actions">
                      <button className="ghost-btn" onClick={() => void addWeek(selectedPhase.id)} disabled={busyKey === `add-week-${selectedPhase.id}`}>
                        + Week
                      </button>
                      <button className="danger-btn" onClick={() => void deletePhase(selectedPhase)} disabled={busyKey === `delete-phase-${selectedPhase.id}`}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="editor-command-bar">
                    <span className="focus-meta">{dirtyPhases[selectedPhase.id] ? "Unsaved changes" : "All changes saved"}</span>
                    <button className="ghost-btn" type="button" onClick={() => void savePhase(selectedPhase)} disabled={busyKey === `save-phase-${selectedPhase.id}`}>
                      {busyKey === `save-phase-${selectedPhase.id}` ? "Saving..." : "Save"}
                    </button>
                  </div>
                  {phaseFieldErrors[selectedPhase.id]?.title ? (
                    <div className="issues-panel">
                      <strong>Issues</strong>
                      <button
                        className="ghost-btn issue-item"
                        type="button"
                        onClick={() => focusFieldById(`phase-title-${selectedPhase.id}`)}
                      >
                        {phaseFieldErrors[selectedPhase.id]?.title}
                      </button>
                    </div>
                  ) : null}
                  <div className="plan-grid">
                    <label>
                      Title
                      <input
                        id={`phase-title-${selectedPhase.id}`}
                        value={selectedPhase.title}
                        onChange={(e) => {
                          setPhases((prev) => prev.map((row) => (row.id === selectedPhase.id ? { ...row, title: e.target.value } : row)));
                          setDirtyPhases((prev) => ({ ...prev, [selectedPhase.id]: true }));
                        }}
                      />
                    </label>
                    <label>
                      Description
                      <input
                        value={selectedPhase.description ?? ""}
                        onChange={(e) => {
                          setPhases((prev) => prev.map((row) => (row.id === selectedPhase.id ? { ...row, description: e.target.value } : row)));
                          setDirtyPhases((prev) => ({ ...prev, [selectedPhase.id]: true }));
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="empty-state-card">
                  <p>Select a phase, week, or day from the hierarchy.</p>
                </div>
              )}
            </div>
          </div>
            </>
          ) : null}

          {editorTab === "day" ? (
            <div className="plan-card">
              <div className="phase-top">
                <strong>Day Editor</strong>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => setEditorTab("structure")}
                >
                  Open Structure
                </button>
              </div>

              <label>
                Select Day
                <select
                  value={selectedDayId ?? ""}
                  onChange={(e) => setSelectedDayId(e.target.value || null)}
                >
                  {phasesWithWeeks.flatMap(({ phase, weeks: phaseWeeks }) =>
                    phaseWeeks.flatMap(({ week, days: weekDays }) =>
                      weekDays.map(({ day }) => (
                        <option key={day.id} value={day.id}>
                          {`P${phase.phase_number} / W${week.week_number} / D${day.day_number} - ${day.label}`}
                        </option>
                      ))
                    )
                  )}
                </select>
              </label>

              {selectedDay ? (
                renderFocusedDayEditor(selectedDay)
              ) : (
                <div className="empty-state-card">
                  <p>Select a day to edit.</p>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state-card">
          <p>No plan for this focus yet.</p>
          <p className="empty-state-sub">Create one to start building phases and weeks.</p>
        </div>
      )}
    </section>
  );
}
