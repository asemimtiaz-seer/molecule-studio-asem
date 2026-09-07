export interface Atom {
  id: number;
  element: string;
  atomicNumber: number;
  charge: number;
  hydrogens: number;
  isotope: number;
  radicalElectrons: number;
  aromatic: boolean;
  stereo: string;
  cip?: string;
  coordinates: [number, number, number];
}

export interface Bond {
  id: number;
  atom1: number;
  atom2: number;
  order: number;
  aromatic: boolean;
  stereo: string;
  stereoAtoms?: number[];
}

export interface MoleculeGraph {
  version: 1;
  atoms: Atom[];
  bonds: Bond[];
  stereochemistry: { atoms: [number, string][]; bonds: [number, number, string][] };
  metadata: { source: "RDKit"; canonicalSmiles: string; molfile: string };
}

export interface MolecularProperties {
  formula: string;
  molecularWeight: number;
  exactMass: number;
  charge: number;
  atoms: number;
  heavyAtoms: number;
  bonds: number;
  donors: number;
  acceptors: number;
  rotatableBonds: number;
  stereocenters: number;
  unspecifiedStereocenters: number;
  rings: number;
  tpsa: number;
  logP: number;
}

export interface FischerRow { atomId: number; left: string; right: string; cip: string }
export type FischerResult =
  | { applicable: true; top: string; bottom: string; rows: FischerRow[]; molfile: string; svg: string; verifiedSmiles: string }
  | { applicable: false; reason: string };

export interface GeometryResult {
  molfile: string | null;
  status: "optimized" | "unoptimized" | "unavailable";
  method: string;
  message: string;
  verified: boolean;
}

export interface MoleculeResult {
  smiles: string;
  canonicalSmiles: string;
  graph: MoleculeGraph;
  properties: MolecularProperties;
  molfile: string;
  svg: string;
  fischer: FischerResult;
  geometry: GeometryResult | null;
  warnings: string[];
}

export type WorkerRequest = { id: number; input: string; action: "analyze" | "geometry" };
export type WorkerResponse =
  | { id: number; action: "analyze"; result: MoleculeResult }
  | { id: number; action: "geometry"; result: GeometryResult }
  | { id: number; action: "error"; error: string };
