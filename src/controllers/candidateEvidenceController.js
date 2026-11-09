import { getCandidateEvidence, matchCandidateEvidenceJobs, mutateCandidateEvidence } from '../services/candidateEvidenceService.js';
import { respondWithInternalError } from '../utils/respondWithInternalError.js';

function failure(res, error) {
  if ([400, 401, 404, 409].includes(error.status)) return res.status(error.status).json({ success: false, code: error.code,
    message: error.message, ...(error.currentVersion === undefined ? {} : { currentVersion: error.currentVersion }) });
  return respondWithInternalError(res, error, { message: 'Could not update your evidence. Please try again.', logLabel: 'Candidate evidence request failed:' });
}

export async function readCandidateEvidence(req, res) {
  try { return res.json({ success: true, data: await getCandidateEvidence(req.user._id) }); }
  catch (error) { return failure(res, error); }
}

export async function readCandidateEvidenceMatches(req, res) {
  try {
    if (Object.keys(req.query).some(key => key !== 'limit') || (req.query.limit !== undefined && (typeof req.query.limit !== 'string' || !/^\d{1,2}$/.test(req.query.limit)))) {
      return res.status(400).json({ success: false, message: 'Choose a match limit from 1 to 20.' });
    }
    return res.json({ success: true, data: await matchCandidateEvidenceJobs(req.user._id, { limit: req.query.limit === undefined ? 10 : Number(req.query.limit), siteSettings: req.siteSettings }) });
  } catch (error) { return failure(res, error); }
}

export const changeCandidateEvidence = (collection, action) => async (req, res) => {
  try {
    const data = await mutateCandidateEvidence(req.user._id, { collection, action, id: req.params.id, body: req.body }, { sessionVersion: req.user.sessionVersion ?? 0 });
    return res.status(action === 'create' ? 201 : 200).json({ success: true, data });
  } catch (error) { return failure(res, error); }
};
