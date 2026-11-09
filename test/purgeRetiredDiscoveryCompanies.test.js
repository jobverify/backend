import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

const execFileAsync = promisify(execFile);
const backendDirectory = path.resolve(import.meta.dirname, "..");

test("retired-company purge removes only the selected provider data", async (t) => {
  let mongoServer;
  let client;

  try {
    mongoServer = await MongoMemoryServer.create({
      binary: { downloadDir: path.join(os.tmpdir(), "jobverify-mongodb-binaries") },
    });
    client = await mongoose.mongo.MongoClient.connect(mongoServer.getUri("jobverify"));
  } catch (error) {
    if (/(Could NOT download|DownloadError|ETIMEDOUT|fastdl\.mongodb\.org)/i.test(String(error))) {
      t.skip("mongodb-memory-server binary download is unavailable in this environment");
      return;
    }
    throw error;
  }

  try {
    const database = client.db("jobverify");
    const retiredJobId = new mongoose.Types.ObjectId();
    const retiredHimalayasJobId = new mongoose.Types.ObjectId();
    const keptJobId = new mongoose.Types.ObjectId();
    const retiredStatusId = new mongoose.Types.ObjectId();
    const retiredHimalayasStatusId = new mongoose.Types.ObjectId();
    const keptStatusId = new mongoose.Types.ObjectId();

    await database.collection("jobs").insertMany([
      {
        _id: retiredJobId,
        title: "Retired Discovery role",
        description: "Build reliable applications for the engineering team.",
        company: "Retired Discovery Co",
        source: "retired-co.wellfoundDirectory",
        fingerprint: "retired-discovery-fingerprint",
        status: "active",
        isPublicIndia: true,
        jobType: "Full-time Experienced",
      },
      {
        _id: retiredHimalayasJobId,
        title: "Retired Himalayas role",
        description: "Build reliable applications for the engineering team.",
        company: "Retired Himalayas Co",
        source: "retired-co.himalayas.app",
        fingerprint: "retired-himalayas-fingerprint",
        status: "active",
        isPublicIndia: true,
        jobType: "Full-time Experienced",
      },
      {
        _id: keptJobId,
        title: "Kept role",
        description: "Build reliable applications for the engineering team.",
        company: "Kept Co",
        source: "kept-co",
        fingerprint: "kept-fingerprint",
        status: "active",
        isPublicIndia: true,
        jobType: "Full-time Experienced",
      },
    ]);
    await database.collection("scraperstatuses").insertMany([
      {
        _id: retiredHimalayasStatusId,
        source: "retired-co.himalayas.app",
        companyName: "Retired Himalayas Co",
      },
      {
        _id: retiredStatusId,
        source: "retired-co.wellfoundDirectory",
        companyName: "Retired Discovery Co",
      },
      { _id: keptStatusId, source: "kept-co", companyName: "Kept Co" },
    ]);
    await database.collection("users").insertOne({
      savedJobs: [retiredJobId, retiredHimalayasJobId, keptJobId],
      profile: {
        profilePreferenceFilters: {
          company: ["Retired Discovery Co", "Retired Himalayas Co", "Kept Co"],
        },
        telegramAlertFilters: {
          company: ["Retired Discovery Co", "Retired Himalayas Co", "Kept Co"],
        },
      },
    });
    await database.collection("clicks").insertMany([
      { job: retiredJobId },
      { job: retiredHimalayasJobId },
      { job: keptJobId },
    ]);
    await database.collection("jobalertdeliveries").insertMany([
      { job: retiredJobId, jobSnapshot: { company: "Retired Discovery Co" } },
      { job: retiredHimalayasJobId, jobSnapshot: { company: "Retired Himalayas Co" } },
      { job: keptJobId, jobSnapshot: { company: "Kept Co" } },
    ]);
    await database.collection("jobdatasetsummaries").insertOne({
      key: "public-active",
      totalJobs: 3,
      totalCompanies: 3,
      companies: ["Retired Discovery Co", "Retired Himalayas Co", "Kept Co"],
    });
    await database.collection("scraperruns").insertOne({
      sources: {
        "retired-co\uFF0EwellfoundDirectory": { success: true, jobsFound: 1 },
        "retired-co\uFF0Ehimalayas\uFF0Eapp": { success: true, jobsFound: 1 },
        "kept-co": { success: true, jobsFound: 1 },
        "normalized-skip": { success: false, skipped: true, jobsFound: 0 },
        "legacy-skip": { success: true, skipped: true, jobsFound: 0 },
        "partial": { success: true, partial: true, jobsFound: 5, inserted: 2, updated: 3 },
        "blocked": { success: true, jobsFound: 0, zeroJobEvidence: 'blocked-zero' },
        "unverified": { success: true, jobsFound: 0, zeroJobEvidence: 'unverified-zero' },
      },
      overall: { totalJobs: 3, sourcesSucceeded: 3, sourcesFailed: 0 },
    });
    await database.collection("adminaudits").insertMany([
      { targetType: "Job", targetId: retiredJobId },
      { targetType: "Job", targetId: retiredHimalayasJobId },
      { targetType: "Job", targetId: keptJobId },
      { targetType: "ScraperStatus", targetId: retiredStatusId },
      { targetType: "ScraperStatus", targetId: retiredHimalayasStatusId },
      { targetType: "ScraperStatus", targetId: keptStatusId },
    ]);

    await execFileAsync(
      process.execPath,
      ["scripts/purgeRetiredCompanyJobs.js", "--only-source=retired-co.wellfoundDirectory", "--confirm"],
      {
        cwd: backendDirectory,
        env: { ...process.env, MONGO_URI: mongoServer.getUri("jobverify") },
        timeout: 60_000,
      },
    );

    assert.deepEqual(
      await database.collection("jobs").distinct("company"),
      ["Kept Co", "Retired Himalayas Co"],
    );
    assert.deepEqual(
      await database.collection("scraperstatuses").distinct("source"),
      ["kept-co", "retired-co.himalayas.app"],
    );

    const [user, summary, scraperRun] = await Promise.all([
      database.collection("users").findOne({}),
      database.collection("jobdatasetsummaries").findOne({ key: "public-active" }),
      database.collection("scraperruns").findOne({}),
    ]);
    assert.deepEqual(user.savedJobs, [retiredHimalayasJobId, keptJobId]);
    assert.deepEqual(user.profile.profilePreferenceFilters.company, ["Retired Himalayas Co", "Kept Co"]);
    assert.deepEqual(user.profile.telegramAlertFilters.company, ["Retired Himalayas Co", "Kept Co"]);
    assert.deepEqual(scraperRun.overall, {
      totalJobs: 7,
      sourcesSucceeded: 3,
      sourcesFailed: 2,
    });
    assert.deepEqual(summary.companies, ["Kept Co", "Retired Himalayas Co"]);
    assert.equal(summary.totalJobs, 2);
    assert.equal(summary.totalCompanies, 2);
    assert.deepEqual(Object.keys(scraperRun.sources), ["retired-co\uFF0Ehimalayas\uFF0Eapp", "kept-co",
      "normalized-skip", "legacy-skip", "partial", "blocked", "unverified"]);
    assert.deepEqual(scraperRun.sources.partial, { success: true, partial: true, jobsFound: 5, inserted: 2, updated: 3 });
    assert.equal(await database.collection("clicks").countDocuments({}), 2);
    assert.equal(await database.collection("jobalertdeliveries").countDocuments({}), 2);
    assert.equal(await database.collection("adminaudits").countDocuments({}), 4);
  } finally {
    await client?.close();
    await mongoServer?.stop();
  }
});
