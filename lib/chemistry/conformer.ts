import { Molecule, ConformerGenerator, ForceFieldMMFF94 } from "openchemlib";
import type { RDKitModule } from "@rdkit/rdkit";
import type { GeometryResult, MoleculeGraph } from "../../types/molecule";
import { withoutHydrogens } from "./rdkit";

export interface ConformerProvider {
  generate(molfile: string, graph: MoleculeGraph): Promise<GeometryResult>;
}
export const unavailableGeometry = (message: string): GeometryResult => ({ molfile: null, status: "unavailable", method: "OpenChemLib", message, verified: false });

export function generateConformer(rdkit: RDKitModule, molfile: string, graph: MoleculeGraph): GeometryResult {
  if (graph.metadata.canonicalSmiles.includes(".")) return unavailableGeometry("3D generation is unavailable for disconnected fragments. The 2D graph and properties include every fragment.");
  if (graph.atoms.some((a) => a.radicalElectrons)) return unavailableGeometry("Radical geometry is outside the supported conformer model. Use the validated 2D structure.");
  if (graph.atoms.length > 250) return unavailableGeometry("3D generation is limited to 250 graph atoms to keep browser computation responsive.");
  try {
    // Canonical SMILES avoids differing interpretations of abbreviated V2000 bond lines.
    const input = Molecule.fromSmiles(graph.metadata.canonicalSmiles);
    const generated = new ConformerGenerator(42).getOneConformerAsMolecule(input);
    if (!generated) return unavailableGeometry("The conformer engine could not find a suitable geometry for this structure.");
    let status: GeometryResult["status"] = "unoptimized";
    let message = "Generated conformer. MMFF94 optimization was unavailable or did not converge.";
    try {
      const forceField = new ForceFieldMMFF94(generated, "MMFF94");
      const code = forceField.minimise({ maxIts: 750, gradTol: 0.001 });
      if (code === 0 && Number.isFinite(forceField.getTotalEnergy())) {
        status = "optimized";
        message = "One generated conformer, locally optimized with MMFF94. Geometry is conformation-dependent; this is not a global energy minimum.";
      }
    } catch { /* A finite verified conformer can still be shown as unoptimized. */ }
    for (let i = 0; i < generated.getAllAtoms(); i++) {
      if (![generated.getAtomX(i), generated.getAtomY(i), generated.getAtomZ(i)].every(Number.isFinite)) return unavailableGeometry("The generated coordinates were invalid and were not displayed.");
    }
    // Remove all 2D wedge hints so validation reads the actual 3D coordinates.
    const lines = generated.toMolfile().split("\n");
    const atomCount = Number(lines[3].slice(0, 3)); const bondCount = Number(lines[3].slice(3, 6));
    // OCL's MOL writer rescales short average bond lengths for 2D display. Preserve actual Å coordinates.
    for (let i = 0; i < atomCount; i++) {
      const values = [generated.getAtomX(i), -generated.getAtomY(i), -generated.getAtomZ(i)];
      lines[4 + i] = values.map((value) => value.toFixed(4).padStart(10)).join("") + lines[4 + i].slice(30);
    }
    for (let i = 4 + atomCount; i < 4 + atomCount + bondCount; i++) lines[i] = lines[i].slice(0, 9) + "  0" + lines[i].slice(12);
    const result = lines.join("\n");
    if (withoutHydrogens(rdkit, result) !== graph.metadata.canonicalSmiles) return unavailableGeometry("The 3D stereochemistry could not be verified against the input. Specify any unknown stereocenters or E/Z bonds; the validated 2D structure is available.");
    return { molfile: result, status, method: status === "optimized" ? "OpenChemLib · MMFF94" : "OpenChemLib conformer", message, verified: true };
  } catch {
    return unavailableGeometry("3D generation is not supported for this structure. Its validated graph and 2D structure remain available.");
  }
}

export class BackendConformerProvider implements ConformerProvider {
  constructor(private readonly endpoint: string) {}
  async generate(molfile: string, graph: MoleculeGraph): Promise<GeometryResult> {
    const response = await fetch(this.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ molfile, isomericSmiles: graph.metadata.canonicalSmiles }), signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error("The optional conformer service is unavailable.");
    // The caller must independently verify the returned MOL against the input before rendering.
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("molfile" in data) || typeof data.molfile !== "string") throw new Error("Invalid conformer service response.");
    return { molfile: data.molfile, status: "unoptimized", verified: false, method: "External service", message: "External coordinates require client-side validation before use." };
  }
}
