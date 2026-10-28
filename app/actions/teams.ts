"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isPro, requireUser } from "@/lib/auth";
import { findOrCreatePlayer } from "@/lib/data";
import { parseTeamsCsv } from "@/lib/importTeams";
import { FREE_TEAM_LIMIT } from "@/lib/plans";

async function remainingSlots(user: Awaited<ReturnType<typeof requireUser>>) {
  if (isPro(user)) return Infinity;
  return FREE_TEAM_LIMIT - (await db.team.count({ where: { userId: user.id } }));
}

export async function createTeam(_: unknown, form: FormData) {
  const user = await requireUser();
  if ((await remainingSlots(user)) <= 0)
    return { error: `Free accounts can track ${FREE_TEAM_LIMIT} teams. Upgrade to Pro for unlimited.` };

  const draftSize = Number(form.get("draftSize") || 12);
  const playerIds = form.getAll("playerId").map(String);
  const pickNumbers = form.getAll("pickNumber").map(Number);
  const picks = playerIds
    .map((playerId, i) => ({ playerId, pickNumber: pickNumbers[i] }))
    .filter((p) => p.playerId && p.pickNumber > 0);
  if (picks.length < 2) return { error: "Add at least two players." };
  if (new Set(picks.map((p) => p.playerId)).size !== picks.length) return { error: "A player appears twice." };

  const team = await db.team.create({
    data: {
      userId: user.id,
      name: String(form.get("name") || "") || null,
      platform: String(form.get("platform") || "Underdog"),
      contest: String(form.get("contest") || "") || null,
      entryFee: Number(form.get("entryFee")) || null,
      draftSize,
      draftedAt: form.get("draftedAt") ? new Date(String(form.get("draftedAt"))) : new Date(),
      picks: { create: picks },
    },
  });
  revalidatePath("/teams");
  redirect(`/teams/${team.id}`);
}

export async function importTeams(_: unknown, form: FormData) {
  const user = await requireUser();
  const file = form.get("file");
  const text = file instanceof File && file.size ? await file.text() : String(form.get("csv") ?? "");
  if (!text.trim()) return { error: "Choose a CSV file or paste CSV text." };
  const platform = String(form.get("platform") || "Underdog");
  const { teams, errors } = parseTeamsCsv(text);
  if (!teams.length) return { error: errors[0] ?? "No teams found in that file." };

  let slots = await remainingSlots(user);
  let created = 0;
  let skipped = 0;
  let limited = 0;
  for (const t of teams) {
    if (await db.team.findUnique({ where: { userId_externalId: { userId: user.id, externalId: t.externalId } } })) {
      skipped++;
      continue;
    }
    if (slots <= 0) {
      limited++;
      continue;
    }
    const picks = [];
    for (const p of t.picks) {
      const player = await findOrCreatePlayer(p.name, p.position, p.nflTeam);
      picks.push({ playerId: player.id, pickNumber: p.pickNumber });
    }
    await db.team.create({
      data: {
        userId: user.id,
        externalId: t.externalId,
        platform,
        contest: t.contest ?? null,
        entryFee: t.entryFee ?? null,
        draftSize: t.draftSize ?? 12,
        draftedAt: t.draftedAt ?? new Date(),
        picks: { create: picks },
      },
    });
    created++;
    slots--;
  }
  revalidatePath("/teams");
  const parts = [`Imported ${created} team${created === 1 ? "" : "s"}.`];
  if (skipped) parts.push(`${skipped} already imported.`);
  if (limited) parts.push(`${limited} skipped — free plan limit is ${FREE_TEAM_LIMIT} teams.`);
  if (errors.length) parts.push(`${errors.length} rows could not be read.`);
  return { ok: parts.join(" ") };
}

export async function deleteTeam(form: FormData) {
  const user = await requireUser();
  await db.team.deleteMany({ where: { id: String(form.get("id")), userId: user.id } });
  revalidatePath("/teams");
  redirect("/teams");
}

export async function renameTeam(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id"));
  await db.team.updateMany({ where: { id, userId: user.id }, data: { name: String(form.get("name") || "") || null } });
  revalidatePath(`/teams/${id}`);
}
