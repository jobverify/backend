import '../loadEnv.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { configureMongoDns } from '../src/utils/mongoDns.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';
import { collectPublicationVisibilityDiagnostics, normalizeDiagnosticSources } from './publicationVisibilityDiagnostics.js';

const MAX_TIME_MS = 30000;
const unavailable = (now, diagnosticSources) => ({
  generatedAt: now.toISOString(), databaseAvailable: false,
  errorKind: 'database_unavailable', siteSettings: null,
  statuses: null, inventory: null, publicCompanyNames: null,
  ...(diagnosticSources ? { publicationDiagnostics: null } : {}),
});

// Native collection reads deliberately preserve absent historical fields. Model
// hydration would supply defaults that can make unknown counts appear verified.
export async function collectPublishingGapSnapshot({ database = mongoose.connection.db, now = new Date(), diagnosticSources } = {}) {
  if (diagnosticSources !== undefined) diagnosticSources = normalizeDiagnosticSources(diagnosticSources);
  try {
    if (!database) return unavailable(now, diagnosticSources);
    const storedSettings = await database.collection('sitesettings').findOne(
      { _id: 'global' }, { projection: { experiencedJobsEnabled: 1, billingEnabled: 1 }, maxTimeMS: MAX_TIME_MS },
    );
    const siteSettings = {
      experiencedJobsEnabled: storedSettings?.experiencedJobsEnabled !== false,
      billingEnabled: storedSettings?.billingEnabled === true,
    };
    const companyLabel = { $trim: { input: { $ifNull: ['$company', ''] } } };
    const sourceScope = diagnosticSources ? [{ $match: { source: { $in: diagnosticSources } } }] : [];
    const [statuses, saved, visible, publicationDiagnostics] = await Promise.all([
      database.collection('scraperstatuses').find(
        { source: { $ne: '__pipeline__', ...(diagnosticSources ? { $in: diagnosticSources } : {}) } },
        { projection: { purgeJobIds: 0, _id: 0, __v: 0 }, maxTimeMS: MAX_TIME_MS },
      ).toArray(),
      database.collection('jobs').aggregate([
        ...sourceScope,
        { $group: { _id: '$source', savedJobs: { $sum: 1 } } },
      ], { maxTimeMS: MAX_TIME_MS, allowDiskUse: true }).toArray(),
      database.collection('jobs').aggregate([
        ...sourceScope,
        { $match: applyPublicJobVisibility({ status: 'active', $or: [{ closingDate: null }, { closingDate: { $gt: now } }] }, siteSettings, now) },
        { $facet: {
          sources: [{ $group: { _id: '$source', visibleJobs: { $sum: 1 }, visibleCompanies: { $addToSet: companyLabel } } }],
          companies: [
            { $group: { _id: { $toLower: companyLabel }, label: { $first: companyLabel } } },
            { $match: { _id: { $ne: '' } } },
            { $sort: { _id: 1 } },
          ],
        } },
      ], { maxTimeMS: MAX_TIME_MS, allowDiskUse: true }).toArray(),
      diagnosticSources ? collectPublicationVisibilityDiagnostics({ database, sources: diagnosticSources, siteSettings, now }) : null,
    ]);
    const bySource = new Map(saved.map(row => [row._id, {
      source: row._id ?? null, savedJobs: row.savedJobs, visibleJobs: 0, visibleCompanies: [],
    }]));
    for (const row of visible[0]?.sources ?? []) {
      const entry = bySource.get(row._id) ?? { source: row._id ?? null, savedJobs: 0 };
      bySource.set(row._id, { ...entry, visibleJobs: row.visibleJobs, visibleCompanies: row.visibleCompanies.filter(Boolean).sort() });
    }
    return {
      generatedAt: now.toISOString(), databaseAvailable: true, siteSettings, statuses,
      inventory: [...bySource.values()].sort((a, b) => String(a.source ?? '').localeCompare(String(b.source ?? ''))),
      publicCompanyNames: (visible[0]?.companies ?? []).map(row => row.label),
      ...(diagnosticSources ? { publicationDiagnostics } : {}),
    };
  } catch {
    // Driver messages can contain credentials, connection strings and hosts.
    // A failed component invalidates the whole snapshot rather than zeroing it.
    return unavailable(now, diagnosticSources);
  }
}

// This wrapper owns the connection; call the collector directly when a caller
// already owns one. Connector injection permits tests without any network access.
export async function readPublishingGapSnapshot({ now = new Date(), connector = mongoose, uri = process.env.MONGO_URI, diagnosticSources } = {}) {
  if (diagnosticSources !== undefined) diagnosticSources = normalizeDiagnosticSources(diagnosticSources);
  try {
    if (!uri) return unavailable(now, diagnosticSources);
    configureMongoDns();
    await connector.connect(uri, {
      autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
    });
    return await collectPublishingGapSnapshot({ database: connector.connection.db, now, diagnosticSources });
  } catch {
    return unavailable(now, diagnosticSources);
  } finally {
    try { await connector.disconnect(); } catch { /* Never expose driver details. */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const snapshot = await readPublishingGapSnapshot();
  const outputFlag = process.argv.find(arg => arg.startsWith('--output='));
  const output = outputFlag ? path.resolve(outputFlag.slice('--output='.length))
    : fileURLToPath(new URL('../../artifacts/publishing-gap/baseline-runtime.json', import.meta.url));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(JSON.stringify({ databaseAvailable: snapshot.databaseAvailable, errorKind: snapshot.errorKind ?? null,
    trackedSources: snapshot.statuses?.length ?? null, companiesWithVisibleJobs: snapshot.publicCompanyNames?.length ?? null }));
}
