/** Analyze unpublished model trials and time a source-order-preserving formatter. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { formatEmployerSource } from '../rewriting/sourceOrderFormatter.js';
import { createHash } from 'node:crypto';
import { assessRewriteInput, factPlanSchema, buildSourceFacts } from '../rewriting/factPlan.js';
import { writeFileAtomically } from '../rewriting/atomicFile.js';

const at = process.argv.indexOf('--run-dir');
if (at < 0 || !process.argv[at + 1]) throw new Error('Use --run-dir <captured benchmark directory>');
const directory = path.resolve(process.argv[at + 1]);
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const save = async (file, value) => writeFileAtomically(file, JSON.stringify(value, null, 2) + '\n');
const files = await fs.readdir(directory, { withFileTypes: true });
const cache = files.find(f => f.isFile() && /^fixed-inputs-.*\.json$/.test(f.name));
if (!cache) throw new Error('Evaluate a fixed sample first to create the immutable input cache');
const { inputs } = await read(path.join(directory, cache.name));
const scrape = await read(path.join(directory, 'scrape-summary.json'));
const policyHash = createHash('sha256');
for (const file of ['../rewriting/factPlan.js', '../src/services/jobDescriptionPolicy.js']) policyHash.update(await fs.readFile(new URL(file, import.meta.url)));
const policyIdentity = policyHash.digest('hex');
let cachedAssessments;
try {
  const index = await read(path.join(directory, 'analysis', 'candidate-index.json'));
  if (index.policyHash === policyIdentity && index.inputFile === cache.name && index.inputs.length === inputs.length) {
    const mapped = new Map(index.inputs.map(r => [r.key, r]));
    if (inputs.every(i => mapped.has(i.key))) cachedAssessments = mapped;
  }
} catch (e) { if (e.code !== 'ENOENT') throw e; }
const quantile = (values, p) => values.length ? values[Math.floor((values.length - 1) * p)] : null;

const results = [], examples = [], reasons = {}, distribution = { under250: 0, words250to499: 0, words500to999: 0, words1000plus: 0 };
let zeroAmbiguous = 0, eligibleZeroAmbiguous = 0;
for (const item of inputs) {
  const prior = cachedAssessments?.get(item.key);
  const assessment = prior ? { ok: prior.policyAssessment === 'eligible', reason: prior.policyAssessment } : assessRewriteInput(item.input);
  reasons[assessment.ok ? 'eligible' : assessment.reason] = (reasons[assessment.ok ? 'eligible' : assessment.reason] || 0) + 1;
  const ambiguity = prior?.ambiguousFacts ?? factPlanSchema(item.input).properties.categories.minItems;
  if (!ambiguity) { zeroAmbiguous++; if (assessment.ok) eligibleZeroAmbiguous++; }
  const bucket = item.input.sourceWords < 250 ? 'under250' : item.input.sourceWords < 500 ? 'words250to499' : item.input.sourceWords < 1000 ? 'words500to999' : 'words1000plus';
  distribution[bucket]++;
  const start = performance.now(), formatted = formatEmployerSource(item.input.sourceDescription), durationMs = performance.now() - start;
  results.push({ key: item.key, source: item.source, title: item.job.title, sourceWords: item.input.sourceWords, sourceFacts: prior?.sourceFacts ?? buildSourceFacts(item.input).length,
    ambiguousFacts: ambiguity, policyAssessment: assessment.ok ? 'eligible' : assessment.reason, durationMs, ...formatted });
  if (['alation', 'nvidia', 'motorolasolutions', 'target'].includes(item.source) && !examples.some(x => x.source === item.source) && formatted.headingCount > 2) examples.push({ source: item.source, title: item.job.title, original: item.input.sourceDescription, ...formatted });
}
const durations = results.map(r => r.durationMs).sort((a, b) => a - b), totalMs = durations.reduce((n, v) => n + v, 0);
const outputDir = path.join(directory, 'analysis'); await fs.mkdir(outputDir, { recursive: true });
await save(path.join(outputDir, 'candidate-index.json'), { inputFile: cache.name, policyHash: policyIdentity, inputs: results.map(r => ({ key: r.key, sourceFacts: r.sourceFacts, ambiguousFacts: r.ambiguousFacts, policyAssessment: r.policyAssessment })) });
await writeFileAtomically(path.join(outputDir, 'source-preserving-descriptions.ndjson'), results.map(row => JSON.stringify(row)).join('\n') + '\n');
await save(path.join(outputDir, 'formatter-examples.json'), examples);

const profiles = [], perDescription = [];
for (const entry of files.filter(f => f.isDirectory() && /^\d+m-t/.test(f.name))) {
  let report; try { report = await read(path.join(directory, entry.name, 'summary.json')); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
  const rows = report.results ?? [], attempts = rows.filter(r => r.attempted), completed = attempts.filter(r => r.usage);
  for (const row of attempts) perDescription.push([entry.name, row.index, row.source, row.title, row.sourceWords, row.ambiguousFacts, row.durationMs / 1000, row.usage?.prompt_tokens, row.timings?.cache_n, row.usage?.completion_tokens, row.accepted, row.reason, row.url]);
  const wallSeconds = report.sample?.wallSeconds ?? report.summary?.inferenceWallSeconds ?? (report.environment.slots === 1 && (report.environment.workers || 1) === 1 ? attempts.reduce((n, r) => n + r.durationMs, 0) / 1000 : null);
  profiles.push({ name: entry.name, status: report.status, configuration: report.environment, sample: report.sample, policy: report.policy, requests: attempts.length,
    completedModelResponses: completed.length, automaticValidatorPasses: rows.filter(r => r.accepted).length,
    sampleKeyHash: createHash('sha256').update(JSON.stringify(rows.map(r => r.key).sort())).digest('hex'),
    meanMs: completed.length ? completed.reduce((n, r) => n + r.durationMs, 0) / completed.length : null,
    p95Ms: quantile(completed.map(r => r.durationMs).sort((a, b) => a - b), .95),
    inferenceWallSeconds: wallSeconds, descriptionsPerSecond: wallSeconds ? completed.length / wallSeconds : null,
    projected35000Hours: completed.length && wallSeconds ? 35000 * wallSeconds / completed.length / 3600 : null,
    totalCachedPromptTokens: completed.reduce((n, r) => n + (r.timings?.cache_n || 0), 0),
    peakModelResidentMiB: report.peakWorkerMemoryBytes ? report.peakWorkerMemoryBytes / 2 ** 20 : null,
    peakCoordinatorResidentMiB: report.peakCoordinatorMemoryBytes ? report.peakCoordinatorMemoryBytes / 2 ** 20 : null,
    lengthBuckets: report.summary?.lengthBuckets, reasons: report.summary?.reasonCounts,
    warning: 'Validator passes are not independently verified quality. Model-only throughput excludes downloads, preprocessing, database writes, and publication.' });
}
const analysis = { generatedAt: new Date().toISOString(), mongoWrites: 0, scrape: scrape.summary, dataset: { descriptions: inputs.length, distribution, existingPolicyAssessments: reasons, zeroAmbiguousFacts: zeroAmbiguous, eligibleZeroAmbiguousFacts: eligibleZeroAmbiguous, maxSourceWords: Math.max(...inputs.map(i => i.input.sourceWords)) }, profiles,
  formatter: { processed: results.length, availableDescriptions: results.filter(r => r.sourceAvailable).length, emptyDescriptions: results.filter(r => !r.sourceAvailable).length,
    normalizedSourcePayloadPreserved: results.filter(r => r.preserved).length, descriptionsWithHeadings: results.filter(r => r.headingCount).length, descriptionsWithBullets: results.filter(r => r.bulletCount).length,
    totalFormattingSeconds: totalMs / 1000, meanMs: totalMs / results.length, p95Ms: quantile(durations, .95),
    projected35000FormattingSeconds: totalMs / results.length * 35000 / 1000,
    warning: 'Prototype preserves source headings, order, and wording after HTML cleanup. It is not a prose rewrite or a claim of semantic classification accuracy. File/DB I/O and preprocessing are excluded.' },
  target: { jobHours: 6, requiredDescriptionsPerSecond: 35000 / (6 * 3600), withOneHourReservePerSecond: 35000 / (5 * 3600), ifTwoHoursScrapingInSameJobPerSecond: 35000 / (4 * 3600) },
  environmentCaveat: 'Measured on a shared Windows i7-1370P host, with a maximum four model compute threads. This is not a benchmark on GitHub Ubuntu 4 vCPUs.' };
await save(path.join(outputDir, 'benchmark-analysis.json'), analysis);
const csv = rows => rows.map(row => row.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\n') + '\n';
await writeFileAtomically(path.join(outputDir, 'model-comparison.csv'), csv([['configuration', 'status', 'requests', 'responses', 'validator_passes', 'mean_seconds', 'p95_seconds', 'responses_per_second', 'projected_35000_hours', 'peak_model_mib', 'cached_prompt_tokens'], ...profiles.map(p => [p.name, p.status, p.requests, p.completedModelResponses, p.automaticValidatorPasses, p.meanMs === null ? null : p.meanMs / 1000, p.p95Ms === null ? null : p.p95Ms / 1000, p.descriptionsPerSecond, p.projected35000Hours, p.peakModelResidentMiB, p.totalCachedPromptTokens])]));
await writeFileAtomically(path.join(outputDir, 'per-description-timings.csv'), csv([['configuration', 'index', 'source', 'title', 'source_words', 'ambiguous_facts', 'seconds', 'prompt_tokens', 'cached_tokens', 'completion_tokens', 'validator_pass', 'reason', 'job_url'], ...perDescription]));
console.log(JSON.stringify({ dataset: analysis.dataset, formatter: analysis.formatter, profiles: profiles.map(p => ({ name: p.name, status: p.status, requests: p.requests, projected35000Hours: p.projected35000Hours })) }));
