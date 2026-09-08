# Molecule — Structure Studio

A browser-based molecular workspace for drawing and SMILES input, validated 2D structures, interactive 3D conformers, conservative Fischer projections, molecular properties, and exports. Molecules and calculations remain in the browser. No chemistry API key or backend account is required.

## Run it locally

Install **Node.js 24 LTS** (the project pins `24.x` to prevent automatic major-version upgrades). Extract the source ZIP, open a terminal in the `molecule-studio` directory, and run:

```bash
npm ci
npm run dev:local
```

Open the local URL printed in the terminal. Keep that terminal running; Ctrl+C stops the app. The `dev:local` command works without POSIX-style environment assignment and is intended for Windows, macOS, and Linux. On Windows, WSL is also supported. The first install requires internet access. Chemistry assets are then served from your own application; no external molecular database is queried.

Use the included private hosted application if you only want to use the simulator. Local installation is for editing or self-hosting the source.

### Other commands

```bash
npm run typecheck
npm test
npm run source:zip
npm run build
```

The hosted production build uses the Sites/Vinext starter's verified Bash build wrapper. On Windows, use WSL for this wrapper. A portable direct build is `node scripts/prepare-chemistry.mjs` followed by `npx vinext build`.

`predev`, `predev:local`, and `prebuild` prepare locally served WASM/JS assets, compile the chemistry worker, and create the source download. Do not open an HTML file directly using `file://`; WASM, workers, and modules need an HTTP server.

## Deploy to Vercel

1. Extract this archive and commit the contents of `molecule-studio` to your Git repository, including `vercel.json`, `package.json`, and `package-lock.json`.
2. Import that repository in Vercel. Set the Root Directory to the folder containing `package.json` (`.` if you committed its contents at the repository root).
3. The included `vercel.json` sets the Next.js framework, `npm ci` install command, `npm run build:vercel` build command, and `.next` output directory. Node.js is pinned to `24.x` in `package.json`.
4. Redeploy after pushing the updated files. Remove any stale dashboard command overrides that conflict with these values. No chemistry API keys are needed.

The Vercel build explicitly prepares the chemistry worker, WASM, viewer assets, and downloadable source, then runs native `next build --webpack`. It does not invoke the Cloudflare/Vinext wrapper. The original `npm run build` command remains the Sites/Cloudflare build; do not select it as the Vercel build command.

To reproduce the Vercel application build locally:

```bash
npm ci
npm run build:vercel
npm run start:vercel
```

The install policy approves only the locked versions of esbuild, sharp, unrs-resolver, and workerd that need native setup. Review and update these version-specific entries when upgrading dependencies. The deprecated `@esbuild-kit` packages are transitive dependencies of the retained Drizzle development tooling; their warnings do not stop deployment. Do not install `tsx` merely to hide them.

If deployment still fails, inspect the first actual error after the warnings and the final build exit status. Warning-only log excerpts cannot identify every possible deployment failure.

## Stack and library choices

- React 19, TypeScript strict mode, Vite 8 through Vinext, and Tailwind CSS 4.
- Existing shadcn/Radix primitives for tabs, dialogs, menus, tooltips, selects, switches, and collapsible details.
- RDKit.js `2025.3.4-1.0.0`: native parsing and sanitization, canonical and isomeric SMILES, descriptors, stereochemistry, JSON graph, 2D coordinates, and SVG.
- OpenChemLib `9.25.0`: CanvasEditor, conformer generation with deterministic seed 42, and MMFF94 geometry optimization.
- 3Dmol.js `2.5.5`: WebGL rendering and camera/representation controls.
- Browser Web Worker: RDKit WASM and conformer calculations are isolated from React rendering.

OpenChemLib is the mature drawing and conformer library in place of Ketcher. RDKit.js's minimal browser package does not expose the complete Python ETKDG/force-field workflow. No substitute hand-written force field is used.

## Architecture

| Location | Responsibility |
|---|---|
| `components/layout` | Workspace state, import/export actions, themes, help, error boundary |
| `components/editor` | Text/Draw inputs, OpenChemLib editor adapter, Lewis view |
| `components/viewer` | Persistent 3Dmol viewer, 2D/Fischer views, camera and display settings |
| `components/properties` | Primary properties and expandable descriptors |
| `lib/chemistry/rdkit.ts` | Native parsing, resource lifetime, canonicalization helpers |
| `lib/chemistry/graph.ts` | Library-independent graph, electron accounting, validated JSON adapter |
| `lib/chemistry/analyze.ts` | Parse → validate → normalize → properties → 2D → Fischer |
| `lib/chemistry/conformer.ts` | Mature conformer/force-field adapter and independent validation |
| `lib/chemistry/fischer.ts` | Supported-chain selection, projected candidates, RDKit verification |
| `lib/conversion` | Format-specific browser downloads and snapshots |
| `hooks/useChemistry.ts` | Worker lifecycle, cancellation, timeouts, 24-result session cache |
| `workers/chemistry.worker.ts` | Serialized chemistry jobs and library loading |
| `types/molecule.ts` | Normalized model and worker message contracts |
| `tests/chemistry.test.ts` | Chemistry and stereochemistry regression checks |

