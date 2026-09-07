import type { RDKitModule } from "@rdkit/rdkit";
import type { Atom, FischerResult, MoleculeGraph } from "../../types/molecule";
import { withoutHydrogens } from "./rdkit";

export const FISCHER_UNAVAILABLE = "Fischer projection is not applicable or cannot be uniquely generated for this structure.";
const unavailable = (reason: string): FischerResult => ({ applicable: false, reason });
const neighbors = (graph: MoleculeGraph, id: number) => graph.bonds.filter((b) => b.atom1 === id || b.atom2 === id).map((b) => ({ atom: graph.atoms[b.atom1 === id ? b.atom2 : b.atom1], bond: b }));
const hLabel = (element: string, h: number) => element + (h ? "H" + (h > 1 ? h : "") : "");

function endGroup(graph: MoleculeGraph, atom: Atom): { label: string; rank: number } | null {
  const side = neighbors(graph, atom.id).filter((n) => n.atom.element !== "C");
  if (!side.length && atom.hydrogens === 3) return { label: "CH3", rank: 1 };
  if (side.length === 1 && side[0].atom.element === "O") {
    if (side[0].bond.order === 2 && atom.hydrogens === 1) return { label: "CHO", rank: 4 };
    if (side[0].bond.order === 1 && side[0].atom.hydrogens === 1 && atom.hydrogens === 2) return { label: "CH2OH", rank: 3 };
  }
  if (side.length === 2 && side.every((s) => s.atom.element === "O") && side.some((s) => s.bond.order === 2) && side.some((s) => s.bond.order === 1 && s.atom.hydrogens === 1)) return { label: "COOH", rank: 5 };
  return null;
}

function projectionMolfile(graph: MoleculeGraph, chain: number[], right: boolean[]): string {
  const positions = new Map<number, [number, number]>();
  const wedges = new Map<number, number>();
  chain.forEach((id, row) => {
    positions.set(id, [0, -row * 1.8]);
    const side = neighbors(graph, id).filter((n) => !chain.includes(n.atom.id));
    side.forEach((n, index) => {
      const internal = row > 0 && row < chain.length - 1;
      const x = internal ? (right[row - 1] ? 1.5 : -1.5) : (index ? 1.25 : -1.25);
      positions.set(n.atom.id, [x, -row * 1.8 + (internal ? 0 : row === 0 ? 0.65 : -0.65)]);
      if (internal) wedges.set(n.bond.id, id);
    });
  });
  const f3 = (n: number) => n.toString().padStart(3);
  const coords = (n: number) => n.toFixed(4).padStart(10);
  const atoms = graph.atoms.map((a) => {
    const p = positions.get(a.id)!;
    return `${coords(p[0])}${coords(p[1])}${coords(0)} ${a.element.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`;
  });
  const bonds = graph.bonds.map((b) => {
    const center = wedges.get(b.id);
    const first = center ?? b.atom1;
    const second = center === undefined ? b.atom2 : b.atom1 === center ? b.atom2 : b.atom1;
    return `${f3(first + 1)}${f3(second + 1)}${f3(b.order)}${f3(center === undefined ? 0 : 1)}  0  0  0`;
  });
  return ["Fischer verification", "  Molecule          2D", "", `${f3(atoms.length)}${f3(bonds.length)}  0  0  1  0  0  0  0  0999 V2000`, ...atoms, ...bonds, "M  END", ""].join("\n");
}

