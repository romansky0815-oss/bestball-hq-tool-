import { Fragment } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { getUser, isPro } from "@/lib/auth";
import { FREE_RANKINGS_LIMIT } from "@/lib/plans";
import { Paywall, Pos } from "@/components/ui";

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ pos?: string }> }) {
  const { pos } = await searchParams;
  const user = await getUser();
  const pro = isPro(user);
  const [current, previous] = await db.rankingSet.findMany({
    orderBy: { publishedAt: "desc" },
    take: 2,
    include: { entries: { include: { player: true }, orderBy: { rank: "asc" } } },
  });
  if (!current) return <div className="card">Rankings haven&apos;t been published yet.</div>;

  // Exposure column for logged-in users.
  const exposure = new Map<string, number>();
  let teamCount = 0;
  if (user) {
    teamCount = await db.team.count({ where: { userId: user.id } });
    const counts = await db.pick.groupBy({ by: ["playerId"], where: { team: { userId: user.id } }, _count: true });
    for (const c of counts) exposure.set(c.playerId, (c._count / Math.max(1, teamCount)) * 100);
  }
  const prevRank = new Map(previous?.entries.map((e) => [e.playerId, e.rank]) ?? []);
  const posRank = new Map<string, number>();
  const counters: Record<string, number> = {};
  for (const e of current.entries) posRank.set(e.id, (counters[e.player.position] = (counters[e.player.position] ?? 0) + 1));

  let entries = current.entries;
  if (pos) entries = entries.filter((e) => e.player.position === pos);
  const visible = pro ? entries : entries.filter((e) => e.rank <= FREE_RANKINGS_LIMIT);
  let lastTier: number | null = null;

  return (
    <div className="stack">
      <div>
        <h1>{current.title}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {current.format} · updated {current.publishedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          {previous && " · movement vs. previous update"}
        </p>
        {current.notes && <p>{current.notes}</p>}
      </div>
      <div className="tabs">
        {["", "QB", "RB", "WR", "TE"].map((p) => (
          <Link key={p} href={p ? `/rankings?pos=${p}` : "/rankings"} className={(pos ?? "") === p ? "on" : ""}>{p || "Overall"}</Link>
        ))}
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">Rk</th><th>Move</th><th>Player</th><th>Pos</th><th>NFL</th><th className="num">ADP</th><th className="num">Rk vs ADP</th>
              {user && teamCount > 0 && <th className="num">My exp.</th>}
              {pro && <th>Notes</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => {
              const prev = prevRank.get(e.playerId);
              const move = prev != null ? prev - e.rank : null;
              const tierBreak = e.tier != null && e.tier !== lastTier;
              lastTier = e.tier;
              return (
                <Fragment key={e.id}>
                  {tierBreak && (
                    <tr><td colSpan={9} className="small muted" style={{ background: "var(--surface-2)", fontWeight: 700 }}>Tier {e.tier}</td></tr>
                  )}
                  <tr>
                    <td className="num"><strong>{e.rank}</strong></td>
                    <td>{move == null ? <span className="muted small">new</span> : move > 0 ? <span className="mv-up">▲{move}</span> : move < 0 ? <span className="mv-down">▼{-move}</span> : <span className="muted">–</span>}</td>
                    <td><strong>{e.player.name}</strong></td>
                    <td><Pos p={e.player.position} /> <span className="muted small">{e.player.position}{posRank.get(e.id)}</span></td>
                    <td>{e.player.nflTeam}</td>
                    <td className="num">{e.player.adp?.toFixed(1) ?? "—"}</td>
                    <td className="num">{e.player.adp != null ? <span className={e.player.adp - e.rank > 0 ? "pos-val" : e.player.adp - e.rank < 0 ? "neg-val" : ""}>{(e.player.adp - e.rank > 0 ? "+" : "") + (e.player.adp - e.rank).toFixed(0)}</span> : "—"}</td>
                    {user && teamCount > 0 && <td className="num">{exposure.get(e.playerId)?.toFixed(0) ?? 0}%</td>}
                    {pro && <td className="small" style={{ whiteSpace: "normal", minWidth: 220 }}>{e.note}</td>}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!pro && <Paywall what={`Rankings beyond the top ${FREE_RANKINGS_LIMIT}`} />}
    </div>
  );
}
