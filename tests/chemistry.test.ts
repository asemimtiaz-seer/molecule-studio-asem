import test from "node:test";
import assert from "node:assert/strict";
import initRDKit from "@rdkit/rdkit";
import type { RDKitLoader } from "@rdkit/rdkit";
import { Molecule, Resources } from "openchemlib";
import { analyzeMolecule } from "../lib/chemistry/analyze";
import { generateConformer } from "../lib/chemistry/conformer";
import { graphToRdkitJson, inferLonePairs } from "../lib/chemistry/graph";
import { withoutHydrogens } from "../lib/chemistry/rdkit";
import { samples } from "../lib/chemistry/samples";

const rdkit = await (initRDKit as unknown as RDKitLoader)();
Resources.registerFromNodejs();

for (const [name, input, formula, weight, atoms, bonds] of [
  ["methane", "C", "CH4", 16.043, 5, 0],
  ["water", "O", "H2O", 18.015, 3, 0],
  ["ethanol", "CCO", "C2H6O", 46.069, 9, 2],
  ["benzene", "c1ccccc1", "C6H6", 78.114, 12, 6],
  ["acetic acid", "CC(=O)O", "C2H4O2", 60.052, 8, 3],
] as const) {
  test(`${name}: formula, mass, counts, 2D and verified 3D`, () => {
    const result = analyzeMolecule(rdkit, input);
    assert.equal(result.properties.formula, formula);
    assert.ok(Math.abs(result.properties.molecularWeight - weight) < 0.015);
    assert.equal(result.properties.atoms, atoms); assert.equal(result.properties.bonds, bonds);
    assert.match(result.svg, /<svg/);
    assert.equal(result.fischer.applicable, false);
    const geometry = generateConformer(rdkit, result.molfile, result.graph);
    assert.equal(geometry.verified, true, geometry.message);
    assert.equal(withoutHydrogens(rdkit, geometry.molfile!), result.smiles);
  });
}

test("lactic acid enantiomers: opposite Fischer substituents and preserved 3D handedness", () => {
  const left = analyzeMolecule(rdkit, "C[C@H](O)C(=O)O");
  const right = analyzeMolecule(rdkit, "C[C@@H](O)C(=O)O");
  assert.equal(left.graph.atoms[1].cip, "S"); assert.equal(right.graph.atoms[1].cip, "R");
  assert.ok(left.fischer.applicable); assert.ok(right.fischer.applicable);
  assert.equal(left.fischer.top, "COOH"); assert.equal(left.fischer.bottom, "CH3");
  assert.equal(left.fischer.rows[0].left, "OH"); assert.equal(right.fischer.rows[0].right, "OH");
  for (const result of [left, right]) {
    assert.ok(result.fischer.applicable);
    assert.equal(withoutHydrogens(rdkit, result.fischer.molfile), result.smiles);
    const graphRoundTrip = analyzeMolecule(rdkit, JSON.stringify(result.graph));
    assert.equal(graphRoundTrip.smiles, result.smiles);
    const geometry = generateConformer(rdkit, graphRoundTrip.molfile, graphRoundTrip.graph);
    assert.ok(geometry.verified, geometry.message);
    assert.equal(withoutHydrogens(rdkit, geometry.molfile!), result.smiles);
  }
});

test("D-glucose: R/S/R/R centers, right-left-right-right Fischer, graph and 3D round trips", () => {
  const result = analyzeMolecule(rdkit, samples[3].smiles);
  assert.equal(result.properties.stereocenters, 4);
  assert.ok(result.fischer.applicable);
  assert.equal(result.fischer.top, "CHO"); assert.equal(result.fischer.bottom, "CH2OH");
  assert.deepEqual(result.fischer.rows.map((row) => row.cip), ["R", "S", "R", "R"]);
  assert.deepEqual(result.fischer.rows.map((row) => row.right), ["OH", "H", "OH", "OH"]);
  const graphRoundTrip = analyzeMolecule(rdkit, JSON.stringify(result.graph));
  assert.equal(graphRoundTrip.smiles, result.smiles);
  const geometry = generateConformer(rdkit, graphRoundTrip.molfile, graphRoundTrip.graph);
  assert.ok(geometry.verified, geometry.message);
  assert.equal(withoutHydrogens(rdkit, result.fischer.molfile), result.smiles);
});

