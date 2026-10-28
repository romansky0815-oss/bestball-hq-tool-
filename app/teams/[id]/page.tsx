import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isPro, requireUser } from "@/lib/auth";
import { gradeTeams, seasonContext } from "@/lib/data";
import { Grade, Paywall, Pos, Signed } from "@/components/ui";
import { deleteTeam, renameTeam } from "@/app/actions/teams";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const team = await db.team.findFirst({
    where: { id, userId: user.id },
    include: { picks: { include: { player: true }, orderBy: { pickNumber: "asc" } } },
  });
  if (!team) notFound();
  const pro = isPro(user);
  const { season, weeks } = await seasonContext();
  const g = (await gradeTeams([team], 1000)).get(team.id)!;

  // Teams in the portfolio that share players with this one.
  const ids = new Set(team.picks.map((p) => p.playerId));
  const others = await db.team.findMany({
    where: { userId: user.id, id: { not: team.id } },
    include: { picks: { include: { player: true } } },
  });
  const twins = others
    .map((o) => ({ o, shared: o.picks.filter((p) => ids.has(p.playerId)) }))
    .filter((x) => x.shared.length >= 5)
    .sort((a, b) => b.shared.length - a.shared.length)
    .slice(0, 5);
  const maxWeek = Math.max(1, ...g.weekly);

  return (
    <div className="stack">
      <div className="row">
        <div>
          <h1>{team.name ?? `Team ${team.id.slice(-5)}`}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {team.platform}{team.contest ? ` · ${team.contest}` : ""}{team.entryFee ? ` · $${team.entryFee}` : ""} · drafted {team.draftedAt.toLocaleDateString()} · slot {team.picks[0]?.pickNumber}
          </p>
        </div>
        <div className="spacer" />
        <form action={renameTeam} className="row">
          <input type="hidden" name="id" value={team.id} />
          <input name="name" placeholder="Rename" defaultValue={team.name ?? ""} style={{ width: 160 }} />
          <button className="btn sm">Save</button>
        </form>
        <form action={deleteTeam}>
          <input type="hidden" name="id" value={team.id} />
          <button className="btn sm danger">Delete</button>
        </form>
      </div>

      <div className="grid g4">
        <div className="card stat"><div className="label">Season {season} points</div><div className="value">{g.total.toFixed(1)}</div><div className="muted small">{weeks.length ? `through week ${weeks[weeks.length - 1]}` : "season hasn't started"}</div></div>
        <div className="card stat"><div className="label">Performance grade</div><div className="value">{pro ? <Grade g={g.grade} /> : "🔒"}</div><div className="muted small">{pro && weeks.length ? `better than ${g.percentile.toFixed(0)}% of ADP twins` : "vs. ADP twins"}</div></div>
        <div className="card stat"><div className="label">ADP-twin average</div><div className="value">{pro ? g.cohortMean.toFixed(1) : "🔒"}</div><div className="muted small">{pro ? <>you: <Signed v={g.total - g.cohortMean} /> · top 10%: {g.cohortP90.toFixed(0)}</> : ""}</div></div>
        <div className="card stat"><div className="label">Draft grade</div><div className="value">{pro ? <Grade g={g.draftGrade} /> : "🔒"}</div><div className="muted small">value vs. ADP and our rankings</div></div>
      </div>

      {weeks.length > 0 && (
        <div className="card">
          <h3>Weekly best-ball score</h3>
          <div className="weeks">
            {g.weekly.map((w, i) => (
              <div key={i} title={`Week ${weeks[i]}: ${w.toFixed(1)}`} style={{ height: `${(w / maxWeek) * 100}%` }} />
            ))}
          </div>
          <div className="row muted small" style={{ justifyContent: "space-between" }}><span>Wk {weeks[0]}</span><span>Wk {weeks[weeks.length - 1]}</span></div>
        </div>
      )}

      {!pro && <Paywall what="Pick-by-pick grading" />}

      <div className="card table-wrap">
        <h3>Roster</h3>
        <table>
          <thead>
            <tr>
              <th>Pick</th><th>Player</th><th>Pos</th><th>NFL</th>
              <th className="num">ADP</th><th className="num">Value</th><th className="num">Our rank</th>
              <th className="num">Points</th>
              {pro && <><th className="num">Same-ADP avg</th><th className="num">+/- vs ADP</th></>}
            </tr>
          </thead>
          <tbody>
            {g.picks.map((p) => {
              const pl = team.picks.find((x) => x.playerId === p.playerId)!.player;
              return (
                <tr key={p.playerId}>
                  <td>{Math.ceil(p.pickNumber / team.draftSize)}.{String(((p.pickNumber - 1) % team.draftSize) + 1).padStart(2, "0")} <span className="muted small">({p.pickNumber})</span></td>
                  <td><strong>{p.name}</strong></td>
                  <td><Pos p={p.position} /></td>
                  <td>{pl.nflTeam ?? ""}</td>
                  <td className="num">{p.adp?.toFixed(1) ?? "—"}</td>
                  <td className="num"><Signed v={p.adpValue} /></td>
                  <td className="num">{p.myRank ?? "—"}</td>
                  <td className="num">{p.points.toFixed(1)}</td>
                  {pro && <><td className="num muted">{p.cohortAvg.toFixed(1)}</td><td className="num"><Signed v={p.pointsOverCohort} /></td></>}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Value = pick number − current ADP (positive means you got him later than the market). &ldquo;Same-ADP avg&rdquo; is the average points of players at the same position with an ADP near that pick.</p>
      </div>

      <div className="card">
        <h3>Similar teams in your portfolio</h3>
        {twins.length ? (
          <table>
            <tbody>
              {twins.map(({ o, shared }) => (
                <tr key={o.id}>
                  <td><Link href={`/teams/${o.id}`}>{o.name ?? `Team ${o.id.slice(-5)}`}</Link></td>
                  <td>{shared.length} shared</td>
                  <td className="small muted">{shared.slice(0, 6).map((s) => s.player.name).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No other team shares 5+ players with this one. 👍</p>
        )}
      </div>
    </div>
  );
}
