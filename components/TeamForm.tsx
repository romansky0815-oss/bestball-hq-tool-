"use client";
import { useActionState, useMemo, useState } from "react";

type P = { id: string; label: string };
type Action = (prev: unknown, form: FormData) => Promise<{ error?: string } | undefined>;

/** Snake-draft overall pick number for a slot (1-based) and round (1-based). */
function snakePick(slot: number, round: number, size: number) {
  return (round - 1) * size + (round % 2 === 1 ? slot : size - slot + 1);
}

export default function TeamForm({ players, action }: { players: P[]; action: Action }) {
  const [state, run, pending] = useActionState(action, undefined);
  const [slot, setSlot] = useState(1);
  const [size, setSize] = useState(12);
  const [rounds, setRounds] = useState(18);
  const [labels, setLabels] = useState<string[]>(Array(20).fill(""));
  const byLabel = useMemo(() => new Map(players.map((p) => [p.label, p.id])), [players]);

  return (
    <form action={run} className="stack">
      <div className="card grid g4">
        <div className="field"><label>Team name</label><input name="name" placeholder="optional" /></div>
        <div className="field">
          <label>Platform</label>
          <select name="platform">
            <option>Underdog</option><option>DraftKings</option><option>Drafters</option><option>Other</option>
          </select>
        </div>
        <div className="field"><label>Contest</label><input name="contest" placeholder="Best Ball Mania" /></div>
        <div className="field"><label>Entry fee</label><input name="entryFee" type="number" step="0.01" /></div>
        <div className="field"><label>Draft date</label><input name="draftedAt" type="date" /></div>
        <div className="field"><label>Draft slot</label><input type="number" min={1} max={size} value={slot} onChange={(e) => setSlot(Number(e.target.value) || 1)} /></div>
        <div className="field"><label>Teams in draft</label><input name="draftSize" type="number" min={2} max={20} value={size} onChange={(e) => setSize(Number(e.target.value) || 12)} /></div>
        <div className="field"><label>Rounds</label><input type="number" min={2} max={20} value={rounds} onChange={(e) => setRounds(Math.min(20, Number(e.target.value) || 18))} /></div>
      </div>

      <div className="card table-wrap">
        <datalist id="players">{players.map((p) => <option key={p.id} value={p.label} />)}</datalist>
        <table>
          <thead><tr><th>Rd</th><th>Pick</th><th style={{ width: "70%" }}>Player</th></tr></thead>
          <tbody>
            {Array.from({ length: rounds }, (_, i) => {
              const id = byLabel.get(labels[i]) ?? "";
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input name="pickNumber" type="number" value={snakePick(slot, i + 1, size)} readOnly style={{ width: 70 }} /></td>
                  <td>
                    <input list="players" value={labels[i]} placeholder="Start typing a name…"
                      onChange={(e) => setLabels((l) => l.map((v, j) => (j === i ? e.target.value : v)))}
                      style={labels[i] && !id ? { borderColor: "var(--bad)" } : undefined} />
                    <input type="hidden" name="playerId" value={id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {state?.error && <div className="alert err">{state.error}</div>}
      <div><button className="btn primary" disabled={pending}>Save team</button></div>
    </form>
  );
}