test("Fischer parent chain orientation is consistent when atom order changes", () => {
  const a = analyzeMolecule(rdkit, "O=C(O)[C@@H](O)C");
  const b = analyzeMolecule(rdkit, a.smiles);
  assert.ok(a.fischer.applicable); assert.ok(b.fischer.applicable);
  assert.equal(a.fischer.top, b.fischer.top);
  assert.deepEqual(a.fischer.rows.map((r) => [r.left, r.right]), b.fischer.rows.map((r) => [r.left, r.right]));
});

test("unspecified stereocenters and cyclic sugars are never assigned a fake Fischer", () => {
  for (const input of ["CC(O)C(=O)O", "C1CCCCC1", "OC1OC(CO)C(O)C(O)C1O", "CC(C)C", "O=CC(O)C(O)C(O)C(O)CO"]) {
    const result = analyzeMolecule(rdkit, input); assert.equal(result.fischer.applicable, false);
  }
});

test("formal charges, salts and non-inferred aromatic lone pairs", () => {
  const ammonium = analyzeMolecule(rdkit, "[NH4+]"); assert.equal(ammonium.properties.charge, 1); assert.equal(inferLonePairs(ammonium.graph, 0), 0);
  const chloride = analyzeMolecule(rdkit, "[Cl-]"); assert.equal(chloride.properties.charge, -1); assert.equal(inferLonePairs(chloride.graph, 0), 4);
  const salt = analyzeMolecule(rdkit, "[Na+].[Cl-]"); assert.equal(salt.properties.charge, 0); assert.equal(salt.graph.atoms.length, 2);
  assert.equal(generateConformer(rdkit, salt.molfile, salt.graph).status, "unavailable");
  const pyridine = analyzeMolecule(rdkit, "n1ccccc1"); assert.equal(pyridine.properties.acceptors, 1); assert.equal(inferLonePairs(pyridine.graph, 0), null);
});

test("explicit isotope and charge survive graph serialization", () => {
  for (const smiles of ["[13CH3]CO", "[NH4+]", "[O-]C(=O)C", "[2H]O[2H]", "[Na+].[Cl-]"]) {
    const result = analyzeMolecule(rdkit, smiles); const roundTrip = analyzeMolecule(rdkit, JSON.stringify(result.graph));
    assert.equal(roundTrip.smiles, result.smiles); assert.equal(roundTrip.properties.charge, result.properties.charge);
  }
});

test("aromatic bond metadata survives normalized graph conversion", () => {
  const result = analyzeMolecule(rdkit, samples[4].smiles);
  assert.equal(result.graph.bonds.filter((b) => b.aromatic).length, 6);
  const roundTrip = analyzeMolecule(rdkit, JSON.stringify(result.graph)); assert.equal(roundTrip.smiles, result.smiles);
});

test("E/Z configuration survives graph, MOL and 3D coordinates", () => {
  for (const input of ["C/C=C/C", "C/C=C\\C", "F/C=C/F"]) {
    const result = analyzeMolecule(rdkit, input);
    assert.equal(analyzeMolecule(rdkit, JSON.stringify(result.graph)).smiles, result.smiles);
    assert.equal(analyzeMolecule(rdkit, result.molfile).smiles, result.smiles);
    const geometry = generateConformer(rdkit, result.molfile, result.graph); assert.ok(geometry.verified, geometry.message);
    assert.equal(withoutHydrogens(rdkit, geometry.molfile!), result.smiles);
  }
});

