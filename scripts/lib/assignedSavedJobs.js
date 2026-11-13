import { classificationShard } from '../../src/services/postScrapeClassification.js';

export async function* assignedSavedJobs(model, shard, shardCount, summary, shouldStop) {
  const query = model.find({ status: 'active' }).sort({ _id: 1 }).lean();
  if (shardCount > 1) query.select({ _id: 1, fingerprint: 1 });
  const cursor = query.cursor({ batchSize: shardCount > 1 ? 1000 : 100 });
  let assignedIds = [];
  async function* fetchAssigned() {
    const ids = assignedIds;
    assignedIds = [];
    for (const job of await model.find({ _id: { $in: ids }, status: 'active' }).sort({ _id: 1 }).lean()) {
      if (classificationShard(job.fingerprint || job._id, shardCount) === shard) yield job;
    }
  }
  try {
    for await (const row of cursor) {
      if (shouldStop()) { summary.budgetExhausted = true; return; }
      summary.scanned++;
      if (shardCount === 1) yield row;
      else if (classificationShard(row.fingerprint || row._id, shardCount) === shard) {
        assignedIds.push(row._id);
        if (assignedIds.length === 100) yield* fetchAssigned();
      }
    }
    if (assignedIds.length) {
      if (shouldStop()) summary.budgetExhausted = true;
      else yield* fetchAssigned();
    }
  } finally { await cursor.close(); }
}
