// Turns platform exports into teams. Supports Underdog's exposure CSV
// (one row per pick, grouped by "Draft Entry") and a generic format.
import { col, parseCsv } from "./csv";

export type ParsedPick = { name: string; position: string; nflTeam?: string; pickNumber: number };
export type ParsedTeam = {
  externalId: string;
  name?: string;
  contest?: string;
  entryFee?: number;
  draftSize?: number;
  draftedAt?: Date;
  picks: ParsedPick[];
};

export function parseTeamsCsv(text: string): { teams: ParsedTeam[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const teams = new Map<string, ParsedTeam>();
  rows.forEach((r, i) => {
    const entry = col(r, "Draft Entry", "Entry ID", "Entry", "Team ID", "Team Name", "Draft ID", "Draft");
    const pick = Number(col(r, "Pick Number", "Pick", "Overall Pick", "Overall"));
    const first = col(r, "First Name");
    const last = col(r, "Last Name");
    const name = first || last ? `${first ?? ""} ${last ?? ""}`.trim() : col(r, "Player", "Player Name", "Name");
    const position = (col(r, "Position", "Pos") ?? "").toUpperCase();
    if (!entry || !name || !pick || !position) {
      errors.push(`Row ${i + 2}: missing entry, player, position or pick number`);
      return;
    }
    let t = teams.get(entry);
    if (!t) {
      const fee = Number((col(r, "Tournament Entry Fee", "Draft Entry Fee", "Entry Fee") ?? "").replace(/[$,]/g, ""));
      const picked = col(r, "Picked At", "Drafted At", "Date");
      const size = Number(col(r, "Draft Size", "Teams"));
      t = {
        externalId: entry,
        contest: col(r, "Tournament Title", "Contest", "Draft Pool Title", "Tournament"),
        entryFee: Number.isFinite(fee) && fee > 0 ? fee : undefined,
        draftSize: size > 1 ? size : undefined,
        draftedAt: picked && !Number.isNaN(Date.parse(picked)) ? new Date(picked) : undefined,
        picks: [],
      };
      teams.set(entry, t);
    }
    t.picks.push({ name, position, nflTeam: col(r, "NFL Team", "Team"), pickNumber: pick });
  });
  for (const t of teams.values()) t.picks.sort((a, b) => a.pickNumber - b.pickNumber);
  return { teams: [...teams.values()], errors };
}