The host serves the interface and static library files. There is no chemistry server, database, authentication code inside the application, or molecular telemetry. Private access to the hosted URL is handled by the hosting platform.

### Normalized data model

`MoleculeGraph` has versioned atoms, bonds, stereochemistry, and provenance metadata. Atoms include element, atomic number, charge, implicit/grouped hydrogens, isotope, radical electrons, aromaticity, tetrahedral stereo, CIP code when assigned, and coordinates. Bonds include endpoints, order, aromaticity, stereo, and stereo-reference atoms for E/Z bonds.

JSON imports validate the graph itself; metadata strings are not trusted as a replacement for its atoms and bonds. Canonicalization can reorder atom IDs. Graph exports describe the 2D graph; verified conformer coordinates are exported separately as 3D SDF.

## How to use it

1. Select an example, enter SMILES and press **Visualize molecule**, or open **Draw → Edit structure**.
2. In the sketcher, use atom, bond, aromatic/ring template, charge, eraser, selection, and stereobond tools. Drag to draw bonds; use the element picker or atom typing shortcuts. Undo/redo buttons preserve up to 60 snapshots during the editing session.
3. Apply the structure to validate it and calculate the output. Expensive calculations are explicit on Apply/Visualize rather than running for every mouse movement or keystroke.
4. Switch between **3D model**, **2D structure**, and **Fischer**.
5. Use **All properties** for donors/acceptors, rotatable bonds, charge, exact mass, TPSA, calculated logP, and both SMILES forms.
6. Use **Export** for SMILES, MOL/SDF, current-view PNG, 2D/Fischer SVG, or graph JSON.

### 3D interaction

Drag to rotate, scroll/pinch to zoom, and right-drag to pan. Camera buttons provide keyboard-accessible zoom, rotation, and reset. Rendering modes are Ball & Stick, Stick, Space Filling/CPK, and Wireframe. Hydrogens, labels, and multiple-bond display can be toggled. Click an atom for its element and conformer atom number. Conformer numbering includes explicit H and need not match the 2D graph IDs.

Standard element-color families are used; carbon is gray and hydrogen is pale gray for contrast. The view uses a single long-lived WebGL context across molecule and tab changes. Resize observers and model/label cleanup prevent accumulation during normal editing. The context is released on workspace teardown.

### Import and export

- Inputs: SMILES, the six included molecule names, a single MOL/SDF record, or exported version-1 graph JSON.
- Multi-record SDF files are rejected explicitly. Max import size is 200 KB.
- MOL/SDF 2D output preserves assigned stereochemistry. The 3D SDF option is enabled only for a verified conformer.
- PNG snapshots capture the current representation. SVG outputs are scalable chemical diagrams.
- The source download includes this README, complete application source, pinned lockfile, build scripts, tests, and third-party notices. Host-specific project identity is removed from the downloadable source.

## Chemical correctness and boundaries

### Exact graph versus generated geometry

RDKit sanitization remains authoritative for accepted graphs and valences. Formal charges, implicit/explicit hydrogen, aromaticity, isotopes, ordinary tetrahedral stereocenters, and specified E/Z bonds are retained. No neutralization, tautomer selection, or unrequested protonation changes are performed. Canonical aromatic representation is a library normalization, not a change of molecule.

3D models are generated conformers, not experimental structures. MMFF94 success is reported only when the minimizer returns success with finite energy. Unconverged or unsupported force fields are labeled **unoptimized**. Neither status implies a global energy minimum. Energies are not presented as comparable chemical properties.

Every proposed 3D model has its 2D wedge hints removed; RDKit reads the actual 3D coordinates. After removing ordinary explicit H atoms, the complete canonical isomeric SMILES must equal the input. A mismatch produces **3D model unavailable**, with no geometry rendered or exported. This also prevents a guessed stereoisomer from being shown for an ambiguous input.

The OCL V2000 writer can rescale short bonds to suit 2D display. The conformer adapter restores the actual calculated Å coordinates before validation/export. Unit tests check water bond lengths and bent geometry.

**Known pinned-library regression:** OpenChemLib's conformer generator in this version changes Z-1,2-difluoroethene to the E arrangement. The independent check rejects that output. Both its 2D depiction and E/Z graph round trips remain available; a regression test ensures the incorrect 3D structure cannot appear. Other E/Z test structures, including both 2-butene isomers, pass coordinate verification.

3D generation is disabled for disconnected fragments and radicals. The 2D graph and properties retain all fragments. Unsupported elements, coordination chemistry, unusually large rings, unspecified stereochemistry, or other engine limitations can result in an unavailable conformer.

