import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectResumePdf } from '../resume-tailoring/latexCompiler.js';

function fixture({ font = 11, x = 60, y = 740, pageWidth = 612, prefix = '' } = {}) {
  const content = `${prefix} BT /F1 ${font} Tf ${x} ${y} Td (Synthetic readable resume text) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test('actual PDF parsing confirms readable selectable text and page count', async () => {
  const result = await inspectResumePdf(fixture());
  assert.equal(result.pageCount, 1);
  assert.match(result.text, /Synthetic readable resume text/);
});
test('PDF inspection renders each page and rejects invisible or clipped text', async () => {
  await assert.rejects(inspectResumePdf(fixture({ prefix: '1 1 1 rg' })), /visible|readable/i);
  await assert.rejects(inspectResumePdf(fixture({ prefix: '0 0 10 10 re W n' })), /visible|readable/i);
  await assert.rejects(inspectResumePdf(fixture({ prefix: '0 0 0 rg 100 100 100 100 re f 1 1 1 rg' })), /visible|readable/i);
  await assert.rejects(inspectResumePdf(fixture({ prefix: '0 0 0 rg 50 730 300 30 re f 0 0 0 rg' })), /visible|readable/i);
  await assert.rejects(inspectResumePdf(fixture({ prefix: '0 0 0 rg 60 738 300 1 re f 1 1 1 rg' })), /visible|readable/i);
  await assert.rejects(inspectResumePdf(fixture({ prefix: '3 Tr' })), /visible|readable/i);
});
test('PDF validation rejects unreadable bytes, undersized text and content outside its page', async () => {
  await assert.rejects(inspectResumePdf(Buffer.from('not a PDF')), /invalid/i);
  await assert.rejects(inspectResumePdf(fixture({ font: 9 })), /10 pt/);
  await assert.rejects(inspectResumePdf(fixture({ y: 900 })), /boundary|readable/);
  await assert.rejects(inspectResumePdf(fixture({ x: 600 })), /boundary|readable/);
});
