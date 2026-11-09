import { createHash } from 'node:crypto';

// The cap leaves ample room below MongoDB's BSON document size limit. Resume
// bytes live in their own document, never in the routinely fetched user profile.
export const MAX_RESUME_BYTES = 500 * 1024;
export const RESUME_MIME_TYPES = Object.freeze({
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  tex: 'application/x-tex',
});

export class ResumeValidationError extends Error {
  constructor(message, statusCode = 400) { super(message); this.name = 'ResumeValidationError'; this.statusCode = statusCode; }
}

export function inspectResume(filename, data) {
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 200 || /[\u0000-\u001f\u007f/\\]/u.test(filename)) {
    throw new ResumeValidationError('Use a filename of up to 200 characters without path separators or control characters.');
  }
  filename = filename.trim().normalize('NFC');
  const extension = filename.split('.').at(-1).toLowerCase();
  if (!filename.includes('.') || !Object.hasOwn(RESUME_MIME_TYPES, extension)) {
    throw new ResumeValidationError('Choose a PDF, Word (.doc or .docx), or LaTeX (.tex) file.', 415);
  }
  if (!Buffer.isBuffer(data) || data.length === 0) throw new ResumeValidationError('The resume file is empty.');
  if (data.length > MAX_RESUME_BYTES) throw new ResumeValidationError('Your resume must be 500 KB or smaller.', 413);
  let valid = false;
  if (extension === 'pdf') valid = data.subarray(0, 5).equals(Buffer.from('%PDF-'));
  if (extension === 'doc') valid = data.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) && data.includes(Buffer.from('WordDocument', 'utf16le'));
  if (extension === 'docx') valid = data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && data.includes(Buffer.from('[Content_Types].xml')) && data.includes(Buffer.from('word/document.xml'));
  if (extension === 'tex') {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
      valid = !/[\u0000-\u0008\u000b\u000e-\u001f]/u.test(text) && /\\[A-Za-z@]+/.test(text);
    } catch { valid = false; }
  }
  if (!valid) throw new ResumeValidationError(`The file contents do not match ${extension.toUpperCase()} format. Choose the original document.`);
  return { filename, extension, mimeType: RESUME_MIME_TYPES[extension], size: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}
