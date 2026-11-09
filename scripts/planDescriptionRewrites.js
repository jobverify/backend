import fs from 'node:fs/promises';
import path from 'node:path';
import { buildRewritePlan } from '../rewriting/partitioning.js';

// Consume the read-only queue preview; planning never connects to the database.
const summary = JSON.parse(await fs.readFile(process.argv[2] || '.cache/scraper-actions/description-summary.json', 'utf8'));
const queueAsOf = summary.queueAsOf || summary.startedAt;
if (!Number.isFinite(Date.parse(queueAsOf))) throw new Error('Invalid rewrite queue cutoff');
const plan = { ...buildRewritePlan(summary.queued, {
  jobsPerShard: Number(process.env.JOB_DESCRIPTION_REWRITE_JOBS_PER_SHARD || 1000),
  maxParallel: Number(process.env.JOB_DESCRIPTION_REWRITE_MAX_PARALLEL || 4),
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
