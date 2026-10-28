import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import ImportForm from "@/components/ImportForm";
import { publishRankings } from "@/app/actions/admin";

const q = (s: string | null | undefined) => (s && /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s ?? "");

export default async function AdminRankings() {
  await requireAdmin();
  const current = await db.rankingSet.findFirst({
    orderBy: { publishedAt: "desc" },
    include: { entries: { include: { player: true }, orderBy: { rank: "asc" } } },
  });
  // Prefill with the live rankings (or ADP order) so an update is "edit and republish".
  const base = current
    ? current.entries.map((e) => [e.rank, q(e.player.name), e.player.position, e.player.nflTeam ?? "", e.tier ?? "", q(e.note)].join(","))
    : (await db.player.findMany({ where: { adp: { not: null } }, orderBy: { adp: "asc" }, take: 240 })).map((p, i) =>
        [i + 1, q(p.name), p.position, p.nflTeam ?? "", "", ""].join(","),
      );
  const csv = ["Rank,Player,Position,Team,Tier,Note", ...base].join("\n");

  return (
    <div className="stack">
      <h1>Publish rankings</h1>
      <p className="muted">
        Edit the CSV below (or upload one) and publish. Each publish creates a new version, and subscribers see movement
        arrows against the previous version. {current && `Live version: “${current.title}”, ${current.publishedAt.toLocaleString()}.`}
      </p>
      <ImportForm action={publishRankings} hidePaste submitLabel="Publish rankings">
        <div className="grid g2">
          <div className="field"><label>Title</label><input name="title" defaultValue={current?.title ?? "Best Ball Rankings"} /></div>
          <div className="field"><label>What changed (shown above the rankings)</label><input name="notes" placeholder="Bumped rookie WRs after camp reports…" /></div>
        </div>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" name="announce" defaultChecked style={{ width: "auto" }} /> Also post a &ldquo;Rankings update&rdquo; to the newsletter</label>
        <textarea name="csv" defaultValue={csv} style={{ minHeight: 420 }} />
      </ImportForm>
    </div>
  );
}
