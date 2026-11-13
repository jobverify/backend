import '../loadEnv.js';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { buildDescriptionRepairPlan, applyDescriptionRepairPlan } from '../rewriting/descriptionRepair.js';
import { writeFileAtomically } from '../rewriting/atomicFile.js';
import { configureMongoDns } from '../src/utils/mongoDns.js';

const option = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const input = option('--input'), output = option('--output'), apply = option('--apply');
try {
  if (apply) {
    if (!output) throw new Error('Use --apply <reviewed-plan.json> --output <backup-directory>');
    const plan = JSON.parse(await fs.readFile(path.resolve(apply), 'utf8'));
    if (!process.env.MONGO_URI) dotenv.config({ path: new URL('../../backend.env', import.meta.url), quiet: true });
    configureMongoDns();
    await fs.mkdir(path.resolve(output), { recursive: true });
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, maxPoolSize: 2 });
    const result = await applyDescriptionRepairPlan(mongoose.connection.db.collection('jobs'), plan, {
      backup: value => writeFileAtomically(path.join(path.resolve(output), value.id + '.ejson'), mongoose.mongo.BSON.EJSON.stringify(value, { relaxed: false }) + '\n'),
    });
    await writeFileAtomically(path.join(path.resolve(output), 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
    if (result.conflicts) process.exitCode = 2;
  } else {
    if (!input || !output) throw new Error('Use --input <description-snapshot.json> --output <plan.json> [--evidence <captured-source-directory>]');
    const data = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
    const jobs = Array.isArray(data) ? data : [...(data.affected || []), ...(data.sample || [])];
    const nativeEvidence = {}, directory = option('--evidence');
    if (directory) {
      const results = JSON.parse(await fs.readFile(path.join(path.resolve(directory), 'results.json'), 'utf8'));
      for (const job of jobs) {
        const result = results.find(row => row.id === String(job._id));
        if (!result || result.status !== 200) continue;
        const ascendion = job.source === 'ascendion';
        const raw = await fs.readFile(path.join(path.resolve(directory), String(job._id) + (ascendion ? '.json' : '.html')), 'utf8');
        nativeEvidence[String(job._id)] = { status: 200,
          url: ascendion ? `https://jobs.ascendion.com/api/pcsx/position_details?position_id=${encodeURIComponent(job.jobId)}&domain=ascendion.com&hl=en` : job.sourceUrl,
          body: ascendion ? JSON.parse(raw) : raw };
      }
    }
    const unique = [...new Map(jobs.map(job => [String(job._id), job])).values()];
    const plan = buildDescriptionRepairPlan(unique, { nativeEvidence });
    await writeFileAtomically(path.resolve(output), JSON.stringify(plan, null, 2) + '\n');
    console.log(JSON.stringify({ plan: path.resolve(output), hash: plan.hash, records: plan.rows.length,
      kinds: Object.fromEntries(['layout', 'native_source', 'quarantine'].map(kind => [kind, plan.rows.filter(row => row.kind === kind).length])) }));
  }
} catch (error) {
  console.error(JSON.stringify({ error: error.name, message: /^Use |^Invalid|^Repair |^Native |^Unsupported/.test(error.message) ? error.message : 'Description repair failed; no connection details are logged.' }));
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
