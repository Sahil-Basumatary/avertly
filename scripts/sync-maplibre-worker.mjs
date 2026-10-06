import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const source = join(
  process.cwd(),
  "node_modules",
  "maplibre-gl",
  "dist",
  "maplibre-gl-worker.mjs",
);
const destination = join(
  process.cwd(),
  "public",
  "maplibre-gl-worker.mjs",
);

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
