import test from 'node:test'
import assert from 'node:assert/strict'
import { createPublishingGapAtsScraper } from '../utils/publishingGapAts.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'

const provider = { source: 'example', companyName: 'Example', atsPlatform: 'ashby', boardToken: 'example' }
const role = (id, overrides = {}) => ({
  id, title: 'Software Engineer', isListed: true,
  location: 'Bengaluru, India', address: { postalAddress: { addressCountry: 'India' } },
  secondaryLocations: [], descriptionPlain: 'Build reliable software and support production services.',
  jobUrl: `https://jobs.ashbyhq.com/example/${id}`,
  applyUrl: `https://jobs.ashbyhq.com/example/${id}/application`,
  ...overrides,
})
const run = jobs => createPublishingGapAtsScraper(provider).run({
  fetchJson: async () => ({ apiVersion: '1', jobs }),
})

test('Ashby retains valid jobs when an active publisher record has no title', async () => {
  for (const title of ['', '   ', null, undefined]) {
    const rejected = role('untitled', { title })
    const jobs = await run([rejected, role('valid')])
    assert.deepEqual(jobs.map(job => job.jobId), ['valid'])
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.status, 'discovery-only')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, 2)
    assert.equal(evidence.indiaFacetCount, null)
    assert.match(evidence.reason, /native-active-title-unavailable/)
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.deepEqual(jobs.nativeCollectionEvidence.nativeRecords, [rejected, role('valid')])
    assert.deepEqual(jobs.nativeCollectionEvidence.rejectedRecords,
      [{ jobId: 'untitled', reason: 'native-active-title-unavailable' }])
  }
})

test('Ashby never certifies an inventory of only untitled active records as empty', async () => {
  const jobs = await run([role('untitled', { title: '' })])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('untitled Ashby records still require valid identity and country consistency', async () => {
  await assert.rejects(run([role('untitled', { title: '', jobUrl: 'https://jobs.ashbyhq.com/foreign/untitled' })]), /foreign board/)
  await assert.rejects(run([role('untitled', { title: '' }), role('untitled')]), /repeated native identity/)
  await assert.rejects(run([role('untitled', { title: '', address: { postalAddress: { addressCountry: 'US' } } })]), /contradictory country/)
  await assert.rejects(run([role('untitled', { title: { text: 'Engineer' } })]), /non-string title/)
})

test('a complete valid Ashby feed keeps its normal completeness behavior', async () => {
  const jobs = await run([role('valid')])
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
})
