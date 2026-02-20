import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  onSignedIn?: () => void;
};

export function AdminAuthPanel({ onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  function validate(): boolean {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Password is required.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      onSignedIn?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel auth-panel">
      <h2>Admin Sign In</h2>
      <p>Use your admin account to upload and index documents for chat context.</p>
      <form className="auth-form" onSubmit={signIn} noValidate>
        <label>
          Email
          <input
            id="admin-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            autoComplete="email"
            inputMode="email"
            placeholder="admin@reform.tech"
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "admin-email-error" : undefined}
          />
        </label>
        {fieldErrors.email ? (
          <p id="admin-email-error" className="error" aria-live="polite">
            {fieldErrors.email}
          </p>
        ) : null}
        <label>
          Password
          <input
            id="admin-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "admin-password-error" : undefined}
          />
        </label>
        {fieldErrors.password ? (
          <p id="admin-password-error" className="error" aria-live="polite">
            {fieldErrors.password}
          </p>
        ) : null}
        <button type="submit" disabled={busy || !email || !password}>
          {busy ? "Signing In..." : "Sign In"}
        </button>
      </form>
      {error ? (
        <p className="error" aria-live="polite">
          {error}
        </p>
      ) : null}
    </section>
  );
}
