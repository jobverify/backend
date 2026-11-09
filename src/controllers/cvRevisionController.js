import { listCvRevisions, compareCvRevisions, getCvRevisionArtifact, restoreCvRevision } from '../services/cvRevisionService.js';
import { artifactBytes } from '../services/resumeArtifactService.js';
import { respondWithInternalError } from '../utils/respondWithInternalError.js';

const scope = req => req.params.jobId ? { kind: 'tailored', jobId: req.params.jobId } : { kind: 'base' };
const fail = (res, error) => error.statusCode ? res.status(error.statusCode).json({ success: false, message: error.message })
  : respondWithInternalError(res, { name: error?.name }, { message: 'Could not load CV history. Please retry.', logLabel: '[CV history]' });

export async function list(req, res) {
  try {
    return res.json({ success: true, data: await listCvRevisions(req.user, scope(req), {
      ...(req.query.before === undefined ? {} : { before: Number(req.query.before) }),
      ...(req.query.limit === undefined ? {} : { limit: Number(req.query.limit) }),
    }) });
  } catch (error) { return fail(res, error); }
}
export async function compare(req, res) {
  try { return res.json({ success: true, data: await compareCvRevisions(req.user, scope(req), { from: req.query.from, to: req.query.to }) }); }
  catch (error) { return fail(res, error); }
}
export async function download(req, res) {
  try {
    const format = req.query.format || 'pdf';
    if (!['pdf', 'tex', 'json'].includes(format)) return res.status(400).json({ success: false, message: 'Choose PDF, TeX or legacy JSON format.' });
    const { artifact, revision } = await getCvRevisionArtifact(req.user, scope(req), req.params.revisionId);
    if (format === 'json' && !artifact) return res.attachment(`resume-v${revision.sequence}.json`).type('application/json').send(JSON.stringify(revision.outputSnapshot, null, 2));
    if (!artifact || format === 'json') return res.status(409).json({ success: false, message: artifact ? 'Choose PDF or TeX for this revision.' : 'This older revision is available in JSON format.' });
    return res.attachment(`resume-v${revision.sequence}.${format}`).type(format === 'pdf' ? 'application/pdf' : 'application/x-tex; charset=utf-8')
      .send(artifactBytes(format === 'pdf' ? artifact.pdf : artifact.latex));
  } catch (error) { return fail(res, error); }
}
export async function restore(req, res) {
  try {
    if (!req.body || Object.keys(req.body).some(key => key !== 'expectedCurrentRevisionId')) return res.status(400).json({ success: false, message: 'Provide the current revision from CV history.' });
    return res.json({ success: true, data: await restoreCvRevision(req.user, scope(req), req.params.revisionId,
      { expectedCurrentRevisionId: req.body.expectedCurrentRevisionId }) });
  } catch (error) { return fail(res, error); }
}
