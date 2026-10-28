// Portfolio analysis: player exposure, duplicate-team detection, repeated cores and stacks.

export type PortfolioTeam = {
  id: string;
  name: string;
  picks: { playerId: string; pickNumber: number }[];
};
export type PlayerInfo = { id: string; name: string; position: string; nflTeam: string | null; adp: number | null };

export type ExposureRow = PlayerInfo & {
  count: number;
  pct: number;
  avgPick: number;
  minPick: number;
  maxPick: number;
  clv: number | null; // adp - avgPick: positive = you're drafting him later than the market does now
};

export function exposures(teams: PortfolioTeam[], players: Map<string, PlayerInfo>): ExposureRow[] {
  const agg = new Map<string, number[]>();
  for (const t of teams)
    for (const p of t.picks) {
      const arr = agg.get(p.playerId) ?? [];
      arr.push(p.pickNumber);
      agg.set(p.playerId, arr);
    }
  const rows: ExposureRow[] = [];
  for (const [id, picks] of agg) {
    const info = players.get(id);
    if (!info) continue;
    const avgPick = picks.reduce((a, b) => a + b, 0) / picks.length;
    rows.push({
      ...info,
      count: picks.length,
      pct: teams.length ? (picks.length / teams.length) * 100 : 0,
      avgPick,
      minPick: Math.min(...picks),
      maxPick: Math.max(...picks),
      clv: info.adp != null ? info.adp - avgPick : null,
    });
  }
  return rows.sort((a, b) => b.pct - a.pct || a.avgPick - b.avgPick);
}

export type SimilarPair = { a: PortfolioTeam; b: PortfolioTeam; shared: number; coreShared: number; jaccard: number };

/**
 * Pairs of teams that look alike. `coreRounds` compares only the early picks,
 * which is where duplicated builds actually hurt you in large-field tournaments.
 */
export function similarTeams(
  teams: PortfolioTeam[],
  draftSize = 12,
  coreRounds = 6,
  minJaccard = 0.3,
): SimilarPair[] {
  const sets = teams.map((t) => new Set(t.picks.map((p) => p.playerId)));
  const cores = teams.map(
    (t) => new Set(t.picks.filter((p) => p.pickNumber <= draftSize * coreRounds).map((p) => p.playerId)),
  );
  const out: SimilarPair[] = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) {
      let shared = 0;
      for (const id of sets[i]) if (sets[j].has(id)) shared++;
      let coreShared = 0;
      for (const id of cores[i]) if (cores[j].has(id)) coreShared++;
      const union = sets[i].size + sets[j].size - shared;
      const jaccard = union ? shared / union : 0;
      if (jaccard >= minJaccard || coreShared >= Math.ceil(coreRounds / 2))
        out.push({ a: teams[i], b: teams[j], shared, coreShared, jaccard });
    }
  return out.sort((x, y) => y.coreShared - x.coreShared || y.jaccard - x.jaccard);
}

export type Combo = { playerIds: string[]; count: number; pct: number };

/** Most frequently repeated 2- or 3-player combinations among early picks. */
export function topCombos(
  teams: PortfolioTeam[],
  size: 2 | 3,
  draftSize = 12,
  rounds = 8,
  limit = 15,
): Combo[] {
  const counts = new Map<string, number>();
  for (const t of teams) {
    const ids = t.picks
      .filter((p) => p.pickNumber <= draftSize * rounds)
      .map((p) => p.playerId)
      .sort();
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        if (size === 2) {
          const k = `${ids[i]}|${ids[j]}`;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        } else
          for (let m = j + 1; m < ids.length; m++) {
            const k = `${ids[i]}|${ids[j]}|${ids[m]}`;
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
      }
  }
  return [...counts]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, c]) => ({ playerIds: k.split("|"), count: c, pct: (c / Math.max(1, teams.length)) * 100 }));
}

export type StackRow = { qbId: string; nflTeam: string; teams: number; pct: number; avgStackSize: number };

/** QB stacks: how often you paired each QB with his own pass catchers. */
export function qbStacks(teams: PortfolioTeam[], players: Map<string, PlayerInfo>): StackRow[] {
  const agg = new Map<string, { teams: number; partners: number; nflTeam: string }>();
  for (const t of teams) {
    const roster = t.picks.map((p) => players.get(p.playerId)).filter((p): p is PlayerInfo => !!p);
    for (const qb of roster.filter((p) => p.position === "QB" && p.nflTeam)) {
      const partners = roster.filter(
        (p) => p.nflTeam === qb.nflTeam && (p.position === "WR" || p.position === "TE"),
      ).length;
      if (!partners) continue;
      const a = agg.get(qb.id) ?? { teams: 0, partners: 0, nflTeam: qb.nflTeam as string };
      a.teams++;
      a.partners += partners;
      agg.set(qb.id, a);
    }
  }
  return [...agg]
    .map(([qbId, a]) => ({
      qbId,
      nflTeam: a.nflTeam,
      teams: a.teams,
      pct: (a.teams / Math.max(1, teams.length)) * 100,
      avgStackSize: 1 + a.partners / a.teams,
    }))
    .sort((a, b) => b.teams - a.teams);
}

/** Position build counts, e.g. "3-5-8-2" (QB-RB-WR-TE) → number of teams. */
export function buildCounts(teams: PortfolioTeam[], players: Map<string, PlayerInfo>) {
  const counts = new Map<string, number>();
  for (const t of teams) {
    const c = { QB: 0, RB: 0, WR: 0, TE: 0 } as Record<string, number>;
    for (const p of t.picks) {
      const pos = players.get(p.playerId)?.position;
      if (pos && pos in c) c[pos]++;
    }
    const k = `${c.QB}-${c.RB}-${c.WR}-${c.TE}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([build, n]) => ({ build, n })).sort((a, b) => b.n - a.n);
}
