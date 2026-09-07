export const samples = [
  { name: "Water", smiles: "O", formula: "H₂O", description: "Small molecule · bent geometry" },
  { name: "Ethanol", smiles: "CCO", formula: "C₂H₆O", description: "Alcohol · flexible carbon chain" },
  { name: "Lactic acid", smiles: "C[C@H](O)C(=O)O", formula: "C₃H₆O₃", description: "L-(S) isomer · one stereocenter" },
  { name: "Glucose", smiles: "O=C[C@H](O)[C@@H](O)[C@H](O)[C@H](O)CO", formula: "C₆H₁₂O₆", description: "Open-chain D-glucose · four stereocenters" },
  { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O", formula: "C₉H₈O₄", description: "Acetylsalicylic acid · aromatic ring" },
  { name: "Caffeine", smiles: "Cn1c(=O)c2c(ncn2C)n(C)c1=O", formula: "C₈H₁₀N₄O₂", description: "Heterocycle · fused aromatic rings" },
] as const;

export function resolveInput(input: string): string {
  // MOL files have three positional header lines; an empty first line is meaningful.
  if (/V[23]000/.test(input) && /M  END/.test(input)) return input.replace(/\r\n/g, "\n");
  return samples.find((sample) => sample.name.toLowerCase() === input.trim().toLowerCase())?.smiles ?? input.trim();
}
