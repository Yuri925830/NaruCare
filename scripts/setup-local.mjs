import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = join(root, "worker", ".dev.vars.example");
const localPath = join(root, "worker", ".dev.vars");

if (!existsSync(localPath)) {
  copyFileSync(examplePath, localPath);
  console.log("Created worker/.dev.vars with optional blank provider keys.");
} else {
  console.log("Keeping existing worker/.dev.vars.");
}
