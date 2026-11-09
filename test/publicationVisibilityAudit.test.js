import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as publication from '../scripts/publicationVisibilityDiagnostics.js';

const now = new Date('2026-11-07T03:40:00.000Z');
const archived = JSON.parse(await readFile(new URL('./test-data/publicationVisibilityArchive20261107.json', import.meta.url), 'utf8'));
const report = { generatedAt: '2026-11-06T18:20:20.995Z', summary: { runtimeSnapshotAt: archived.generatedAt },
  rows: [...archived.rows.map(row => ({ ...row, gapExplanation: 'saved-jobs-not-public-rule-inspection-required' })),
    { source: 'already-published', savedJobs: 5, visibleJobs: 5, gapExplanation: 'published' }],
};
const snapshot = { generatedAt: archived.generatedAt, databaseAvailable: true, siteSettings: archived.siteSettings,
  inventory: archived.rows, statuses: [{ source: 'aanandpjangidandassociates', lastFilteredOld: 3, lastFilteredClosed: 3 }],
};

test('all 74 archived gaps retain their 252 saved jobs and unknown reasons instead of guessing from ingestion counters', () => {
  assert.equal(typeof publication.buildPublicationVisibilityAudit, 'function');
  const audit = publication.buildPublicationVisibilityAudit({ report, snapshot, now });
  assert.equal(audit.summary.targetSources, 74);
  assert.equal(audit.summary.archivedSavedJobs, 252);
  assert.equal(audit.summary.archivedVisibleJobs, 0);
  assert.equal(audit.summary.verifiedReasonSources, 0);
  assert.equal(audit.summary.unknownReasonSources, 74);
  assert.equal(audit.summary.reasonTotalsFromVerifiedSources, null);
  assert.deepEqual(audit.rows.map(row => row.source), archived.rows.map(row => row.source));
  assert.ok(audit.rows.every(row => row.diagnosis === 'unknown' && row.reasonCounts === null
    && row.unknownReason === 'job-level-diagnostics-not-collected' && row.observed.savedJobs > 0 && row.observed.visibleJobs === 0));
});

const counts = {
  'status-not-active': 0, 'not-marked-public-india': 0, 'aggregate-hiring-signal': 0,
  'source-description-missing': 0, 'closing-date-not-open': 0, 'posted-at-in-future': 0,
  'posted-at-before-public-window': 1, 'public-category-not-enabled': 0,
};
const current = () => ({
  generatedAt: now.toISOString(), databaseAvailable: true, siteSettings: { experiencedJobsEnabled: true },
  inventory: [{ source: 'aanandpjangidandassociates', savedJobs: 1, visibleJobs: 0 }],
  publicationDiagnostics: { schemaVersion: 1, generatedAt: now.toISOString(), reasonsOverlap: true,
    publicPostedAtCutoff: '2026-10-07T00:00:00.000Z',
    rules: Object.keys(counts).map(code => ({ code, action: 'Verify employer evidence.' })),
    sources: [{ source: 'aanandpjangidandassociates', savedJobs: 1, visibleJobs: 0, excludedJobs: 1,
      unexplainedExcludedJobs: 0, complete: true, reasonCounts: { ...counts },
      reasonSamples: Object.fromEntries(Object.keys(counts).map(code => [code, code === 'posted-at-before-public-window' ? [{ id: 'record-1' }] : []])),
    }],
  },
});

test('fresh diagnostics keep historical counts separate and explain only sources with complete matching evidence', () => {
  assert.equal(typeof publication.buildPublicationVisibilityAudit, 'function');
  const audit = publication.buildPublicationVisibilityAudit({ report, snapshot: current(), now });
  const row = audit.rows.find(row => row.source === 'aanandpjangidandassociates');
  assert.equal(row.diagnosis, 'verified');
  assert.equal(row.archived.savedJobs, 3);
  assert.equal(row.observed.savedJobs, 1);
  assert.equal(row.reasonCounts['posted-at-before-public-window'], 1);
  assert.equal(row.primaryReason, 'posted-at-before-public-window');
  assert.equal(audit.summary.verifiedReasonSources, 1);
  assert.equal(audit.summary.unknownReasonSources, 73);
});

test('untracked null source inventory cannot invalidate a diagnosed registered source', () => {
  const data = current();
  data.inventory.push({ source: null, savedJobs: 1, visibleJobs: 0 });
  const row = publication.buildPublicationVisibilityAudit({ report, snapshot: data, now }).rows[0];
  assert.equal(row.diagnosis, 'verified');
});

test('unavailable, stale, incomplete, duplicate and inconsistent diagnostics remain unknown', () => {
  assert.equal(typeof publication.buildPublicationVisibilityAudit, 'function');
  const mutations = [
    data => { data.databaseAvailable = false; },
    data => { data.generatedAt = '2026-10-01T00:00:00.000Z'; data.publicationDiagnostics.generatedAt = data.generatedAt; },
    data => { data.publicationDiagnostics.sources[0].complete = false; },
    data => { data.publicationDiagnostics.sources[0].unexplainedExcludedJobs = 1; },
    data => { data.publicationDiagnostics.sources.push({ ...data.publicationDiagnostics.sources[0] }); },
    data => { data.publicationDiagnostics.sources = [null]; },
    data => { data.publicationDiagnostics.rules[0] = null; },
    data => { data.inventory[0].savedJobs = 2; },
    data => { data.publicationDiagnostics.sources[0].reasonCounts['posted-at-before-public-window'] = 2; },
    data => { delete data.publicationDiagnostics.sources[0].reasonCounts['status-not-active']; },
    data => { data.publicationDiagnostics.generatedAt = '2026-11-07T03:41:00.000Z'; },
  ];
  for (const mutate of mutations) {
    const data = current();
    mutate(data);
    const row = publication.buildPublicationVisibilityAudit({ report, snapshot: data, now }).rows[0];
    assert.equal(row.diagnosis, 'unknown');
    assert.equal(row.reasonCounts, null);
  }
});

test('offline audit CLI retains all 74 archived sources without opening a database', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'publication-visibility-audit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const reportPath = path.join(directory, 'report.json');
  const snapshotPath = path.join(directory, 'snapshot.json');
  const outputPath = path.join(directory, 'audit.json');
  await writeFile(reportPath, JSON.stringify(report));
  await writeFile(snapshotPath, JSON.stringify(snapshot));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/auditPublicationVisibility.js', import.meta.url)),
    `--report=${reportPath}`, `--snapshot=${snapshotPath}`, `--output=${outputPath}`], {
    encoding: 'utf8', timeout: 30000, env: { ...process.env, MONGO_URI: 'mongodb://must-not-connect.invalid:1/forbidden' },
  });
  assert.equal(result.status, 0, result.stderr);
  const audit = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(audit.summary.targetSources, 74);
  assert.equal(audit.summary.unknownReasonSources, 74);
  assert.equal(audit.summary.archivedSavedJobs, 252);
  assert.equal(audit.rows[0].source, 'aanandpjangidandassociates');
  assert.equal(audit.rows.at(-1).source, 'zoho');
});
