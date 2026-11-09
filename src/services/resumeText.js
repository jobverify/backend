import { Worker } from 'node:worker_threads';
import { inflateRawSync } from 'node:zlib';
import { MAX_RESUME_BYTES } from '../utils/resumeFile.js';
import { MAX_RESUME_TEXT_BYTES, tailoringError } from './resumeTailoringContent.js';
import { normalizeResumeLinks } from './resumeSource.js';
import { remainingBudget } from '../../resume-tailoring/resumeBudget.js';
import { resumeFailure } from '../../resume-tailoring/resumeDiagnostics.js';

export function inspectResumeArchive(data) {
  const start = Math.max(0, data.length - 65557);
  let end = data.length - 22;
  while (end >= start && data.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < start) throw tailoringError('Upload a readable Word resume.', 422);
  const count = data.readUInt16LE(end + 10);
  let offset = data.readUInt32LE(end + 16);
  let total = 0;
  if (!count || count > 1024 || offset > end) throw tailoringError('The Word document is too large or unreadable.', 422);
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || data.readUInt32LE(offset) !== 0x02014b50) throw tailoringError('Upload a readable Word resume.', 422);
    const limit = 20 * 1024 * 1024;
    const declared = data.readUInt32LE(offset + 24);
    if (declared > limit - total || data.readUInt16LE(offset + 8) & 1) throw tailoringError('The expanded Word document is too large or encrypted. Upload a shorter, readable resume.', 422);
    const local = data.readUInt32LE(offset + 42);
    const compressed = data.readUInt32LE(offset + 20);
    const method = data.readUInt16LE(offset + 10);
    if (local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50) throw tailoringError('Upload a readable Word resume.', 422);
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    if (start + compressed > data.length || ![0, 8].includes(method)) throw tailoringError('Upload a readable Word resume.', 422);
    let expanded;
    try { expanded = method === 0 ? data.subarray(start, start + compressed) : inflateRawSync(data.subarray(start, start + compressed), { maxOutputLength: Math.max(1, limit - total) }); }
    catch { throw tailoringError('The expanded Word document is too large or unreadable.', 422); }
    total += expanded.length;
    if (total > limit || expanded.length !== declared) throw tailoringError('The Word document is too large or unreadable.', 422);
    offset += 46 + data.readUInt16LE(offset + 28) + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32);
  }
}

export async function extractResumeContent({ extension, data, deadline }) {
  const budget = Number.isFinite(deadline) ? remainingBudget(deadline, 15000) : 15000;
  const bytes = Buffer.from(data || []);
  if (!bytes.length || bytes.length > MAX_RESUME_BYTES || !['pdf', 'doc', 'docx', 'tex'].includes(extension)) throw tailoringError('Upload a readable PDF, Word, or LaTeX resume.', 422);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./resumeTextWorker.js', import.meta.url), { workerData: { extension, data: bytes },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 } });
    let settled = false;
    const finish = (error, text) => {
      if (settled) return;
      settled = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(error); else resolve(text);
    };
    const timer = setTimeout(() => finish(Number.isFinite(deadline) ? resumeFailure('time_limit', { statusCode: 504 })
      : tailoringError('Could not read this document in time. Upload a shorter, readable resume.', 422)), budget);
    worker.once('error', () => finish(tailoringError('Could not read this document. Upload a readable resume.', 422)));
    worker.once('exit', () => { if (!settled) finish(tailoringError('Could not read this document. Upload a readable resume.', 422)); });
    worker.once('message', result => {
      if (result.error || typeof result.text !== 'string' || result.text.trim().length < 40) return finish(tailoringError('Could not extract enough text. Upload a readable resume with your experience and education.', 422));
      if (Buffer.byteLength(result.text) > MAX_RESUME_TEXT_BYTES) return finish(tailoringError('Use a shorter resume so all candidate facts can be preserved.', 422));
      finish(null, { text: result.text.trim(), links: normalizeResumeLinks(result.links) });
    });
  });
}

// Preserve the original plain-text API for existing uploads and legacy jobs.
export async function extractResumeText(input) {
  return (await extractResumeContent(input)).text;
}
