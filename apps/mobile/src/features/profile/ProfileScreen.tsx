import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/theme";
import { useCurrentFocus } from "../focus/useCurrentFocus";

type WeightUnit = "lb" | "kg";
type DistanceUnit = "km" | "mi";

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentFocus, currentFocusId, focuses, setCurrentFocus, loading: focusLoading } = useCurrentFocus();
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lb");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");
  const [focusPickerOpen, setFocusPickerOpen] = useState(false);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<{ calories: number; protein: number; carbs: number; fats: number } | null>(null);

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
      if (data.preferred_weight_unit === "lb" || data.preferred_weight_unit === "kg") {
        setWeightUnit(data.preferred_weight_unit);
      }
      if (data.preferred_distance_unit === "km" || data.preferred_distance_unit === "mi") {
        setDistanceUnit(data.preferred_distance_unit);
      }
    }
    void loadPreferences();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadActivePlan() {
      if (!currentFocusId) {
        setActivePlanName(null);
        return;
      }
      const { data, error } = await supabase
        .from("training_plans")
        .select("name")
        .eq("focus_id", currentFocusId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setActivePlanName(null);
        return;
      }
      setActivePlanName((data?.name as string | undefined) ?? null);
    }
    void loadActivePlan();
    return () => {
      active = false;
    };
  }, [currentFocusId]);

  useEffect(() => {
    let active = true;
    async function loadNutrition() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_nutrition_profiles")
        .select("daily_calories,protein_g,carbs_g,fats_g")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active || !data) return;
      setNutrition({
        calories: Number((data as any).daily_calories ?? 0),
        protein: Number((data as any).protein_g ?? 0),
        carbs: Number((data as any).carbs_g ?? 0),
        fats: Number((data as any).fats_g ?? 0)
      });
    }
    void loadNutrition();
    return () => {
      active = false;
    };
  }, []);

  async function saveWeightUnit(next: WeightUnit) {
    setWeightUnit(next);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ preferred_weight_unit: next }).eq("id", user.id);
  }

  async function saveDistanceUnit(next: DistanceUnit) {
    setDistanceUnit(next);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ preferred_distance_unit: next }).eq("id", user.id);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.sm }]}>
      <Text style={styles.title}>Profile & Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Focus</Text>
        <Text style={styles.value}>{currentFocus?.name ?? (focusLoading ? "Loading..." : "Unselected")}</Text>
        <Pressable style={styles.inlineButton} onPress={() => setFocusPickerOpen(true)}>
          <Text style={styles.inlineButtonText}>Change Focus</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Plan</Text>
        <Text style={styles.value}>{activePlanName ?? "No active plan for selected focus"}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Weight Unit</Text>
        <View style={styles.optionRow}>
          <Pressable
            style={[styles.option, weightUnit === "lb" && styles.optionActive]}
            onPress={() => void saveWeightUnit("lb")}
          >
            <Text style={styles.optionText}>Pounds (lb)</Text>
          </Pressable>
          <Pressable
            style={[styles.option, weightUnit === "kg" && styles.optionActive]}
            onPress={() => void saveWeightUnit("kg")}
          >
            <Text style={styles.optionText}>Kilograms (kg)</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Distance Unit</Text>
        <View style={styles.optionRow}>
          <Pressable
            style={[styles.option, distanceUnit === "km" && styles.optionActive]}
            onPress={() => void saveDistanceUnit("km")}
          >
            <Text style={styles.optionText}>Kilometers (km)</Text>
          </Pressable>
          <Pressable
            style={[styles.option, distanceUnit === "mi" && styles.optionActive]}
            onPress={() => void saveDistanceUnit("mi")}
          >
            <Text style={styles.optionText}>Miles (mi)</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Daily Nutrition Targets</Text>
        <Text style={styles.value}>{nutrition ? `${nutrition.calories} kcal` : "Not set"}</Text>
        {nutrition ? (
          <Text style={styles.mutedLine}>{`Protein ${nutrition.protein}g  •  Carbs ${nutrition.carbs}g  •  Fats ${nutrition.fats}g`}</Text>
        ) : null}
      </View>
      <Pressable style={styles.button} onPress={() => void supabase.auth.signOut()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>

      <Modal visible={focusPickerOpen} animationType="slide" onRequestClose={() => setFocusPickerOpen(false)}>
        <View style={[styles.modalScreen, { paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Focus</Text>
            <Pressable style={styles.inlineButton} onPress={() => setFocusPickerOpen(false)}>
              <Text style={styles.inlineButtonText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.focusList}>
            {focuses.map((focus) => (
              <Pressable
                key={focus.id}
                style={[styles.focusCard, currentFocus?.id === focus.id && styles.focusCardActive]}
                onPress={() => {
                  void setCurrentFocus(focus.id);
                  setFocusPickerOpen(false);
                }}
              >
                {focus.imageUrl ? <Image source={{ uri: focus.imageUrl }} style={styles.focusImage} /> : null}
                <Text style={styles.focusName}>{focus.name}</Text>
                <Text style={styles.focusMeta}>{focus.slug}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title1,
    fontWeight: "800",
    marginBottom: theme.spacing.md
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  label: {
    color: theme.colors.textMuted
  },
  value: {
    color: theme.colors.textPrimary,
    marginTop: 4,
    fontWeight: "700"
  },
  mutedLine: {
    color: theme.colors.textMuted,
    marginTop: 6
  },
  optionRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: 8
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingVertical: 9,
    alignItems: "center"
  },
  optionActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#2D1C0C"
  },
  optionText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: theme.typography.caption
  },
  inlineButton: {
    marginTop: theme.spacing.sm,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  inlineButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  button: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    alignItems: "center"
  },
  buttonText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  modalScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subtitle,
    fontWeight: "800"
  },
  focusList: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl
  },
  focusCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.xs
  },
  focusCardActive: {
    borderColor: theme.colors.accent
  },
  focusImage: {
    width: "100%",
    height: 140,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface
  },
  focusName: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.subtitle
  },
  focusMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption
  }
});
