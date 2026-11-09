import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectResume, MAX_RESUME_BYTES } from '../src/utils/resumeFile.js';

const pdf = Buffer.from('%PDF-1.7\nResume content\n%%EOF');
const latex = Buffer.from('\\documentclass{article}\n\\begin{document}Resume\\end{document}');

test('resume validation preserves the filename and recognizes supported document formats', () => {
  const files = [
    ['My Résumé.PDF', pdf, 'application/pdf'],
    ['resume.tex', latex, 'application/x-tex'],
    ['resume.doc', Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.from('WordDocument', 'utf16le')]), 'application/msword'],
    ['resume.docx', Buffer.from('PK\x03\x04[Content_Types].xml word/document.xml'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ];
  for (const [filename, content, mimeType] of files) {
    const metadata = inspectResume(filename, content);
    assert.equal(metadata.filename, filename);
    assert.equal(metadata.mimeType, mimeType);
    assert.equal(metadata.size, content.length);
    assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
  }
});

test('resume validation rejects unsupported, disguised, empty, and non-text files', () => {
  for (const [name, content] of [
    ['resume.exe', pdf], ['resume.pdf.exe', pdf], ['resume.pdf', latex],
    ['resume.docx', Buffer.from('PK\x03\x04unrelated.zip')], ['resume.doc', pdf],
    ['resume.tex', Buffer.from([0xff, 0xfe, 0x00])], ['resume.tex', Buffer.from('plain text\x00')],
    ['resume.pdf', Buffer.alloc(0)], ['', pdf], ['bad\r\nname.pdf', pdf], ['../resume.pdf', pdf],
  ]) assert.throws(() => inspectResume(name, content), { name: 'ResumeValidationError' }, name);
});

test('resume file limits are checked in bytes, including the exact upper boundary', () => {
  const maximum = Buffer.alloc(500 * 1024, 32);
  pdf.copy(maximum);
  assert.equal(inspectResume('resume.pdf', maximum).size, MAX_RESUME_BYTES);
  assert.throws(() => inspectResume('resume.pdf', Buffer.alloc(500 * 1024 + 1)), { statusCode: 413, message: 'Your resume must be 500 KB or smaller.' });
});
