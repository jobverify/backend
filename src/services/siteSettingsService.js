import SiteSettings from "../models/SiteSettings.js";

const publicSettings = (settings) => ({
  billingEnabled: settings?.billingEnabled === true,
  experiencedJobsEnabled: settings?.experiencedJobsEnabled !== false,
});

let pendingRead;

export async function getSiteSettings() {
  // Share only overlapping reads. Billing and visibility decisions must always
  // consult MongoDB again after that read completes, including after failures.
  if (!pendingRead) {
    const read = Promise.resolve().then(() => SiteSettings.findById('global').lean())
      .then(publicSettings).finally(() => { if (pendingRead === read) pendingRead = undefined; });
    pendingRead = read;
  }
  return { ...await pendingRead };
}

export async function saveSiteSettings(changes, updatedBy) {
  // Keep the existing billing-only service call compatible with older callers.
  const values = typeof changes === "boolean" ? { billingEnabled: changes } : changes;
  const settings = await SiteSettings.findByIdAndUpdate("global", {
    $set: { ...values, updatedBy },
  }, { upsert: true, new: true, runValidators: true }).lean();
  // Reads started before this write must not be reused after it commits.
  pendingRead = undefined;
  return publicSettings(settings);
}
