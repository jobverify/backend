import { getSiteSettings, saveSiteSettings } from "../services/siteSettingsService.js";

export async function readSiteSettings(_req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.json({ success: true, data: await getSiteSettings() });
  } catch (error) { next(error); }
}

export async function updateSiteSettings(req, res, next) {
  const fields = ["billingEnabled", "experiencedJobsEnabled"];
  const changes = Object.fromEntries(fields.filter((key) => Object.hasOwn(req.body ?? {}, key)).map((key) => [key, req.body[key]]));
  if (!Object.keys(changes).length || Object.values(changes).some((value) => typeof value !== "boolean")) {
    return res.status(400).json({ success: false, message: "Provide billingEnabled or experiencedJobsEnabled as a boolean." });
  }
  try {
    const data = await saveSiteSettings(changes, req.user._id);
    res.json({ success: true, data });
  } catch (error) { next(error); }
}
