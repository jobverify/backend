import assert from 'node:assert/strict';
import test from 'node:test';
import { extractResumeText, inspectResumeArchive } from '../src/services/resumeText.js';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const JSZip = require('jszip');

test('a real legacy Word fixture extracts readable text', async () => {
  const data = await readFile(new URL('./fixtures/resume-tailoring/sample.doc', import.meta.url));
  const text = await extractResumeText({ extension: 'doc', data });
  assert.ok(text.length >= 40);
});

test('a text PDF extracts the original candidate facts', async () => {
  const content = 'BT /F1 12 Tf 50 750 Td (Asha Rao built a React task manager in 2025. BSc Computer Science, 2026.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  const text = await extractResumeText({ extension: 'pdf', data: Buffer.from(pdf) });
  assert.match(text, /Asha Rao built a React task manager/);
});

test('LaTeX is read as source without executing input or shell commands', async () => {
  const text = await extractResumeText({ extension: 'tex', data: Buffer.from('\\documentclass{article}\n\\begin{document}\nAsha Rao\\section{Projects}Built a React task manager with JavaScript in 2025.\\input{/private/secret}\\write18{echo secret}\\end{document}') });
  assert.match(text, /Asha Rao/);
  assert.match(text, /React task manager/);
  assert.doesNotMatch(text, /private|echo secret|documentclass/);
});
test('a real DOCX archive extracts paragraphs as plain text', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Asha Rao built a React task manager with JavaScript in 2025.</w:t></w:r></w:p></w:body></w:document>');
  const text = await extractResumeText({ extension: 'docx', data: await zip.generateAsync({ type: 'nodebuffer' }) });
  assert.match(text, /Asha Rao built a React task manager/);
});
test('unreadable documents, expanded archives and empty sources fail with a useful message', async () => {
  const zip = new JSZip();
  zip.file('word/document.xml', 'x'.repeat(21 * 1024 * 1024));
  for (const source of [{ extension: 'doc', data: Buffer.from('invalid word') }, { extension: 'pdf', data: Buffer.from('%PDF-1.7\ninvalid') }, { extension: 'tex', data: Buffer.from('\\begin{document}\\end{document}') }, { extension: 'docx', data: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) }]) await assert.rejects(extractResumeText(source), /readable|large|shorter/);
});

test('a Word archive cannot bypass the expansion ceiling by lying in directory metadata', async () => {
  const zip = new JSZip();
  zip.file('word/document.xml', 'x'.repeat(21 * 1024 * 1024));
  const forged = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  let offset = 0;
  while ((offset = forged.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), offset)) !== -1) {
    forged.writeUInt32LE(0, offset + 24); offset += 46;
  }
  assert.throws(() => inspectResumeArchive(forged), /large|readable/);
});
