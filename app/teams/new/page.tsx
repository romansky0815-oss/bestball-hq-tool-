import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import TeamForm from "@/components/TeamForm";
import { createTeam } from "@/app/actions/teams";

export default async function NewTeamPage() {
  await requireUser();
  const players = await db.player.findMany({ orderBy: [{ adp: "asc" }, { name: "asc" }] });
  return (
    <div className="stack">
      <h1>Add a team</h1>
      <p className="muted">Pick numbers fill in automatically from your draft slot (snake draft).</p>
      <TeamForm
        action={createTeam}
        players={players.map((p) => ({ id: p.id, label: `${p.name} · ${p.position}${p.nflTeam ? " · " + p.nflTeam : ""}` }))}
      />
    </div>
  );
}