test("a library-generated conformer that inverts Z-1,2-difluoroethene is rejected", () => {
  const result = analyzeMolecule(rdkit, "F/C=C\\F");
  assert.equal(analyzeMolecule(rdkit, JSON.stringify(result.graph)).smiles, result.smiles);
  assert.equal(analyzeMolecule(rdkit, result.molfile).smiles, result.smiles);
  const geometry = generateConformer(rdkit, result.molfile, result.graph);
  assert.equal(geometry.verified, false); assert.equal(geometry.molfile, null);
});

test("impossible valences and malformed structures return useful errors", () => {
  for (const input of ["C(C)(C)(C)(C)C", "C1CC", "not-a-smiles", "", "O=O=O"]) assert.throws(() => analyzeMolecule(rdkit, input), /structure|atom|SMILES/i);
});

test("Lewis electron accounting and a formal charge edit use the same graph", () => {
  const water = analyzeMolecule(rdkit, "O"); assert.equal(inferLonePairs(water.graph, 0), 2);
  const hydroxide = analyzeMolecule(rdkit, "[OH-]"); assert.equal(inferLonePairs(hydroxide.graph, 0), 3);
  const graph = structuredClone(hydroxide.graph); assert.equal(analyzeMolecule(rdkit, JSON.stringify(graph)).properties.charge, -1);
});

test("editor adapter preserves assigned stereo through OCL MOL output", () => {
  for (const input of [samples[2].smiles, samples[3].smiles, "F/C=C/F", "C[C@@H](O)C(=O)O"]) {
    const original = analyzeMolecule(rdkit, input);
    const molfile = Molecule.fromSmiles(original.smiles).toMolfile();
    assert.equal(analyzeMolecule(rdkit, molfile).smiles, original.smiles);
  }
});

test("water has reasonable optimized bond lengths and bent geometry", () => {
  const result = analyzeMolecule(rdkit, "O"); const geometry = generateConformer(rdkit, result.molfile, result.graph);
  assert.ok(geometry.molfile); const m = Molecule.fromMolfile(geometry.molfile);
  const p = (i: number) => [m.getAtomX(i), m.getAtomY(i), m.getAtomZ(i)];
  const center = p(0); const a = p(1).map((v, i) => v - center[i]); const b = p(2).map((v, i) => v - center[i]);
  const la = Math.hypot(...a), lb = Math.hypot(...b); assert.ok(la > 0.8 && la < 1.2); assert.ok(lb > 0.8 && lb < 1.2);
  const angle = Math.acos(a.reduce((sum, v, i) => sum + v * b[i], 0) / (la * lb)) * 180 / Math.PI;
  assert.ok(angle > 95 && angle < 115, `Water angle: ${angle}`);
});

test("200 graph atoms can be parsed, depicted, and described", () => {
  const result = analyzeMolecule(rdkit, "C".repeat(200));
  assert.equal(result.properties.heavyAtoms, 200); assert.equal(result.properties.formula, "C200H402"); assert.match(result.svg, /<svg/);
});

test("malformed JSON graphs are rejected before native parsing", () => {
  const result = analyzeMolecule(rdkit, "CCO"); const graph = structuredClone(result.graph); graph.bonds[0].atom2 = 900;
  assert.throws(() => graphToRdkitJson(graph), /Invalid bond/);
  assert.throws(() => graphToRdkitJson({version: 1, atoms: [], bonds: [{id: 0}]}), /Invalid bond/);
});

test("all six samples have verified 3D output and graph round trips", () => {
  for (const sample of samples) {
    const result = analyzeMolecule(rdkit, sample.name);
    assert.equal(analyzeMolecule(rdkit, result.molfile).smiles, result.smiles);
    const geometry = generateConformer(rdkit, result.molfile, result.graph);
    assert.ok(geometry.verified, `${sample.name}: ${geometry.message}`);
  }
});
