// Grades a best-ball team against "ADP twins": simulated teams that drafted the
// same positions at the same pick numbers, choosing among players whose ADP was
// near each of your picks. Your percentile within that cohort is the grade.

import { DEFAULT_LINEUP, LineupConfig, ScoreTable, playerTotal, seasonScore } from "./bestball";

export type PoolPlayer = { id: string; name: string; position: string; adp: number | null };
export type TeamPick = { playerId: string; pickNumber: number };

export type PickReport = {
  playerId: string;
  name: string;
  position: string;
  pickNumber: number;
  adp: number | null;
  adpValue: number | null; // pickNumber - adp; positive means you got him later than ADP
  points: number;
  cohortAvg: number; // average points of same-position players drafted around this pick
  pointsOverCohort: number;
  cohortSize: number;
  myRank: number | null;
};

export type TeamGrade = {
  total: number;
  weekly: number[];
  cohortMean: number;
  cohortP90: number;
  percentile: number; // 0-100
  grade: string;
  draftValue: number; // avg pickNumber - adp across picks
  draftGrade: string;
  picks: PickReport[];
};

export function letterFromPercentile(p: number): string {
  if (p >= 95) return "A+";
  if (p >= 85) return "A";
  if (p >= 75) return "A-";
  if (p >= 65) return "B+";
  if (p >= 55) return "B";
  if (p >= 45) return "B-";
  if (p >= 35) return "C+";
  if (p >= 25) return "C";
  if (p >= 15) return "D";
  return "F";
}

/** Draft-day grade from average ADP value (picks after ADP) and value against your rankings. */
export function letterFromDraftValue(v: number): string {
  if (v >= 4) return "A+";
  if (v >= 2.5) return "A";
  if (v >= 1.25) return "B+";
  if (v >= 0) return "B";
  if (v >= -1.5) return "C+";
  if (v >= -3) return "C";
  if (v >= -5) return "D";
  return "F";
}

/** Deterministic PRNG so a team's grade doesn't jitter between page loads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function cohortWindow(pickNumber: number): number {
  // Tight early (ADP is sticky in round 1), wider late where ADP is noisy.
  return Math.max(3, Math.round(pickNumber * 0.1));
}

/** Players at the same position whose ADP falls near the pick. Widens until at least `min` are found. */
export function cohortFor(
  pick: { pickNumber: number; position: string },
  pool: PoolPlayer[],
  min = 4,
): PoolPlayer[] {
  let w = cohortWindow(pick.pickNumber);
  const samePos = pool.filter((p) => p.position === pick.position && p.adp != null);
  for (let i = 0; i < 6; i++) {
    const c = samePos.filter((p) => Math.abs((p.adp as number) - pick.pickNumber) <= w);
    if (c.length >= min) return c;
    w = Math.ceil(w * 1.6);
  }
  return samePos.filter((p) => Math.abs((p.adp as number) - pick.pickNumber) <= w);
}

export function gradeTeam(opts: {
  teamId: string;
  picks: TeamPick[];
  pool: PoolPlayer[];
  scores: ScoreTable;
  weeks: number[];
  myRanks?: Map<string, number>;
  sims?: number;
  lineup?: LineupConfig;
}): TeamGrade {
  const { picks, pool, scores, weeks, myRanks, sims = 400, lineup = DEFAULT_LINEUP } = opts;
  const byId = new Map(pool.map((p) => [p.id, p]));
  const roster = picks
    .map((pk) => ({ pk, p: byId.get(pk.playerId) }))
    .filter((x): x is { pk: TeamPick; p: PoolPlayer } => !!x.p)
    .sort((a, b) => a.pk.pickNumber - b.pk.pickNumber);

  const actual = seasonScore(
    roster.map((r) => r.p),
    scores,
    weeks,
    lineup,
  );

  const cohorts = roster.map((r) => cohortFor({ pickNumber: r.pk.pickNumber, position: r.p.position }, pool));

  const pickReports: PickReport[] = roster.map((r, i) => {
    const pts = playerTotal(r.p.id, scores, weeks);
    const c = cohorts[i];
    const cohortAvg = c.length ? c.reduce((a, p) => a + playerTotal(p.id, scores, weeks), 0) / c.length : 0;
    return {
      playerId: r.p.id,
      name: r.p.name,
      position: r.p.position,
      pickNumber: r.pk.pickNumber,
      adp: r.p.adp,
      adpValue: r.p.adp != null ? r.pk.pickNumber - r.p.adp : null,
      points: pts,
      cohortAvg,
      pointsOverCohort: pts - cohortAvg,
      cohortSize: c.length,
      myRank: myRanks?.get(r.p.id) ?? null,
    };
  });

  // Monte Carlo: build ADP-twin teams pick by pick, never repeating a player.
  const rand = mulberry32(hashString(opts.teamId));
  const simTotals: number[] = [];
  if (weeks.length > 0) {
    for (let s = 0; s < sims; s++) {
      const used = new Set<string>();
      const alt: PoolPlayer[] = [];
      for (let i = 0; i < roster.length; i++) {
        const options = cohorts[i].filter((p) => !used.has(p.id));
        const choice = options.length ? options[Math.floor(rand() * options.length)] : roster[i].p;
        used.add(choice.id);
        alt.push(choice);
      }
      simTotals.push(seasonScore(alt, scores, weeks, lineup).total);
    }
  }
  simTotals.sort((a, b) => a - b);
  const below = simTotals.filter((t) => t < actual.total).length;
  const ties = simTotals.filter((t) => t === actual.total).length;
  const percentile = simTotals.length ? ((below + ties / 2) / simTotals.length) * 100 : 50;
  const cohortMean = simTotals.length ? simTotals.reduce((a, b) => a + b, 0) / simTotals.length : 0;
  const cohortP90 = simTotals.length ? simTotals[Math.floor(simTotals.length * 0.9)] : 0;

  // Draft value: half ADP value, half value against your own rankings when available.
  const vals = pickReports.map((p) => {
    const adpV = p.adpValue ?? 0;
    const rankV = p.myRank != null ? p.pickNumber - p.myRank : adpV;
    return (adpV + rankV) / 2;
  });
  // Scale by pick so a 3-spot steal in round 1 counts as much as a 15-spot steal in round 15.
  const scaled = vals.map((v, i) => v / Math.max(1, cohortWindow(pickReports[i].pickNumber) / 3));
  const draftValue = scaled.length ? scaled.reduce((a, b) => a + b, 0) / scaled.length : 0;

  return {
    total: actual.total,
    weekly: actual.weekly,
    cohortMean,
    cohortP90,
    percentile,
    grade: weeks.length ? letterFromPercentile(percentile) : "—",
    draftValue,
    draftGrade: letterFromDraftValue(draftValue),
    picks: pickReports,
  };
}
