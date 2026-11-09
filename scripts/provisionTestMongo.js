import path from "node:path";
import { MongoBinary } from "mongodb-memory-server";

// Explicit download step, separate from tests. Never loads application credentials
// or starts a database. Use the same version/cache in CI and local integration runs.
const downloadDir = path.resolve(
  process.env.MONGOMS_DOWNLOAD_DIR || path.join(import.meta.dirname, "../.cache/mongodb-binaries"),
);
process.env.MONGOMS_RUNTIME_DOWNLOAD = "true";
const binaryPath = await MongoBinary.getPath({
  version: process.env.MONGOMS_VERSION || "8.2.6",
  downloadDir,
});
console.log("MongoDB test binary ready:", binaryPath);
