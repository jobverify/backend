import '../loadEnv.js';
import mongoose from 'mongoose';
import { configureMongoDns } from '../src/utils/mongoDns.js';
import ScraperSchedule from '../src/models/ScraperSchedule.js';
import { githubRequest } from '../src/pipeline/github.js';
import { parseSchedule, nextScheduleRun, scheduleView } from '../src/pipeline/schedule.js';

// Run before replacing the old workflow. Reads GitHub; never commits or dispatches.
configureMongoDns();
try {
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await ScraperSchedule.findById('global').lean();
  if (existing) console.log('Database schedule already exists; preserving it:', JSON.stringify(scheduleView(existing)));
  else {
    const repo = process.env.GITHUB_REPO;
    const repository = await githubRequest(repo, '');
    const file = await githubRequest(repo, `/contents/.github/workflows/scraper.yml?ref=${encodeURIComponent(repository.default_branch)}`);
    if (file.encoding !== 'base64' || !file.content) throw new Error('GitHub did not return the workflow content.');
    const parsed = parseSchedule(Buffer.from(file.content, 'base64').toString('utf8'));
    const settings = parsed.mode === 'daily' ? { mode: 'daily', time: parsed.time } : { mode: 'interval', hours: parsed.hours, startAt: parsed.startAt };
    await ScraperSchedule.updateOne({ _id: 'global' }, { $setOnInsert: { ...settings, revision: 0, nextRunAt: new Date(nextScheduleRun(settings)) } }, { upsert: true });
    console.log('Saved database schedule:', JSON.stringify(scheduleView(await ScraperSchedule.findById('global').lean())));
  }
} catch (error) {
  console.error('Schedule migration failed:', error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
