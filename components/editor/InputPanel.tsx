"use client";
import { useState } from "react";
import { ArrowUpRight, Braces, Check, ChevronRight, Code2, Expand, FlaskConical, PenLine, Play, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { samples } from "@/lib/chemistry/samples";
import type { MoleculeResult } from "@/types/molecule";
import { IconButton, Loading } from "@/components/layout/Ui";
import MoleculeSketcher from "./MoleculeSketcher";
import LewisView from "./LewisView";

export default function InputPanel({ result, input, setInput, mode, setMode, busy, error, onVisualize, onSample, onDraw, onLewis, draft, selectedSample }: {
  result: MoleculeResult | null; input: string; setInput: (s: string) => void; mode: string; setMode: (m: string) => void; busy: boolean; error: string;
  onVisualize: () => void; onSample: (sample: typeof samples[number]) => void; onDraw: (molfile: string) => void; onLewis: (input: string) => void; draft: string; selectedSample: string;
}) {
  const [sketching, setSketching] = useState(false); const [drawStyle, setDrawStyle] = useState("skeletal");
  return <aside className="input-column"><section className="panel input-panel"><div className="panel-heading"><h2>Structure input</h2><span className="step-label">01</span></div>
    <Tabs value={mode} onValueChange={setMode} className="input-tabs"><TabsList className="input-tab-list"><TabsTrigger value="draw"><PenLine size={16} />Draw</TabsTrigger><TabsTrigger value="text"><Code2 size={16} />Text input</TabsTrigger></TabsList>
      <TabsContent value="draw" className="draw-content"><div className="draw-toolbar"><Select value={drawStyle} onValueChange={setDrawStyle}><SelectTrigger aria-label="Drawing representation" className="draw-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="skeletal">Skeletal structure</SelectItem><SelectItem value="lewis">Lewis structure</SelectItem></SelectContent></Select><IconButton label="Open full molecular sketcher" onClick={() => setSketching(true)}><Expand size={16} /></IconButton></div>
        {drawStyle === "lewis" && result ? <LewisView key={result.smiles} graph={result.graph} onApply={onLewis} /> : <button className="sketch-preview" onClick={() => setSketching(true)} aria-label="Edit molecular structure">{busy ? <Loading>Validating structure…</Loading> : result ? <div className="sketch-svg" dangerouslySetInnerHTML={{ __html: result.svg }} /> : <div className="empty-sketch"><PenLine size={30} strokeWidth={1.3} /><strong>Start with a single bond.</strong><span>Open the canvas to draw a structure.</span></div>}<span className="edit-preview-label"><PenLine size={13} />Click to edit</span></button>}
        <button className="primary-button full-width" onClick={() => setSketching(true)}><PenLine size={16} />{result || draft ? "Edit structure" : "Open drawing canvas"}<ArrowUpRight size={16} /></button>
      </TabsContent>
      <TabsContent value="text" className="text-content"><div className="field-label"><label htmlFor="smiles-input">SMILES notation</label><span>or a sample name</span></div><textarea id="smiles-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="CC(O)C(=O)O" spellCheck={false} autoCapitalize="off" autoCorrect="off" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onVisualize(); } }} aria-invalid={!!error} /><p className="field-help">Use <code>@</code> / <code>@@</code> for stereocenters and <code>/</code> / <code>\</code> for E/Z bonds.</p><button className="primary-button full-width" disabled={busy || !input.trim()} onClick={onVisualize}><Play size={15} fill="currentColor" />Visualize molecule<span className="shortcut">⌘ ↵</span></button>{result && <div className="text-preview"><span className="eyebrow">STRUCTURE PREVIEW</span><div dangerouslySetInnerHTML={{ __html: result.svg }} /></div>}</TabsContent>
    </Tabs>
    {error && <p role="alert" className="input-error">{error}</p>}
    {result && <div className="input-status"><Check size={14} /><span>Valid structure</span><span>{result.properties.heavyAtoms} heavy atoms · {result.properties.bonds} graph bonds</span></div>}
  </section>
  <section className="panel samples-panel"><div className="panel-heading"><h2><FlaskConical size={16} />Try a molecule</h2><span className="small-muted">6 examples</span></div><div className="sample-grid">{samples.map((sample) => <button key={sample.name} title={sample.description} onClick={() => onSample(sample)} className={`sample-button ${selectedSample === sample.name ? "selected" : ""}`}><span>{sample.name}</span><span className="sample-formula">{sample.formula}</span>{selectedSample === sample.name ? <Check size={13} /> : <ChevronRight size={13} />}</button>)}</div></section>
  <MoleculeSketcher open={sketching} setOpen={setSketching} smiles={result?.smiles ?? ""} draft={draft} onApply={onDraw} />
  </aside>;
}
