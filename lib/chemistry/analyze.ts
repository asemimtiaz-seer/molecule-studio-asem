import type { RDKitModule } from "@rdkit/rdkit";
import type { MoleculeResult } from "../../types/molecule";
import { parseMolecule, nonIsomericSmiles } from "./rdkit";
import { toGraph, formulaFromGraph, graphToRdkitJson } from "./graph";
import { generateFischer } from "./fischer";
import { resolveInput } from "./samples";

export function analyzeMolecule(rdkit: RDKitModule, input: string): MoleculeResult {
  if (input.length > 200000) throw new Error("The input is too large. Import a single small-molecule record.");
  if (input.trim().startsWith("InChI=")) throw new Error("InChI input is not implemented. Please use SMILES or a MOL/SDF file.");
  const normalizedInput = input.trim().startsWith("{") ? graphToRdkitJson(JSON.parse(input)) : resolveInput(input);
  // Reassignment discards E/Z tags in RDKit's JSON reader; preserve graph tags while still sanitizing.
  let mol = parseMolecule(rdkit, normalizedInput, input.trim().startsWith("{"));
  if (input.trim().startsWith("{")) {
    // Reparse the library's isomeric SMILES to populate bond directions before CIP assignment.
    const isomeric = mol.get_smiles(); mol.delete(); mol = parseMolecule(rdkit, isomeric);
  }
  try {
    const representation = JSON.parse(mol.get_json()) as { molecules: { stereoGroups?: unknown[] }[] };
    if (representation.molecules.some((m) => m.stereoGroups?.length)) throw new Error("Enhanced stereo groups (relative or alternative stereochemistry) are not supported. Provide one explicitly assigned stereoisomer.");
    const desc = JSON.parse(mol.get_descriptors()) as Record<string, number>;
    if (desc.NumHeavyAtoms > 500) throw new Error("This workspace supports up to 500 heavy atoms per structure.");
    mol.set_new_coords(true);
    const graph = toGraph(mol);
    const warnings: string[] = [];
    if (desc.NumUnspecifiedAtomStereoCenters > 0) warnings.push(`${desc.NumUnspecifiedAtomStereoCenters} stereocenter(s) are unspecified. Add wedges/dashes or @ notation for an exact stereoisomer.`);
    if (mol.get_smiles().includes(".")) warnings.push("Disconnected fragments are included in the graph and property totals.");
    if (graph.atoms.some((a) => a.radicalElectrons)) warnings.push("This graph contains radicals. Lewis completion and 3D support are limited.");
    const svg = mol.get_svg_with_highlights(JSON.stringify({ width: 700, height: 480, clearBackground: true, addStereoAnnotation: true, padding: 0.16, bondLineWidth: 2, fixedFontSize: 21, backgroundColour: [1, 1, 1, 1] }));
    return {
      smiles: mol.get_smiles(), canonicalSmiles: nonIsomericSmiles(mol), graph,
      molfile: mol.get_molblock(), svg,
      properties: { formula: formulaFromGraph(graph), molecularWeight: desc.amw, exactMass: desc.exactmw,
        charge: graph.atoms.reduce((sum, atom) => sum + atom.charge, 0), atoms: desc.NumAtoms,
        heavyAtoms: desc.NumHeavyAtoms, bonds: graph.bonds.length, donors: desc.NumHBD, acceptors: desc.NumHBA,
        rotatableBonds: desc.NumRotatableBonds, stereocenters: desc.NumAtomStereoCenters,
        unspecifiedStereocenters: desc.NumUnspecifiedAtomStereoCenters, rings: desc.NumRings, tpsa: desc.tpsa, logP: desc.CrippenClogP },
      fischer: generateFischer(rdkit, graph), geometry: null, warnings,
    };
  } finally { mol.delete(); }
}
