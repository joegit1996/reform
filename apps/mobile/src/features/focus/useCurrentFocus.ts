import { createContext, createElement, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export type FocusOption = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
};

type FocusState = {
  loading: boolean;
  error: string | null;
  currentFocusId: string | null;
  currentFocus: FocusOption | null;
  focuses: FocusOption[];
  setCurrentFocus: (focusId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const FocusContext = createContext<FocusState | null>(null);

function useProvideCurrentFocus(): FocusState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFocusId, setCurrentFocusId] = useState<string | null>(null);
  const [focuses, setFocuses] = useState<FocusOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setCurrentFocusId(null);
        setFocuses([]);
        return;
      }

      const { data: focusRows, error: focusErr } = await supabase
        .from("focuses")
        .select("id,slug,name,image_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (focusErr) throw focusErr;
      const available = ((focusRows as Array<any>) ?? []).map((row) => ({
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        imageUrl: (row.image_url as string | null) ?? null
      }));
      setFocuses(available);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("current_focus_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profileErr) throw profileErr;

      let nextFocusId = (profile?.current_focus_id as string | null) ?? null;
      if (!nextFocusId && available.length > 0) {
        nextFocusId = available[0].id;
        await supabase.from("profiles").update({ current_focus_id: nextFocusId }).eq("id", user.id);
      }
      setCurrentFocusId(nextFocusId);
    } catch (err) {
      setError((err as Error).message ?? "Unable to load focus.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setCurrentFocus = useCallback(
    async (focusId: string) => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ current_focus_id: focusId })
        .eq("id", user.id);
      if (updateErr) throw updateErr;
      setCurrentFocusId(focusId);
    },
    []
  );

  const currentFocus = focuses.find((focus) => focus.id === currentFocusId) ?? null;
  return useMemo(
    () => ({ loading, error, currentFocusId, currentFocus, focuses, setCurrentFocus, refresh: load }),
    [loading, error, currentFocusId, currentFocus, focuses, setCurrentFocus, load]
  );
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const value = useProvideCurrentFocus();
  return createElement(FocusContext.Provider, { value }, children);
}

export function useCurrentFocus(): FocusState {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useCurrentFocus must be used inside FocusProvider.");
  }
  return context;
}
