"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useChemistry } from "@/hooks/useChemistry";
import { samples } from "@/lib/chemistry/samples";
import type { ViewerApi } from "@/components/viewer/Molecule3D";
import ViewerPanel, { type ViewTab } from "@/components/viewer/ViewerPanel";
import InputPanel from "@/components/editor/InputPanel";
import PropertiesPanel from "@/components/properties/PropertiesPanel";
import WorkspaceHeader from "./WorkspaceHeader";
import ErrorBoundary from "./ErrorBoundary";

export default function Workspace() {
  const chemistry = useChemistry();
  const [input, setInput] = useState<string>(samples[4].smiles);
  const [name, setName] = useState("Aspirin"); const [selectedSample, setSelectedSample] = useState("Aspirin");
  const [mode, setMode] = useState("draw"); const [draft, setDraft] = useState("");
  const [view, setView] = useState<ViewTab>("3d"); const [dark, setDark] = useState(false);
  const api = useRef<ViewerApi | null>(null);
  useEffect(() => {
    chemistry.analyze(samples[4].smiles);
    try { const theme = localStorage.getItem("molecule-theme"); const preferred = theme === "dark"; setDark(preferred); document.documentElement.classList.toggle("dark", preferred); } catch { /* Preferences are optional. */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleTheme = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); try { localStorage.setItem("molecule-theme", next ? "dark" : "light"); } catch { /* Restricted storage must not prevent theme changes. */ } };
  const selectSample = (sample: typeof samples[number]) => { setName(sample.name); setSelectedSample(sample.name); setInput(sample.smiles); setDraft(""); chemistry.analyze(sample.smiles); };
  const visualize = () => { const sample = samples.find((s) => s.smiles === input.trim() || s.name.toLowerCase() === input.trim().toLowerCase()); setName(sample?.name ?? "Untitled molecule"); setSelectedSample(sample?.name ?? ""); setDraft(""); chemistry.analyze(input); };
  const draw = (molfile: string) => { setDraft(molfile); setInput(molfile); setName("Untitled molecule"); setSelectedSample(""); chemistry.analyze(molfile); };
  const clear = () => { chemistry.clear(); setInput(""); setName("Untitled molecule"); setSelectedSample(""); setDraft(""); setMode("draw"); };
  return <ErrorBoundary><TooltipProvider delayDuration={300}><div className="app-shell"><WorkspaceHeader dark={dark} toggleTheme={toggleTheme} onNew={clear} onImport={(data, filename) => { setInput(data); setName(filename.replace(/\.[^.]+$/, "")); setDraft(""); setSelectedSample(""); chemistry.analyze(data); }} result={chemistry.result} name={name} view={view} api={api} />
    <main className="workspace"><div className="workspace-intro"><div><div className="breadcrumb"><span>Studio</span><ChevronRight size={12} /><span>Workspace</span></div><h1>Molecular workspace</h1></div><span className="local-note"><LockKeyhole size={14} />Private, in-browser calculations</span></div>
      <div className="workspace-grid"><InputPanel result={chemistry.result} input={input} setInput={setInput} mode={mode} setMode={(next) => { if (next === "text" && chemistry.result) setInput(chemistry.result.smiles); setMode(next); }} busy={chemistry.busy} error={chemistry.error} onVisualize={visualize} onSample={selectSample} onDraw={draw} onLewis={(data) => { setSelectedSample(""); setDraft(""); setInput(data); chemistry.analyze(data); }} draft={draft} selectedSample={selectedSample} /><ViewerPanel result={chemistry.result} name={name} busy={chemistry.busy} geometryBusy={chemistry.geometryBusy} geometryError={chemistry.geometryError} dark={dark} view={view} setView={setView} api={api} /></div>
      {!!chemistry.result?.warnings.length && <div className="chemistry-warnings" role="status">{chemistry.result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
      <PropertiesPanel result={chemistry.result} />
      <footer className="workspace-footer"><span><span className="footer-dot" />{chemistry.busy ? "Validating structure" : chemistry.geometryBusy ? "Preparing 3D coordinates" : chemistry.result ? "Workspace ready" : "Ready for a new molecule"}</span><span>For education & exploration<span className="footer-separator">/</span>RDKit · OpenChemLib · 3Dmol.js</span></footer>
    </main><Toaster position="bottom-right" theme={dark ? "dark" : "light"} /></div></TooltipProvider></ErrorBoundary>;
}
