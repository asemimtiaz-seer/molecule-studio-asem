import { spawn } from "node:child_process";
process.env.WRANGLER_LOG_PATH ??= ".wrangler/wrangler.log";
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "localhost"], { stdio: "inherit", env: process.env });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
