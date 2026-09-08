import { readdir, readFile, writeFile } from "node:fs/promises";
import { zipSync } from "fflate";
import path from "node:path";
const paths = ["app", "components", "hooks", "lib", "types", "workers", "scripts", "tests", "build", "worker", "vendor"];
const flat = ["package.json", "package-lock.json", "vercel.json", ".nvmrc", ".npmrc", "tsconfig.json", "vite.config.ts", "postcss.config.mjs", "next.config.ts", "next.config.mjs", "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "eslint.config.mjs", "components.json", "public/favicon.svg"];
const files = {};
async function addFile(filename) { try { files[`molecule-studio/${filename}`] = new Uint8Array(await readFile(filename)); } catch (error) { if (error.code !== "ENOENT") throw error; } }
async function walk(dir) { for (const item of await readdir(dir, { withFileTypes: true })) { const filename = path.posix.join(dir, item.name); if (item.isDirectory()) await walk(filename); else if (item.isFile()) await addFile(filename); } }
for (const dir of paths) await walk(dir);
for (const file of flat) await addFile(file);
files["molecule-studio/.openai/hosting.json"] = new TextEncoder().encode('{"d1":null,"r2":null}\n');
files["molecule-studio/.gitignore"] = new Uint8Array(await readFile(".gitignore"));
await writeFile("public/molecule-studio-source.zip", zipSync(files, { level: 6 }));
console.log(`Packaged ${Object.keys(files).length} source files without site credentials, runtime state, or dependencies.`);
