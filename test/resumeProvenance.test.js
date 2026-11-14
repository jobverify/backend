import assert from 'node:assert/strict';
import test from 'node:test';
import PDFDocument from 'pdfkit';
import { generatedResumeBytes, legacyResumeBytes } from '../src/services/resumeProvenance.js';

async function samplePdf() {
  const document = new PDFDocument({ compress: false });
  const chunks = [];
  document.on('data', chunk => chunks.push(chunk));
  const done = new Promise((resolve, reject) => { document.on('end', resolve); document.on('error', reject); });
  document.text('Synthetic Candidate: built accessible job search tools.');
  document.addPage().text('Second page remains intact.');
  document.end();
  await done;
  return Buffer.concat(chunks);
}

test('generated PDF downloads contain interoperable provenance while retaining pages and text', async () => {
  const { PDFDocument: Reader, PDFName } = await import('pdf-lib');
  const source = await samplePdf();
  const original = Buffer.from(source);
  const bytes = await generatedResumeBytes({ pdf: source, modelVersion: 'model-test' }, 'pdf');
  const pdf = await Reader.load(bytes, { updateMetadata: false });
  assert.equal(pdf.getPageCount(), 2);
  assert.match(pdf.getCreator(), /Jobverify.*AI/i);
  assert.match(pdf.getKeywords(), /AI-assisted/);
  const metadata = pdf.context.lookup(pdf.catalog.get(PDFName.of('Metadata')));
  assert.match(Buffer.from(metadata.getContents()).toString('utf8'), /compositeWithTrainedAlgorithmicMedia/);
  assert.match(Buffer.from(metadata.getContents()).toString('utf8'), /http:\/\/ns\.iptc\.org\/Iptc4xmpExt\/2008-02-29\//);
  assert.deepEqual(source, original, 'marking must not mutate the stored PDF or original upload');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, verbosity: 0 });
  const reader = await task.promise;
  try {
    assert.match((await (await reader.getPage(1)).getTextContent()).items.map(item => item.str).join(' '), /Synthetic Candidate/);
    assert.match((await (await reader.getPage(2)).getTextContent()).items.map(item => item.str).join(' '), /Second page remains intact/);
  } finally { await task.destroy(); }
});

test('TeX downloads carry machine-readable provenance without injecting model data as TeX commands', async () => {
  const latex = Buffer.from('\\documentclass{article}\n\\begin{document}Example\\end{document}');
  const artifact = { latex, modelVersion: 'untrusted\n\\input{secret}' };
  const marked = await generatedResumeBytes(artifact, 'tex');
  const line = marked.toString('utf8').split('\n')[0];
  const metadata = JSON.parse(line.replace('% Jobverify provenance: ', ''));
  assert.equal(metadata.aiAssisted, true);
  assert.equal(metadata.provider, 'Jobverify');
  assert.equal(marked.toString().slice(line.length + 1), latex.toString());
  assert.deepEqual(await generatedResumeBytes({ ...artifact, latex: marked }, 'tex'), marked);
});

test('legacy JSON exports preserve existing fields and add explicit AI provenance', () => {
  const source = { summary: 'Synthetic resume summary.' };
  const result = JSON.parse(legacyResumeBytes(source));
  assert.equal(result.summary, source.summary);
  assert.equal(result._jobverifyProvenance.aiAssisted, true);
  assert.equal(source._jobverifyProvenance, undefined);
});

test('known deterministic template exports do not falsely claim AI authorship', async () => {
  const bytes = await generatedResumeBytes({ latex: Buffer.from('\\documentclass{article}\n\\begin{document}Example\\end{document}'), modelVersion: 'source-template:v1' }, 'tex');
  assert.equal(JSON.parse(bytes.toString().split('\n')[0].replace('% Jobverify provenance: ', '')).aiAssisted, false);
});

test('original uploads are downloaded byte-for-byte without generated provenance', async () => {
  const { default: Resume } = await import('../src/models/Resume.js');
  const { downloadResume } = await import('../src/controllers/resumeController.js');
  const originalFind = Resume.findOne;
  const source = Buffer.from('%PDF-1.7\nOriginal synthetic document.');
  const user = { _id: 'synthetic-owner' };
  let sent;
  Resume.findOne = filter => {
    assert.deepEqual(filter, { _id: user._id, user: user._id });
    return { select: async () => ({ filename: 'original.pdf', mimeType: 'application/pdf', data: source }) };
  };
  try {
    const res = { attachment() { return this; }, set() { return this; }, send(bytes) { sent = bytes; return this; } };
    await downloadResume({ user }, res);
    assert.deepEqual(sent, source);
  } finally { Resume.findOne = originalFind; }
});

test('invalid or oversized generated exports fail with a fixed non-sensitive error', async () => {
  for (const artifact of [{ pdf: Buffer.from('private candidate content') }, { pdf: Buffer.from('%PDF-1.7 malformed') },
    { pdf: Buffer.alloc(5 * 1024 * 1024 + 1) }]) {
    await assert.rejects(generatedResumeBytes(artifact, 'pdf'), error => error.statusCode === 422
      && !error.message.includes('private candidate content'));
  }
  await assert.rejects(generatedResumeBytes({ latex: Buffer.from('test') }, 'other'), { statusCode: 400 });
});
