import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".chemistry-test", { recursive: true });
await build({ entryPoints: ["tests/chemistry.test.ts"], outfile: ".chemistry-test/chemistry.test.mjs", bundle: true, format: "esm", platform: "node", packages: "external", target: "node22" });
const result = spawnSync(process.execPath, ["--test", ".chemistry-test/chemistry.test.mjs"], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
