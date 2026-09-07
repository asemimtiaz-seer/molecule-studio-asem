"use client";
import { useState } from "react";
import { ChevronDown, Copy, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { MoleculeResult } from "@/types/molecule";
import { Formula, IconButton } from "@/components/layout/Ui";

export default function PropertiesPanel({ result }: { result: MoleculeResult | null }) {
  const [open, setOpen] = useState(false);
  const p = result?.properties;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success("SMILES copied"); } catch { toast.error("Clipboard access is unavailable. Select and copy the text manually."); } };
  return <Collapsible open={open} onOpenChange={setOpen} className="panel properties-panel"><div className="panel-heading"><h2><SlidersHorizontal size={16} />Molecular properties</h2><CollapsibleTrigger className="details-trigger">{open ? "Fewer details" : "All properties"}<ChevronDown size={15} className={open ? "rotated" : ""} /></CollapsibleTrigger></div>
    <div className="property-highlights"><div><span>Molecular formula</span><strong>{p ? <Formula value={p.formula} /> : "—"}</strong></div><div><span>Molecular weight</span><strong>{p?.molecularWeight.toFixed(2) ?? "—"}<small> g/mol</small></strong></div><div><span>Total atoms <small>(including H)</small></span><strong>{p?.atoms ?? "—"}<small>{p ? ` / ${p.heavyAtoms} heavy` : ""}</small></strong></div><div><span>Stereocenters</span><strong>{p?.stereocenters ?? "—"}<small>{p ? p.unspecifiedStereocenters ? ` / ${p.unspecifiedStereocenters} unassigned` : p.stereocenters ? " / all assigned" : " / achiral" : ""}</small></strong></div></div>
    <CollapsibleContent>{result && p ? <div className="property-details"><dl className="descriptor-grid">{[
      ["Formal charge", p.charge > 0 ? `+${p.charge}` : p.charge], ["Graph bonds", p.bonds], ["H-bond donors", p.donors], ["H-bond acceptors", p.acceptors], ["Rotatable bonds", p.rotatableBonds], ["Rings", p.rings], ["Exact mass", `${p.exactMass.toFixed(5)} Da`], ["Polar surface area", `${p.tpsa.toFixed(2)} Å²`], ["Calculated logP", p.logP.toFixed(2)],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="smiles-detail"><span>Canonical SMILES <small>(without stereochemistry)</small></span><div><code>{result.canonicalSmiles}</code><IconButton label="Copy canonical SMILES" onClick={() => copy(result.canonicalSmiles)}><Copy size={15} /></IconButton></div></div><div className="smiles-detail"><span>Isomeric SMILES</span><div><code>{result.smiles}</code><IconButton label="Copy isomeric SMILES" onClick={() => copy(result.smiles)}><Copy size={15} /></IconButton></div></div><p className="small-muted">RDKit graph descriptors. Formula includes all fragments. Graph bonds exclude implicit hydrogen bonds; stereocenters include unassigned centers.</p></div> : <p className="property-details small-muted">Add a molecule to calculate its properties.</p>}</CollapsibleContent>
  </Collapsible>;
}
