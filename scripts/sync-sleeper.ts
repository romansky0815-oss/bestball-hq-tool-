// Pulls NFL players and weekly half-PPR fantasy points from Sleeper's public API
// and upserts them into the database. Run weekly (cron / GitHub Action):
//   npm run sync:sleeper -- --season 2026 --weeks 1-8
import { PrismaClient } from "@prisma/client";
import { nameKey } from "../lib/names";

const db = new PrismaClient();
const POS = new Set(["QB", "RB", "WR", "TE"]);

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<T>;
}

async function main() {
  const season = Number(arg("season") ?? (await db.setting.findUnique({ where: { key: "season" } }))?.value ?? new Date().getFullYear());
  const [from, to] = (arg("weeks") ?? "1-18").split("-").map(Number);

  type SPlayer = { full_name?: string; first_name?: string; last_name?: string; position?: string; team?: string | null; active?: boolean };
  const sp = await getJson<Record<string, SPlayer>>("https://api.sleeper.app/v1/players/nfl");
  const idMap = new Map<string, string>();
  for (const [sid, p] of Object.entries(sp)) {
    if (!p.position || !POS.has(p.position) || !p.active) continue;
    const name = p.full_name ?? `${p.first_name} ${p.last_name}`;
    const key = nameKey(name, p.position);
    const existing = (await db.player.findUnique({ where: { sleeperId: sid } })) ?? (await db.player.findUnique({ where: { nameKey: key } }));
    const row = existing
      ? await db.player.update({ where: { id: existing.id }, data: { sleeperId: sid, nflTeam: p.team ?? existing.nflTeam } })
      : await db.player.create({ data: { name, position: p.position, nflTeam: p.team ?? null, sleeperId: sid, nameKey: key } });
    idMap.set(sid, row.id);
  }
  console.log(`Synced ${idMap.size} players`);

  for (let week = from; week <= (to || from); week++) {
    const stats = await getJson<Record<string, { pts_half_ppr?: number }>>(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`);
    let n = 0;
    for (const [sid, s] of Object.entries(stats)) {
      const playerId = idMap.get(sid);
      if (!playerId || s.pts_half_ppr == null) continue;
      await db.weeklyScore.upsert({
        where: { playerId_season_week: { playerId, season, week } },
        update: { points: s.pts_half_ppr },
        create: { playerId, season, week, points: s.pts_half_ppr },
      });
      n++;
    }
    console.log(`Week ${week}: ${n} scores`);
    if (!n) break; // future week
  }
  await db.setting.upsert({ where: { key: "dataVersion" }, update: { value: String(Date.now()) }, create: { key: "dataVersion", value: String(Date.now()) } });
}

main().finally(() => db.$disconnect());
