// Seeds a demo environment: sample players/ADP, SYNTHETIC weekly scores, rankings,
// newsletter posts and a demo user with simulated drafts. Never run against production.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SAMPLE_PLAYERS } from "./sample-players";
import { nameKey } from "../lib/names";

const db = new PrismaClient();
const SEASON = 2026;
const WEEKS = 8;

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());

async function main() {
  await db.$transaction([
    db.pick.deleteMany(), db.team.deleteMany(), db.weeklyScore.deleteMany(), db.rankingEntry.deleteMany(),
    db.rankingSet.deleteMany(), db.post.deleteMany(), db.player.deleteMany(), db.setting.deleteMany(),
  ]);
  await db.setting.create({ data: { key: "season", value: String(SEASON) } });

  // Players with ADP and a hidden "true talent" that drives synthetic scores.
  const base: Record<string, number> = { QB: 21, RB: 15, WR: 15, TE: 10 };
  const players = [];
  for (const [i, [name, position, nflTeam]] of SAMPLE_PLAYERS.entries()) {
    const adp = Math.round((i + 1 + gauss() * 1.5) * 10) / 10;
    const p = await db.player.create({ data: { name, position, nflTeam, adp: Math.max(1, adp), nameKey: nameKey(name, position) } });
    const talent = base[position] * (1.15 - i / SAMPLE_PLAYERS.length * 0.75) * (1 + gauss() * 0.25);
    const scores = [];
    for (let w = 1; w <= WEEKS; w++) {
      const injured = rand() < 0.07;
      scores.push({ playerId: p.id, season: SEASON, week: w, points: injured ? 0 : Math.max(0, Math.round((talent + gauss() * talent * 0.45) * 10) / 10) });
    }
    await db.weeklyScore.createMany({ data: scores });
    players.push(p);
  }

  // Two ranking versions so movement arrows show.
  for (const [title, jitter, daysAgo] of [["Preseason Best Ball Rankings", 0, 30], ["Week 8 Best Ball Rankings", 6, 0]] as const) {
    const order = [...players].sort((a, b) => (a.adp! + gauss() * jitter) - (b.adp! + gauss() * jitter));
    await db.rankingSet.create({
      data: {
        title,
        notes: daysAgo ? "Initial release." : "Updated after week 7: injuries baked in, buying rookie WRs.",
        publishedAt: new Date(Date.now() - daysAgo * 864e5),
        entries: { create: order.map((p, i) => ({ playerId: p.id, rank: i + 1, tier: Math.floor(i / 12) + 1, note: i < 30 ? "Locked-in volume; a top-24 floor at his position." : null })) },
      },
    });
  }

  await db.post.createMany({
    data: [
      { slug: "week-8-injury-report", title: "Week 8 injury report: what it means for your best ball teams", category: "INJURY", premium: true, excerpt: "Three injuries that move the needle and how to react in drafts.", publishedAt: new Date(Date.now() - 3600e3),
        body: "Big week on the injury front. Here's how each one affects your **best ball portfolio**.\n\nIf you're light on exposure to the backups, now is the time to adjust in late-round picks.\n\n## RB\n- Monitor practice reports Wednesday–Friday\n- Handcuffs move up 10–15 spots in our rankings\n\n## WR\n- Target share consolidates to the WR2\n\n*Rankings have been updated to reflect all of the above.*" },
      { slug: "how-adp-twin-grades-work", title: "How ADP-twin grades work", category: "STRATEGY", premium: false, excerpt: "Why we grade your team against teams drafted at the same picks.", publishedAt: new Date(Date.now() - 5 * 864e5),
        body: "Raw points don't tell you whether you drafted well — a team with the 1.01 and a team from the 1.12 start in different places.\n\nSo for every pick you made, we look at every player at the same position whose ADP was near that pick, then simulate hundreds of teams that made a random one of those choices at each spot. Your **percentile** among those ADP twins is your grade.\n\n- **A+**: better than 95% of ADP twins\n- **B**: around the middle\n- **F**: bottom 15%" },
    ],
  });

  // Demo user with 40 simulated drafts (12 teams, 18 rounds, drafting ~ADP with noise).
  const demo = await db.user.upsert({
    where: { email: "demo@bestball.test" },
    update: { plan: "PRO" },
    create: { email: "demo@bestball.test", name: "Demo", plan: "PRO", passwordHash: await bcrypt.hash("demo1234", 10) },
  });
  const byAdp = [...players].sort((a, b) => a.adp! - b.adp!);
  for (let t = 0; t < 40; t++) {
    const slot = 1 + Math.floor(rand() * 12);
    const available = [...byAdp];
    const picks: { playerId: string; pickNumber: number }[] = [];
    const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const caps: Record<string, number> = { QB: 3, RB: 6, WR: 8, TE: 3 };
    for (let pick = 1; pick <= 12 * 18; pick++) {
      const round = Math.ceil(pick / 12);
      const inRound = pick - (round - 1) * 12;
      const mine = (round % 2 === 1 ? inRound : 13 - inRound) === slot;
      const window = Math.min(available.length, mine ? 4 : 3);
      let idx = Math.floor(rand() * window);
      if (mine) {
        while (idx < available.length && counts[available[idx].position] >= caps[available[idx].position]) idx++;
        const p = available.splice(Math.min(idx, available.length - 1), 1)[0];
        counts[p.position]++;
        picks.push({ playerId: p.id, pickNumber: pick });
      } else available.splice(idx, 1);
    }
    await db.team.create({
      data: {
        userId: demo.id, platform: "Underdog", contest: t % 3 ? "Best Ball Mania" : "The Puppy", entryFee: t % 3 ? 25 : 5,
        draftSize: 12, externalId: `demo-${t}`, draftedAt: new Date(Date.now() - (60 - t) * 864e5), picks: { create: picks },
      },
    });
  }
  console.log(`Seeded ${players.length} players, ${WEEKS} weeks of synthetic scores, 40 demo teams. Login: demo@bestball.test / demo1234`);
}

main().finally(() => db.$disconnect());
