import assert from 'node:assert/strict';
import test from 'node:test';
import Resume from '../src/models/Resume.js';
import TailoredResume from '../src/models/TailoredResume.js';
import ResumeArtifact, { MAX_LATEX_BYTES, MAX_PDF_BYTES } from '../src/models/ResumeArtifact.js';
import { validateResumeArtifact } from '../src/services/resumeArtifactService.js';

test('resume preparation is explicit and binary output is separate from metadata', () => {
  assert.ok(Resume.schema.path('preparation.status'), 'stored originals need durable preparation state');
  assert.equal(Resume.schema.path('preparation.status').defaultValue, 'unprepared');
  assert.ok(TailoredResume.schema.path('generationId'), 'tailoring points to an immutable generation');
  assert.ok(TailoredResume.schema.path('sourceBaseGenerationId'), 'tailoring pins the prepared base generation');
});

test('generated artifacts enforce byte limits and reject JSON-only or invalid PDF results', () => {
  const valid = { latex: '\\begin{document}Resume\\end{document}', pdf: Buffer.from('%PDF-1.7\nresume'), pageCount: 1 };
  assert.equal(validateResumeArtifact(valid).pageCount, 1);
  for (const output of [{ summary: 'Legacy JSON resume' }, { ...valid, latex: 'é'.repeat(MAX_LATEX_BYTES) },
    { ...valid, pdf: Buffer.alloc(MAX_PDF_BYTES + 1) }, { ...valid, pdf: Buffer.from('not a PDF') },
    { ...valid, pageCount: 0 }]) assert.throws(() => validateResumeArtifact(output));
  for (const path of ['latex', 'pdf', 'facts']) assert.equal(ResumeArtifact.schema.path(path).options.select, false);
  for (const path of ['user', 'kind', 'sourceResumeSha', 'latex', 'pdf']) assert.equal(ResumeArtifact.schema.path(path).options.immutable, true);
});
