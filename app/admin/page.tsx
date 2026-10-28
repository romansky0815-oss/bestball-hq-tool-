import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSetting, seasonContext } from "@/lib/data";
import ImportForm from "@/components/ImportForm";
import { saveSettings, setPlan, uploadAdp, uploadScores } from "@/app/actions/admin";

export default async function AdminPage() {
  await requireAdmin();
  const [users, proCount, teamCount, playerCount, season] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { _count: { select: { teams: true } } } }),
    db.user.count({ where: { plan: "PRO" } }),
    db.team.count(),
    db.player.count({ where: { adp: { not: null } } }),
    getSetting("season", String(new Date().getFullYear())),
  ]);
  const { weeks } = await seasonContext();
  const userCount = await db.user.count();

  return (
    <div className="stack">
      <div className="row">
        <h1>Admin</h1>
        <div className="spacer" />
        <Link className="btn" href="/admin/rankings">Publish rankings</Link>
        <Link className="btn primary" href="/admin/posts">Newsletter posts</Link>
      </div>
      <div className="grid g4">
        <div className="card stat"><div className="label">Users</div><div className="value">{userCount}</div></div>
        <div className="card stat"><div className="label">Pro subscribers</div><div className="value">{proCount}</div></div>
        <div className="card stat"><div className="label">Teams tracked</div><div className="value">{teamCount}</div></div>
        <div className="card stat"><div className="label">Players with ADP</div><div className="value">{playerCount}</div><div className="muted small">season {season} · {weeks.length ? `weeks ${weeks[0]}–${weeks[weeks.length - 1]} scored` : "no scores yet"}</div></div>
      </div>

      <div className="card">
        <h2>Season</h2>
        <form action={saveSettings} className="row">
          <input name="season" type="number" defaultValue={season} style={{ width: 120 }} />
          <button className="btn">Save</button>
        </form>
      </div>

      <div className="grid g2">
        <div>
          <h2>Upload ADP</h2>
          <p className="muted small">Columns: <code>Player, Position, Team, ADP</code> (optional <code>Bye</code>). Underdog&apos;s rankings export works as-is. Players not in the file keep their previous ADP.</p>
          <ImportForm action={uploadAdp} />
        </div>
        <div>
          <h2>Upload weekly scores</h2>
          <p className="muted small">Columns: <code>Player, Position, Week, Points</code> (optional <code>Team, Season</code>). Use half-PPR points for Underdog. Or run <code>npm run sync:sleeper</code> to pull them automatically.</p>
          <ImportForm action={uploadScores} />
        </div>
      </div>

      <div className="card table-wrap">
        <h2>Users</h2>
        <table>
          <thead><tr><th>Email</th><th>Joined</th><th className="num">Teams</th><th>Plan</th><th>Stripe</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email} {u.role === "ADMIN" && <span className="tag">admin</span>}</td>
                <td>{u.createdAt.toLocaleDateString()}</td>
                <td className="num">{u._count.teams}</td>
                <td>{u.plan === "PRO" ? <span className="tag PRO">Pro</span> : "Free"}</td>
                <td className="small muted">{u.subscriptionStatus ?? "—"}</td>
                <td>
                  <form action={setPlan}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="plan" value={u.plan === "PRO" ? "FREE" : "PRO"} />
                    <button className="btn sm">{u.plan === "PRO" ? "Revoke Pro" : "Comp Pro"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
