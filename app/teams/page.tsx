import Link from "next/link";
import { db } from "@/lib/db";
import { isPro, requireUser } from "@/lib/auth";
import { gradeTeams } from "@/lib/data";
import { Grade, Signed } from "@/components/ui";
import { FREE_TEAM_LIMIT } from "@/lib/plans";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const user = await requireUser();
  const { sort = "date" } = await searchParams;
  const teams = await db.team.findMany({
    where: { userId: user.id },
    include: { picks: { include: { player: true }, orderBy: { pickNumber: "asc" } } },
    orderBy: { draftedAt: "desc" },
  });
  const pro = isPro(user);
  const grades = pro ? await gradeTeams(teams) : new Map();
  const rows = teams.map((t) => ({ t, g: grades.get(t.id) }));
  if (sort === "grade") rows.sort((a, b) => (b.g?.percentile ?? 0) - (a.g?.percentile ?? 0));
  if (sort === "points") rows.sort((a, b) => (b.g?.total ?? 0) - (a.g?.total ?? 0));

  return (
    <div className="stack">
      <div className="row">
        <div>
          <h1>My teams</h1>
          <p className="muted" style={{ margin: 0 }}>
            {teams.length} team{teams.length === 1 ? "" : "s"}
            {!pro && ` · free plan: ${FREE_TEAM_LIMIT} max`}
          </p>
        </div>
        <div className="spacer" />
        <Link href="/teams/import" className="btn primary">Import CSV</Link>
        <Link href="/teams/new" className="btn">Add team manually</Link>
      </div>

      {!teams.length ? (
        <div className="card">
          <p>No teams yet. Export your teams from Underdog (Settings → Export Exposure) and import the CSV, or add one by hand.</p>
        </div>
      ) : (
        <div className="card table-wrap">
          <div className="tabs" style={{ marginBottom: 10 }}>
            {[["date", "Newest"], ["grade", "Best grade"], ["points", "Most points"]].map(([k, l]) => (
              <Link key={k} href={`/teams?sort=${k}`} className={sort === k ? "on" : ""}>{l}</Link>
            ))}
          </div>
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Contest</th>
                <th>Slot</th>
                <th>First 4 picks</th>
                <th className="num">Points</th>
                <th className="num">vs ADP twins</th>
                <th>Grade</th>
                <th>Draft</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, g }) => {
                const first = t.picks[0]?.pickNumber;
                return (
                  <tr key={t.id}>
                    <td><Link href={`/teams/${t.id}`}><strong>{t.name ?? `Team ${t.id.slice(-5)}`}</strong></Link><div className="muted small">{t.draftedAt.toLocaleDateString()}</div></td>
                    <td className="small">{t.platform}{t.contest ? ` · ${t.contest}` : ""}</td>
                    <td>{first ?? "—"}</td>
                    <td className="small">{t.picks.slice(0, 4).map((p) => p.player.name.split(" ").slice(-1)[0]).join(", ")}</td>
                    <td className="num">{g ? g.total.toFixed(1) : "—"}</td>
                    <td className="num">{g ? <Signed v={g.total - g.cohortMean} /> : "—"}</td>
                    <td>{pro ? <Grade g={g?.grade ?? "—"} /> : <Link href="/account" className="small">Pro</Link>}</td>
                    <td>{pro ? <Grade g={g?.draftGrade ?? "—"} /> : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
