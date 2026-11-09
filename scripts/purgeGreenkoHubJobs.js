/**
 * Remove job records created for the retired Greenko Hub provider.
 *
 * Usage:
 *   node scripts/purgeGreenkoHubJobs.js
 *   node scripts/purgeGreenkoHubJobs.js --confirm
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../.env") });

const greenkoHubFilter = {
  $or: [
    { company: "Greenko Hub" },
    { source: "greenkohub" },
  ],
};
const confirmed = process.argv.includes("--confirm");

const { default: connectDB } = await import("../db/db.js");
const { default: Job } = await import("../src/models/Job.js");

try {
  await connectDB();
  const matchedCount = await Job.countDocuments(greenkoHubFilter);
  console.log(`Matched ${matchedCount} Greenko Hub job record(s).`);

  if (!confirmed) {
    console.log("Preview only. Re-run with --confirm to delete these records.");
  } else {
    const { deletedCount } = await Job.deleteMany(greenkoHubFilter);
    console.log(`Deleted ${deletedCount} Greenko Hub job record(s).`);
  }
} catch (error) {
  process.exitCode = 1;
  console.error("Greenko Hub purge failed:", error.message);
} finally {
  await mongoose.disconnect();
}
