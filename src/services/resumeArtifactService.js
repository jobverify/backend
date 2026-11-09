import { randomUUID } from 'node:crypto';
import ResumeArtifact, { MAX_LATEX_BYTES, MAX_PDF_BYTES } from '../models/ResumeArtifact.js';
import { tailoringError } from './resumeTailoringContent.js';

export function artifactBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value?.buffer) return Buffer.from(value.buffer);
  return Buffer.alloc(0);
}

export function validateResumeArtifact(output) {
  if (typeof output?.latex !== 'string' || !output.latex.trim() || Buffer.byteLength(output.latex) > MAX_LATEX_BYTES) throw tailoringError('The generated LaTeX is empty or too large. Please retry.', 422);
  const pdf = artifactBytes(output.pdf);
  if (!pdf.length || pdf.length > MAX_PDF_BYTES || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw tailoringError('The generated PDF is invalid or too large. Please retry.', 422);
  if (!Number.isInteger(output.pageCount) || output.pageCount < 1 || output.pageCount > 100) throw tailoringError('The generated PDF page count is invalid. Please retry.', 422);
  return { latex: Buffer.from(output.latex), pdf, pageCount: output.pageCount, facts: output.facts,
    modelVersion: String(output.modelVersion || '').slice(0, 300), styleVersion: String(output.styleVersion || '').slice(0, 100) };
}

export async function createResumeArtifact(owner, output, { session } = {}) {
  const data = validateResumeArtifact(output);
  if (!session) return ResumeArtifact.create({ ...owner, ...data, _id: randomUUID() });
  return (await ResumeArtifact.create([{ ...owner, ...data, _id: randomUUID() }], { session }))[0];
}

export async function readResumeArtifact(user, generationId, { kind, job, withSource = false, session } = {}) {
  if (!generationId) return null;
  const query = ResumeArtifact.findOne({ _id: generationId, user, ...(kind ? { kind } : {}), ...(job ? { job } : {}) });
  return query.session(session || null).select(withSource ? '+latex +pdf +facts' : '+latex +pdf').lean();
}

export async function deleteResumeArtifact(user, generationId) {
  if (generationId) await ResumeArtifact.deleteOne({ _id: generationId, user });
}
