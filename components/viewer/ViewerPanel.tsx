"use client";
import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { Atom, Box, Check, ChevronDown, Crosshair, Expand, Info, Maximize2, Minus, Move, Plus, RotateCcw, RotateCw, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import type { MoleculeResult } from "@/types/molecule";
import Molecule3D, { type ViewerApi } from "./Molecule3D";
import { IconButton, Loading, Formula } from "@/components/layout/Ui";
import { elementColor } from "@/lib/viewer/elementColors";
import { FISCHER_UNAVAILABLE } from "@/lib/chemistry/fischer";

export type ViewTab = "3d" | "2d" | "fischer";
export default function ViewerPanel({ result, name, busy, geometryBusy, geometryError, dark, view, setView, api }: {
  result: MoleculeResult | null; name: string; busy: boolean; geometryBusy: boolean; geometryError: string; dark: boolean;
  view: ViewTab; setView: (view: ViewTab) => void; api: MutableRefObject<ViewerApi | null>;
}) {
  const [representation, setRepresentation] = useState("ball");
  const [hydrogens, setHydrogens] = useState(true); const [labels, setLabels] = useState(false); const [multipleBonds, setMultipleBonds] = useState(true);
  const [atom, setAtom] = useState<{ element: string; index: number } | null>(null);
  const [renderError, setRenderError] = useState("");
  const panel = useRef<HTMLElement>(null);
  const options = useMemo(() => ({ representation, hydrogens, labels, multipleBonds, dark }), [representation, hydrogens, labels, multipleBonds, dark]);
  const geometry = result?.geometry;
  const can3D = !!geometry?.molfile && geometry.verified && !renderError;
  const fullScreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (panel.current?.requestFullscreen) await panel.current.requestFullscreen(); else toast.error("Fullscreen is not supported by this browser."); }
    catch { toast.error("The browser could not enter fullscreen."); }
  };
  return <section ref={panel} className="viewer-panel panel" aria-label="Molecular visualization">
    <div className="viewer-toolbar">
      <Tabs value={view} onValueChange={(v) => setView(v as ViewTab)} className="view-tabs"><TabsList className="view-tab-list" aria-label="Molecular view">
        <TabsTrigger id="view-3d" aria-controls="molecular-view" value="3d"><Box size={16} />3D model</TabsTrigger>
        <TabsTrigger id="view-2d" aria-controls="molecular-view" value="2d">2D structure</TabsTrigger>
        <TabsTrigger id="view-fischer" aria-controls="molecular-view" value="fischer">Fischer</TabsTrigger>
      </TabsList></Tabs>
      <IconButton label="Toggle fullscreen" onClick={fullScreen}><Expand size={17} /></IconButton>
    </div>
    <div className="viewer-stage" role="tabpanel" id="molecular-view" aria-labelledby={`view-${view}`}>
      <div className="molecule-heading"><span className="eyebrow">{view === "3d" ? "MOLECULAR MODEL" : view === "2d" ? "STRUCTURAL FORMULA" : "STEREOCHEMISTRY"}</span><h2>{result ? name : "Your molecule"}</h2>{result && <Formula value={result.properties.formula} />}</div>
      {result && <span className="graph-badge"><Check size={13} />Graph validated</span>}
      <div className={`molecule-3d ${view !== "3d" ? "inactive-view" : ""}`}><Molecule3D molfile={can3D ? geometry!.molfile : null} options={options} active={view === "3d"} api={api} onAtom={setAtom} onError={setRenderError} /></div>
      {(busy || (view === "3d" && geometryBusy)) && <div className="view-overlay"><Loading>{busy ? "Validating your structure…" : "Building and optimizing the conformer…"}</Loading></div>}
      {!busy && !result && <div className="view-overlay"><div className="empty-state"><Atom size={44} strokeWidth={1} /><strong>Ready for your molecule</strong><span>Draw a molecule, enter SMILES, or choose an example.</span></div></div>}
      {result && view === "3d" && !geometryBusy && !can3D && <div className="view-overlay"><div className="empty-state unavailable"><Box size={32} /><strong>3D model unavailable</strong><p>{renderError || geometryError || geometry?.message || "The conformer could not be prepared."}</p><button className="secondary-button" onClick={() => setView("2d")}>View 2D structure</button></div></div>}
      {result && view === "2d" && <div className="structure-view" role="img" aria-label={`2D structural formula of ${name}`} dangerouslySetInnerHTML={{ __html: result.svg }} />}
      {result && view === "fischer" && (result.fischer.applicable ? <div className="fischer-view"><div className="fischer-svg" dangerouslySetInnerHTML={{ __html: result.fischer.svg }} /><div className="fischer-key"><span><b>Horizontal</b> · toward you</span><span><b>Vertical</b> · away from you</span></div></div> : <div className="view-overlay"><div className="empty-state unavailable"><Crosshair size={34} strokeWidth={1.2} /><strong>{FISCHER_UNAVAILABLE}</strong><p>{result.fischer.reason}</p></div></div>)}
      {view === "3d" && can3D && <>
        {atom && <div className="atom-popover"><span><strong>{atom.element}</strong> · atom {atom.index + 1}</span><IconButton label="Close atom details" onClick={() => setAtom(null)}><X size={13} /></IconButton></div>}
        <div className="camera-controls"><IconButton label="Zoom in" onClick={() => api.current?.zoom(1.2)}><Plus size={18} /></IconButton><IconButton label="Zoom out" onClick={() => api.current?.zoom(0.83)}><Minus size={18} /></IconButton><div className="control-divider" /><IconButton label="Reset camera" onClick={() => api.current?.reset()}><Maximize2 size={17} /></IconButton><IconButton label="Rotate molecule left" onClick={() => api.current?.rotate(-15, "y")}><RotateCcw size={17} /></IconButton><IconButton label="Rotate molecule up" onClick={() => api.current?.rotate(15, "x")}><RotateCw size={17} /></IconButton></div>
        <div className="element-legend">{[...new Set(result?.graph.atoms.filter((a) => hydrogens || a.element !== "H").map((a) => a.element))].slice(0, 7).map((element) => <span key={element}><i style={{ background: elementColor(element) }} />{element}</span>)}{hydrogens && result?.graph.atoms.some((a) => a.hydrogens > 0) && !result?.graph.atoms.some((a) => a.element === "H") && <span><i className="hydrogen-dot" />H</span>}</div>
        <div className="interaction-hint"><Move size={13} /><span>Drag to rotate · Scroll to zoom · Right-drag to pan</span></div>
      </>}
    </div>
    <div className={`viewer-options ${view !== "3d" ? "options-muted" : ""}`}>
      {view === "3d" ? <><Select value={representation} onValueChange={setRepresentation}><SelectTrigger aria-label="Rendering mode" className="representation-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ball">Ball & Stick</SelectItem><SelectItem value="stick">Stick</SelectItem><SelectItem value="space">Space Filling / CPK</SelectItem><SelectItem value="wire">Wireframe</SelectItem></SelectContent></Select><div className="viewer-switch"><label htmlFor="show-h">Hydrogens</label><Switch id="show-h" checked={hydrogens} onCheckedChange={setHydrogens} /></div><div className="viewer-switch"><label htmlFor="show-labels">Atom labels</label><Switch id="show-labels" checked={labels} onCheckedChange={setLabels} /></div></> : <span className="view-caption">{view === "2d" ? "Library-generated depiction · Wedges and dashes preserve assigned stereochemistry" : result?.fischer.applicable ? "Complete isomeric graph verified against the input" : "Try Lactic acid or open-chain Glucose to explore a Fischer projection"}</span>}
    </div>
    <Collapsible className="geometry-note"><CollapsibleTrigger className="geometry-trigger"><span><Info size={14} />{view === "3d" ? geometry?.status === "optimized" ? "MMFF94 optimized · one possible conformation" : "About this molecular model" : "About this representation"}</span><ChevronDown size={14} /></CollapsibleTrigger><CollapsibleContent><p>{view === "3d" ? geometry?.message || "Generated geometry is conformation-dependent and is intended for education and exploration." : "Graph and stereochemical data are validated by RDKit. Fischer projections are limited to a verified subset of acyclic molecules with fully assigned carbon stereocenters."}</p>{view === "3d" && <div className="viewer-switch"><label htmlFor="multiple-bonds">Show multiple bond orders</label><Switch id="multiple-bonds" checked={multipleBonds} onCheckedChange={setMultipleBonds} /></div>}</CollapsibleContent></Collapsible>
  </section>;
}
