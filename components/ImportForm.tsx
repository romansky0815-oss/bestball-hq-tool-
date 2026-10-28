"use client";
import { useActionState } from "react";

type Action = (prev: unknown, form: FormData) => Promise<{ error?: string; ok?: string } | undefined>;

export default function ImportForm({ action, children, hidePaste, submitLabel = "Import" }: { action: Action; children?: React.ReactNode; hidePaste?: boolean; submitLabel?: string }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="card stack">
      {children}
      <div className="field"><label>CSV file</label><input type="file" name="file" accept=".csv,text/csv" /></div>
      {!hidePaste && <div className="field"><label>…or paste CSV</label><textarea name="csv" /></div>}
      {state?.error && <div className="alert err">{state.error}</div>}
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      <div><button className="btn primary" disabled={pending}>{pending ? "Working…" : submitLabel}</button></div>
    </form>
  );
}
