export const MAX_REWRITE_SHARDS = 256;
export const DEFAULT_REWRITE_MAX_PARALLEL = 64;

export function validateRewriteShard(shard, shardCount) {
  if (!Number.isSafeInteger(shardCount) || shardCount < 1 || shardCount > MAX_REWRITE_SHARDS
    || (shardCount & (shardCount - 1)) !== 0
    || !Number.isSafeInteger(shard) || shard < 0 || shard >= shardCount) throw new Error('Invalid rewrite shard');
}

/** A suffix is immutable across source changes and has exactly one owner. */
export function rewriteShardFilter(shard, shardCount) {
  validateRewriteShard(shard, shardCount);
  if (shardCount === 1) return {};
  const values = Array.from({ length: shardCount <= 16 ? 16 : 256 }, (_, index) => index)
    .filter(index => index % shardCount === shard);
  const regex = shardCount <= 16 ? `[${values.map(value => value.toString(16)).join('')}]$`
    : `(?:${values.map(value => value.toString(16).padStart(2, '0')).join('|')})$`;
  return { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex } } };
}

/** Plan all partitions in one workflow, optionally using a fixed shard count. */
export function buildRewritePlan(queued, { jobsPerShard = 'auto', maxParallel = DEFAULT_REWRITE_MAX_PARALLEL, shardCount } = {}) {
  if (!Number.isSafeInteger(queued) || queued < 0) throw new Error('Invalid rewrite queue count');
  const automatic = jobsPerShard === 'auto' || jobsPerShard === 'automatic';
  if (!automatic && (!Number.isSafeInteger(jobsPerShard) || jobsPerShard < 1)) throw new Error('Invalid rewrite partition target');
  if (!Number.isSafeInteger(maxParallel) || maxParallel < 1 || maxParallel > MAX_REWRITE_SHARDS) throw new Error('Invalid rewrite parallel runner limit');
  // Target two waves before power-of-two rounding, without a fixed jobs target.
  // This distributes known work; it is not a model throughput estimate.
  const needed = automatic ? Math.max(1, Math.min(queued, maxParallel * 2, MAX_REWRITE_SHARDS))
    : Math.max(1, Math.ceil(queued / jobsPerShard));
  if (shardCount === undefined) {
    shardCount = 1;
    while (shardCount < needed && shardCount < MAX_REWRITE_SHARDS
      && (!automatic || shardCount * 2 <= Math.max(1, queued))) shardCount *= 2;
  } else validateRewriteShard(0, shardCount);
  return { queued, jobsPerShard: automatic ? Math.max(1, Math.ceil(queued / shardCount)) : jobsPerShard,
    partitionSizing: automatic ? 'automatic' : 'fixed', shardCount, maxParallel: Math.min(maxParallel, shardCount),
    estimatedJobsPerShard: Math.ceil(queued / shardCount), capacityLimited: !automatic && needed > shardCount,
    plannedWaves: Math.ceil(shardCount / Math.min(maxParallel, shardCount)),
    matrix: { shard: Array.from({ length: shardCount }, (_, index) => index) } };
}
