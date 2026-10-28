// Best-ball lineup math. Each week a team is credited with its optimal lineup.

export type Position = "QB" | "RB" | "WR" | "TE";

export type LineupConfig = {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number; // RB / WR / TE
};

// Underdog Best Ball Mania structure. DraftKings uses QB1 RB2 WR3 TE1 FLEX1 as well.
export const DEFAULT_LINEUP: LineupConfig = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 };

const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

export type WeekLine = { position: string; points: number };

/** Optimal best-ball score for a single week. */
export function bestBallWeek(lines: WeekLine[], cfg: LineupConfig = DEFAULT_LINEUP): number {
  const byPos: Record<string, number[]> = { QB: [], RB: [], WR: [], TE: [] };
  for (const l of lines) byPos[l.position]?.push(l.points);
  let total = 0;
  const flexPool: number[] = [];
  for (const pos of ["QB", "RB", "WR", "TE"] as const) {
    const pts = byPos[pos].sort((a, b) => b - a);
    const n = cfg[pos];
    for (let i = 0; i < pts.length; i++) {
      if (i < n) total += pts[i];
      else if (FLEX_POSITIONS.has(pos)) flexPool.push(pts[i]);
    }
  }
  flexPool.sort((a, b) => b - a);
  for (let i = 0; i < cfg.FLEX && i < flexPool.length; i++) total += flexPool[i];
  return total;
}

/** points[playerId][week] */
export type ScoreTable = Map<string, Map<number, number>>;

export function seasonScore(
  roster: { id: string; position: string }[],
  scores: ScoreTable,
  weeks: number[],
  cfg: LineupConfig = DEFAULT_LINEUP,
): { total: number; weekly: number[] } {
  const weekly = weeks.map((w) =>
    bestBallWeek(
      roster.map((p) => ({ position: p.position, points: scores.get(p.id)?.get(w) ?? 0 })),
      cfg,
    ),
  );
  return { total: weekly.reduce((a, b) => a + b, 0), weekly };
}

export function playerTotal(id: string, scores: ScoreTable, weeks: number[]): number {
  const m = scores.get(id);
  if (!m) return 0;
  let t = 0;
  for (const w of weeks) t += m.get(w) ?? 0;
  return t;
}
