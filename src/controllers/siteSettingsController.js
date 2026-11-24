import { getSiteSettings, saveSiteSettings } from "../services/siteSettingsService.js";
import { verificationEnabled } from '../jobVerification/service.js';

export async function readSiteSettings(req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.json({ success: true, data: { ...await getSiteSettings(), jobVerificationEnabled: verificationEnabled() } });
  } catch (error) { next(error); }
}

export async function updateSiteSettings(req, res, next) {
  const fields = ["billingEnabled", "experiencedJobsEnabled", "assistantEnabled"];
  const changes = Object.fromEntries(fields.filter((key) => Object.hasOwn(req.body ?? {}, key)).map((key) => [key, req.body[key]]));
  if (!Object.keys(changes).length || Object.values(changes).some((value) => typeof value !== "boolean")) {
    return res.status(400).json({ success: false, message: "Provide billingEnabled, experiencedJobsEnabled or assistantEnabled as a boolean." });
  }
  try {
    const data = await saveSiteSettings(changes, req.user._id);
    res.json({ success: true, data });
  } catch (error) { next(error); }
}
