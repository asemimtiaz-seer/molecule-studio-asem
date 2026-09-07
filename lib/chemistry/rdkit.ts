import type { RDKitModule, JSMol } from "@rdkit/rdkit";

export function parseMolecule(rdkit: RDKitModule, input: string, preserveJsonStereo = false): JSMol {
  let mol: JSMol | null = null;
  try { mol = rdkit.get_mol(input, preserveJsonStereo ? JSON.stringify({ assignStereo: false }) : "{}"); } catch { /* RDKit can throw or return null on invalid input. */ }
  if (!mol || !mol.is_valid()) {
    mol?.delete();
    throw new Error("This structure could not be validated. Check atom valences, bond orders, charges, and ring closures. Carbon normally supports a total bond order of four.");
  }
  if (!mol.get_smiles()) { mol.delete(); throw new Error("Add an atom or enter a SMILES string to get started."); }
  return mol;
}

export function withoutHydrogens(rdkit: RDKitModule, molfile: string): string {
  const mol = parseMolecule(rdkit, molfile);
  try {
    const noH = parseMolecule(rdkit, mol.remove_hs());
    try { return noH.get_smiles(); } finally { noH.delete(); }
  } finally { mol.delete(); }
}

export function nonIsomericSmiles(mol: JSMol): string {
  return (mol.get_smiles as (options?: string) => string)(JSON.stringify({ doIsomericSmiles: false }));
}
