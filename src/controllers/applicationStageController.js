import mongoose from 'mongoose';
import { changeApplicationStage, changeJobApplicationStage, getApplicationTimeline } from '../services/applicationService.js';
import { respondWithInternalError } from '../utils/respondWithInternalError.js';

const fail = (res, error, message) => error.statusCode
  ? res.status(error.statusCode).json({ success: false, message: error.message })
  : respondWithInternalError(res, error, { message });

export async function updateApplicationStage(req, res) {
  const id = req.params.applicationId || req.params.jobId;
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ success: false, message: 'Invalid application or job ID.' });
  try {
    const mutate = req.params.jobId ? changeJobApplicationStage : changeApplicationStage;
    return res.json({ success: true, data: await mutate(req.user._id, id, req.body) });
  } catch (error) { return fail(res, error, 'Could not save your application stage.'); }
}

export async function listApplicationEvents(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.applicationId)) return res.status(400).json({ success: false, message: 'Invalid application ID.' });
  const page = req.query.page ?? '1';
  if (typeof page !== 'string' || !/^\d+$/.test(page)) return res.status(400).json({ success: false, message: 'Invalid timeline page.' });
  try {
    return res.json({ success: true, ...await getApplicationTimeline(req.user._id, req.params.applicationId, { page: Number(page) }) });
  } catch (error) { return fail(res, error, 'Could not load your application timeline.'); }
}
