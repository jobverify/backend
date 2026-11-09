import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

// Artificial pure-classifier controls, never native posting/HTTP evidence.
const control = { title: 'Engineering Analyst', company: 'Offline remote-scope control',
  location: 'Mumbai, India', jobDescription: 'Artificial classifier control without a published work arrangement.' }

test('an unresolved native arrangement cannot become on-site from a populated city alone', () => {
  const job = normalizeScrapedJob({ ...control, remoteStatus: null, sourceRemoteStatusUnresolved: true })
  assert.equal(job.remoteStatus, null)
})

test('unflagged callers retain their existing city-based arrangement default', () => {
  assert.equal(normalizeScrapedJob(control).remoteStatus, 'On-site')
})

test('explicit arrangements and literal remote/on-site location markers remain usable', () => {
  assert.equal(normalizeScrapedJob({ ...control, remoteStatus: 'Hybrid', sourceRemoteStatusUnresolved: false }).remoteStatus, 'Hybrid')
  assert.equal(normalizeScrapedJob({ ...control, location: 'Remote - India', sourceRemoteStatusUnresolved: true }).remoteStatus, 'Remote')
  assert.equal(normalizeScrapedJob({ ...control, location: 'On-site - Mumbai, India', sourceRemoteStatusUnresolved: true }).remoteStatus, 'On-site')
})

test('a negated on-site marker cannot authorize on-site work for an unresolved source', () => {
  assert.equal(normalizeScrapedJob({ ...control, location: 'Not on-site - Mumbai, India',
    sourceRemoteStatusUnresolved: true }).remoteStatus, null)
})

for (const location of ['Not remote - Pune, India', 'Not hybrid - Pune, India', 'Non-remote - India',
  'No hybrid - India', 'Remoteville, India', 'Hybridsville, India']) test('opted-in literal scope rejects negated or substring arrangements: ' + location, () => {
  assert.equal(normalizeScrapedJob({ ...control, location, sourceRemoteStatusUnresolved: true }).remoteStatus, null)
})

test('negated secondary arrangements cannot turn literal remote work into hybrid work', () => {
  for (const location of ['Remote, no on-site work - India', 'Remote, not hybrid - India', 'Remote, no office work - India'])
    assert.equal(normalizeScrapedJob({ ...control, location, sourceRemoteStatusUnresolved: true }).remoteStatus, 'Remote')
  assert.equal(normalizeScrapedJob({ ...control, location: 'Remote and on-site - India', sourceRemoteStatusUnresolved: true }).remoteStatus, 'Hybrid')
})

test('the opt-in correction preserves the unflagged legacy interpretation', () => {
  assert.equal(normalizeScrapedJob({ ...control, location: 'Not remote - Pune, India' }).remoteStatus, 'Remote')
  assert.equal(normalizeScrapedJob({ ...control, location: 'Not hybrid - Pune, India' }).remoteStatus, 'Hybrid')
  assert.equal(normalizeScrapedJob({ ...control, location: 'Remote, no on-site work - India' }).remoteStatus, 'Hybrid')
})
