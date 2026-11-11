import fs from 'node:fs/promises';
import path from 'node:path';
import { buildRewritePlan, DEFAULT_REWRITE_MAX_PARALLEL } from '../rewriting/partitioning.js';

// Consume the read-only queue preview; planning never connects to the database.
const summary = JSON.parse(await fs.readFile(process.argv[2] || '.cache/scraper-actions/description-summary.json', 'utf8'));
const queueAsOf = summary.queueAsOf || summary.startedAt;
if (!Number.isFinite(Date.parse(queueAsOf))) throw new Error('Invalid rewrite queue cutoff');
const jobsPerShard = process.env.JOB_DESCRIPTION_REWRITE_JOBS_PER_SHARD?.trim();
const plan = { ...buildRewritePlan(summary.queued, {
  jobsPerShard: !jobsPerShard || /^(auto|automatic)$/i.test(jobsPerShard) ? 'auto' : Number(jobsPerShard),
  maxParallel: Number(process.env.JOB_DESCRIPTION_REWRITE_MAX_PARALLEL || DEFAULT_REWRITE_MAX_PARALLEL),
  shardCount: process.env.JOB_DESCRIPTION_REWRITE_SHARD_COUNT
    ? Number(process.env.JOB_DESCRIPTION_REWRITE_SHARD_COUNT) : undefined,
}), queueAsOf };
const file = '.cache/scraper-actions/description-plan.json';
await fs.mkdir(path.dirname(file), { recursive: true });
await fs.writeFile(file, JSON.stringify(plan, null, 2) + '\n');
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, [
  `matrix=${JSON.stringify(plan.matrix)}`, `shard_count=${plan.shardCount}`,
  `max_parallel=${plan.maxParallel}`, `queue_as_of=${plan.queueAsOf}`, `queued=${plan.queued}`, '',
].join('\n'));
console.log(JSON.stringify(plan));
