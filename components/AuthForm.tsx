"use client";
import { useActionState } from "react";

type Action = (prev: unknown, form: FormData) => Promise<{ error?: string } | undefined>;

export default function AuthForm({ action, mode }: { action: Action; mode: "login" | "signup" }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="card" style={{ maxWidth: 420 }}>
      {mode === "signup" && (
        <div className="field">
          <label>Name</label>
          <input name="name" autoComplete="name" />
        </div>
      )}
      <div className="field">
        <label>Email</label>
        <input name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label>Password</label>
        <input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </div>
      {state?.error && <div className="alert err" style={{ marginBottom: 12 }}>{state.error}</div>}
      <button className="btn primary" disabled={pending}>
        {mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
