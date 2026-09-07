"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MoleculeResult, WorkerResponse } from "@/types/molecule";

export function useChemistry() {
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const cache = useRef(new Map<string, MoleculeResult>());
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [result, setResult] = useState<MoleculeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [geometryBusy, setGeometryBusy] = useState(false);
  const [error, setError] = useState("");
  const [geometryError, setGeometryError] = useState("");
  const clearTimer = () => { if (timeout.current) clearTimeout(timeout.current); };
  const analyze = useCallback((input: string) => {
    const id = ++requestId.current;
    clearTimer();
    setBusy(true); setGeometryBusy(false); setError(""); setGeometryError(""); setResult(null);
    // Cancelling a stale worker also cancels synchronous WASM/conformer work.
    if (worker.current) { worker.current.terminate(); worker.current = null; }
    const cached = cache.current.get(input);
    if (cached) { setResult(cached); setBusy(false); return; }
    const next = new Worker("/chemistry/worker.js"); worker.current = next;
    let analyzed: MoleculeResult | null = null;
    timeout.current = setTimeout(() => {
      next.terminate(); worker.current = null; setBusy(false); setGeometryBusy(false);
      setError("This calculation took too long. Try a smaller molecule or simplify the input.");
    }, 45000);
    next.onerror = () => {
      clearTimer(); setBusy(false); setGeometryBusy(false);
      setError("The chemistry engine could not load. Check your connection and try again.");
      next.terminate(); worker.current = null;
    };
    next.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.id !== requestId.current) return;
      clearTimer();
      if (data.action === "error") {
        setBusy(false); setGeometryBusy(false);
        if (analyzed) setGeometryError(data.error); else setError(data.error);
      } else if (data.action === "analyze") {
        analyzed = data.result;
        setResult(data.result); setBusy(false); setGeometryBusy(true);
        timeout.current = setTimeout(() => { next.terminate(); worker.current = null; setGeometryBusy(false); setGeometryError("3D generation timed out. The validated 2D structure and properties are available."); }, 45000);
        next.postMessage({ id, input, action: "geometry" });
      } else {
        if (analyzed) {
          const completed = { ...analyzed, geometry: data.result };
          if (cache.current.size >= 24) cache.current.delete(cache.current.keys().next().value!);
          cache.current.set(input, completed);
          setResult(completed);
        }
        setGeometryBusy(false);
      }
    };
    next.postMessage({ id, input, action: "analyze" });
  }, []);
  const clear = useCallback(() => {
    requestId.current++; clearTimer(); worker.current?.terminate(); worker.current = null;
    setResult(null); setError(""); setGeometryError(""); setBusy(false); setGeometryBusy(false);
  }, []);
  useEffect(() => () => { clearTimer(); worker.current?.terminate(); }, []);
  return { result, busy, geometryBusy, error, geometryError, analyze, clear };
}
