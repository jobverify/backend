import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareResumeRuntime, processResumeDocument } from '../resume-tailoring/resumePipeline.js';
import { reportResumeDiagnostic } from '../resume-tailoring/resumeDiagnostics.js';
import { inspectResumePdf } from '../resume-tailoring/latexCompiler.js';

// Synthetic data only: no .env loading, MongoDB, GitHub dispatch, or live users.
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error('--output requires a directory');
const outputRoot = path.resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : '.cache/ai-resume-benchmark');
const source = {
  text: ['Alex Example', '\u{1F4E7} alex@example.test | \u{1F4F1} +91 98765 43210', 'SUMMARY',
    'Software engineer building reliable services.', 'EXPERIENCE',
    'Example Systems | Software Engineer | Jan 2022 - Present',
    'Built SQL reports for internal teams.',
    'Developed Python services with Redis caching, reducing latency by 25%.',
    'EDUCATION', 'Example University | BSc Computer Science | 2018 - 2022',
    'SKILLS', 'Python, SQL, Redis'].join('\n'),
  links: ['mailto:alex@example.test', 'tel:+919876543210', 'https://example.test/alex'],
};
const jobSnapshot = { title: 'Python Software Engineer', company: 'Target Systems', requiredSkills: ['Python', 'Redis', 'SQL'],
  preferredSkills: ['Kubernetes'], description: 'Build Python services, Redis caches and SQL reporting. Kubernetes experience is preferred.' };
const cases = [];
let runtime;
try {
  await fs.mkdir(outputRoot, { recursive: true });
  reportResumeDiagnostic({ stage: 'startup', code: 'started' });
  runtime = await prepareResumeRuntime();
  reportResumeDiagnostic({ stage: 'startup', code: 'passed', seconds: process.uptime() });
  let base;
  for (const mode of ['base', 'tailored']) {
    const started = Date.now();
    const output = await processResumeDocument({ mode, source, ...(mode === 'tailored' ? { baseLatex: base.latex, jobSnapshot } : {}) },
      { onDiagnostic: reportResumeDiagnostic });
    if (mode === 'tailored') {
      const inspected = await inspectResumePdf(output.pdf);
      const experience = inspected.text.split(/EXPERIENCE/i)[1]?.split(/EDUCATION/i)[0] || '';
      const python = experience.search(/\bPython\b/i), sql = experience.search(/\bSQL\b/i);
      if (python < 0 || sql < 0 || python >= sql) throw new Error('The synthetic Python job must prioritize its proven Python achievement before SQL reporting.');
      if (/directly aligned|job requirements|this (?:job|role|vacancy)/i.test(experience)) throw new Error('The resume must contain candidate achievements without job-matching commentary.');
    }
    if (mode === 'base') base = output;
    await fs.writeFile(path.join(outputRoot, `${mode}.tex`), output.latex);
    await fs.writeFile(path.join(outputRoot, `${mode}.pdf`), output.pdf);
    cases.push({ mode, modelVersion: output.modelVersion, pages: output.pageCount, bytes: output.pdf.length,
      seconds: Number(((Date.now() - started) / 1000).toFixed(2)) });
  }
  await fs.writeFile(path.join(outputRoot, 'benchmark.json'), JSON.stringify({ synthetic: true, cases }, null, 2) + '\n');
  console.log(JSON.stringify({ synthetic: true, cases }));
} catch (error) {
  reportResumeDiagnostic({ stage: 'worker', code: error.code || 'processing_failed', seconds: process.uptime() });
  process.exitCode = 1;
} finally { await runtime?.stop(); }
