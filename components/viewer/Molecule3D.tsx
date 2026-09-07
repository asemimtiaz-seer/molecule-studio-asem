"use client";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { GLViewer, AtomStyleSpec, AtomSpec } from "3dmol";
import { load3dmol } from "@/lib/viewer/load3dmol";
import { elementColors } from "@/lib/viewer/elementColors";

export interface ViewerApi { reset(): void; zoom(factor: number): void; rotate(angle: number, axis: "x" | "y"): void; pan(x: number, y: number): void; png(): string }
export interface ViewerOptions { representation: string; hydrogens: boolean; labels: boolean; multipleBonds: boolean; dark: boolean }
export default function Molecule3D({ molfile, options, active, api, onAtom, onError }: {
  molfile: string | null; options: ViewerOptions; active: boolean; api: MutableRefObject<ViewerApi | null>;
  onAtom: (atom: { element: string; index: number } | null) => void; onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<GLViewer | null>(null);
  const baseView = useRef<number[] | null>(null);
  const initialView = useRef<number[] | null>(null);
  const callbacks = useRef({ onAtom, onError }); callbacks.current = { onAtom, onError };
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false; let observer: ResizeObserver | undefined;
    const element = container.current!;
    load3dmol().then((library) => {
      if (cancelled) return;
      const v = library.createViewer(element, { backgroundColor: "#f7fafb", antialias: true, defaultcolors: { ...library.elementColors.Jmol, ...elementColors } });
      viewer.current = v;
      baseView.current = v.getView();
      observer = new ResizeObserver(() => { if (element.clientWidth && element.clientHeight) { v.resize(); v.render(); } }); observer.observe(element);
      api.current = { reset: () => { if (initialView.current) v.setView(initialView.current); v.render(); }, zoom: (n) => { v.zoom(n); v.render(); }, rotate: (a, axis) => { v.rotate(a, axis); v.render(); }, pan: (x, y) => { v.translate(x, y); v.render(); }, png: () => v.pngURI() };
      setReady(true);
    }).catch((e: unknown) => callbacks.current.onError(e instanceof Error ? e.message : "WebGL is unavailable. You can still use the 2D view."));
    return () => {
      cancelled = true; observer?.disconnect(); api.current = null;
      const v = viewer.current;
      if (v) { v.spin(false); v.clear(); const canvas = v.getCanvas(); canvas.remove(); const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl"); gl?.getExtension("WEBGL_lose_context")?.loseContext(); }
      viewer.current = null;
    };
  }, [api]);

  useEffect(() => {
    const v = viewer.current; if (!ready || !v) return;
    v.removeAllLabels(); v.removeAllModels(); callbacks.current.onAtom(null);
    if (molfile) { if (baseView.current) v.setView(baseView.current); v.addModel(molfile, "sdf", { keepH: true }); v.zoomTo(); v.rotate(25, "y"); v.rotate(12, "x"); initialView.current = v.getView(); }
    v.render();
  }, [molfile, ready]);

  useEffect(() => {
    const v = viewer.current; if (!ready || !v) return;
    const selection = options.hydrogens ? {} : { not: { elem: "H" } };
    const styles: Record<string, AtomStyleSpec> = {
      ball: { sphere: { scale: 0.28 }, stick: { radius: 0.12, singleBonds: !options.multipleBonds } },
      stick: { stick: { radius: 0.21, singleBonds: !options.multipleBonds } },
      space: { sphere: { scale: 1 } },
      wire: { line: { linewidth: 2 } },
    };
    v.setBackgroundColor(options.dark ? "#18252c" : "#f7fafb", 1);
    v.setStyle({}, {}); v.setStyle(selection, styles[options.representation] ?? styles.ball);
    v.removeAllLabels();
    if (options.labels) v.selectedAtoms(selection).forEach((atom: AtomSpec) => v.addLabel(atom.elem ?? "", { position: atom as {x: number; y: number; z: number}, fontSize: 13, fontColor: options.dark ? "white" : "#253e49", backgroundColor: options.dark ? "#18252c" : "white", backgroundOpacity: 0.85, borderThickness: 0, inFront: true }));
    v.setClickable({}, false, undefined);
    v.setClickable(selection, true, (atom: AtomSpec) => callbacks.current.onAtom({ element: atom.elem ?? "?", index: atom.index ?? 0 }));
    v.render();
  }, [molfile, ready, options]);

  useEffect(() => { if (active && ready) requestAnimationFrame(() => { viewer.current?.resize(); viewer.current?.render(); }); }, [active, ready]);
  return <div ref={container} className="webgl-container" role="img" tabIndex={active ? 0 : -1} aria-label="Interactive 3D molecule. Arrow keys rotate; Shift and arrow keys pan; plus and minus zoom; Home resets the camera. Drag to rotate, scroll to zoom, or right-drag to pan." onKeyDown={(event) => {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 15], ArrowDown: [0, -15] };
    const direction = directions[event.key];
    if (direction) { event.preventDefault(); if (event.shiftKey) api.current?.pan(...direction); else api.current?.rotate(direction[0] || direction[1], direction[0] ? "y" : "x"); }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); api.current?.zoom(1.2); }
    if (event.key === "-") { event.preventDefault(); api.current?.zoom(0.83); }
    if (event.key === "Home") { event.preventDefault(); api.current?.reset(); }
  }} />;
}
