"use client";
import { useEffect, useRef, useState } from "react";
import type { CanvasEditor } from "openchemlib";
import { Check, RotateCcw, Undo2, Redo2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { IconButton, Loading } from "@/components/layout/Ui";

function EditorCanvas({ smiles, draft, onReady, onExport }: { smiles: string; draft: string; onReady: (ready: boolean) => void; onExport: React.MutableRefObject<(() => string) | null> }) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<CanvasEditor | null>(null);
  const history = useRef<string[]>([]); const cursor = useRef(0);
  const [index, setIndex] = useState(0); const [historyLength, setHistoryLength] = useState(1);
  const [error, setError] = useState(""); const [ready, setReady] = useState(false);
  const ocl = useRef<typeof import("openchemlib") | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("openchemlib").then((lib) => {
      if (cancelled) return;
      ocl.current = lib;
      const instance = new lib.CanvasEditor(container.current!, { initialMode: "molecule", initialFragment: false });
      editor.current = instance;
      instance.setMolecule(draft ? lib.Molecule.fromMolfile(draft) : smiles ? lib.Molecule.fromSmiles(smiles) : new lib.Molecule(0, 0));
      history.current = [instance.getMolecule().toMolfile()];
      instance.setOnChangeListener((event) => {
        if (event.type !== "molecule" || !event.isUserEvent) return;
        const molfile = instance.getMolecule().toMolfile();
        if (molfile === history.current[cursor.current]) return;
        history.current = [...history.current.slice(0, cursor.current + 1), molfile].slice(-60);
        cursor.current = history.current.length - 1; setIndex(cursor.current); setHistoryLength(history.current.length);
      });
      onExport.current = () => instance.getMolecule().toMolfile();
      setReady(true); onReady(true);
    }).catch(() => setError("The molecular sketcher could not load. Close this window and use Text input, or try again."));
    return () => { cancelled = true; editor.current?.destroy(); editor.current = null; onExport.current = null; };
  // The starting structure is a snapshot for this editing session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const restore = (next: number) => {
    if (!editor.current || !ocl.current || next < 0 || next >= history.current.length) return;
    cursor.current = next; setIndex(next); editor.current.setMolecule(ocl.current.Molecule.fromMolfile(history.current[next]));
  };
  return <>
    <div className="sketcher-actions"><span>Atoms · bonds · rings · charges · stereochemistry</span><div><IconButton label="Undo drawing edit" disabled={!ready || index === 0} onClick={() => restore(index - 1)}><Undo2 size={17} /></IconButton><IconButton label="Redo drawing edit" disabled={!ready || index >= historyLength - 1} onClick={() => restore(index + 1)}><Redo2 size={17} /></IconButton><IconButton label="Clear drawing" disabled={!ready} onClick={() => editor.current?.clearAll()}><RotateCcw size={17} /></IconButton></div></div>
    <div className="sketcher-container"><div ref={container} className="ocl-editor" aria-label="Molecular drawing canvas" />{!ready && <div className="sketcher-loading">{error ? <p role="alert">{error}</p> : <Loading>Loading the molecular sketcher…</Loading>}</div>}</div>
    <p className="sketcher-help">Choose a bond or ring tool, then click or drag on the canvas. Hover over an atom and type an element, or use the element picker. Use wedge and dashed bonds to assign stereochemistry.</p>
  </>;
}

export default function MoleculeSketcher({ open, setOpen, smiles, draft, onApply }: { open: boolean; setOpen: (open: boolean) => void; smiles: string; draft: string; onApply: (molfile: string) => void }) {
  const exportRef = useRef<(() => string) | null>(null); const [ready, setReady] = useState(false);
  return <Dialog open={open} onOpenChange={(value) => { setReady(false); setOpen(value); }}><DialogContent className="sketcher-dialog"><DialogHeader><DialogTitle>Draw a molecule</DialogTitle><DialogDescription>Build your structure naturally. The full molecular graph will be validated when you apply it.</DialogDescription></DialogHeader>{open && <EditorCanvas smiles={smiles} draft={draft} onReady={setReady} onExport={exportRef} />}<DialogFooter><button className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" disabled={!ready} onClick={() => { const molfile = exportRef.current?.(); if (molfile) { onApply(molfile); setOpen(false); } }}><Check size={16} />Apply structure</button></DialogFooter></DialogContent></Dialog>;
}
