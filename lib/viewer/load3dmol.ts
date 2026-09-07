import type * as Mol3D from "3dmol";
declare global { interface Window { $3Dmol?: typeof Mol3D } }
let promise: Promise<typeof Mol3D> | null = null;
export function load3dmol(): Promise<typeof Mol3D> {
  if (window.$3Dmol) return Promise.resolve(window.$3Dmol);
  if (!promise) promise = new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = "/chemistry/3Dmol-min.js"; script.async = true;
    script.onload = () => window.$3Dmol ? resolve(window.$3Dmol) : reject(new Error("The 3D renderer did not initialize."));
    script.onerror = () => { promise = null; script.remove(); reject(new Error("The 3D renderer could not load.")); };
    document.head.appendChild(script);
  });
  return promise;
}
