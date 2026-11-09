import { readHiringSnapshot } from '../services/hiringObservationService.js';
import { createPublicResponseCache } from '../utils/publicResponseCache.js';

const cached = createPublicResponseCache();

export async function getJobSnapshot(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const settings = req.siteSettings || {};
    const key = settings.experiencedJobsEnabled !== false;
    res.json({ success: true, data: await cached(key, () => readHiringSnapshot(settings)) });
  } catch (error) { next(error); }
}
