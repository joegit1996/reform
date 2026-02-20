import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

type Props = {
  onUploaded: () => Promise<void>;
  focusRefreshToken?: number;
  onNotify?: (kind: "success" | "error" | "info", message: string) => void;
};

type FocusRow = {
  id: string;
  name: string;
  slug: string;
};

export function DocumentUpload({ onUploaded, focusRefreshToken = 0, onNotify }: Props) {
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<"focus" | "global">("focus");
  const [focusId, setFocusId] = useState("");
  const [newFocusName, setNewFocusName] = useState("");
  const [focuses, setFocuses] = useState<FocusRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ focusId?: string; newFocusName?: string; file?: string }>({});
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("focuses")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      const rows = ((data as FocusRow[]) ?? []);
      setFocuses(rows);
      if (rows[0]?.id) setFocusId((prev) => prev || rows[0].id);
    })();
  }, [focusRefreshToken]);

  async function extractPdfText(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const doc = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = (textContent.items as Array<{ str?: string }>).map((item) => item.str ?? "").join(" ");
      if (text.trim()) pages.push(text.trim());
    }
    return pages.join("\n\n");
  }

  async function triggerIndex(documentId: string) {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Admin session required to index documents.");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/index-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ documentId })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Indexing failed with status ${response.status}`);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextFieldErrors: { focusId?: string; newFocusName?: string; file?: string } = {};
    if (!file) nextFieldErrors.file = "Select a markdown or PDF file.";
    if (scope === "focus" && !focusId && !newFocusName.trim()) {
      nextFieldErrors.focusId = "Select a focus or create a new one.";
      nextFieldErrors.newFocusName = "Create a focus name if none is selected.";
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      let targetFocusId: string | null = null;
      let targetFocusSlug = "global";

      if (scope === "focus") {
        if (focusId) {
          const selectedFocus = focuses.find((focus) => focus.id === focusId);
          targetFocusId = focusId;
          targetFocusSlug = selectedFocus?.slug ?? "focus";
        } else if (newFocusName.trim()) {
          const focusSlug = newFocusName.trim().toLowerCase().replace(/\s+/g, "-");
          const { data: focus, error: focusErr } = await supabase
            .from("focuses")
            .upsert(
              {
                slug: focusSlug,
                name: newFocusName.trim()
              },
              { onConflict: "slug" }
            )
            .select("id,slug")
            .single();
          if (focusErr || !focus) throw focusErr || new Error("Failed to upsert focus");
          targetFocusId = focus.id as string;
          targetFocusSlug = focus.slug as string;
        } else {
          throw new Error("Select a focus or create a new one.");
        }
      }

      const storagePath = `${targetFocusSlug}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("knowledge_docs").upload(storagePath, file);
      if (uploadErr) throw uploadErr;

      const sourceType = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "markdown";
      const text = sourceType === "pdf" ? await extractPdfText(file) : await file.text();
      const { data: docRow, error: docErr } = await supabase
        .from("documents")
        .insert({
          focus_id: targetFocusId,
          scope,
          title: title || file.name,
          source_type: sourceType,
          storage_path: storagePath,
          raw_text: text,
          status: "processing"
        })
        .select("id")
        .single();
      if (docErr || !docRow) throw docErr || new Error("Document insert failed");

      await triggerIndex(docRow.id);

      setTitle("");
      setFile(null);
      setNewFocusName("");
      await onUploaded();
      onNotify?.("success", "Document uploaded and indexing triggered.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      onNotify?.("error", message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <h2>Upload Document</h2>
      <label>
        Title
        <input
          id="doc-title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title"
          autoComplete="off"
        />
      </label>
      <label>
        Scope
        <select
          id="doc-scope"
          name="scope"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as "focus" | "global");
            setFieldErrors((prev) => ({ ...prev, focusId: undefined, newFocusName: undefined }));
          }}
        >
          <option value="focus">Focus-specific</option>
          <option value="global">Global (all focuses)</option>
        </select>
      </label>
      {scope === "focus" ? (
        <>
          <label>
            Focus
            <select
              id="doc-focus"
              name="focus_id"
              value={focusId}
              onChange={(e) => {
                setFocusId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, focusId: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.focusId)}
              aria-describedby={fieldErrors.focusId ? "doc-focus-error" : undefined}
            >
              {focuses.map((focus) => (
                <option key={focus.id} value={focus.id}>
                  {focus.name}
                </option>
              ))}
            </select>
          </label>
          {fieldErrors.focusId ? (
            <p id="doc-focus-error" className="error" aria-live="polite">
              {fieldErrors.focusId}
            </p>
          ) : null}
          <label>
            Or create focus
            <input
              id="doc-new-focus"
              name="new_focus_name"
              type="text"
              value={newFocusName}
              onChange={(e) => {
                setNewFocusName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, newFocusName: undefined }));
              }}
              placeholder="New focus name"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.newFocusName)}
              aria-describedby={fieldErrors.newFocusName ? "doc-new-focus-error" : undefined}
            />
          </label>
          {fieldErrors.newFocusName ? (
            <p id="doc-new-focus-error" className="error" aria-live="polite">
              {fieldErrors.newFocusName}
            </p>
          ) : null}
        </>
      ) : null}
      <label>
        File
        <input
          id="doc-file"
          name="file"
          type="file"
          accept=".md,.markdown,.pdf"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setFieldErrors((prev) => ({ ...prev, file: undefined }));
          }}
          aria-invalid={Boolean(fieldErrors.file)}
          aria-describedby={fieldErrors.file ? "doc-file-error" : undefined}
        />
      </label>
      {fieldErrors.file ? (
        <p id="doc-file-error" className="error" aria-live="polite">
          {fieldErrors.file}
        </p>
      ) : null}
      <button type="submit" disabled={busy || !file}>
        {busy ? "Uploading..." : "Upload"}
      </button>
      {error ? <p className="error" aria-live="polite">{error}</p> : null}
    </form>
  );
}
