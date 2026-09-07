import type { JSMol } from "@rdkit/rdkit";
import type { MoleculeGraph } from "../../types/molecule";

const elements = "* H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" ");
type RawAtom = { z?: number; impHs?: number; chg?: number; isotope?: number; nRad?: number; stereo?: string };
type RawBond = { atoms: [number, number]; bo?: number; stereo?: string; stereoAtoms?: number[] };
interface RawJson {
  defaults: { atom: Required<RawAtom>; bond: { bo: number; stereo: string } };
  molecules: { atoms: RawAtom[]; bonds: RawBond[]; conformers?: { coords: number[][] }[];
    extensions?: { name: string; aromaticAtoms?: number[]; aromaticBonds?: number[]; cipCodes?: [number, string][] }[] }[];
}

export function toGraph(mol: JSMol): MoleculeGraph {
  const json = JSON.parse(mol.get_json()) as RawJson;
  const raw = json.molecules[0];
  const ext = raw.extensions?.find((e) => e.name === "rdkitRepresentation");
  const cip = new Map(ext?.cipCodes ?? []);
  const tags = JSON.parse(mol.get_stereo_tags()) as { CIP_atoms: [number, string][]; CIP_bonds: [number, number, string][] };
  return {
    version: 1,
    atoms: raw.atoms.map((entry, id) => {
      const a = { ...json.defaults.atom, ...entry };
      const coords = raw.conformers?.[0]?.coords[id] ?? [0, 0, 0];
      return { id, element: elements[a.z] ?? "*", atomicNumber: a.z, charge: a.chg,
        hydrogens: a.impHs, isotope: a.isotope, radicalElectrons: a.nRad,
        aromatic: ext?.aromaticAtoms?.includes(id) ?? false, stereo: a.stereo, cip: cip.get(id),
        coordinates: [coords[0], coords[1], coords[2] ?? 0] };
    }),
    bonds: raw.bonds.map((b, id) => ({ id, atom1: b.atoms[0], atom2: b.atoms[1],
      order: b.bo ?? json.defaults.bond.bo, aromatic: ext?.aromaticBonds?.includes(id) ?? false,
      stereo: b.stereo ?? json.defaults.bond.stereo, stereoAtoms: b.stereoAtoms })),
    stereochemistry: { atoms: tags.CIP_atoms ?? [], bonds: tags.CIP_bonds ?? [] },
    metadata: { source: "RDKit", canonicalSmiles: mol.get_smiles(), molfile: mol.get_molblock() },
  };
}

export function graphToRdkitJson(data: unknown): string {
  if (!data || typeof data !== "object") throw new Error("Invalid molecular JSON.");
  const graph = data as MoleculeGraph;
  if (graph.version !== 1 || !Array.isArray(graph.atoms) || !Array.isArray(graph.bonds) || graph.atoms.length > 500 || graph.bonds.length > 1500) throw new Error("Expected a version 1 molecular graph with at most 500 atoms.");
  const n = graph.atoms.length;
  const atoms = graph.atoms.map((a, i) => {
    if (a.id !== i || !Number.isInteger(a.atomicNumber) || a.atomicNumber < 1 || a.atomicNumber > 118 || elements[a.atomicNumber] !== a.element || !Number.isInteger(a.charge) || Math.abs(a.charge) > 8 || !Number.isInteger(a.hydrogens) || a.hydrogens < 0 || a.hydrogens > 8 || !Number.isInteger(a.isotope) || a.isotope < 0 || !Number.isInteger(a.radicalElectrons) || a.radicalElectrons < 0 || a.radicalElectrons > 4 || !["unspecified", "cw", "ccw"].includes(a.stereo)) throw new Error("Invalid atom in molecular JSON.");
    return { z: a.atomicNumber, impHs: a.hydrogens, chg: a.charge, isotope: a.isotope, nRad: a.radicalElectrons, stereo: a.stereo };
  });
  const seen = new Set<string>();
  const bonds = graph.bonds.map((b, i) => {
    if (b.id !== i || ![b.atom1, b.atom2].every((v) => Number.isInteger(v) && v >= 0 && v < n) || b.atom1 === b.atom2 || ![1, 2, 3].includes(b.order) || !["unspecified", "cis", "trans", "either"].includes(b.stereo)) throw new Error("Invalid bond in molecular JSON.");
    const key = [b.atom1, b.atom2].sort((a, c) => a - c).join(":");
    if (seen.has(key)) throw new Error("Duplicate bond in molecular JSON."); seen.add(key);
    if (b.stereoAtoms && (!Array.isArray(b.stereoAtoms) || b.stereoAtoms.length !== 2 || !b.stereoAtoms.every((v) => Number.isInteger(v) && v >= 0 && v < n))) throw new Error("Invalid bond stereochemistry.");
    return { atoms: [b.atom1, b.atom2], bo: b.order, stereo: b.stereo, ...(b.stereoAtoms ? { stereoAtoms: b.stereoAtoms } : {}) };
  });
  return JSON.stringify({ rdkitjson: { version: 12 }, defaults: { atom: { z: 6, impHs: 0, chg: 0, nRad: 0, isotope: 0, stereo: "unspecified" }, bond: { bo: 1, stereo: "unspecified" } }, molecules: [{ atoms, bonds }] });
}

export function formulaFromGraph(graph: MoleculeGraph): string {
  const counts: Record<string, number> = {};
  for (const a of graph.atoms) {
    const symbol = a.isotope ? `[${a.isotope}${a.element}]` : a.element;
    counts[symbol] = (counts[symbol] ?? 0) + 1;
    if (a.hydrogens) counts.H = (counts.H ?? 0) + a.hydrogens;
  }
  const names = Object.keys(counts).sort();
  const order = counts.C ? ["C", ...(counts.H ? ["H"] : []), ...names.filter((s) => s !== "C" && s !== "H")] : names;
  return order.map((s) => s + (counts[s] > 1 ? counts[s] : "")).join("");
}

export function inferLonePairs(graph: MoleculeGraph, atomId: number): number | null {
  const a = graph.atoms[atomId];
  const valenceElectrons: Record<string, number> = { H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, Si: 4, P: 5, S: 6, Cl: 7, Br: 7, I: 7 };
  if (!a || a.aromatic || a.radicalElectrons || a.isotope || valenceElectrons[a.element] === undefined) return null;
  const bonds = graph.bonds.filter((b) => b.atom1 === a.id || b.atom2 === a.id);
  const occupied = bonds.reduce((n, b) => n + b.order, a.hydrogens);
  const electrons = valenceElectrons[a.element] - a.charge - occupied;
  if (electrons < 0 || electrons % 2 !== 0 || electrons + occupied * 2 > (a.element === "H" ? 2 : 8)) return null;
  return electrons / 2;
}
