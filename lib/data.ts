import "server-only";
import { db } from "./db";
import { ScoreTable } from "./bestball";
import { gradeTeam, PoolPlayer, TeamGrade } from "./grading";
import { nameKey } from "./names";

export async function getSetting(key: string, fallback: string): Promise<string> {
  return (await db.setting.findUnique({ where: { key } }))?.value ?? fallback;
}
export async function setSetting(key: string, value: string) {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Bump whenever ADP, scores or rankings change so cached grades are recomputed. */
export async function bumpDataVersion() {
  await setSetting("dataVersion", String(Date.now()));
  gradeCache.clear();
}

export async function seasonContext() {
  const season = Number(await getSetting("season", String(new Date().getFullYear())));
  const weeksRows = await db.weeklyScore.findMany({ where: { season }, distinct: ["week"], select: { week: true } });
  const weeks = weeksRows.map((w) => w.week).sort((a, b) => a - b);
  return { season, weeks };
}

export async function loadScores(season: number): Promise<ScoreTable> {
  const rows = await db.weeklyScore.findMany({ where: { season } });
  const t: ScoreTable = new Map();
  for (const r of rows) {
    let m = t.get(r.playerId);
    if (!m) t.set(r.playerId, (m = new Map()));
    m.set(r.week, r.points);
  }
  return t;
}

export async function loadPool(): Promise<PoolPlayer[]> {
  return db.player.findMany({ select: { id: true, name: true, position: true, adp: true } });
}

export async function latestRankings() {
  return db.rankingSet.findFirst({
    orderBy: { publishedAt: "desc" },
    include: { entries: { include: { player: true }, orderBy: { rank: "asc" } } },
  });
}

export async function myRankMap(): Promise<Map<string, number>> {
  const set = await db.rankingSet.findFirst({ orderBy: { publishedAt: "desc" }, include: { entries: true } });
  return new Map(set?.entries.map((e) => [e.playerId, e.rank]) ?? []);
}

const gradeCache = new Map<string, TeamGrade>();

/** Grades many teams, sharing the expensive loads. */
export async function gradeTeams(
  teams: { id: string; picks: { playerId: string; pickNumber: number }[] }[],
  sims = 250,
): Promise<Map<string, TeamGrade>> {
  const version = await getSetting("dataVersion", "0");
  const out = new Map<string, TeamGrade>();
  const todo = teams.filter((t) => {
    const hit = gradeCache.get(`${version}:${sims}:${t.id}:${t.picks.length}`);
    if (hit) out.set(t.id, hit);
    return !hit;
  });
  if (!todo.length) return out;
  const { season, weeks } = await seasonContext();
  const [scores, pool, myRanks] = await Promise.all([loadScores(season), loadPool(), myRankMap()]);
  for (const t of todo) {
    const g = gradeTeam({ teamId: t.id, picks: t.picks, pool, scores, weeks, myRanks, sims });
    gradeCache.set(`${version}:${sims}:${t.id}:${t.picks.length}`, g);
    out.set(t.id, g);
  }
  return out;
}

/** Finds a player by name+position, creating an unranked one if we've never seen them. */
export async function findOrCreatePlayer(name: string, position: string, nflTeam?: string | null) {
  const pos = position.toUpperCase();
  const key = nameKey(name, pos);
  const existing = await db.player.findUnique({ where: { nameKey: key } });
  if (existing) return existing;
  return db.player.create({ data: { name: name.trim(), position: pos, nflTeam: nflTeam || null, nameKey: key } });
}
