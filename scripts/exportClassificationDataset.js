import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../db/db.js';
import Job from '../src/models/Job.js';
import { buildClassificationInput } from '../src/services/jobClassificationPolicy.js';

dotenv.config({ quiet: true });
const output = path.resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || '.cache/classification/unlabelled.jsonl');
const limit = Number(process.argv.find(arg => arg.startsWith('--limit='))?.slice(8) || 1000);
if (!Number.isInteger(limit) || limit < 500 || limit > 10000) throw new Error('Export --limit must be 500 to 10000');
fs.mkdirSync(path.dirname(output), { recursive: true });
// Never overwrite annotations accidentally.
const stream = fs.createWriteStream(output, { flags: 'wx' });
const now = new Date();
let count = 0;
try {
  await connectDB();
  const cursor = Job.find({ status: 'active', description: { $type: 'string', $ne: '' } }).sort({ _id: 1 }).lean().cursor();
  for await (const record of cursor) {
    const job = Object.fromEntries(['title', 'description', 'sourceDescription', 'minimumQualification', 'preferredQualification', 'sourceEmploymentType', 'sourceExperienceRequired', 'eligibleBatches', 'postedAt', 'jobUrl', 'applyLink'].filter(key => record[key] != null).map(key => [key, record[key]]));
    job.description = buildClassificationInput(job, { now }).sourceFields.description;
    if (!buildClassificationInput(job, { now }).body) continue;
    stream.write(`${JSON.stringify({ id: String(record._id), companyKey: String(record.source || record.company || record.companyId || ''), referenceDate: now.toISOString(), job, labelSource: null, labelledBy: null, split: null, targetCase: null, expected: { employment: null, experience: null, seniority: null, leadership: null, jobType: null } })}\n`);
    if (++count >= limit) break;
  }
  await new Promise((resolve, reject) => { stream.on('error', reject); stream.end(resolve); });
  console.log(JSON.stringify({ exported: count, output, next: 'Human annotation is required; predictions are not labels.' }));
} finally {
  stream.destroy();
  await mongoose.disconnect();
}
