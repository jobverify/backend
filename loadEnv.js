/**
 * @file Loads local environment configuration with optional cloud fallbacks.
 * @module loadEnv
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILES = [".env", ".env.cloud"];

for (const fileName of ENV_FILES) {
  const filePath = path.resolve(currentDir, fileName);
  if (!fs.existsSync(filePath)) continue;

  dotenv.config({
    path: filePath,
    override: false,
    quiet: true,
  });
}