export function fischerSvg(top: string, bottom: string, rows: { left: string; right: string; cip: string }[]): string {
  const height = Math.max(280, 140 + rows.length * 75);
  const firstY = 90; const lastY = firstY + (rows.length - 1) * 75;
  const chemicalText = (label: string) => label.replace(/(\d+)/g, '<tspan baseline-shift="sub" font-size="14">$1</tspan>');
  const text = (x: number, y: number, label: string, anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" fill="#253b42" font-family="Arial, sans-serif" font-size="23">${chemicalText(label)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 ${height}" role="img" aria-label="Verified Fischer projection"><rect width="380" height="${height}" fill="white"/><path d="M190 51V${lastY + 39}" stroke="#253b42" stroke-width="2.1"/>${text(190, 31, top)}${rows.map((r, i) => {const y = firstY + i * 75; return `<path d="M120 ${y}H260" stroke="#253b42" stroke-width="2.1"/>${text(105, y, r.left, "end")}${text(275, y, r.right, "start")}<text x="202" y="${y - 12}" fill="#08776d" font-size="13" font-family="Arial">${r.cip}</text>`;}).join("")}${text(190, lastY + 60, bottom)}</svg>`;
}

export function generateFischer(rdkit: RDKitModule, graph: MoleculeGraph): FischerResult {
  if (graph.atoms.some((a) => a.aromatic || a.isotope || a.charge || a.radicalElectrons || a.element === "H")) return unavailable("A neutral, acyclic carbon chain with ordinary isotopes is required by this implementation.");
  const carbons = graph.atoms.filter((a) => a.element === "C");
  if (carbons.length < 3 || carbons.length > 10) return unavailable("Supported projections have a 3–10 carbon parent chain with assigned stereocenters.");
  const cNeighbors = (id: number) => neighbors(graph, id).filter((n) => n.atom.element === "C");
  if (carbons.some((a) => cNeighbors(a.id).length > 2)) return unavailable("Branched carbon skeletons are outside the verified projection scope.");
  const ends = carbons.filter((a) => cNeighbors(a.id).length === 1);
  if (ends.length !== 2) return unavailable("Cyclic structures do not have a supported Fischer parent chain.");
  const endA = endGroup(graph, ends[0]); const endB = endGroup(graph, ends[1]);
  if (!endA || !endB) return unavailable("The terminal groups are outside the supported alcohol, aldehyde, carboxylic acid, and alkyl set.");
  const start = endA.rank >= endB.rank ? ends[0] : ends[1];
  const chain = [start.id];
  while (true) { const next = cNeighbors(chain[chain.length - 1]).find((n) => !chain.includes(n.atom.id)); if (!next) break; if (next.bond.order !== 1) return unavailable("Unsaturated parent chains are outside the supported scope."); chain.push(next.atom.id); }
  if (chain.length !== carbons.length) return unavailable("Disconnected structures cannot share a Fischer projection.");
  const interiors = chain.slice(1, -1);
  const sides = interiors.map((id) => neighbors(graph, id).filter((n) => !chain.includes(n.atom.id)));
  const allowed = { O: 1, N: 2, F: 0, Cl: 0, Br: 0, I: 0 } as Record<string, number>;
  for (let i = 0; i < interiors.length; i++) {
    const atom = graph.atoms[interiors[i]]; const s = sides[i];
    if (!atom.cip || !["R", "S"].includes(atom.cip) || atom.hydrogens !== 1 || s.length !== 1 || s[0].bond.order !== 1 || allowed[s[0].atom.element] !== s[0].atom.hydrogens || neighbors(graph, s[0].atom.id).length !== 1) return unavailable("Every internal carbon must have assigned R/S stereochemistry, one hydrogen, and a supported simple substituent.");
  }
  const represented = new Set([...chain, ...chain.flatMap((id) => neighbors(graph, id).map((n) => n.atom.id))]);
  if (represented.size !== graph.atoms.length || graph.atoms.filter((a) => a.cip).length !== interiors.length) return unavailable("The full structure cannot be represented by this supported chain.");
  // Enumerate the small supported set; RDKit, not hand-written CIP ranking, decides equivalence.
  for (let mask = 0; mask < 2 ** interiors.length; mask++) {
    const right = interiors.map((_, i) => !!(mask & (1 << i)));
    const molfile = projectionMolfile(graph, chain, right);
    try {
      const verifiedSmiles = withoutHydrogens(rdkit, molfile);
      if (verifiedSmiles !== graph.metadata.canonicalSmiles) continue;
      const rows = interiors.map((id, i) => {
        const label = hLabel(sides[i][0].atom.element, sides[i][0].atom.hydrogens);
        return { atomId: id, left: right[i] ? "H" : label, right: right[i] ? label : "H", cip: graph.atoms[id].cip! };
      });
      const top = endGroup(graph, graph.atoms[chain[0]])!.label;
      const bottom = endGroup(graph, graph.atoms[chain[chain.length - 1]])!.label;
      return { applicable: true, top, bottom, rows, molfile, verifiedSmiles, svg: fischerSvg(top, bottom, rows) };
    } catch { /* A candidate must parse and preserve the complete isomeric graph. */ }
  }
  return unavailable("No candidate passed the stereochemistry round-trip check.");
}
