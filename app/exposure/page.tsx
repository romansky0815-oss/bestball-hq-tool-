import Link from "next/link";
import { db } from "@/lib/db";
import { isPro, requireUser } from "@/lib/auth";
import { loadPortfolio } from "@/lib/portfolio";
import { buildCounts, exposures, qbStacks, similarTeams, topCombos } from "@/lib/exposure";
import { Paywall, Pos, Signed } from "@/components/ui";

type SP = { pos?: string; q?: string; contest?: string; platform?: string };

export default async function ExposurePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const pro = isPro(user);
  const { portfolio, players, draftSize } = await loadPortfolio(user.id, { contest: sp.contest, platform: sp.platform });
  const contests = await db.team.findMany({ where: { userId: user.id, contest: { not: null } }, distinct: ["contest"], select: { contest: true } });

  let rows = exposures(portfolio, players);
  if (sp.pos) rows = rows.filter((r) => r.position === sp.pos);
  if (sp.q) rows = rows.filter((r) => r.name.toLowerCase().includes(sp.q!.toLowerCase()));
  const maxPct = Math.max(1, ...rows.map((r) => r.pct));
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/exposure?${p}`;
  };

  return (
    <div className="stack">
      <div className="row">
        <div>
          <h1>Exposure</h1>
          <p className="muted" style={{ margin: 0 }}>{portfolio.length} teams{sp.contest ? ` in ${sp.contest}` : ""}</p>
        </div>
        <div className="spacer" />
        <form className="row" action="/exposure">
          {sp.pos && <input type="hidden" name="pos" value={sp.pos} />}
          <select name="contest" defaultValue={sp.contest ?? ""} style={{ width: 200 }}>
            <option value="">All contests</option>
            {contests.map((c) => <option key={c.contest} value={c.contest!}>{c.contest}</option>)}
          </select>
          <input name="q" placeholder="Search player" defaultValue={sp.q} style={{ width: 160 }} />
          <button className="btn sm">Filter</button>
        </form>
      </div>

      {pro ? <PortfolioHealth portfolio={portfolio} players={players} draftSize={draftSize} /> : <Paywall what="Duplicate-team detection, core combos and stack tracking" />}

      <h2 style={{ marginTop: 8 }}>Player exposure</h2>
      <div className="tabs">
        {["", "QB", "RB", "WR", "TE"].map((p) => (
          <Link key={p} href={qs({ pos: p || undefined })} className={(sp.pos ?? "") === p ? "on" : ""}>{p || "All"}</Link>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Player</th><th>Pos</th><th>NFL</th><th className="num">Teams</th><th>Exposure</th>
              <th className="num">Avg pick</th><th className="num">Range</th><th className="num">Current ADP</th><th className="num">ADP move</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.name}</strong></td>
                <td><Pos p={r.position} /></td>
                <td>{r.nflTeam}</td>
                <td className="num">{r.count}</td>
                <td>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <div className="bar" style={{ width: 120 }}><div style={{ width: `${(r.pct / maxPct) * 100}%` }} /></div>
                    <span>{r.pct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="num">{r.avgPick.toFixed(1)}</td>
                <td className="num muted">{r.minPick}–{r.maxPick}</td>
                <td className="num">{r.adp?.toFixed(1) ?? "—"}</td>
                <td className="num"><Signed v={r.clv} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">ADP move = current ADP − your average pick. Positive means the market now drafts him later than you did; negative means his price has risen since you took him (closing line value).</p>
      </div>

    </div>
  );
}

type Portfolio = Awaited<ReturnType<typeof loadPortfolio>>;

function PortfolioHealth({ portfolio, players, draftSize }: Pick<Portfolio, "portfolio" | "players" | "draftSize">) {
  const pairs = similarTeams(portfolio, draftSize).slice(0, 15);
  const combos2 = topCombos(portfolio, 2, draftSize);
  const combos3 = topCombos(portfolio, 3, draftSize, 8, 10);
  const stacks = qbStacks(portfolio, players).slice(0, 12);
  const builds = buildCounts(portfolio, players).slice(0, 8);
  const name = (id: string) => players.get(id)?.name ?? "?";
  return (
    <>
      <div className="card table-wrap">
        <h2>Near-duplicate teams</h2>
        {pairs.length ? (
          <table>
            <thead><tr><th>Team A</th><th>Team B</th><th className="num">Shared (first 6 rds)</th><th className="num">Shared (all)</th><th className="num">Overlap</th></tr></thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={p.a.id + p.b.id}>
                  <td><Link href={`/teams/${p.a.id}`}>{p.a.name}</Link></td>
                  <td><Link href={`/teams/${p.b.id}`}>{p.b.name}</Link></td>
                  <td className="num"><strong>{p.coreShared}</strong></td>
                  <td className="num">{p.shared}</td>
                  <td className="num">{(p.jaccard * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No near-duplicates. Your builds are well diversified.</p>}
      </div>
      <div className="grid g2">
        <div className="card">
          <h2>Most repeated pairs (rounds 1–8)</h2>
          <ComboTable combos={combos2} name={name} />
        </div>
        <div className="card">
          <h2>Most repeated trios (rounds 1–8)</h2>
          <ComboTable combos={combos3} name={name} />
        </div>
        <div className="card">
          <h2>QB stacks</h2>
          <table>
            <thead><tr><th>QB</th><th className="num">Teams stacked</th><th className="num">% of portfolio</th><th className="num">Avg stack size</th></tr></thead>
            <tbody>
              {stacks.map((s) => (
                <tr key={s.qbId}><td>{name(s.qbId)} <span className="muted small">{s.nflTeam}</span></td><td className="num">{s.teams}</td><td className="num">{s.pct.toFixed(1)}%</td><td className="num">{s.avgStackSize.toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Roster builds (QB-RB-WR-TE)</h2>
          <table>
            <tbody>
              {builds.map((b) => (
                <tr key={b.build}><td>{b.build}</td><td className="num">{b.n} teams</td><td className="num">{((b.n / Math.max(1, portfolio.length)) * 100).toFixed(0)}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ComboTable({ combos, name }: { combos: ReturnType<typeof topCombos>; name: (id: string) => string }) {
  if (!combos.length) return <p className="muted">No repeated combinations yet.</p>;
  return (
    <table>
      <tbody>
        {combos.map((c) => (
          <tr key={c.playerIds.join()}><td>{c.playerIds.map(name).join(" + ")}</td><td className="num">{c.count}×</td><td className="num">{c.pct.toFixed(1)}%</td></tr>
        ))}
      </tbody>
    </table>
  );
}
