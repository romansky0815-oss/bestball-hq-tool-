import { test } from "node:test";
import assert from "node:assert/strict";
import { bestBallWeek, ScoreTable } from "./bestball";
import { cohortFor, gradeTeam, letterFromPercentile, PoolPlayer } from "./grading";
import { exposures, similarTeams, topCombos, qbStacks } from "./exposure";
import { parseTeamsCsv } from "./importTeams";
import { normalizeName } from "./names";

test("best ball week picks optimal lineup incl. flex", () => {
  const pts = bestBallWeek([
    { position: "QB", points: 20 }, { position: "QB", points: 25 },
    { position: "RB", points: 10 }, { position: "RB", points: 12 }, { position: "RB", points: 9 },
    { position: "WR", points: 5 }, { position: "WR", points: 6 }, { position: "WR", points: 7 }, { position: "WR", points: 30 },
    { position: "TE", points: 8 }, { position: "TE", points: 11 },
  ]);
  // QB25 + RB12+10 + WR30+7+6 + TE11 + FLEX max(9, WR5, TE8)=9
  assert.equal(pts, 25 + 22 + 43 + 11 + 9);
});

test("cohort widens until it has enough players", () => {
  const pool: PoolPlayer[] = [1, 2, 30, 31, 32, 60].map((adp, i) => ({ id: `p${i}`, name: `P${i}`, position: "WR", adp }));
  assert.equal(cohortFor({ pickNumber: 31, position: "WR" }, pool).length >= 3, true);
  assert.ok(cohortFor({ pickNumber: 1, position: "WR" }, pool).length >= 4);
});

test("team that hit on its picks grades high, one that whiffed grades low", () => {
  const pool: PoolPlayer[] = [];
  const positions = ["QB", "RB", "WR", "TE"];
  for (let i = 1; i <= 220; i++) pool.push({ id: `p${i}`, name: `p${i}`, position: positions[i % 4], adp: i });
  const picks: { playerId: string; pickNumber: number }[] = [];
  for (let r = 0; r < 18; r++) {
    const pickNumber = r % 2 === 0 ? r * 12 + 6 : r * 12 + 7;
    picks.push({ playerId: cohortFor({ pickNumber, position: positions[r % 4] }, pool)[0].id, pickNumber });
  }
  const mine = new Set(picks.map((p) => p.playerId));
  const weeks = [1, 2, 3, 4, 5, 6];
  const table = (hit: number, miss: number): ScoreTable =>
    new Map(pool.map((p) => [p.id, new Map(weeks.map((w) => [w, mine.has(p.id) ? hit : miss + ((p.adp! * w) % 7)]))]));
  const good = gradeTeam({ teamId: "t1", picks, pool, scores: table(25, 5), weeks });
  assert.ok(good.percentile > 95, `good percentile ${good.percentile}`);
  assert.equal(letterFromPercentile(good.percentile), "A+");
  assert.equal(good.picks.length, 18);
  const bad = gradeTeam({ teamId: "t1", picks, pool, scores: table(0, 10), weeks });
  assert.ok(bad.percentile < 5, `bad percentile ${bad.percentile}`);
  const preseason = gradeTeam({ teamId: "t1", picks, pool, scores: new Map(), weeks: [] });
  assert.equal(preseason.grade, "—");
});

function sum(s: ScoreTable, id: string) {
  return [...(s.get(id)?.values() ?? [])].reduce((a, b) => a + b, 0);
}

test("exposure, similarity, combos and stacks", () => {
  const players = new Map(
    [
      ["qb", "QB", "KC"], ["wr1", "WR", "KC"], ["wr2", "WR", "MIA"], ["rb1", "RB", "SF"], ["te", "TE", "KC"],
    ].map(([id, position, nflTeam]) => [id, { id, name: id, position, nflTeam, adp: 10 }]),
  );
  const teams = [
    { id: "a", name: "A", picks: [{ playerId: "qb", pickNumber: 5 }, { playerId: "wr1", pickNumber: 20 }, { playerId: "rb1", pickNumber: 29 }] },
    { id: "b", name: "B", picks: [{ playerId: "qb", pickNumber: 6 }, { playerId: "wr1", pickNumber: 19 }, { playerId: "rb1", pickNumber: 30 }] },
    { id: "c", name: "C", picks: [{ playerId: "wr2", pickNumber: 6 }, { playerId: "te", pickNumber: 19 }] },
  ];
  const ex = exposures(teams, players);
  assert.equal(ex.find((r) => r.id === "qb")!.pct.toFixed(1), "66.7");
  const sim = similarTeams(teams);
  assert.equal(sim[0].shared, 3);
  assert.equal(topCombos(teams, 3)[0].count, 2);
  assert.equal(qbStacks(teams, players)[0].teams, 2);
});

test("parses Underdog exposure export", () => {
  const csv = [
    "Picked At,Pick Number,Appearance,First Name,Last Name,Team,Position,Draft,Draft Entry,Draft Entry Fee,Draft Size,Tournament Title,Tournament Entry Fee",
    '2026-08-01 12:00:00 UTC,6,x,Ja\'Marr,Chase,CIN,WR,d1,e1,25,12,"Best Ball Mania VII",25',
    "2026-08-01 12:01:00 UTC,19,x,Bijan,Robinson,ATL,RB,d1,e1,25,12,Best Ball Mania VII,25",
    "2026-08-02 12:00:00 UTC,1,x,Saquon,Barkley,PHI,RB,d2,e2,10,12,Puppy,10",
  ].join("\n");
  const { teams, errors } = parseTeamsCsv(csv);
  assert.deepEqual(errors, []);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].picks[0].name, "Ja'Marr Chase");
  assert.equal(teams[0].picks[0].nflTeam, "CIN");
  assert.equal(teams[0].contest, "Best Ball Mania VII");
  assert.equal(teams[0].entryFee, 25);
});

test("name normalization", () => {
  assert.equal(normalizeName("Marvin Harrison Jr."), "marvin harrison");
  assert.equal(normalizeName("Ja'Marr Chase"), "jamarr chase");
});
