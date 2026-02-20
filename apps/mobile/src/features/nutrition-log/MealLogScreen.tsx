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
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/theme";
import { fetchDailyMacroTotals, fetchMacroTargets, fetchRecentMeals, getCurrentUserId, type MealRow } from "./api";

type DraftItem = {
  id: string;
  name: string;
  estimated_weight_g: string;
  quantity_text: string;
  protein_g: string;
  carbs_g: string;
  fats_g: string;
  calories: string;
  confidence: string;
};

function newItem(partial?: Partial<DraftItem>): DraftItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: partial?.name ?? "",
    estimated_weight_g: partial?.estimated_weight_g ?? "",
    quantity_text: partial?.quantity_text ?? "",
    protein_g: partial?.protein_g ?? "",
    carbs_g: partial?.carbs_g ?? "",
    fats_g: partial?.fats_g ?? "",
    calories: partial?.calories ?? "",
    confidence: partial?.confidence ?? ""
  };
}

export function MealLogScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [targets, setTargets] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [recentMeals, setRecentMeals] = useState<MealRow[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [draftImagePath, setDraftImagePath] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    setLoading(true);
    const uid = await getCurrentUserId();
    setUserId(uid);
    if (!uid) {
      setLoading(false);
      return;
    }
    const [macroTargets, dayTotals, meals] = await Promise.all([
      fetchMacroTargets(uid),
      fetchDailyMacroTotals(uid, today),
      fetchRecentMeals(uid, 14)
    ]);
    setTargets(macroTargets);
    setTotals(dayTotals);
    setRecentMeals(meals);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const draftTotals = useMemo(
    () =>
      draftItems.reduce(
        (acc, item) => ({
          calories: acc.calories + (Number(item.calories) || 0),
          protein: acc.protein + (Number(item.protein_g) || 0),
          carbs: acc.carbs + (Number(item.carbs_g) || 0),
          fats: acc.fats + (Number(item.fats_g) || 0)
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      ),
    [draftItems]
  );

  async function analyzeWithAi(imageBase64: string, mimeType: string) {
    const {
      data: { session: initialSession }
    } = await supabase.auth.getSession();
    let session = initialSession;
    if (!session || (session.expires_at ?? 0) * 1000 < Date.now() + 30_000) {
      const { data, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) throw refreshErr;
      session = data.session;
    }
    if (!session?.access_token) {
      throw new Error("Session expired. Please sign in again.");
    }

    const { data, error } = await supabase.functions.invoke("analyze-meal", {
      body: { imageBase64, mimeType, note: draftNote || undefined },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      throw new Error(error.message || "Could not analyze meal.");
    }

    return (data ?? { components: [] }) as { components: Array<any> };
  }

  async function scanMeal() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission required", "Enable camera permission to scan meals.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    if (!asset.base64) {
      Alert.alert("Image failed", "Could not read image data.");
      return;
    }
    try {
      setSaving(true);
      const analysis = await analyzeWithAi(asset.base64, mimeType);
      setDraftItems(
        (analysis.components ?? []).map((item) =>
          newItem({
            name: String(item.name ?? ""),
            estimated_weight_g: item.estimated_weight_g != null ? String(item.estimated_weight_g) : "",
            quantity_text: String(item.quantity_text ?? ""),
            protein_g: item.protein_g != null ? String(item.protein_g) : "",
            carbs_g: item.carbs_g != null ? String(item.carbs_g) : "",
            fats_g: item.fats_g != null ? String(item.fats_g) : "",
            calories: item.calories != null ? String(item.calories) : "",
            confidence: item.confidence != null ? String(item.confidence) : ""
          })
        )
      );
      setDraftImagePath(null);
      setDraftOpen(true);
    } catch (err) {
      Alert.alert("AI analysis failed", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDraftMeal() {
    if (!userId) return;
    const cleanItems = draftItems
      .map((item, idx) => ({
        name: item.name.trim(),
        estimated_weight_g: Number(item.estimated_weight_g) || null,
        quantity_text: item.quantity_text.trim() || null,
        protein_g: Number(item.protein_g) || 0,
        carbs_g: Number(item.carbs_g) || 0,
        fats_g: Number(item.fats_g) || 0,
        calories: Number(item.calories) || 0,
        confidence: Number(item.confidence) || null,
        sort_order: idx
      }))
      .filter((item) => item.name.length > 0);
    if (cleanItems.length === 0) {
      Alert.alert("Add items", "Please add at least one meal item.");
      return;
    }
    setSaving(true);
    try {
      const { data: meal, error: mealErr } = await supabase
        .from("user_meals")
        .insert({
          user_id: userId,
          meal_date: today,
          meal_time: new Date().toISOString(),
          source_type: draftImagePath ? "ai_photo" : "manual",
          image_path: draftImagePath,
          notes: draftNote || null,
          total_calories: Math.round(draftTotals.calories),
          total_protein_g: draftTotals.protein,
          total_carbs_g: draftTotals.carbs,
          total_fats_g: draftTotals.fats
        })
        .select("id")
        .single();
      if (mealErr || !meal) throw mealErr ?? new Error("Could not save meal.");

      const { error: itemsErr } = await supabase.from("user_meal_items").insert(
        cleanItems.map((item) => ({
          meal_id: (meal as any).id,
          ...item
        }))
      );
      if (itemsErr) throw itemsErr;

      setDraftOpen(false);
      setDraftItems([]);
      setDraftNote("");
      setDraftImagePath(null);
      await load();
    } catch (err) {
      Alert.alert("Save failed", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.sm }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 100, 120) }]}>
        <View style={styles.hero}>
          <Text style={styles.title}>Macro Log</Text>
          <Text style={styles.subtitle}>Track meals and stay aligned with your daily targets.</Text>
        </View>

        <View style={styles.metrics}>
          <Metric title="Calories" value={`${Math.round(totals.calories)} / ${Math.round(targets.calories)}`} />
          <Metric title="Protein" value={`${Math.round(totals.protein)}g / ${Math.round(targets.protein)}g`} />
          <Metric title="Carbs" value={`${Math.round(totals.carbs)}g / ${Math.round(targets.carbs)}g`} />
          <Metric title="Fats" value={`${Math.round(totals.fats)}g / ${Math.round(targets.fats)}g`} />
        </View>

        <Pressable style={styles.scanButton} onPress={() => void scanMeal()}>
          <Text style={styles.scanButtonText}>{saving ? "Analyzing..." : "Scan Meal With AI"}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            setDraftItems([newItem()]);
            setDraftNote("");
            setDraftImagePath(null);
            setDraftOpen(true);
          }}
        >
          <Text style={styles.secondaryButtonText}>Log Manual Meal</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Recent Meals</Text>
        {recentMeals.map((meal) => (
          <View key={meal.id} style={styles.mealCard}>
            <Text style={styles.mealTitle}>{new Date(meal.meal_time).toLocaleString()}</Text>
            <Text style={styles.mealMeta}>
              {`${Math.round(meal.total_calories)} kcal • P ${Math.round(meal.total_protein_g)} • C ${Math.round(meal.total_carbs_g)} • F ${Math.round(meal.total_fats_g)}`}
            </Text>
            {(meal.items ?? []).map((item) => (
              <Text key={item.id} style={styles.itemText}>
                {`• ${item.name} (${Math.round(item.calories)} kcal, P ${Math.round(item.protein_g)} / C ${Math.round(item.carbs_g)} / F ${Math.round(item.fats_g)}${item.estimated_weight_g ? `, ${Math.round(item.estimated_weight_g)}g` : ""
                  }${item.quantity_text ? `, ${item.quantity_text}` : ""}${item.confidence != null ? `, conf ${Math.round(item.confidence * 100)}%` : ""})`}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={draftOpen} animationType="slide" onRequestClose={() => setDraftOpen(false)}>
        <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.sm }]}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom + 24) }]}>
            <Text style={styles.title}>Review Meal</Text>
            <TextInput
              placeholder="Meal note"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={draftNote}
              onChangeText={setDraftNote}
            />
            {draftItems.map((item) => (
              <View key={item.id} style={styles.editCard}>
                <TextInput
                  style={styles.input}
                  placeholder="Food item"
                  placeholderTextColor={theme.colors.textMuted}
                  value={item.name}
                  onChangeText={(value) => setDraftItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, name: value } : x)))}
                />
                <View style={styles.inlineRow}>
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    placeholder="Qty/weight g"
                    placeholderTextColor={theme.colors.textMuted}
                    value={item.estimated_weight_g}
                    onChangeText={(value) =>
                      setDraftItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, estimated_weight_g: value } : x)))
                    }
                  />
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    placeholder="P"
                    placeholderTextColor={theme.colors.textMuted}
                    value={item.protein_g}
                    onChangeText={(value) => setDraftItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, protein_g: value } : x)))}
                  />
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    placeholder="C"
                    placeholderTextColor={theme.colors.textMuted}
                    value={item.carbs_g}
                    onChangeText={(value) => setDraftItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, carbs_g: value } : x)))}
                  />
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    placeholder="F"
                    placeholderTextColor={theme.colors.textMuted}
                    value={item.fats_g}
                    onChangeText={(value) => setDraftItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, fats_g: value } : x)))}
                  />
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    placeholder="kcal"
                    placeholderTextColor={theme.colors.textMuted}
                    value={item.calories}
                    onChangeText={(value) => setDraftItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, calories: value } : x)))}
                  />
                </View>
                <Pressable style={styles.removeButton} onPress={() => setDraftItems((prev) => prev.filter((x) => x.id !== item.id))}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.secondaryButton} onPress={() => setDraftItems((prev) => [...prev, newItem()])}>
              <Text style={styles.secondaryButtonText}>Add Component</Text>
            </Pressable>

            <View style={styles.metrics}>
              <Metric title="Calories" value={`${Math.round(draftTotals.calories)}`} />
              <Metric title="Protein" value={`${Math.round(draftTotals.protein)}g`} />
              <Metric title="Carbs" value={`${Math.round(draftTotals.carbs)}g`} />
              <Metric title="Fats" value={`${Math.round(draftTotals.fats)}g`} />
            </View>

            <Pressable style={styles.scanButton} onPress={() => void saveDraftMeal()}>
              <Text style={styles.scanButtonText}>{saving ? "Saving..." : "Save Meal"}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setDraftOpen(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  center: {
    justifyContent: "center",
    alignItems: "center"
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md
  },
  hero: {
    gap: 4
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title1,
    fontWeight: "800"
  },
  subtitle: {
    color: theme.colors.textSecondary
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.subtitle
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metricCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 10,
    minWidth: 140
  },
  metricTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption
  },
  metricValue: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    marginTop: 2
  },
  scanButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  scanButtonText: {
    color: "#2B1700",
    fontWeight: "800"
  },
  mealCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6
  },
  mealTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  mealMeta: {
    color: theme.colors.textMuted
  },
  itemText: {
    color: theme.colors.textSecondary
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  editCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.sm,
    gap: 8
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  inlineInput: {
    minWidth: 70
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceElevated
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  removeButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#7A2E2E",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  removeButtonText: {
    color: "#F3BABA",
    fontWeight: "700"
  }
});
