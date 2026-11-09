import { getTailoredResume, requestTailoredResume, getTailoredResumeArtifact } from '../services/resumeTailoringService.js';
import { artifactBytes } from '../services/resumeArtifactService.js';
import { respondWithInternalError } from '../utils/respondWithInternalError.js';
const failure = (res, error) => error.statusCode ? res.status(error.statusCode).json({ success: false, message: error.message })
  : respondWithInternalError(res, { name: error?.name }, { message: 'Could not load your tailored resume. Please try again.', logLabel: '[Resume tailoring]' });
export async function read(req, res) {
  try { return res.json({ success: true, data: await getTailoredResume(req.user, req.params.jobId, req.siteSettings) }); }
  catch (error) { return failure(res, error); }
}
export async function create(req, res) {
  try {
    if (req.body?.regenerate !== undefined && typeof req.body.regenerate !== 'boolean') return res.status(400).json({ success: false, message: 'Regenerate must be true or false.' });
    const data = await requestTailoredResume(req.user, req.params.jobId, { regenerate: req.body?.regenerate === true, settings: req.siteSettings });
    return res.status(['queued', 'running'].includes(data.status) ? 202 : 200).json({ success: true, data });
  } catch (error) { return failure(res, error); }
}
export async function download(req, res) {
  try {
    const format = req.query?.format || 'pdf';
    if (!['pdf', 'tex'].includes(format)) return res.status(400).json({ success: false, message: 'Choose PDF or TeX format.' });
    const { artifact, job } = await getTailoredResumeArtifact(req.user, req.params.jobId, req.siteSettings);
    const name = `${job.company || ''}-${job.title || ''}-resume`.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 150) || 'tailored-resume';
    const data = artifactBytes(format === 'pdf' ? artifact.pdf : artifact.latex);
    return res.attachment(`${name}.${format}`).type(format === 'pdf' ? 'application/pdf' : 'application/x-tex; charset=utf-8').send(data);
  } catch (error) { return failure(res, error); }
}

export async function preview(req, res) {
  try {
    const { artifact } = await getTailoredResumeArtifact(req.user, req.params.jobId, req.siteSettings);
    return res.set('Content-Disposition', 'inline; filename="tailored-resume.pdf"').type('application/pdf').send(artifactBytes(artifact.pdf));
  } catch (error) { return failure(res, error); }
}
