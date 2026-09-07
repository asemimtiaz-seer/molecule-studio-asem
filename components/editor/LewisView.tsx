"use client";
import { useMemo, useState } from "react";
import type { MoleculeGraph } from "@/types/molecule";
import { inferLonePairs } from "@/lib/chemistry/graph";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const valence: Record<string, number> = { H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, Si: 4, P: 5, S: 6, Cl: 7, Br: 7, I: 7 };
export default function LewisView({ graph, onApply }: { graph: MoleculeGraph; onApply: (input: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [pairs, setPairs] = useState("0");
  const layout = useMemo(() => {
    const xs = graph.atoms.map((a) => a.coordinates[0]); const ys = graph.atoms.map((a) => a.coordinates[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min(70, 280 / Math.max(1, maxX - minX), 225 / Math.max(1, maxY - minY));
    return graph.atoms.map((a) => ({ x: 190 + (a.coordinates[0] - (minX + maxX) / 2) * scale, y: 160 - (a.coordinates[1] - (minY + maxY) / 2) * scale }));
  }, [graph]);
  const atom = selected === null ? null : graph.atoms[selected];
  const occupied = atom ? graph.bonds.filter((b) => b.atom1 === atom.id || b.atom2 === atom.id).reduce((sum, b) => sum + b.order, atom.hydrogens) : 0;
  const charge = atom ? valence[atom.element] - occupied - Number(pairs) * 2 : 0;
  const unsupported = graph.atoms.some((a) => inferLonePairs(graph, a.id) === null);
  return <div className="lewis-wrapper"><svg viewBox="0 0 380 325" className="lewis-canvas" aria-label="Condensed Lewis structure with explicit lone pairs and formal charges">
    <rect width="380" height="325" fill="white" />
    {graph.bonds.map((b) => { const a = layout[b.atom1], c = layout[b.atom2]; const dx = c.x - a.x, dy = c.y - a.y, length = Math.hypot(dx, dy) || 1; return Array.from({ length: b.order }, (_, n) => { const offset = (n - (b.order - 1) / 2) * 4; return <line key={`${b.id}-${n}`} x1={a.x + dx / length * 15 + dy / length * offset} y1={a.y + dy / length * 15 - dx / length * offset} x2={c.x - dx / length * 15 + dy / length * offset} y2={c.y - dy / length * 15 - dx / length * offset} stroke="#3f525b" strokeWidth="1.7" />; }); })}
    {graph.atoms.map((a) => {
      const p = layout[a.id]; const inferred = inferLonePairs(graph, a.id);
      const choose = () => { if (inferred !== null) { setSelected(a.id); setPairs(String(inferred)); } };
      return <g key={a.id} role={inferred !== null ? "button" : undefined} tabIndex={inferred !== null ? 0 : undefined} aria-label={`${a.element} atom ${a.id + 1}, ${inferred === null ? "lone pairs not inferred" : `${inferred} lone pairs`}`} onClick={choose} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } }} className={inferred !== null ? "lewis-atom" : ""}>
        <rect x={p.x - 16} y={p.y - 13} width={a.hydrogens ? 48 : 32} height="26" rx="5" fill={selected === a.id ? "#d9eee7" : "white"} />
        <text x={p.x} y={p.y + 6} textAnchor="middle" fill={a.element === "O" ? "#cd4a45" : a.element === "N" ? "#355fb6" : "#2c434b"} fontFamily="Arial" fontSize="18">{a.element}{a.hydrogens > 0 && <tspan>H{a.hydrogens > 1 && <tspan baselineShift="sub" fontSize="11">{a.hydrogens}</tspan>}</tspan>}</text>
        {a.charge !== 0 && <text x={p.x + 23} y={p.y - 9} fontSize="12" fill="#9e4b35">{Math.abs(a.charge) > 1 ? Math.abs(a.charge) : ""}{a.charge > 0 ? "+" : "−"}</text>}
        {Array.from({ length: inferred ?? 0 }, (_, n) => { const angle = -Math.PI / 2 - n * Math.PI / 2; const x = p.x + Math.cos(angle) * 21, y = p.y + Math.sin(angle) * 21; return <g key={n} fill="#41555b"><circle cx={x - Math.sin(angle) * 3} cy={y + Math.cos(angle) * 3} r="1.6" /><circle cx={x + Math.sin(angle) * 3} cy={y - Math.cos(angle) * 3} r="1.6" /></g>; })}
      </g>;
    })}
  </svg><p className="lewis-note">Lone pairs automatically inferred for supported closed-shell atoms. H atoms are grouped; bond stereochemistry is shown in the 2D view.{unsupported && " Aromatic, radical, and unsupported atoms have no inferred electron dots."}</p>
    {atom && <div className="lewis-edit"><span>{atom.element} · atom {atom.id + 1}</span><Select value={pairs} onValueChange={setPairs}><SelectTrigger aria-label="Lone pair count"><SelectValue /></SelectTrigger><SelectContent>{[0, 1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)} disabled={occupied * 2 + n * 2 > (atom.element === "H" ? 2 : 8)}>{n} lone pair{n !== 1 ? "s" : ""}</SelectItem>)}</SelectContent></Select><small>Formal charge will be {charge > 0 ? "+" : ""}{charge}.</small><button className="secondary-button" onClick={() => { const next = structuredClone(graph); next.atoms[atom.id].charge = charge; onApply(JSON.stringify(next)); }}>Apply electrons</button></div>}
    {!atom && <span className="lewis-hint">Select an atom to edit its lone pairs.</span>}
  </div>;
}
