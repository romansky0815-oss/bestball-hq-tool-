import Link from "next/link";
import { requireUser } from "@/lib/auth";
import ImportForm from "@/components/ImportForm";
import { importTeams } from "@/app/actions/teams";

export default async function ImportPage() {
  await requireUser();
  return (
    <div className="stack">
      <h1>Import teams</h1>
      <div className="card small">
        <p><strong>Underdog:</strong> Profile → Settings → Export exposure CSV. Upload the file as-is; teams are grouped by <code>Draft Entry</code>. Re-uploading is safe — teams already imported are skipped.</p>
        <p style={{ marginBottom: 0 }}><strong>Any other site:</strong> one row per pick with columns <code>Entry ID, Pick Number, Player, Position, NFL Team</code> (optional: <code>Contest, Entry Fee, Draft Size, Drafted At</code>).</p>
      </div>
      <ImportForm action={importTeams}>
        <div className="field" style={{ maxWidth: 240 }}>
          <label>Platform</label>
          <select name="platform"><option>Underdog</option><option>DraftKings</option><option>Drafters</option><option>Other</option></select>
        </div>
      </ImportForm>
      <Link href="/teams">← Back to teams</Link>
    </div>
  );
}
