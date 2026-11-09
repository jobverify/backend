/**
 * @file Database utility to repair and normalize scraped job cities.
 * @module scripts/repairCities
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../.env") });

const { default: connectDB } = await import("../db/db.js");
const { default: Job } = await import("../src/models/Job.js");
const { normalizeCity } = await import("../scraper-support/utils/cityNormalizer.js");

// Query all active and expired jobs, re-run city normalization, and save modifications.
async function main() {
  try {
    await connectDB();
    console.log("Connected to MongoDB database.");

    const jobs = await Job.find({}).exec();
    console.log(`Retrieved ${jobs.length} jobs to inspect.`);

    let updatedCount = 0;
    for (const job of jobs) {
      const originalCity = job.city;
      const normalizedCity = normalizeCity(originalCity || job.location || "");

      if (normalizedCity !== originalCity) {
        job.city = normalizedCity;
        await job.save();
        console.log(`  [Updated] "${job.title}" (${job.company}): "${originalCity}" -> "${normalizedCity}"`);
        updatedCount++;
      }
    }

    console.log(`\n✓ City repair completed. Updated ${updatedCount} out of ${jobs.length} jobs.`);
  } catch (err) {
    console.error("City repair failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }
}

main();
