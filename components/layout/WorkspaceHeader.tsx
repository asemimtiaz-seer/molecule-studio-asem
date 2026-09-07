"use client";
import { useRef, useState, type MutableRefObject } from "react";
import { Atom, ChevronDown, Code2, Copy, Download, FileCode2, FileJson, FileText, HelpCircle, Image, Moon, Plus, Sun, Upload } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { IconButton } from "./Ui";
import type { MoleculeResult } from "@/types/molecule";
import type { ViewerApi } from "@/components/viewer/Molecule3D";
import type { ViewTab } from "@/components/viewer/ViewerPanel";
import { download, exportMol, svgToPng } from "@/lib/conversion/exports";

export default function WorkspaceHeader({ dark, toggleTheme, onNew, onImport, result, name, api, view }: {
  dark: boolean; toggleTheme: () => void; onNew: () => void; onImport: (data: string, filename: string) => void;
  result: MoleculeResult | null; name: string; api: MutableRefObject<ViewerApi | null>; view: ViewTab;
}) {
  const input = useRef<HTMLInputElement>(null); const [help, setHelp] = useState(false);
  const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "molecule";
  const perform = (action: () => void | Promise<void>) => Promise.resolve().then(action).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "The export could not be completed."));
  const png = async () => {
    if (!result) return;
    if (view === "3d") {
      if (!api.current || !result.geometry?.verified) throw new Error("A verified 3D model is required for this snapshot.");
      const response = await fetch(api.current.png()); download(await response.blob(), `${filename}-3d.png`);
    } else {
      const svg = view === "fischer" && result.fischer.applicable ? result.fischer.svg : view === "2d" ? result.svg : null;
      if (!svg) throw new Error("There is no Fischer projection to export.");
      download(await svgToPng(svg), `${filename}-${view}.png`);
    }
    toast.success("PNG snapshot downloaded");
  };
  return <><header className="app-header"><a className="wordmark" href="/" aria-label="Molecule home"><span className="brand-icon"><Atom size={23} strokeWidth={1.7} /></span><span>molecule<span className="brand-period">.</span></span><span className="brand-divider" /><span className="brand-caption">STRUCTURE STUDIO</span></a><nav className="header-actions" aria-label="Workspace actions">
    <button className="header-button" onClick={onNew}><Plus size={17} /><span>New</span></button>
    <button className="header-button" onClick={() => input.current?.click()}><Upload size={16} /><span>Import</span></button>
    <DropdownMenu><DropdownMenuTrigger asChild><button className="header-button export-button" disabled={!result}><Download size={16} /><span>Export</span><ChevronDown size={13} /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="export-menu"><DropdownMenuLabel>Export molecule</DropdownMenuLabel><DropdownMenuItem onSelect={() => perform(async () => { await navigator.clipboard.writeText(result!.smiles); toast.success("Isomeric SMILES copied"); })}><Copy />Copy isomeric SMILES</DropdownMenuItem><DropdownMenuItem onSelect={() => perform(() => exportMol(result!, filename))}><FileText />MOL · 2D structure</DropdownMenuItem><DropdownMenuItem onSelect={() => perform(() => exportMol(result!, filename, true))}><FileText />SDF · 2D structure</DropdownMenuItem><DropdownMenuItem disabled={!result?.geometry?.verified} onSelect={() => perform(() => exportMol(result!, `${filename}-3d`, true, true))}><Atom />SDF · verified 3D conformer</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => perform(png)} disabled={view === "fischer" && !result?.fischer.applicable || view === "3d" && !result?.geometry?.verified}><Image />PNG · current view</DropdownMenuItem><DropdownMenuItem onSelect={() => download(result!.svg, `${filename}-2d.svg`, "image/svg+xml")}><FileCode2 />SVG · 2D structure</DropdownMenuItem><DropdownMenuItem disabled={!result?.fischer.applicable} onSelect={() => { if (result?.fischer.applicable) download(result.fischer.svg, `${filename}-fischer.svg`, "image/svg+xml"); }}><FileCode2 />SVG · Fischer projection</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => download(JSON.stringify(result!.graph, null, 2), `${filename}.json`, "application/json")}><FileJson />JSON · molecular graph</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <div className="header-divider" /><IconButton label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}</IconButton><IconButton label="Workspace guide and scientific limitations" onClick={() => setHelp(true)}><HelpCircle size={18} /></IconButton>
  </nav><input type="file" ref={input} hidden accept=".mol,.sdf,.smi,.smiles,.txt,.json" onChange={async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    if (file.size > 200000) { toast.error("Import a single molecule file smaller than 200 KB."); return; }
    try { const data = await file.text(); if (data.split("$$$$").filter((s) => s.trim()).length > 1) throw new Error("This import contains multiple SDF records. Import one molecule at a time."); onImport(data, file.name); } catch (error) { toast.error(error instanceof Error ? error.message : "The file could not be read."); }
  }} /></header>
  <Dialog open={help} onOpenChange={setHelp}><DialogContent className="help-dialog"><DialogHeader><DialogTitle>Inside the workspace</DialogTitle><DialogDescription>Explore molecular structure, one representation at a time.</DialogDescription></DialogHeader><div className="help-body"><h3>Start with a structure</h3><p>Draw atoms, bonds, rings, charges, and wedges in the sketcher, enter SMILES, or import one MOL, SDF, or exported JSON graph. Text names are limited to the six included examples. InChI and formula-to-structure lookup are not implemented.</p><h3>Explore the model</h3><p>Drag to rotate, scroll or pinch to zoom, and right-drag to pan. Camera buttons also work with a keyboard. On touch screens, use two fingers to navigate the model.</p><h3>What the chemistry can tell you</h3><p>RDKit validates the molecular graph and calculates properties. OpenChemLib generates one 3D conformer and attempts MMFF94 optimization. The actual 3D coordinates must reproduce the input isomeric graph before they are shown. This is not a conformational search or a claim of the lowest-energy structure.</p><h3>Fischer projections</h3><p>Supported structures have a neutral, unbranched, acyclic 3–10 carbon chain, assigned R/S centers at each internal carbon, one H and a simple OH, NH₂, or halogen substituent per center, and supported end groups. Each projection is verified by RDKit. Rings, unspecified centers, and other unsupported structures receive no projection.</p><h3>Lewis structures</h3><p>Lone pairs are completed only for supported closed-shell atoms using electron accounting. Hydrogens are grouped. Selecting an atom lets you edit its lone pairs and explicitly apply the corresponding formal charge. Aromatic and radical lone pairs are not inferred. Lewis depictions do not show stereochemical wedges; use the 2D tab for stereochemistry.</p><p>For education and exploration. This tool is not a substitute for validated computational chemistry software.</p><a className="secondary-button" href="/molecule-studio-source.zip" download><Code2 size={16} />Download source code & README</a></div></DialogContent></Dialog>
  </>;
}
