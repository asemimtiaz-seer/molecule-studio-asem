import { Resources } from "openchemlib";
import type { RDKitModule } from "@rdkit/rdkit";
import type { WorkerRequest, WorkerResponse, MoleculeResult } from "../types/molecule";
import { analyzeMolecule } from "../lib/chemistry/analyze";
import { generateConformer } from "../lib/chemistry/conformer";

declare const self: {
  importScripts(...urls: string[]): void;
  initRDKitModule(options: { locateFile: (name: string) => string }): Promise<RDKitModule>;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(data: WorkerResponse): void;
};

let engine: Promise<RDKitModule> | null = null;
let resources: Promise<void> | null = null;
const cache = new Map<string, MoleculeResult>();
function getEngine() {
  if (!engine) {
    self.importScripts("/chemistry/RDKit_minimal.js");
    engine = self.initRDKitModule({ locateFile: (name) => `/chemistry/${name}` });
  }
  return engine;
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      const rdkit = await getEngine();
      let result = cache.get(data.input);
      if (!result) {
        result = analyzeMolecule(rdkit, data.input);
        if (cache.size >= 24) cache.delete(cache.keys().next().value!);
        cache.set(data.input, result);
      }
      if (data.action === "analyze") self.postMessage({ id: data.id, action: "analyze", result });
      else {
        resources ??= Resources.registerFromUrl("/chemistry/ocl-resources.json");
        await resources;
        result.geometry ??= generateConformer(rdkit, result.molfile, result.graph);
        self.postMessage({ id: data.id, action: "geometry", result: result.geometry });
      }
    } catch (error) {
      self.postMessage({ id: data.id, action: "error", error: error instanceof Error ? error.message : "The chemistry engine could not process this structure." });
    }
  });
};
