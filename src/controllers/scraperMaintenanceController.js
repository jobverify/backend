import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import ScraperStatus from '../models/ScraperStatus.js';
import PipelineRun from '../models/PipelineRun.js';
import { purgeScraperData } from '../services/scraperMaintenance.js';
import { acquireMongoRunLease, MongoRunLeaseHeldError } from '../../scraper-support/utils/runLease.js';
import { reconcileLocal } from '../pipeline/local.js';

export async function purgeScraperJobs(req, res) {
  res.set('Cache-Control', 'no-store');
  let reservation;
  let runLease;
  let heartbeat;
  let leaseError;
  let outcome;
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid scraper status ID.' });
    }
    const scraper = await ScraperStatus.findById(req.params.id).lean();
    if (!scraper || scraper.source === '__pipeline__') {
      return res.status(404).json({ success: false, message: 'Scraper source not found.' });
    }
    if (req.body?.confirmation !== scraper.source) {
      return res.status(400).json({ success: false, message: 'Confirm the selected scraper source before purging.' });
    }
    if (await ScraperStatus.exists({ source: '__pipeline__', pipelineState: 'running' })) {
      return res.status(409).json({ success: false, message: 'Wait for the running scraper pipeline to finish before purging.' });
    }
    // Recover interrupted maintenance through the existing local-run watchdog.
    const abandoned = await PipelineRun.findOne({ activeKey: 'database', localOwner: 'scraper-purge' }).lean();
    if (abandoned) await reconcileLocal(abandoned);
    // Reserve both supported entrypoints: coordinated pipelines and direct CLI
    // scrapers. Both reservations expire/reconcile after an interrupted process.
    await PipelineRun.init();
    const id = randomUUID();
    const now = new Date();
    await PipelineRun.create({ _id: id, activeKey: 'database', status: 'running', origin: 'admin', target: 'local', localOwner: 'scraper-purge', startedAt: now, heartbeatAt: now, stages: [], requestedBy: String(req.user._id) });
    reservation = id;
    runLease = await acquireMongoRunLease({ runId: id, onLost: error => { leaseError = error; } });
    const assertActive = async () => {
      if (leaseError) throw leaseError;
      const result = await PipelineRun.updateOne({ _id: id, activeKey: 'database', status: 'running' }, { $set: { heartbeatAt: new Date() } });
      if (!result.matchedCount) throw new Error('Purge execution slot was lost.');
    };
    heartbeat = setInterval(() => { void assertActive().catch(error => { leaseError = error; }); }, 30000);
    heartbeat.unref();
    const data = await purgeScraperData(scraper, { assertActive });
    outcome = { status: 200, body: { success: true, message: 'Scraper jobs and linked data purged. The source is paused.', data } };
  } catch (error) {
    if (error.code === 11000 || error instanceof MongoRunLeaseHeldError) {
      outcome = { status: 409, body: { success: false, message: 'A pipeline or another purge is active. Wait for it to finish.' } };
    } else {
      console.error('[scraperMaintenance] Purge failed:', error.message);
      outcome = { status: 500, body: { success: false, message: 'Purge could not finish. The scraper remains paused; retry to finish cleanup.' } };
    }
  } finally {
    clearInterval(heartbeat);
    await runLease?.release().catch(error => {
      console.error('[scraperMaintenance] Could not release scraper lease:', error.message);
    });
    if (reservation) await PipelineRun.deleteOne({ _id: reservation }).catch(error => {
      console.error('[scraperMaintenance] Could not release execution slot:', error.message);
    });
  }
  return res.status(outcome.status).json(outcome.body);
}
