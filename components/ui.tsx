import Link from "next/link";

export function Pos({ p }: { p: string }) {
  return <span className={`pos ${p}`}>{p}</span>;
}

export function Grade({ g }: { g: string }) {
  const cls = g === "—" ? "none" : g[0];
  return <span className={`grade ${cls}`}>{g}</span>;
}

export function Signed({ v, digits = 1, suffix = "" }: { v: number | null | undefined; digits?: number; suffix?: string }) {
  if (v == null || Number.isNaN(v)) return <span className="muted">—</span>;
  const cls = v > 0.05 ? "pos-val" : v < -0.05 ? "neg-val" : "";
  return (
    <span className={cls}>
      {v > 0 ? "+" : ""}
      {v.toFixed(digits)}
      {suffix}
    </span>
  );
}

export function Paywall({ what }: { what: string }) {
  return (
    <div className="paywall">
      <h3>{what} is a Pro feature</h3>
      <p className="muted">Upgrade to unlock ADP-twin grades, full rankings and every newsletter.</p>
      <Link className="btn primary" href="/account">
        Upgrade to Pro
      </Link>
    </div>
  );
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <div className="alert err">{err}</div>;
  if (ok) return <div className="alert ok">{ok}</div>;
  return null;
}
