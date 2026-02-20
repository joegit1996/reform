import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/theme";
import {
  calculateNutritionTargets,
  type ActivityLevel,
  type FitnessGoal,
  type Sex
} from "./calculator";

type Props = {
  onComplete: () => void;
};

export function NutritionOnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [sex, setSex] = useState<Sex>("male");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<FitnessGoal>("maintenance");
  const [age, setAge] = useState("30");
  const [heightCm, setHeightCm] = useState("175");
  const [weightKg, setWeightKg] = useState("80");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(
    () => ({
      age: Number(age),
      heightCm: Number(heightCm),
      weightKg: Number(weightKg)
    }),
    [age, heightCm, weightKg]
  );

  const targets = useMemo(() => {
    if (!Number.isFinite(parsed.age) || !Number.isFinite(parsed.heightCm) || !Number.isFinite(parsed.weightKg)) return null;
    if (parsed.age < 13 || parsed.age > 99) return null;
    if (parsed.heightCm < 120 || parsed.heightCm > 240) return null;
    if (parsed.weightKg < 35 || parsed.weightKg > 300) return null;
    return calculateNutritionTargets({
      sex,
      age: parsed.age,
      heightCm: parsed.heightCm,
      weightKg: parsed.weightKg,
      activityLevel,
      goal
    });
  }, [activityLevel, goal, parsed.age, parsed.heightCm, parsed.weightKg, sex]);

  async function save() {
    if (!targets) {
      setError("Please enter valid values.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired. Please sign in again.");

      const { error: upsertErr } = await supabase.from("user_nutrition_profiles").upsert({
        user_id: user.id,
        sex,
        age: parsed.age,
        height_cm: parsed.heightCm,
        weight_kg: parsed.weightKg,
        activity_level: activityLevel,
        goal,
        daily_calories: targets.dailyCalories,
        protein_g: targets.proteinG,
        carbs_g: targets.carbsG,
        fats_g: targets.fatsG,
        updated_at: new Date().toISOString()
      });
      if (upsertErr) throw upsertErr;
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.md }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}>
        <Text style={styles.title}>Nutrition Setup</Text>
        <Text style={styles.subtitle}>Set your body data and goal to calculate daily calories and macros.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Sex</Text>
          <View style={styles.row}>
            <Choice label="Male" active={sex === "male"} onPress={() => setSex("male")} />
            <Choice label="Female" active={sex === "female"} onPress={() => setSex("female")} />
          </View>

          <Text style={styles.label}>Age</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={age} onChangeText={setAge} />

          <Text style={styles.label}>Height (cm)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={heightCm} onChangeText={setHeightCm} />

          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} />

          <Text style={styles.label}>Activity</Text>
          <View style={styles.wrapRow}>
            {(
              [
                ["sedentary", "Sedentary"],
                ["light", "Light"],
                ["moderate", "Moderate"],
                ["very_active", "Very Active"],
                ["athlete", "Athlete"]
              ] as Array<[ActivityLevel, string]>
            ).map(([value, label]) => (
              <Choice key={value} label={label} active={activityLevel === value} onPress={() => setActivityLevel(value)} />
            ))}
          </View>

          <Text style={styles.label}>Goal</Text>
          <View style={styles.wrapRow}>
            {(
              [
                ["fat_loss", "Fat Loss"],
                ["maintenance", "Maintenance"],
                ["muscle_gain", "Muscle Gain"]
              ] as Array<[FitnessGoal, string]>
            ).map(([value, label]) => (
              <Choice key={value} label={label} active={goal === value} onPress={() => setGoal(value)} />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.summaryTitle}>Daily Targets</Text>
          <Text style={styles.summaryLine}>Calories: {targets ? `${targets.dailyCalories} kcal` : "--"}</Text>
          <Text style={styles.summaryLine}>Protein: {targets ? `${targets.proteinG} g` : "--"}</Text>
          <Text style={styles.summaryLine}>Carbs: {targets ? `${targets.carbsG} g` : "--"}</Text>
          <Text style={styles.summaryLine}>Fats: {targets ? `${targets.fatsG} g` : "--"}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} disabled={busy} onPress={() => void save()}>
          {busy ? <ActivityIndicator color="#2B1700" /> : <Text style={styles.buttonText}>Save Nutrition Plan</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title1,
    fontWeight: "800"
  },
  subtitle: {
    color: theme.colors.textSecondary
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.md,
    gap: theme.spacing.xs
  },
  label: {
    marginTop: 8,
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choice: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface
  },
  choiceActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#2D1C0C"
  },
  choiceText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  choiceTextActive: {
    color: theme.colors.accent
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  summaryTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    marginBottom: 4
  },
  summaryLine: {
    color: theme.colors.textSecondary
  },
  error: {
    color: "#FF7F7F"
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  buttonText: {
    color: "#2B1700",
    fontWeight: "800"
  }
});
