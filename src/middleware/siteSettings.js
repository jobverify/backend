import { getSiteSettings } from "../services/siteSettingsService.js";

export async function loadSiteSettings(req, _res, next) {
  try {
    req.siteSettings = await getSiteSettings();
    next();
  } catch (error) { next(error); }
}

// Existing payment verification and webhooks must still settle purchases made before a switch.
export async function requireBillingEnabled(_req, res, next) {
  try {
    const { billingEnabled } = await getSiteSettings();
    if (!billingEnabled) {
      return res.status(403).json({ success: false, message: "Billing and premium features are currently disabled." });
    }
    next();
  } catch (error) { next(error); }
}
