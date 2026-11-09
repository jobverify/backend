import '../loadEnv.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { configureMongoDns } from '../src/utils/mongoDns.js';
import { buildPublicationDiagnosticPipeline, summarizePublicationDiagnostics } from '../src/utils/jobPublicationDiagnostics.js';

const unavailable = now => ({ schemaVersion: 1, generatedAt: now.toISOString(),
  databaseAvailable: false, readOnly: true, errorKind: 'database_unavailable', sources: null, jobs: null });

export async function collectPublicationDiagnostics({ database, sources, now = new Date() } = {}) {
  // Invalid selection is a caller error; validate before attempting a read.
  buildPublicationDiagnosticPipeline({ sources, now });
  if (!database) return unavailable(now);
  try {
    const stored = await database.collection('sitesettings').findOne({ _id: 'global' }, {
      projection: { experiencedJobsEnabled: 1 }, maxTimeMS: 30000,
    });
    const siteSettings = { experiencedJobsEnabled: stored?.experiencedJobsEnabled !== false };
    const pipeline = buildPublicationDiagnosticPipeline({ sources, siteSettings, now });
    const [result] = await database.collection('jobs').aggregate(pipeline, {
      maxTimeMS: 30000, allowDiskUse: true,
    }).toArray();
    if (!result || !Array.isArray(result.jobs) || !Array.isArray(result.visible)) return unavailable(now);
    return summarizePublicationDiagnostics(result, { sources, siteSettings, now });
  } catch {
    // Driver errors can contain connection strings or credentials.
    return unavailable(now);
  }
}

export async function readPublicationDiagnostics({ sources, now = new Date(), connector = mongoose,
  uri = process.env.MONGO_URI } = {}) {
  buildPublicationDiagnosticPipeline({ sources, now });
  try {
    if (!uri) return unavailable(now);
    configureMongoDns();
    await connector.connect(uri, { autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
    return await collectPublicationDiagnostics({ database: connector.connection.db, sources, now });
  } catch {
    return unavailable(now);
  } finally {
    try { await connector.disconnect(); } catch { /* Keep diagnostics credential-free. */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
  let sources = option('--sources')?.split(',').map(value => value.trim()).filter(Boolean);
  if (option('--coverage-report')) {
    if (sources) throw new Error('Choose --sources or --coverage-report');
    const coverage = JSON.parse(await fs.readFile(path.resolve(option('--coverage-report')), 'utf8'));
    sources = coverage.rows.filter(row => row.gapExplanation === 'saved-jobs-not-public-rule-inspection-required')
      .map(row => row.source);
  }
  const report = await readPublicationDiagnostics({ sources });
  const output = path.resolve(option('--output') || '../artifacts/publication-gap-diagnostics.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ databaseAvailable: report.databaseAvailable, readOnly: true,
    countsComplete: report.countsComplete ?? false, sources: report.sources, output }));
  if (!report.databaseAvailable || !report.countsComplete) process.exitCode = 1;
}
