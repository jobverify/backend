import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePublishingGapPersistence } from '../scripts/validatePublishingGapPersistence.js'

test('fresh extracted jobs retain missing details privately while healthy roles survive the exact public query', { timeout: 120000 }, async () => {
  const now = new Date()
  const job = { title: 'Software Engineer', jobType: 'Full-time Experienced', company: 'Publishing Gap Trial', country: 'India', city: 'Bangalore', location: 'Bangalore, India',
    sourceUrl: 'https://example.com/jobs/valid', applyUrl: 'https://example.com/jobs/valid', scrapedAt: now.toISOString(),
    description: 'Develop and maintain production software with our engineering team.' }
  const report = await validatePublishingGapPersistence({ now, trials: [{ source: 'publishing-gap-trial', completedAt: now.toISOString(),
    inventoryEvidence: { status: 'complete-inventory', firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 3, surface: 'https://example.com/jobs', verifiedAt: now.toISOString() },
    jobs: [job, { ...job, sourceUrl: 'https://example.com/jobs/empty', applyUrl: 'https://example.com/jobs/empty', description: '' },
      { ...job, sourceUrl: 'https://example.com/jobs/closed', applyUrl: 'https://example.com/jobs/closed', closingDate: '2000-01-01' }],
  }] })
  assert.equal(report.environment, 'temporary-local-mongodb')
  assert.equal(report.productionWrites, false)
  assert.equal(report.rows[0].rawJobs, 3)
  assert.equal(report.rows[0].eligibleJobs, 2)
  assert.equal(report.rows[0].savedJobs, 2)
  assert.equal(report.rows[0].visibleJobs, 1)
  assert.equal(report.rows[0].privateJobsMissingSourceDescription, 1)
  assert.equal(report.rows[0].detailHealth.complete, false)
  assert.equal(report.rows[0].detailHealth.missingDescriptions, 1)
  assert.equal(report.rows[0].rejections.emptyDescription, 0)
  assert.equal(report.rows[0].rejections.closed, 1)
  assert.equal(report.rows[0].repeatSave.inserted, 0)
  for (const save of [report.rows[0].firstSave, report.rows[0].repeatSave]) {
    assert.equal(save.deleted, 0)
    assert.equal(save.expired, 0)
    assert.equal(save.missed, 0)
  }
  const status = report.snapshot.statuses.find(row => row.source === 'publishing-gap-trial')
  assert.ok(status.lastPartialAt)
  assert.equal(status.latestAttempt.detailHealth.complete, false)
  assert.equal(status.latestAttempt.inventoryEvidence.listingComplete, true)
  assert.equal(status.lastCompleteJobsFound ?? null, null)
  assert.equal(report.rows[0].idempotent, true)
  assert.equal(report.rows[0].outcome, 'passed')
})

test('a partial detail validation preserves previously stored jobs from another trial source', { timeout: 120000 }, async () => {
  const now = new Date()
  const job = { title: 'Engineer', jobType: 'Full-time Experienced', company: 'Earlier Trial Company', country: 'India', location: 'Bangalore, India',
    sourceUrl: 'https://example.com/earlier', applyUrl: 'https://example.com/earlier', scrapedAt: now.toISOString(),
    sourceDescription: 'Build production software and maintain reliable engineering systems.' }
  const trial = (source, jobs) => ({ source, completedAt: now.toISOString(), jobs,
    inventoryEvidence: { status: 'complete-inventory', firstParty: true, listingComplete: true,
      pagesFetched: 1, reportedTotal: jobs.length, surface: 'https://example.com/jobs', verifiedAt: now.toISOString() } })
  const report = await validatePublishingGapPersistence({ now, trials: [trial('earlier-trial', [job]),
    trial('partial-later-trial', [{ ...job, company: 'Later Trial Company',
      sourceUrl: 'https://example.com/later', applyUrl: 'https://example.com/later' },
    { ...job, company: 'Later Trial Company', sourceDescription: '',
      sourceUrl: 'https://example.com/later-missing', applyUrl: 'https://example.com/later-missing' }])] })
  const earlier = report.snapshot.inventory.find(row => row.source === 'earlier-trial')
  const later = report.rows.find(row => row.source === 'partial-later-trial')
  assert.equal(earlier.savedJobs, 1)
  assert.equal(earlier.visibleJobs, 1)
  assert.equal(later.savedJobs, 2)
  assert.equal(later.visibleJobs, 1)
  assert.equal(later.privateJobsMissingSourceDescription, 1)
  assert.equal(later.firstSave.deleted, 0)
  assert.equal(later.repeatSave.deleted, 0)
})

test('validation refuses stale trial files before starting persistence', async () => {
  await assert.rejects(validatePublishingGapPersistence({ now: new Date('2026-10-20'), trials: [{ source: 'old', completedAt: '2026-07-01', jobs: [] }] }), /fresh|evidence/i)
})

test('a fresh wrapper cannot launder stale or structurally incomplete inventory evidence', async () => {
  const now = new Date('2026-10-20T06:00:00Z')
  for (const overrides of [{ verifiedAt: '2026-07-01' }, { verifiedAt: '2026-10-21' }, { surface: null }, { pagesFetched: 0 }]) {
    await assert.rejects(validatePublishingGapPersistence({ now, trials: [{ source: 'invalid', completedAt: now.toISOString(), jobs: [], inventoryEvidence: {
      status: 'complete-inventory', firstParty: true, listingComplete: true, pagesFetched: 1, surface: 'https://example.com/jobs', verifiedAt: now.toISOString(), ...overrides,
    } }] }), /fresh|evidence/i)
  }
})
