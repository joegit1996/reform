import { useEffect, useMemo, useState } from "react";
import { AdminAuthPanel } from "../components/AdminAuthPanel";
import { DocumentUpload } from "../components/DocumentUpload";
import { PlanBuilder } from "../components/PlanBuilder";
import { supabase } from "../lib/supabase";

type DocRow = {
  id: string;
  title: string;
  source_type: "markdown" | "pdf";
  scope: "focus" | "global";
  storage_path: string;
  status: string;
  created_at?: string;
  focuses?: { name: string };
};

type FocusRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

type FocusDraft = {
  name: string;
  slug: string;
  image_url: string;
  is_active: boolean;
};

type Notice = {
  id: string;
  kind: "success" | "error" | "info";
  message: string;
};

type FocusFieldErrors = {
  name?: string;
  slug?: string;
  image?: string;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function draftFromFocus(focus: FocusRow): FocusDraft {
  return {
    name: focus.name,
    slug: focus.slug,
    image_url: focus.image_url ?? "",
    is_active: focus.is_active
  };
}

export function DocumentsPage() {
  const [activePage, setActivePage] = useState<"focuses" | "documents" | "plans">("focuses");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [focuses, setFocuses] = useState<FocusRow[]>([]);
  const [focusDrafts, setFocusDrafts] = useState<Record<string, FocusDraft>>({});
  const [focusImageFiles, setFocusImageFiles] = useState<Record<string, File | null>>({});
  const [expandedFocusId, setExpandedFocusId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortMode, setSortMode] = useState<"manual" | "az" | "recent">("manual");

  const [newFocusName, setNewFocusName] = useState("");
  const [newFocusSlug, setNewFocusSlug] = useState("");
  const [newFocusSlugTouched, setNewFocusSlugTouched] = useState(false);
  const [newFocusImageUrl, setNewFocusImageUrl] = useState("");
  const [newFocusImageFile, setNewFocusImageFile] = useState<File | null>(null);
  const [newFocusImageMode, setNewFocusImageMode] = useState<"upload" | "url">("upload");
  const [newFocusActive, setNewFocusActive] = useState(true);

  const [focusError, setFocusError] = useState<string | null>(null);
  const [createFocusErrors, setCreateFocusErrors] = useState<FocusFieldErrors>({});
  const [docsError, setDocsError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [focusesLoading, setFocusesLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState<"all" | "ready" | "processing" | "error">("all");
  const [docScopeFilter, setDocScopeFilter] = useState<"all" | "focus" | "global">("all");
  const [docSortMode, setDocSortMode] = useState<"recent" | "title_az" | "status">("recent");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [docsBatchBusy, setDocsBatchBusy] = useState<null | "reindex" | "delete">(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [focusRefreshToken, setFocusRefreshToken] = useState(0);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const filteredFocuses = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = [...focuses];
    if (statusFilter === "active") list = list.filter((f) => f.is_active);
    if (statusFilter === "inactive") list = list.filter((f) => !f.is_active);
    if (query) list = list.filter((f) => f.name.toLowerCase().includes(query) || f.slug.toLowerCase().includes(query));

    if (sortMode === "az") return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === "recent") return list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [focuses, search, statusFilter, sortMode]);

  const createSlugPreview = slugify(newFocusSlug || newFocusName);
  const hasCreateImage = newFocusImageMode === "upload" ? Boolean(newFocusImageFile) : Boolean(newFocusImageUrl.trim());
  const canCreateFocus = Boolean(newFocusName.trim() && createSlugPreview && hasCreateImage && busyId !== "create-focus");

  const filteredDocs = useMemo(() => {
    const query = docSearch.trim().toLowerCase();
    let list = [...docs];
    if (docStatusFilter !== "all") list = list.filter((doc) => doc.status === docStatusFilter);
    if (docScopeFilter !== "all") list = list.filter((doc) => doc.scope === docScopeFilter);
    if (query) {
      list = list.filter((doc) => {
        const focusName = doc.scope === "global" ? "global" : (doc.focuses?.name ?? "unknown");
        return (
          doc.title.toLowerCase().includes(query) ||
          focusName.toLowerCase().includes(query) ||
          doc.source_type.toLowerCase().includes(query)
        );
      });
    }
    if (docSortMode === "title_az") {
      return list.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (docSortMode === "status") {
      const rank: Record<string, number> = { processing: 0, error: 1, ready: 2 };
      return list.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.title.localeCompare(b.title));
    }
    return list.sort((a, b) => +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0));
  }, [docs, docScopeFilter, docSearch, docSortMode, docStatusFilter]);
  const selectedDocs = useMemo(() => docs.filter((doc) => selectedDocIds.includes(doc.id)), [docs, selectedDocIds]);
  const visibleSelectableDocs = useMemo(() => filteredDocs.filter((doc) => doc.status !== "processing"), [filteredDocs]);
  const selectedVisibleIds = useMemo(
    () => visibleSelectableDocs.map((doc) => doc.id).filter((id) => selectedDocIds.includes(id)),
    [selectedDocIds, visibleSelectableDocs]
  );
  const allVisibleSelected = visibleSelectableDocs.length > 0 && selectedVisibleIds.length === visibleSelectableDocs.length;

  function isDraftDirty(focus: FocusRow): boolean {
    const draft = focusDrafts[focus.id] ?? draftFromFocus(focus);
    const hasFieldDiff =
      draft.name !== focus.name ||
      draft.slug !== focus.slug ||
      draft.image_url !== (focus.image_url ?? "") ||
      draft.is_active !== focus.is_active;
    return hasFieldDiff || Boolean(focusImageFiles[focus.id]);
  }

  function pushNotice(kind: Notice["kind"], message: string) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setNotices((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setNotices((prev) => prev.filter((notice) => notice.id !== id));
    }, 4200);
  }

  async function refreshAuth() {
    setAuthError(null);
    const {
      data: { session }
    } = await supabase.auth.getSession();
    setIsAuthenticated(Boolean(session?.access_token));
    if (!session?.user?.id) {
      setIsAdmin(false);
      setSessionReady(true);
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profileErr) {
      setAuthError(profileErr.message);
      setIsAdmin(false);
      setSessionReady(true);
      return;
    }
    setIsAdmin(profile?.role === "admin");
    setSessionReady(true);
  }

  async function loadDocs() {
    setDocsLoading(true);
    setDocsError(null);
    const { data, error: loadErr } = await supabase
      .from("documents")
      .select("id,title,source_type,scope,storage_path,status,created_at,focuses(name)")
      .order("created_at", { ascending: false });
    if (loadErr) {
      setDocsError(loadErr.message);
      setDocsLoading(false);
      return;
    }
    setDocs((data as DocRow[]) ?? []);
    setDocsLoading(false);
  }

  async function loadFocuses() {
    setFocusesLoading(true);
    setFocusError(null);
    const { data, error: loadErr } = await supabase
      .from("focuses")
      .select("id,name,slug,image_url,is_active,sort_order,created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (loadErr) {
      setFocusError(loadErr.message);
      setFocusesLoading(false);
      return;
    }
    const rows = (data as FocusRow[]) ?? [];
    setFocuses(rows);
    setFocusDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        next[row.id] = next[row.id] ?? draftFromFocus(row);
      }
      return next;
    });
    setFocusesLoading(false);
  }

  async function uploadFocusImage(file: File, focusSlug: string): Promise<string> {
    const path = `focus-images/${focusSlug}-${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("knowledge_docs").upload(path, file, { upsert: false });
    if (uploadErr) throw uploadErr;
    const { data } = supabase.storage.from("knowledge_docs").getPublicUrl(path);
    return data.publicUrl;
  }

  function resetCreateForm() {
    setNewFocusName("");
    setNewFocusSlug("");
    setNewFocusSlugTouched(false);
    setNewFocusImageUrl("");
    setNewFocusImageFile(null);
    setNewFocusImageMode("upload");
    setNewFocusActive(true);
    setCreateFocusErrors({});
  }

  async function createFocus() {
    const nextFieldErrors: FocusFieldErrors = {};
    const name = newFocusName.trim();
    if (!name) nextFieldErrors.name = "Focus name is required.";

    const slug = slugify(newFocusSlug || name);
    if (!slug) nextFieldErrors.slug = "Focus slug is invalid.";

    if (focuses.some((focus) => focus.slug === slug)) nextFieldErrors.slug = "Focus slug already exists.";

    if (newFocusImageMode === "upload" && !newFocusImageFile) {
      nextFieldErrors.image = "Upload an image or switch to URL mode.";
    }
    if (newFocusImageMode === "url" && !newFocusImageUrl.trim()) {
      nextFieldErrors.image = "Image URL is required in URL mode.";
    }

    setCreateFocusErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length) {
      setFocusError(null);
      return;
    }

    setBusyId("create-focus");
    setFocusError(null);
    try {
      let imageUrl: string | null = null;
      if (newFocusImageMode === "upload") {
        if (!newFocusImageFile) throw new Error("Image file is missing.");
        imageUrl = await uploadFocusImage(newFocusImageFile, slug);
      } else {
        imageUrl = newFocusImageUrl.trim() || null;
      }

      const maxSort = focuses.reduce((m, f) => Math.max(m, f.sort_order), -1);
      const { error: createErr } = await supabase.from("focuses").insert({
        name,
        slug,
        image_url: imageUrl,
        is_active: newFocusActive,
        sort_order: maxSort + 1
      });
      if (createErr) throw createErr;

      resetCreateForm();
      await loadFocuses();
      setFocusRefreshToken((v) => v + 1);
      pushNotice("success", "Focus created.");
    } catch (err) {
      const message = (err as Error).message;
      setFocusError(message);
      pushNotice("error", message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveFocus(focus: FocusRow) {
    const focusId = focus.id;
    const draft = focusDrafts[focusId] ?? draftFromFocus(focus);
    const name = draft.name.trim();
    const slug = slugify(draft.slug || draft.name);

    if (!name || !slug) {
      setFocusError("Focus name and slug are required.");
      return;
    }

    if (focuses.some((item) => item.id !== focusId && item.slug === slug)) {
      setFocusError("Another focus already uses this slug.");
      return;
    }

    setBusyId(`save-focus-${focusId}`);
    setFocusError(null);
    try {
      let imageUrl = draft.image_url.trim() || null;
      const pendingFile = focusImageFiles[focusId] ?? null;
      if (pendingFile) imageUrl = await uploadFocusImage(pendingFile, slug);

      const { error: updateErr } = await supabase
        .from("focuses")
        .update({ name, slug, image_url: imageUrl, is_active: draft.is_active })
        .eq("id", focusId);
      if (updateErr) throw updateErr;

      setFocusImageFiles((prev) => ({ ...prev, [focusId]: null }));
      await loadFocuses();
      setFocusRefreshToken((v) => v + 1);
      pushNotice("success", "Focus updated.");
    } catch (err) {
      const message = (err as Error).message;
      setFocusError(message);
      pushNotice("error", message);
    } finally {
      setBusyId(null);
    }
  }

  async function moveFocus(focus: FocusRow, direction: "up" | "down") {
    const manualSorted = [...focuses].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const index = manualSorted.findIndex((item) => item.id === focus.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= manualSorted.length) return;

    const target = manualSorted[swapIndex];
    setBusyId(`move-focus-${focus.id}`);
    setFocusError(null);
    try {
      await supabase.from("focuses").update({ sort_order: target.sort_order }).eq("id", focus.id);
      await supabase.from("focuses").update({ sort_order: focus.sort_order }).eq("id", target.id);
      await loadFocuses();
      setFocusRefreshToken((v) => v + 1);
      pushNotice("success", "Focus order updated.");
    } catch (err) {
      const message = (err as Error).message;
      setFocusError(message);
      pushNotice("error", message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteFocus(focusId: string) {
    const focus = focuses.find((f) => f.id === focusId);
    if (!focus) return;
    const confirmed = window.confirm(
      `Delete focus "${focus.name}"?\nThis permanently removes linked plans and focus-specific documents.`
    );
    if (!confirmed) return;

    setBusyId(`delete-focus-${focusId}`);
    setFocusError(null);
    try {
      const { error: deleteErr } = await supabase.from("focuses").delete().eq("id", focusId);
      if (deleteErr) throw deleteErr;
      if (expandedFocusId === focusId) setExpandedFocusId(null);
      await loadFocuses();
      setFocusRefreshToken((v) => v + 1);
      pushNotice("success", "Focus deleted.");
    } catch (err) {
      const message = (err as Error).message;
      setFocusError(message);
      pushNotice("error", message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDoc(doc: DocRow) {
    const confirmed = window.confirm(
      `Delete document "${doc.title}"?\nThis removes the source file and its indexed context for AI responses.`
    );
    if (!confirmed) return;
    setBusyId(doc.id);
    try {
      await supabase.storage.from("knowledge_docs").remove([doc.storage_path]);
      await supabase.from("documents").delete().eq("id", doc.id);
      await loadDocs();
      setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id));
      pushNotice("success", `Deleted document: ${doc.title}`);
    } catch (err) {
      const message = (err as Error).message;
      setDocsError(message);
      pushNotice("error", message);
    } finally {
      setBusyId(null);
    }
  }

  async function reindexDoc(doc: DocRow) {
    if (doc.status === "processing") return;
    setBusyId(doc.id);
    setDocsError(null);
    try {
      await supabase.from("documents").update({ status: "processing" }).eq("id", doc.id);
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Admin session required to reindex documents.");

      const response = await fetch(`${supabaseUrl}/functions/v1/index-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ documentId: doc.id })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Reindex failed with status ${response.status}`);
      }
      await loadDocs();
      pushNotice("success", `Reindex started: ${doc.title}`);
    } catch (err) {
      const message = (err as Error).message;
      setDocsError(message);
      pushNotice("error", message);
      await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
      await loadDocs();
    } finally {
      setBusyId(null);
    }
  }

  async function reindexSelectedDocs() {
    const targets = selectedDocs.filter((doc) => doc.status !== "processing");
    if (targets.length === 0) {
      pushNotice("info", "Select at least one non-processing document to reindex.");
      return;
    }
    const confirmed = window.confirm(`Reindex ${targets.length} selected document(s)?`);
    if (!confirmed) return;
    setDocsBatchBusy("reindex");
    setDocsError(null);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Admin session required to reindex documents.");

      let successCount = 0;
      let errorCount = 0;
      for (const doc of targets) {
        try {
          await supabase.from("documents").update({ status: "processing" }).eq("id", doc.id);
          const response = await fetch(`${supabaseUrl}/functions/v1/index-document`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ documentId: doc.id })
          });
          if (!response.ok) throw new Error(`Reindex failed (${response.status})`);
          successCount += 1;
        } catch {
          errorCount += 1;
          await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
        }
      }
      await loadDocs();
      pushNotice("success", `Batch reindex queued for ${successCount} document(s).`);
      if (errorCount > 0) pushNotice("error", `${errorCount} document(s) failed to reindex.`);
    } catch (err) {
      const message = (err as Error).message;
      setDocsError(message);
      pushNotice("error", message);
    } finally {
      setDocsBatchBusy(null);
    }
  }

  async function deleteSelectedDocs() {
    const targets = selectedDocs.filter((doc) => doc.status !== "processing");
    if (targets.length === 0) {
      pushNotice("info", "Select at least one non-processing document to delete.");
      return;
    }
    const confirmed = window.confirm(
      `Delete ${targets.length} selected document(s)?\nThis removes source files and their indexed AI context.`
    );
    if (!confirmed) return;
    setDocsBatchBusy("delete");
    setDocsError(null);
    try {
      let successCount = 0;
      let errorCount = 0;
      const deletedIds: string[] = [];
      for (const doc of targets) {
        try {
          await supabase.storage.from("knowledge_docs").remove([doc.storage_path]);
          await supabase.from("documents").delete().eq("id", doc.id);
          successCount += 1;
          deletedIds.push(doc.id);
        } catch {
          errorCount += 1;
        }
      }
      await loadDocs();
      setSelectedDocIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
      pushNotice("success", `Deleted ${successCount} document(s).`);
      if (errorCount > 0) pushNotice("error", `${errorCount} document(s) failed to delete.`);
    } catch (err) {
      const message = (err as Error).message;
      setDocsError(message);
      pushNotice("error", message);
    } finally {
      setDocsBatchBusy(null);
    }
  }

  useEffect(() => {
    void refreshAuth();
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void refreshAuth();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated || !isAdmin) return;
    void loadDocs();
    void loadFocuses();
  }, [sessionReady, isAuthenticated, isAdmin]);

  useEffect(() => {
    setSelectedDocIds((prev) => prev.filter((id) => docs.some((doc) => doc.id === id)));
  }, [docs]);

  if (!sessionReady) {
    return (
      <main className="page">
        <section className="panel">
          <h2>Loading</h2>
          <p>Checking admin session...</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="page">
        <header>
          <h1>Reform Admin</h1>
          <p>Sign in to manage document context for AI chat.</p>
        </header>
        <AdminAuthPanel onSignedIn={() => void refreshAuth()} />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="page">
        <header>
          <h1>Reform Admin</h1>
          <p>Your account is authenticated but does not have admin access.</p>
        </header>
        <section className="panel">
          {authError ? <p className="error">{authError}</p> : null}
          <button onClick={() => void supabase.auth.signOut()}>Sign Out</button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="toast-stack" aria-live="polite">
        {notices.map((notice) => (
          <div key={notice.id} className={`toast toast-${notice.kind}`}>
            <span>{notice.message}</span>
            <button className="toast-close" type="button" onClick={() => setNotices((prev) => prev.filter((n) => n.id !== notice.id))}>
              <span className="sr-only">Dismiss notification</span>
              ×
            </button>
          </div>
        ))}
      </div>

      <header>
        <h1>Reform Admin</h1>
        <p>Manage focuses, context documents, and AI knowledge scope.</p>
        <button onClick={() => void supabase.auth.signOut()}>Sign Out</button>
      </header>

      <nav className="admin-nav panel" aria-label="Admin sections">
        <button
          className={activePage === "focuses" ? "active-tab" : "ghost-btn"}
          type="button"
          onClick={() => setActivePage("focuses")}
        >
          Focuses
        </button>
        <button
          className={activePage === "documents" ? "active-tab" : "ghost-btn"}
          type="button"
          onClick={() => setActivePage("documents")}
        >
          Document Upload
        </button>
        <button
          className={activePage === "plans" ? "active-tab" : "ghost-btn"}
          type="button"
          onClick={() => setActivePage("plans")}
        >
          Plan Builder
        </button>
      </nav>

      {activePage === "focuses" ? (
      <section className="panel">
        <h2>Create Focus</h2>
        {focusError ? <p className="error" aria-live="polite">{focusError}</p> : null}

        <div className="focus-create-layout">
          <div className="focus-create-main">
            <div className="focus-create-group">
              <h3>Identity</h3>
              <div className="focus-form-grid">
                <label>
                  Name
                  <input
                    id="focus-create-name"
                    name="focus_name"
                    type="text"
                    value={newFocusName}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setNewFocusName(nextName);
                      if (createFocusErrors.name) setCreateFocusErrors((prev) => ({ ...prev, name: undefined }));
                      if (!newFocusSlugTouched) setNewFocusSlug(slugify(nextName));
                    }}
                    placeholder="e.g. Marathon Training"
                    autoComplete="off"
                    aria-invalid={Boolean(createFocusErrors.name)}
                    aria-describedby={createFocusErrors.name ? "focus-create-name-error" : undefined}
                  />
                </label>
                {createFocusErrors.name ? (
                  <p id="focus-create-name-error" className="error" aria-live="polite">
                    {createFocusErrors.name}
                  </p>
                ) : null}

                <label>
                  Slug
                  <input
                    id="focus-create-slug"
                    name="focus_slug"
                    type="text"
                    value={newFocusSlug}
                    onChange={(e) => {
                      setNewFocusSlugTouched(true);
                      setNewFocusSlug(e.target.value);
                      if (createFocusErrors.slug) setCreateFocusErrors((prev) => ({ ...prev, slug: undefined }));
                    }}
                    onBlur={(e) => setNewFocusSlug(slugify(e.target.value))}
                    placeholder="marathon-training"
                    autoComplete="off"
                    aria-invalid={Boolean(createFocusErrors.slug)}
                    aria-describedby={createFocusErrors.slug ? "focus-create-slug-error" : undefined}
                  />
                </label>
                {createFocusErrors.slug ? (
                  <p id="focus-create-slug-error" className="error" aria-live="polite">
                    {createFocusErrors.slug}
                  </p>
                ) : null}

                <label>
                  Status
                  <select
                    id="focus-create-status"
                    name="focus_status"
                    value={newFocusActive ? "active" : "inactive"}
                    onChange={(e) => setNewFocusActive(e.target.value === "active")}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              <p className="field-hint">Slug preview: /{createSlugPreview || "focus-slug"}</p>
            </div>

            <div className="focus-create-group">
              <h3>Image</h3>
              <div className="focus-image-mode">
                <label className={`segmented-option ${newFocusImageMode === "upload" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="focus_create_image_mode"
                    checked={newFocusImageMode === "upload"}
                    onChange={() => setNewFocusImageMode("upload")}
                  />
                  Upload image
                </label>
                <label className={`segmented-option ${newFocusImageMode === "url" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="focus_create_image_mode"
                    checked={newFocusImageMode === "url"}
                    onChange={() => setNewFocusImageMode("url")}
                  />
                  Image URL
                </label>
              </div>

              {newFocusImageMode === "upload" ? (
                <label className="file-input-wrap">
                  <input
                    id="focus-create-image-file"
                    name="focus_image_file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setNewFocusImageFile(e.target.files?.[0] ?? null);
                      if (createFocusErrors.image) setCreateFocusErrors((prev) => ({ ...prev, image: undefined }));
                    }}
                    aria-invalid={Boolean(createFocusErrors.image)}
                    aria-describedby={createFocusErrors.image ? "focus-create-image-error" : undefined}
                  />
                  <span>{newFocusImageFile ? `Selected: ${newFocusImageFile.name}` : "Choose image file"}</span>
                </label>
              ) : (
                <label>
                  Image URL
                  <input
                    id="focus-create-image-url"
                    name="focus_image_url"
                    type="url"
                    value={newFocusImageUrl}
                    onChange={(e) => {
                      setNewFocusImageUrl(e.target.value);
                      if (createFocusErrors.image) setCreateFocusErrors((prev) => ({ ...prev, image: undefined }));
                    }}
                    placeholder="https://..."
                    autoComplete="off"
                    inputMode="url"
                    aria-invalid={Boolean(createFocusErrors.image)}
                    aria-describedby={createFocusErrors.image ? "focus-create-image-error" : undefined}
                  />
                </label>
              )}
              {createFocusErrors.image ? (
                <p id="focus-create-image-error" className="error" aria-live="polite">
                  {createFocusErrors.image}
                </p>
              ) : null}
            </div>

            <div className="focus-form-actions">
              <button onClick={() => void createFocus()} disabled={!canCreateFocus}>
                {busyId === "create-focus" ? "Creating..." : "Create Focus"}
              </button>
              <button className="ghost-btn" onClick={resetCreateForm} type="button">
                Reset
              </button>
            </div>
          </div>

          <aside className="focus-create-preview">
            <h3>Preview</h3>
            <div className="focus-preview-card">
              {newFocusImageMode === "url" && newFocusImageUrl.trim() ? (
                <img className="focus-thumb" src={newFocusImageUrl.trim()} alt={newFocusName || "Preview"} />
              ) : (
                <div className="focus-thumb focus-thumb-empty">{newFocusImageFile ? "Image selected" : "No image yet"}</div>
              )}
              <strong>{newFocusName.trim() || "Focus name"}</strong>
              <p>/{createSlugPreview || "focus-slug"}</p>
              <span className={newFocusActive ? "badge-active" : "badge-inactive"}>
                {newFocusActive ? "Active" : "Inactive"}
              </span>
            </div>
          </aside>
        </div>
      </section>
      ) : null}

      {activePage === "focuses" ? (
      <section className="panel">
        <div className="focus-list-header">
          <h2>Existing Focuses</h2>
          <p>{filteredFocuses.length} shown</p>
        </div>

        <div className="docs-toolbar">
          <input
            id="focus-search"
            name="focus_search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or slug"
            autoComplete="off"
          />
          <select
            id="focus-filter-status"
            name="focus_filter_status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            id="focus-sort-mode"
            name="focus_sort_mode"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as "manual" | "az" | "recent")}
          >
            <option value="manual">Manual order</option>
            <option value="az">Name A-Z</option>
            <option value="recent">Recently created</option>
          </select>
        </div>

        <div className="focus-list">
          {focusesLoading ? (
            <div className="empty-state-card" aria-live="polite">
              <p>Loading focuses...</p>
            </div>
          ) : null}
          {!focusesLoading && filteredFocuses.length === 0 ? (
            <div className="empty-state-card">
              <p>No focuses match your filters.</p>
              <p className="empty-state-sub">Try resetting filters or create a new focus above.</p>
            </div>
          ) : null}
          {filteredFocuses.map((focus) => {
            const draft = focusDrafts[focus.id] ?? draftFromFocus(focus);
            const isExpanded = expandedFocusId === focus.id;
            const isDirty = isDraftDirty(focus);
            return (
              <div className="focus-row" key={focus.id}>
                <div className="focus-row-main">
                  {draft.image_url ? (
                    <img className="focus-thumb" src={draft.image_url} alt={draft.name} />
                  ) : (
                    <div className="focus-thumb focus-thumb-empty">No image</div>
                  )}

                  <div className="focus-summary">
                    <div className="focus-heading">
                      <strong>{focus.name}</strong>
                      <span className={focus.is_active ? "badge-active" : "badge-inactive"}>
                        {focus.is_active ? "Active" : "Inactive"}
                      </span>
                      {isDirty ? <span className="badge-dirty">Unsaved</span> : null}
                    </div>
                    <p className="focus-slug">/{focus.slug}</p>
                    <p className="focus-meta">Sort #{focus.sort_order}</p>
                  </div>
                </div>

                <div className="focus-actions">
                  <button className="ghost-btn" onClick={() => void moveFocus(focus, "up")}>Up</button>
                  <button className="ghost-btn" onClick={() => void moveFocus(focus, "down")}>Down</button>
                  <button onClick={() => setExpandedFocusId((prev) => (prev === focus.id ? null : focus.id))}>
                    {isExpanded ? "Close" : "Edit"}
                  </button>
                  <button className="danger-btn" onClick={() => void deleteFocus(focus.id)}>
                    Delete
                  </button>
                </div>

                {isExpanded ? (
                  <div className="focus-editor">
                    <div className="focus-form-grid">
                      <label>
                        Name
                        <input
                          id={`focus-edit-name-${focus.id}`}
                          name={`focus_edit_name_${focus.id}`}
                          type="text"
                          value={draft.name}
                          onChange={(e) =>
                            setFocusDrafts((prev) => ({ ...prev, [focus.id]: { ...draft, name: e.target.value } }))
                          }
                        />
                      </label>
                      <label>
                        Slug
                        <input
                          id={`focus-edit-slug-${focus.id}`}
                          name={`focus_edit_slug_${focus.id}`}
                          type="text"
                          value={draft.slug}
                          onChange={(e) =>
                            setFocusDrafts((prev) => ({ ...prev, [focus.id]: { ...draft, slug: e.target.value } }))
                          }
                        />
                      </label>
                      <label>
                        Status
                        <select
                          id={`focus-edit-status-${focus.id}`}
                          name={`focus_edit_status_${focus.id}`}
                          value={draft.is_active ? "active" : "inactive"}
                          onChange={(e) =>
                            setFocusDrafts((prev) => ({
                              ...prev,
                              [focus.id]: { ...draft, is_active: e.target.value === "active" }
                            }))
                          }
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </label>
                    </div>

                    <label>
                      Image URL
                      <input
                        id={`focus-edit-image-url-${focus.id}`}
                        name={`focus_edit_image_url_${focus.id}`}
                        type="url"
                        value={draft.image_url}
                        onChange={(e) =>
                          setFocusDrafts((prev) => ({ ...prev, [focus.id]: { ...draft, image_url: e.target.value } }))
                        }
                        placeholder="https://..."
                        autoComplete="off"
                        inputMode="url"
                      />
                    </label>

                    <label className="file-input-wrap">
                      <input
                        id={`focus-edit-image-file-${focus.id}`}
                        name={`focus_edit_image_file_${focus.id}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setFocusImageFiles((prev) => ({ ...prev, [focus.id]: e.target.files?.[0] ?? null }))
                        }
                      />
                      <span>
                        {focusImageFiles[focus.id]
                          ? `Selected: ${focusImageFiles[focus.id]?.name}`
                          : "Upload replacement image"}
                      </span>
                    </label>

                    <div className="focus-form-actions">
                      <button onClick={() => void saveFocus(focus)} disabled={busyId === `save-focus-${focus.id}`}>
                        {busyId === `save-focus-${focus.id}` ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => {
                          setFocusDrafts((prev) => ({ ...prev, [focus.id]: draftFromFocus(focus) }));
                          setFocusImageFiles((prev) => ({ ...prev, [focus.id]: null }));
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      ) : null}

      {activePage === "documents" ? (
        <DocumentUpload onUploaded={loadDocs} focusRefreshToken={focusRefreshToken} onNotify={pushNotice} />
      ) : null}

      {activePage === "plans" ? (
        <>
          <PlanBuilder
            focuses={focuses.map((focus) => ({ id: focus.id, name: focus.name, is_active: focus.is_active }))}
            onError={setPlanError}
            onNotify={pushNotice}
          />
          {planError ? <section className="panel"><p className="error" aria-live="polite">{planError}</p></section> : null}
        </>
      ) : null}

      {activePage === "documents" ? (
      <section className="panel">
        <div className="focus-list-header">
          <h2>Documents</h2>
          <p>{filteredDocs.length} shown</p>
        </div>
        {docsError ? <p className="error" aria-live="polite">{docsError}</p> : null}
        <div className="focus-toolbar">
          <input
            id="docs-search"
            name="docs_search"
            type="search"
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            placeholder="Search title, focus, or type"
            autoComplete="off"
          />
          <select
            id="docs-filter-status"
            name="docs_filter_status"
            value={docStatusFilter}
            onChange={(e) => setDocStatusFilter(e.target.value as "all" | "ready" | "processing" | "error")}
          >
            <option value="all">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="error">Error</option>
          </select>
          <select
            id="docs-filter-scope"
            name="docs_filter_scope"
            value={docScopeFilter}
            onChange={(e) => setDocScopeFilter(e.target.value as "all" | "focus" | "global")}
          >
            <option value="all">All scopes</option>
            <option value="focus">Focus</option>
            <option value="global">Global</option>
          </select>
          <select
            id="docs-sort-mode"
            name="docs_sort_mode"
            value={docSortMode}
            onChange={(e) => setDocSortMode(e.target.value as "recent" | "title_az" | "status")}
          >
            <option value="recent">Recently added</option>
            <option value="title_az">Title A-Z</option>
            <option value="status">Status priority</option>
          </select>
        </div>
        <div className="docs-batch-actions">
          <span className="focus-meta">{selectedDocIds.length} selected</span>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => void reindexSelectedDocs()}
            disabled={selectedDocIds.length === 0 || docsBatchBusy !== null}
          >
            {docsBatchBusy === "reindex" ? "Reindexing..." : "Reindex Selected"}
          </button>
          <button
            className="danger-btn"
            type="button"
            onClick={() => void deleteSelectedDocs()}
            disabled={selectedDocIds.length === 0 || docsBatchBusy !== null}
          >
            {docsBatchBusy === "delete" ? "Deleting..." : "Delete Selected"}
          </button>
          <button className="ghost-btn" type="button" onClick={() => setSelectedDocIds([])} disabled={selectedDocIds.length === 0}>
            Clear
          </button>
        </div>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">
                  <input
                    type="checkbox"
                    aria-label="Select all visible documents"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const visibleIds = visibleSelectableDocs.map((doc) => doc.id);
                        setSelectedDocIds((prev) => [...new Set([...prev, ...visibleIds])]);
                      } else {
                        const visibleIds = new Set(visibleSelectableDocs.map((doc) => doc.id));
                        setSelectedDocIds((prev) => prev.filter((id) => !visibleIds.has(id)));
                      }
                    }}
                  />
                </th>
                <th scope="col">Title</th>
                <th scope="col">Focus</th>
                <th scope="col">Type</th>
                <th scope="col">Scope</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {docsLoading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state-card empty-state-inline" aria-live="polite">
                      <p>Loading documents...</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!docsLoading && filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state-card empty-state-inline">
                      <p>{docs.length === 0 ? "No documents uploaded yet." : "No documents match current filters."}</p>
                      <p className="empty-state-sub">
                        {docs.length === 0
                          ? "Use Upload Document to add focus or global knowledge context."
                          : "Try adjusting search/filters or upload new context."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!docsLoading &&
                filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${doc.title}`}
                      checked={selectedDocIds.includes(doc.id)}
                      disabled={doc.status === "processing"}
                      onChange={(e) => {
                        setSelectedDocIds((prev) =>
                          e.target.checked ? [...new Set([...prev, doc.id])] : prev.filter((id) => id !== doc.id)
                        );
                      }}
                    />
                  </td>
                  <td>{doc.title}</td>
                  <td>{doc.scope === "global" ? "Global" : (doc.focuses?.name ?? "Unknown")}</td>
                  <td>{doc.source_type}</td>
                  <td>{doc.scope}</td>
                  <td>
                    <span className={`status-badge status-${doc.status}`}>{doc.status}</span>
                  </td>
                  <td className="docs-actions">
                    <button
                      onClick={() => void reindexDoc(doc)}
                      disabled={busyId === doc.id || docsBatchBusy !== null || doc.status === "processing"}
                      className={doc.status === "processing" ? "ghost-btn" : undefined}
                    >
                      {busyId === doc.id ? "Working..." : "Reindex"}
                    </button>
                    <button
                      onClick={() => void deleteDoc(doc)}
                      disabled={busyId === doc.id || docsBatchBusy !== null || doc.status === "processing"}
                      className={doc.status === "processing" ? "ghost-btn" : undefined}
                    >
                      {busyId === doc.id ? "Working..." : "Delete"}
                    </button>
                  </td>
                </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </main>
  );
}
