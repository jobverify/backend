import { body } from "express-validator";
import {
  ALERT_FREQUENCIES, loadAlertSchedule, toPublicAlertSchedule, updateAlertSchedule,
} from "../services/alertScheduleService.js";
import { respondWithInternalError } from "../utils/respondWithInternalError.js";
import { ALERT_TIME_PATTERN, ALERT_WEEKDAYS } from "../constants/alertSchedule.js";
import { canUseTelegramAlerts } from "../utils/accessControl.js";
import { hasSavedFilters } from "../services/jobFilterMatcher.js";
import { normalizeProfilePreferenceFilters } from "../utils/profilePreferenceFilters.js";

export const telegramAlertScheduleValidation = [
  body("frequency").isIn(ALERT_FREQUENCIES).withMessage("Choose daily or weekly delivery."),
  body("isActive").custom((value) => typeof value === "boolean").withMessage("Enabled must be a boolean."),
  body("deliveryTime").isString().bail().matches(ALERT_TIME_PATTERN).withMessage("Choose a valid time in HH:mm format (IST)."),
  body("weeklyDay").isString().bail().isIn(ALERT_WEEKDAYS).withMessage("Choose a valid weekday."),
];

const telegramSetupComplete = (user, siteSettings) => canUseTelegramAlerts(user, new Date(), siteSettings)
  && hasSavedFilters(normalizeProfilePreferenceFilters(user?.profile?.telegramAlertFilters));
const setupRequired = (res) => res.status(409).json({ success: false, code: "TELEGRAM_SETUP_REQUIRED",
  message: "Link Telegram, enable alerts and save matching filters before changing its schedule." });

export const getUserTelegramAlertSchedule = async (req, res) => {
  if (!telegramSetupComplete(req.user, req.siteSettings)) return setupRequired(res);
  try {
    const subscription = await loadAlertSchedule(req.user._id);
    return res.status(200).json({ success: true, data: toPublicAlertSchedule(subscription, new Date()) });
  } catch (error) {
    return respondWithInternalError(res, error, { message: "Unable to load your Telegram schedule." });
  }
};

export const updateUserTelegramAlertSchedule = async (req, res) => {
  const { frequency, isActive, deliveryTime, weeklyDay } = req.body ?? {};
  if (!ALERT_FREQUENCIES.includes(frequency) || typeof isActive !== "boolean"
    || typeof deliveryTime !== "string" || !ALERT_TIME_PATTERN.test(deliveryTime) || !ALERT_WEEKDAYS.includes(weeklyDay)) {
    return res.status(400).json({ success: false, message: "Choose a valid frequency, time, weekday and enabled state." });
  }
  if (!telegramSetupComplete(req.user, req.siteSettings)) return setupRequired(res);
  try {
    const subscription = await updateAlertSchedule(req.user._id, { frequency, isActive, deliveryTime, weeklyDay }, new Date());
    return res.status(200).json({ success: true, message: "Telegram schedule saved.", data: toPublicAlertSchedule(subscription, new Date()) });
  } catch (error) {
    return respondWithInternalError(res, error, { message: "Unable to save your Telegram schedule." });
  }
};
