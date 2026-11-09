/**
 * Remove job records and linked MongoDB data for retired company providers.
 *
 * Himalayas and Wellfound bulk-directory identities are retired as a family.
 * Their source suffix is stable even when an individual provider was migrated
 * to a first-party scraper implementation.
 *
 * Usage:
 *   node scripts/purgeRetiredCompanyJobs.js
 *   node scripts/purgeRetiredCompanyJobs.js --confirm
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { summarizeScraperHistory } from "../scraper-support/utils/scraperOutcome.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../.env") });

const retiredSources = [
  "1mg", "dishtv", "dpworld", "cars24", "ashokleyland", "ador",
  "fortishealthcare", "adityabirlacapital", "legrand", "tatamotors",
  "godrejconsumerproducts", "godrejenterprisesgroup", "godrejproperties",
  "indiamart", "tvsmotorcompany", "johnsoncontrolsindia",
  "drreddyslaboratories", "arcelormittalnipponsteelindia", "delhivery",
  "karurvysyabank", "bajajallianz", "bajajauto", "bajajelectricals",
  "bajajfinserv", "bajajfinservhealth", "bajajhousingfinance", "bajajmarkets",
  "aakash", "dixontechnologies", "heromotocorp", "leapfinance", "mygate",
  "narayanahealth", "redbus", "redingtonindia", "sahyadriindustries",
  "theindianpublicschool", "ibm", "detroitengineeredproducts", "orangebusiness",
];
const retiredCompanyNames = [
  "1mg", "Tata 1mg", "Tata1mg", "DishTV", "Dish TV", "DP World", "Stryker",
  "Cars24", "Ashok Leyland", "ADOR", "Fortis Healthcare", "Aditya Birla Capital",
  "Legrand", "Tata Motors", "Godrej Consumer Products", "Godrej Enterprises Group",
  "Godrej Properties", "IndiaMART", "TVS Motor Company", "Johnson Controls India",
  "Johnson Controls", "Dr. Reddy's Laboratories", "ArcelorMittal Nippon Steel India",
  "AM/NS India", "Delhivery", "Karur Vysya Bank", "Bajaj Allianz", "Bajaj Auto",
  "Bajaj Electricals", "Bajaj Finserv", "Bajaj Finserv Health", "Bajaj Housing Finance",
  "Bajaj Markets",
  "Aakash", "Aakash Byju's", "Aakash Educational Services", "Aakash Institute",
  "Akash Institute", "Dixon Technologies", "Hero MotoCorp", "Leap Finance",
  "MyGate", "Narayana Health", "RedBus", "redBus India Pvt Ltd.",
  "Redington India", "Sahyadri Industries", "The Indian Public School (TIPS)",
  "IBM", "Detroit Engineered Products", "Detroit Engineering", "Orange Business",
];

const DISCOVERY_SOURCE_PATTERN = /(?:\.wellfoundDirectory|\.himalayas(?:Directory|\.app))$/i;
const confirmed = process.argv.includes("--confirm");
const onlySourceSelectors = process.argv.slice(2).filter((argument) =>
  argument === "--only-source" || argument.startsWith("--only-source="),
);
if (onlySourceSelectors.length > 1 || onlySourceSelectors.length === 1
  && (!onlySourceSelectors[0].startsWith("--only-source=")
    || !onlySourceSelectors[0].slice("--only-source=".length).trim())) {
  throw new Error("Expected one non-empty --only-source=<source> selector; bare, empty and duplicate selectors are invalid.");
}
const onlySource = onlySourceSelectors[0]?.slice("--only-source=".length).trim();
const sourcesToPurge = onlySource ? [onlySource] : retiredSources;
const companyNamesToPurge = onlySource ? [] : retiredCompanyNames;
const discoverySourcePattern = onlySource ? null : DISCOVERY_SOURCE_PATTERN;
const sourceSet = new Set(sourcesToPurge);
const decodeMongoMapKey = (value) => String(value || "")
  .replaceAll("\uFF04", "$")
  .replaceAll("\uFF0E", ".");
const isRetiredSource = (source) => {
  const decodedSource = decodeMongoMapKey(source);
  return sourceSet.has(decodedSource) || Boolean(discoverySourcePattern?.test(decodedSource));
};
const uniqueStrings = (values) => [...new Set(
  values.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean),
)];

const { default: connectDB } = await import("../db/db.js");
const mongoose = (await import("mongoose")).default;

try {
  await connectDB();

  const [
    { default: AdminAudit },
    { default: Click },
    { default: Job },
    { default: JobAlertDelivery },
    { default: JobDatasetSummary },
    { default: ScraperRun },
    { default: ScraperStatus },
    { default: User },
    { refreshJobDatasetSummary },
    { getScraperCatalog },
  ] = await Promise.all([
    import("../src/models/AdminAudit.js"),
    import("../src/models/Click.js"),
    import("../src/models/Job.js"),
    import("../src/models/JobAlertDelivery.js"),
    import("../src/models/JobDatasetSummary.js"),
    import("../src/models/ScraperRun.js"),
    import("../src/models/ScraperStatus.js"),
    import("../src/models/User.js"),
    import("../src/services/jobDatasetSummaryService.js"),
    import("../scraper-support/providers/index.js"),
  ]);

  const initialCompanyNames = uniqueStrings(companyNamesToPurge);
  // Source is the ownership boundary. Mongo query $in/regex also match array
  // elements, so require the field itself to be a scalar string.
  const sourceSelectionFilter = {
    $expr: { $eq: [{ $type: "$source" }, "string"] },
    $or: [
      { source: { $in: sourcesToPurge } },
      ...(discoverySourcePattern ? [{ source: discoverySourcePattern }] : []),
    ],
  };
  const scraperStatusFilter = sourceSelectionFilter;
  const matchedStatuses = await ScraperStatus.find(scraperStatusFilter)
    .select("_id source companyName")
    .lean();
  const companyNames = uniqueStrings([
    ...initialCompanyNames,
    ...matchedStatuses.map(({ companyName }) => companyName),
  ]);
  const retiredCompanyFilter = sourceSelectionFilter;
  const matchedJobs = await Job.find(retiredCompanyFilter)
    .select("_id company source")
    .lean();
  const allCompanyNames = uniqueStrings([
    ...companyNames,
    ...matchedJobs.map(({ company }) => company),
  ]);
  const jobIds = matchedJobs.map(({ _id }) => _id);
  const statusIds = matchedStatuses.map(({ _id }) => _id);
  const registeredCompanyNames = uniqueStrings(getScraperCatalog()
    .filter(({ source }) => !isRetiredSource(source))
    .map(({ companyName }) => companyName));
  const removableCompanyNames = async (names, excludedJobIds = [], excludedStatusIds = []) => {
    const [jobCompanies, statusCompanies] = await Promise.all([
      Job.distinct("company", { _id: { $nin: excludedJobIds }, company: { $in: names } }),
      ScraperStatus.distinct("companyName", { _id: { $nin: excludedStatusIds }, companyName: { $in: names } }),
    ]);
    const retained = new Set([...registeredCompanyNames, ...jobCompanies, ...statusCompanies]);
    return names.filter((name) => !retained.has(name));
  };
  const previewCompanyNames = await removableCompanyNames(allCompanyNames, jobIds, statusIds);
  const userFilter = {
    $or: [
      { savedJobs: { $in: jobIds } },
      { "profile.profilePreferenceFilters.company": { $in: previewCompanyNames } },
      { "profile.telegramAlertFilters.company": { $in: previewCompanyNames } },
    ],
  };
  // A delivery's snapshot has no source ownership. Only an attributable job
  // ID can select it; historical company labels never widen this query.
  const deliveryFilter = { job: { $in: jobIds } };
  const auditFilter = {
    $or: [
      { targetType: "Job", targetId: { $in: jobIds } },
      { targetType: "ScraperStatus", targetId: { $in: statusIds } },
    ],
  };
  const scraperRuns = await ScraperRun.collection.find({}).toArray();
  const scraperRunUpdates = scraperRuns.flatMap((run) => {
    const entries = Object.entries(run.sources || {});
    const remainingEntries = entries.filter(([source]) => !isRetiredSource(source));
    if (remainingEntries.length === entries.length) return [];

    const remainingSources = Object.fromEntries(remainingEntries);
    const sourceResults = Object.values(remainingSources);
    return [{
      updateOne: {
        filter: { _id: run._id, sources: run.sources },
        update: {
          $set: {
            sources: remainingSources,
            overall: summarizeScraperHistory(sourceResults),
          },
        },
      },
    }];
  });

  const preview = {
    jobs: matchedJobs.length,
    scraperStatuses: matchedStatuses.length,
    users: await User.countDocuments(userFilter),
    clicks: await Click.countDocuments({ job: { $in: jobIds } }),
    jobAlertDeliveries: await JobAlertDelivery.countDocuments(deliveryFilter),
    jobDatasetSummaries: await JobDatasetSummary.countDocuments({
      companies: { $in: allCompanyNames },
    }),
    scraperRuns: scraperRunUpdates.length,
    adminAudits: await AdminAudit.countDocuments(auditFilter),
  };
  console.log("Retired-company purge preview:", JSON.stringify(preview));

  if (!confirmed) {
    console.log("Preview only. Re-run with --confirm to delete these records.");
  } else {
    const results = {};
    // Recheck ownership atomically at removal. Linked cleanup uses only rows
    // actually returned, never IDs whose source changed after the preview.
    const removedJobs = [], removedStatuses = [];
    for (const { _id } of matchedJobs) {
      const removed = await Job.findOneAndDelete({ ...sourceSelectionFilter, _id })
        .select("_id company source").lean();
      if (removed) removedJobs.push(removed);
    }
    for (const { _id } of matchedStatuses) {
      const removed = await ScraperStatus.findOneAndDelete({ ...sourceSelectionFilter, _id })
        .select("_id companyName source").lean();
      if (removed) removedStatuses.push(removed);
    }
    const removedJobIds = removedJobs.map(({ _id }) => _id);
    const removedStatusIds = removedStatuses.map(({ _id }) => _id);
    const confirmedCompanyNames = await removableCompanyNames(uniqueStrings([
      ...initialCompanyNames,
      ...removedJobs.map(({ company }) => company),
      ...removedStatuses.map(({ companyName }) => companyName),
    ]));
    const confirmedUserFilter = { $or: [
      { savedJobs: { $in: removedJobIds } },
      { "profile.profilePreferenceFilters.company": { $in: confirmedCompanyNames } },
      { "profile.telegramAlertFilters.company": { $in: confirmedCompanyNames } },
    ] };
    results.users = await User.updateMany(confirmedUserFilter, {
      $pull: {
        savedJobs: { $in: removedJobIds },
        "profile.profilePreferenceFilters.company": { $in: confirmedCompanyNames },
        "profile.telegramAlertFilters.company": { $in: confirmedCompanyNames },
      },
    });
    results.clicks = await Click.deleteMany({ job: { $in: removedJobIds } });
    results.jobAlertDeliveries = await JobAlertDelivery.deleteMany({ job: { $in: removedJobIds } });
    results.adminAudits = await AdminAudit.deleteMany({ $or: [
      { targetType: "Job", targetId: { $in: removedJobIds } },
      { targetType: "ScraperStatus", targetId: { $in: removedStatusIds } },
    ] });
    if (scraperRunUpdates.length > 0) {
      results.scraperRuns = await ScraperRun.collection.bulkWrite(scraperRunUpdates);
    }
    results.jobs = { deletedCount: removedJobs.length };
    results.scraperStatuses = { deletedCount: removedStatuses.length };
    await refreshJobDatasetSummary();

    console.log("Retired-company purge applied:", JSON.stringify({
      jobs: results.jobs.deletedCount,
      scraperStatuses: results.scraperStatuses.deletedCount,
      users: results.users.modifiedCount,
      clicks: results.clicks.deletedCount,
      jobAlertDeliveries: results.jobAlertDeliveries.deletedCount,
      scraperRuns: results.scraperRuns?.modifiedCount || 0,
      scraperRunConflicts: scraperRunUpdates.length - (results.scraperRuns?.matchedCount || 0),
      adminAudits: results.adminAudits.deletedCount,
    }));
  }
} catch (error) {
  process.exitCode = 1;
  console.error("Retired-company purge failed:", error.message);
} finally {
  await mongoose.disconnect();
}
