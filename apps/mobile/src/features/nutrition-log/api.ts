import { supabase } from "../../lib/supabase";

export type MealItemRow = {
  id: string;
  meal_id: string;
  name: string;
  estimated_weight_g: number | null;
  quantity_text: string | null;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  calories: number;
  confidence: number | null;
  sort_order: number;
};

export type MealRow = {
  id: string;
  meal_date: string;
  meal_time: string;
  source_type: "ai_photo" | "manual";
  image_path: string | null;
  notes: string | null;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fats_g: number;
  items?: MealItemRow[];
};

export type DailyMacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export async function getCurrentUserId() {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function fetchMealsByDate(userId: string, date: string): Promise<MealRow[]> {
  const { data, error } = await supabase
    .from("user_meals")
    .select(
      "id,meal_date,meal_time,source_type,image_path,notes,total_calories,total_protein_g,total_carbs_g,total_fats_g,user_meal_items(id,meal_id,name,estimated_weight_g,quantity_text,protein_g,carbs_g,fats_g,calories,confidence,sort_order)"
    )
    .eq("user_id", userId)
    .eq("meal_date", date)
    .order("meal_time", { ascending: false });
  if (error) throw error;
  return ((data as Array<any>) ?? []).map((row) => ({
    ...row,
    items: (row.user_meal_items as MealItemRow[]) ?? []
  }));
}

export async function fetchRecentMeals(userId: string, days = 14): Promise<MealRow[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fromDate = start.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("user_meals")
    .select(
      "id,meal_date,meal_time,source_type,image_path,notes,total_calories,total_protein_g,total_carbs_g,total_fats_g,user_meal_items(id,meal_id,name,estimated_weight_g,quantity_text,protein_g,carbs_g,fats_g,calories,confidence,sort_order)"
    )
    .eq("user_id", userId)
    .gte("meal_date", fromDate)
    .order("meal_date", { ascending: false })
    .order("meal_time", { ascending: false });
  if (error) throw error;
  return ((data as Array<any>) ?? []).map((row) => ({
    ...row,
    items: (row.user_meal_items as MealItemRow[]) ?? []
  }));
}

export async function fetchDailyMacroTotals(userId: string, date: string): Promise<DailyMacroTotals> {
  const meals = await fetchMealsByDate(userId, date);
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + Number(meal.total_calories ?? 0),
      protein: acc.protein + Number(meal.total_protein_g ?? 0),
      carbs: acc.carbs + Number(meal.total_carbs_g ?? 0),
      fats: acc.fats + Number(meal.total_fats_g ?? 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

export async function fetchMacroTargets(userId: string) {
  const { data, error } = await supabase
    .from("user_nutrition_profiles")
    .select("daily_calories,protein_g,carbs_g,fats_g")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    calories: Number((data as any)?.daily_calories ?? 0),
    protein: Number((data as any)?.protein_g ?? 0),
    carbs: Number((data as any)?.carbs_g ?? 0),
    fats: Number((data as any)?.fats_g ?? 0)
  };
}