Graph analysis supports up to 500 heavy atoms; 3D attempts are limited to 250 graph atoms. Each stage has a 45-second timeout and can be cancelled by changing the molecule. A 200-carbon graph is included in the test suite. Mobile performance and arbitrary large-molecule conformer coverage are not guaranteed.

Enhanced relative/alternative stereo groups are explicitly rejected instead of silently becoming an absolute stereoisomer. InChI input and molecular-formula/name database search are not implemented. A molecular formula alone does not identify a unique structure.

### Fischer projection scope

Supported structures are neutral, unbranched, acyclic carbon chains of 3–10 carbons. Each internal carbon must have assigned R/S stereochemistry, one hydrogen, and a simple OH, NH2, F, Cl, Br, or I substituent. Termini must be supported CH3, CH2OH, CHO, or COOH groups. Every graph atom must be represented. Radicals, isotopically labeled structures, aromatic/cyclic structures, disconnected structures, unsupported branches, and unspecified centers receive no projection.

The more oxidized supported terminus goes at the top. If terminal priorities tie, input atom order breaks the tie consistently. Horizontal substituents point toward the viewer; vertical bonds point away. The limited supported left/right combinations are encoded as candidate stereo MOL files and passed through RDKit. A candidate is shown only if its full isomeric graph matches the original. CIP ranking is not invented in application code.

For unsupported or ambiguous input, the interface says:

> Fischer projection is not applicable or cannot be uniquely generated for this structure.

The Glucose sample is **open-chain D-glucose**, not a cyclic glucopyranose form. Its verified Fischer OH pattern is right–left–right–right with R/S/R/R centers. The Lactic acid sample is L-(S)-lactic acid.

### Lewis representation scope

The sketcher supplies the molecular connectivity; the Lewis view renders the same graph with grouped H atoms, symbols, formal charges, bonds, and inferred lone pairs. Electron accounting is used only for supported main-group closed-shell atoms within the duet/octet envelope. Aromatic, radical, isotopically labeled, and unsupported atoms get no inferred dots.

Selecting a supported atom lets the user change the lone-pair count. The interface explicitly shows the resulting formal charge; **Apply electrons** sends the changed graph through RDKit validation. Invalid electron/valence states are not silently repaired. This is a condensed Lewis view, not an arbitrary electron-dot image recognizer, orbital model, resonance enumerator, or full electron-pushing editor. It does not display stereochemical wedges; use the 2D view for stereochemistry.

### Property conventions

- Formula is calculated from RDKit atom and hydrogen counts, using Hill ordering. An inorganic salt can therefore display `ClNa` rather than conventional `NaCl`.
- Molecular weight and exact mass come from RDKit descriptors; they are not inferred from sample labels.
- Total atom count includes H; graph bond count excludes implicit H bonds.
- Stereocenter count includes unassigned centers, reported separately.
- logP is a calculated descriptor, not a measured property.

## Optional backend extension

`ConformerProvider` defines the replacement boundary. `BackendConformerProvider` is an inactive HTTP adapter for a future RDKit service; there is no placeholder service, secret, or endpoint in the running app. A service could generate ETKDG conformers, optimize them using MMFF/UFF, and return MOL coordinates plus method/convergence metadata.

External results must undergo the same independent client-side graph/coordinate check before `verified` can become true. The supplied adapter deliberately returns `verified: false` and is not wired into the UI.

## Tests and verification

The Node test suite uses the actual pinned RDKit WASM and OpenChemLib engines. Tests include methane, water, ethanol, benzene, acetic acid, lactic-acid enantiomers, D-glucose, charged/aromatic structures, invalid valences, isotopes, disconnected fragments, unsupported Fischer structures, normalized JSON conversions, E/Z bonds, sketcher MOL exports, all sample conformers, bond lengths/angles, and a 200-atom input.

Run `npm test` and `npm run typecheck`. The production build is also validated. These are chemistry, adapter, and build checks; no claim is made of comprehensive visual/browser/accessibility certification. The CanvasEditor is a mature pointer-oriented editor, with a keyboard-accessible text-input alternative. Theme, controls, menus, focus states, reduced motion, and responsive layouts are implemented in the surrounding application.

## Primary library references

- [RDKit.js repository and API](https://github.com/rdkit/rdkit-js)
- [RDKit.js examples](https://www.rdkitjs.com/)
- [RDKit molecular JSON and stereochemistry](https://www.rdkit.org/docs/RDKit_Book.html)
- [OpenChemLib CanvasEditor](https://cheminfo.github.io/openchemlib-js/classes/CanvasEditor.html)
- [OpenChemLib conformer generator](https://cheminfo.github.io/openchemlib-js/classes/ConformerGenerator.html)
- [OpenChemLib MMFF94](https://cheminfo.github.io/openchemlib-js/classes/ForceFieldMMFF94.html)
- [3Dmol viewer API](https://3dmol.csb.pitt.edu/doc/GLViewer.html)

For education and scientific exploration. This tool is not a substitute for validated computational chemistry software.
