import SiteSettings from "../models/SiteSettings.js";

const publicSettings = (settings) => ({
  billingEnabled: settings?.billingEnabled === true,
  experiencedJobsEnabled: settings?.experiencedJobsEnabled !== false,
});

export async function getSiteSettings() {
  const settings = await SiteSettings.findById("global").lean();
  return publicSettings(settings);
}

export async function saveSiteSettings(changes, updatedBy) {
  // Keep the existing billing-only service call compatible with older callers.
  const values = typeof changes === "boolean" ? { billingEnabled: changes } : changes;
  const settings = await SiteSettings.findByIdAndUpdate("global", {
    $set: { ...values, updatedBy },
  }, { upsert: true, new: true, runValidators: true }).lean();
  return publicSettings(settings);
}
