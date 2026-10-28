import Link from "next/link";
import { db } from "@/lib/db";
import { isPro, requireUser } from "@/lib/auth";
import { gradeTeams, seasonContext } from "@/lib/data";
import { loadPortfolio } from "@/lib/portfolio";
import { exposures, similarTeams } from "@/lib/exposure";
import { Grade, Pos, Signed } from "@/components/ui";
import { letterFromPercentile } from "@/lib/grading";

export default async function Dashboard() {
  const user = await requireUser();
  const pro = isPro(user);
  const { portfolio, players, draftSize, teams } = await loadPortfolio(user.id);
  const { weeks } = await seasonContext();
  const grades = pro ? await gradeTeams(portfolio) : new Map();
  const gs = [...grades.values()];
  const avgPct = gs.length ? gs.reduce((a, g) => a + g.percentile, 0) / gs.length : null;
  const avgVsTwins = gs.length ? gs.reduce((a, g) => a + (g.total - g.cohortMean), 0) / gs.length : null;
  const fees = teams.reduce((a, t) => a + (t.entryFee ?? 0), 0);
  const top = exposures(portfolio, players).slice(0, 10);
  const dupes = pro ? similarTeams(portfolio, draftSize).filter((p) => p.coreShared >= 4).length : 0;
  const posts = await db.post.findMany({ orderBy: { publishedAt: "desc" }, take: 4 });
  const best = portfolio
    .map((t) => ({ t, g: grades.get(t.id) }))
    .filter((x) => x.g)
    .sort((a, b) => b.g.percentile - a.g.percentile)
    .slice(0, 5);

  return (
    <div className="stack">
      <div>
        <h1>Welcome back{user.name ? `, ${user.name}` : ""}</h1>
        <p className="muted" style={{ margin: 0 }}>{weeks.length ? `Scores through week ${weeks[weeks.length - 1]}` : "Preseason — grades update once weekly scores are loaded."}</p>
      </div>

      <div className="grid g4">
        <div className="card stat"><div className="label">Teams</div><div className="value">{portfolio.length}</div><div className="muted small">${fees.toFixed(0)} in entries</div></div>
        <div className="card stat"><div className="label">Portfolio grade</div><div className="value">{pro ? <Grade g={avgPct != null && weeks.length ? letterFromPercentile(avgPct) : "—"} /> : "🔒"}</div><div className="muted small">{pro && avgPct != null && weeks.length ? `avg ${avgPct.toFixed(0)}th percentile` : "vs. ADP twins"}</div></div>
        <div className="card stat"><div className="label">Avg pts vs twins</div><div className="value">{pro ? <Signed v={avgVsTwins} /> : "🔒"}</div><div className="muted small">per team</div></div>
        <div className="card stat"><div className="label">Near-duplicates</div><div className="value">{pro ? dupes : "🔒"}</div><div className="muted small">pairs sharing 4+ early picks</div></div>
      </div>

      {!portfolio.length && (
        <div className="card">
          <h2>Get started</h2>
          <p>Import your teams to see grades and exposure.</p>
          <Link href="/teams/import" className="btn primary">Import from Underdog CSV</Link>
        </div>
      )}

      <div className="grid g2">
        <div className="card table-wrap">
          <div className="row"><h2>Top exposures</h2><div className="spacer" /><Link href="/exposure" className="small">All →</Link></div>
          <table>
            <tbody>
              {top.map((r) => (
                <tr key={r.id}><td><Pos p={r.position} /> {r.name}</td><td className="num">{r.pct.toFixed(1)}%</td><td className="num muted">{r.count} teams</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card table-wrap">
          <div className="row"><h2>Best teams</h2><div className="spacer" /><Link href="/teams?sort=grade" className="small">All →</Link></div>
          {pro ? (
            <table>
              <tbody>
                {best.map(({ t, g }) => (
                  <tr key={t.id}><td><Link href={`/teams/${t.id}`}>{t.name}</Link></td><td className="num">{g.total.toFixed(1)}</td><td><Grade g={g.grade} /></td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Upgrade to Pro to see team grades. <Link href="/account">Upgrade →</Link></p>}
        </div>
      </div>

      <div className="card">
        <div className="row"><h2>Latest news</h2><div className="spacer" /><Link href="/news" className="small">All →</Link></div>
        {posts.map((p) => (
          <div key={p.id} style={{ padding: "6px 0" }}>
            <span className={`tag ${p.category}`}>{p.category}</span> <Link href={`/news/${p.slug}`}>{p.title}</Link>{" "}
            <span className="muted small">{p.publishedAt.toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
