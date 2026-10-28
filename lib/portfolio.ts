import "server-only";
import { db } from "./db";
import { PlayerInfo, PortfolioTeam } from "./exposure";

export async function loadPortfolio(userId: string, filter?: { platform?: string; contest?: string }) {
  const teams = await db.team.findMany({
    where: {
      userId,
      ...(filter?.platform ? { platform: filter.platform } : {}),
      ...(filter?.contest ? { contest: filter.contest } : {}),
    },
    include: { picks: { include: { player: true } } },
    orderBy: { draftedAt: "desc" },
  });
  const players = new Map<string, PlayerInfo>();
  for (const t of teams)
    for (const p of t.picks)
      players.set(p.playerId, { id: p.player.id, name: p.player.name, position: p.player.position, nflTeam: p.player.nflTeam, adp: p.player.adp });
  const portfolio: PortfolioTeam[] = teams.map((t) => ({
    id: t.id,
    name: t.name ?? `Team ${t.id.slice(-5)}`,
    picks: t.picks.map((p) => ({ playerId: p.playerId, pickNumber: p.pickNumber })),
  }));
  const draftSize = teams[0]?.draftSize ?? 12;
  return { teams, portfolio, players, draftSize };
}
