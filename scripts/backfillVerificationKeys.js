import '../loadEnv.js';
import mongoose from 'mongoose';
import connectDB from '../db/db.js';
import { backfillVerificationKeys } from '../src/jobVerification/repository.js';
import { initializeVerification } from '../src/jobVerification/initialize.js';

const apply = process.argv.includes('--apply');
await connectDB();
try {
  if (apply) await initializeVerification({ force: true });
  let after, scanned = 0, updated = 0;
  for (;;) {
    const batch = await backfillVerificationKeys({ after, dryRun: !apply });
    scanned += batch.scanned; updated += batch.updated;
    if (!batch.scanned) break;
    after = batch.after;
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', scanned, updated }));
} finally { await mongoose.disconnect(); }
