import type { MoleculeResult } from "@/types/molecule";

export function download(data: string | Blob, filename: string, mime = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function svgToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 1200;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image export is unavailable.");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(1500 / image.width, 1100 / image.height);
    const width = image.width * scale; const height = image.height * scale;
    ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("PNG export failed.")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}
export function exportMol(result: MoleculeResult, name: string, sdf = false, geometry = false) {
  const mol = geometry && result.geometry?.verified ? result.geometry.molfile : result.molfile;
  if (!mol) throw new Error("No verified coordinates are available.");
  const text = sdf ? `${mol.trimEnd()}\n>  <ISOMERIC_SMILES>\n${result.smiles}\n\n>  <GEOMETRY>\n${geometry ? result.geometry?.method : "2D depiction"}\n\n$$$$\n` : mol;
  download(text, `${name}.${sdf ? "sdf" : "mol"}`, "chemical/x-mdl-molfile");
}
