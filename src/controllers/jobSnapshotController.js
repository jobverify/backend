import { readHiringSnapshot } from '../services/hiringObservationService.js';
import { createPublicResponseCache } from '../utils/publicResponseCache.js';

// The jobs page polls every minute. Keep one shared snapshot for five minutes
// rather than running a broad analytics scan for each polling interval.
const cached = createPublicResponseCache({ ttlMs: 5 * 60_000, maxEntries: 2 });

export async function getJobSnapshot(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const settings = req.siteSettings || {};
    const key = settings.experiencedJobsEnabled !== false;
    res.json({ success: true, data: await cached(key, () => readHiringSnapshot(settings)) });
  } catch (error) { next(error); }
}
