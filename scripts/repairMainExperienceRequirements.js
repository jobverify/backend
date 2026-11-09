import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../db/db.js';
import { buildMainExperienceRepair } from '../src/services/mainExperienceRepair.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/repairMainExperienceRequirements.js --source=arcadis [--limit=2000] [--apply]\nDefaults to a read-only preview. --apply updates only unchanged source snapshots and queues classification.');
    return;
  }
  if (args.some(arg => !/^--(?:source=[a-z0-9._-]+|limit=\d+|apply)$/.test(arg))) throw new Error('Invalid argument; use --help');
  const source = args.find(arg => arg.startsWith('--source='))?.slice(9);
  const limit = Number(args.find(arg => arg.startsWith('--limit='))?.slice(8) || 2000);
  if (!source || !Number.isSafeInteger(limit) || limit < 1 || limit > 10000) throw new Error('An exact --source and --limit between 1 and 10000 are required');
  const apply = args.includes('--apply');
  const summary = { source, dryRun: !apply, scanned: 0, proposed: 0, updated: 0, concurrentChangesSkipped: 0, changes: [] };
  // Maintenance previews must not create collections or indexes implicitly.
  // Load the model after disabling Mongoose's automatic database maintenance.
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  const { default: Job } = await import('../src/models/Job.js');
  await connectDB();
  try {
    let cursor;
    while (summary.scanned < limit) {
      const rows = await Job.find({ source, status: 'active', ...(cursor && { _id: { $gt: cursor } }) })
        .sort({ _id: 1 }).limit(Math.min(100, limit - summary.scanned)).lean().exec();
      if (!rows.length) break;
      for (const job of rows) {
        summary.scanned += 1;
        const repair = buildMainExperienceRepair(job);
        if (!repair) continue;
        summary.proposed += 1;
        summary.changes.push({ id: String(job._id), title: job.title, previous: repair.previous, next: repair.next });
        if (apply) {
          const result = await Job.updateOne(repair.filter, repair.update);
          summary.updated += result.modifiedCount;
          if (!result.matchedCount) summary.concurrentChangesSkipped += 1;
        }
      }
      cursor = rows.at(-1)._id;
    }
    console.log(JSON.stringify(summary, null, 2));
  } finally { await mongoose.disconnect(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
