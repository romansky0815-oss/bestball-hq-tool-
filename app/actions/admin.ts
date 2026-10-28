"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { col, parseCsv } from "@/lib/csv";
import { bumpDataVersion, findOrCreatePlayer, getSetting, setSetting } from "@/lib/data";

async function csvFrom(form: FormData) {
  const file = form.get("file");
  return file instanceof File && file.size ? await file.text() : String(form.get("csv") ?? "");
}

const POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

/** ADP upload: Player, Position, Team, ADP[, Bye]. Players missing from the file keep their old ADP. */
export async function uploadAdp(_: unknown, form: FormData) {
  await requireAdmin();
  const rows = parseCsv(await csvFrom(form));
  let n = 0;
  for (const r of rows) {
    const name = col(r, "Player", "Name", "Player Name") ?? `${col(r, "First Name") ?? ""} ${col(r, "Last Name") ?? ""}`.trim();
    const pos = (col(r, "Position", "Pos", "slotName") ?? "").toUpperCase().replace(/\d+$/, "");
    const adp = Number(col(r, "ADP", "adp", "Average Draft Position"));
    if (!name || !POSITIONS.has(pos) || !Number.isFinite(adp) || adp <= 0) continue;
    const nflTeam = col(r, "Team", "NFL Team", "teamName") ?? null;
    const player = await findOrCreatePlayer(name, pos, nflTeam);
    const bye = Number(col(r, "Bye", "Bye Week"));
    await db.player.update({
      where: { id: player.id },
      data: { adp, ...(nflTeam ? { nflTeam } : {}), ...(bye > 0 ? { byeWeek: bye } : {}) },
    });
    n++;
  }
  await bumpDataVersion();
  revalidatePath("/", "layout");
  return n ? { ok: `Updated ADP for ${n} players.` } : { error: "No valid rows. Expected columns: Player, Position, Team, ADP." };
}

/** Weekly fantasy points: Player, Position, Week, Points[, Team][, Season]. */
export async function uploadScores(_: unknown, form: FormData) {
  await requireAdmin();
  const season = Number(await getSetting("season", String(new Date().getFullYear())));
  const rows = parseCsv(await csvFrom(form));
  let n = 0;
  for (const r of rows) {
    const name = col(r, "Player", "Name", "Player Name");
    const pos = (col(r, "Position", "Pos") ?? "").toUpperCase();
    const week = Number(col(r, "Week", "Wk"));
    const points = Number(col(r, "Points", "Fantasy Points", "FPTS", "Pts"));
    if (!name || !POSITIONS.has(pos) || !week || !Number.isFinite(points)) continue;
    const player = await findOrCreatePlayer(name, pos, col(r, "Team", "NFL Team"));
    const s = Number(col(r, "Season", "Year")) || season;
    await db.weeklyScore.upsert({
      where: { playerId_season_week: { playerId: player.id, season: s, week } },
      update: { points },
      create: { playerId: player.id, season: s, week, points },
    });
    n++;
  }
  await bumpDataVersion();
  revalidatePath("/", "layout");
  return n ? { ok: `Saved ${n} weekly scores.` } : { error: "No valid rows. Expected columns: Player, Position, Week, Points." };
}

export async function saveSettings(form: FormData) {
  await requireAdmin();
  const season = Number(form.get("season"));
  if (season > 2000) await setSetting("season", String(season));
  await bumpDataVersion();
  revalidatePath("/", "layout");
}

export async function setPlan(form: FormData) {
  await requireAdmin();
  await db.user.update({ where: { id: String(form.get("id")) }, data: { plan: String(form.get("plan")) } });
  revalidatePath("/admin");
}

/** Publishes a new rankings version. Rows: Rank, Player, Position[, Team][, Tier][, Note]. */
export async function publishRankings(_: unknown, form: FormData) {
  await requireAdmin();
  const rows = parseCsv(await csvFrom(form));
  const entries: { playerId: string; rank: number; tier: number | null; note: string | null }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const name = col(r, "Player", "Name");
    const pos = (col(r, "Position", "Pos") ?? "").toUpperCase();
    const rank = Number(col(r, "Rank", "Rk", "Overall"));
    if (!name || !POSITIONS.has(pos) || !rank) continue;
    const player = await findOrCreatePlayer(name, pos, col(r, "Team", "NFL Team"));
    if (seen.has(player.id)) continue;
    seen.add(player.id);
    entries.push({ playerId: player.id, rank, tier: Number(col(r, "Tier")) || null, note: col(r, "Note", "Notes", "Comment") ?? null });
  }
  if (!entries.length) return { error: "No valid rows. Expected columns: Rank, Player, Position, Team, Tier, Note." };
  await db.rankingSet.create({
    data: {
      title: String(form.get("title") || "Best Ball Rankings"),
      notes: String(form.get("notes") || "") || null,
      entries: { create: entries },
    },
  });
  if (form.get("announce")) {
    const slug = `rankings-update-${Date.now()}`;
    await db.post.create({
      data: {
        slug,
        title: `Rankings update: ${String(form.get("title") || "Best Ball Rankings")}`,
        category: "RANKINGS",
        excerpt: String(form.get("notes") || "") || "New rankings are live.",
        body: `${String(form.get("notes") || "")}\n\n[View the updated rankings](${process.env.NEXT_PUBLIC_APP_URL ?? ""}/rankings)`,
        premium: false,
      },
    });
  }
  await bumpDataVersion();
  revalidatePath("/", "layout");
  return { ok: `Published ${entries.length} players.` };
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "post";

export async function savePost(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") || "");
  const title = String(form.get("title") || "").trim();
  const data = {
    title,
    category: String(form.get("category") || "NEWS"),
    excerpt: String(form.get("excerpt") || "") || null,
    body: String(form.get("body") || ""),
    premium: form.get("premium") === "on",
  };
  if (!title || !data.body) redirect(`/admin/posts?error=${encodeURIComponent("Title and body are required.")}`);
  if (id) await db.post.update({ where: { id }, data });
  else {
    let slug = slugify(title);
    if (await db.post.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    await db.post.create({ data: { ...data, slug } });
  }
  revalidatePath("/news");
  redirect("/admin/posts");
}

export async function deletePost(form: FormData) {
  await requireAdmin();
  await db.post.delete({ where: { id: String(form.get("id")) } });
  revalidatePath("/news");
  redirect("/admin/posts");
}
