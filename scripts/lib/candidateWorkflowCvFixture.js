import mongoose from 'mongoose';
import Resume from '../../src/models/Resume.js';
import { inspectResume } from '../../src/utils/resumeFile.js';
import { requestResumePreparation, drainResumePreparations } from '../../src/services/resumePreparationService.js';
import { requestTailoredResume, drainTailoredResumes } from '../../src/services/resumeTailoringService.js';
import { listCvRevisions } from '../../src/services/cvRevisionService.js';
import { buildSourceFacts, sourceWithCandidateEvidence } from '../../src/services/resumeLatexContent.js';

function pdfDocument(label) {
  const stream = `BT /F1 16 Tf 48 740 Td (Asha Rao - ${label}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let data = '%PDF-1.7\n'; const offsets = [0];
  for (const [index, value] of objects.entries()) { offsets.push(Buffer.byteLength(data)); data += `${index + 1} 0 obj\n${value}\nendobj\n`; }
  const xref = Buffer.byteLength(data);
  data += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(data);
}

// Called only by disposable, authenticated local-browser fixtures. No model or
// GitHub workflow is contacted; all database publication paths remain real.
export async function seedCandidateWorkflowCv({ userId, jobId }) {
  const address = mongoose.connection.host;
  if (!['127.0.0.1', 'localhost', '::1'].includes(address)) throw new Error('CV browser fixtures require a loopback disposable database.');
  const user = { _id: userId }; const dispatch = async () => {};
  const source = Buffer.from('\\documentclass{article}\n\\begin{document}Asha Rao, asha@example.test. Built React applications in 2025. BSc Computer Science, 2026.\\end{document}');
  const existing = await Resume.findOne({ _id: userId, user: userId });
  if (!existing) await Resume.create({ _id: userId, user: userId, ...inspectResume('candidate-fixture.tex', source), data: source });
  const generate = label => async input => ({ latex: `\\documentclass[11pt]{article}\n\\begin{document}\nAsha Rao. ${label}.\n\\end{document}`,
    pdf: pdfDocument(label), pageCount: 1, facts: buildSourceFacts(sourceWithCandidateEvidence(input.source, input.candidateEvidence)), modelVersion: 'local-browser-fixture', styleVersion: 'local-fixture' });
  for (let index = 1; index <= 2; index++) {
    await requestResumePreparation(user, { regenerate: true, dispatch });
    const result = await drainResumePreparations({ generate: generate(`Base revision ${index}`) });
    if (!result.completed) throw new Error(`Base fixture publication failed: ${JSON.stringify(result)}`);
  }
  for (let index = 1; index <= 2; index++) {
    await requestTailoredResume(user, String(jobId), { regenerate: true, dispatch });
    const result = await drainTailoredResumes({ generate: generate(`Tailored revision ${index}`) });
    if (!result.completed) throw new Error(`Tailored fixture publication failed: ${JSON.stringify(result)}`);
  }
  const base = await listCvRevisions(user, { kind: 'base' }); const tailored = await listCvRevisions(user, { kind: 'tailored', jobId: String(jobId) });
  return { baseRevisionIds: base.items.map(row => row.id), tailoredRevisionIds: tailored.items.map(row => row.id),
    baseCurrentRevisionId: base.currentRevisionId, tailoredCurrentRevisionId: tailored.currentRevisionId };
}
