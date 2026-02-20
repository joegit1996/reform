import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../src/lib/supabase";
import { AuthScreen } from "../src/features/profile/AuthScreen";
import { FocusProvider } from "../src/features/focus/useCurrentFocus";
import { NutritionOnboardingScreen } from "../src/features/nutrition/NutritionOnboardingScreen";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [nutritionReady, setNutritionReady] = useState(false);
  const [checkingNutrition, setCheckingNutrition] = useState(true);

  async function ensureProfileAndNutrition(nextSession: Session | null) {
    if (!nextSession?.user?.id) {
      setNutritionReady(false);
      setCheckingNutrition(false);
      return;
    }
    setCheckingNutrition(true);
    const user = nextSession.user;
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? "unknown@example.com",
      role: "user",
      updated_at: new Date().toISOString()
    });

    const { data: nutrition } = await supabase
      .from("user_nutrition_profiles")
      .select("daily_calories,protein_g,carbs_g,fats_g")
      .eq("user_id", user.id)
      .maybeSingle();
    const complete =
      Number((nutrition as any)?.daily_calories ?? 0) > 0 &&
      Number((nutrition as any)?.protein_g ?? 0) > 0 &&
      Number((nutrition as any)?.carbs_g ?? 0) >= 0 &&
      Number((nutrition as any)?.fats_g ?? 0) > 0;
    setNutritionReady(complete);
    setCheckingNutrition(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await ensureProfileAndNutrition(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await ensureProfileAndNutrition(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!session) return <AuthScreen />;
  if (checkingNutrition) return null;
  if (!nutritionReady) {
    return <NutritionOnboardingScreen onComplete={() => setNutritionReady(true)} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <FocusProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </FocusProvider>
    </>
  );
}
