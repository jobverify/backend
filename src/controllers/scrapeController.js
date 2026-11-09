/**
 * @file Controllers for manual scraper pipeline invocation and status checks.
 * @module controllers/scrapeController
 */


// Returns a simple status indicating the scrape router is online.
import { getScraperSchedule } from '../pipeline/schedule.js';

export const scrapeStatus = async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  let schedule = null, scheduleWarning = null;
  try { schedule = await getScraperSchedule(); }
  catch (error) { scheduleWarning = error.status ? error.message : 'Schedule unavailable.'; }
  res.status(200).json({
    code: 200,
    success: true,
    message: 'Scrape endpoint is active.',
    scheduledAt: schedule ? schedule.mode === 'interval' ? `Every ${schedule.hours} hours` : `${schedule.time} IST daily` : null,
    nextRunAt: schedule?.nextRunAt ?? null,
    scheduleWarning,
  })
}
