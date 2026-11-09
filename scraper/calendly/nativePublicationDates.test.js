import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { extractIndiaJobsFromGreenhousePayload } from './script.js'

const native = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-native-packets.json', import.meta.url), 'utf8')).feed.jobs.find(job => job.id === 8728555002)
const mapped = change => {
  const job = { ...structuredClone(native), location: { name: 'Bengaluru, India' }, offices: [{ name: 'Bengaluru', location: 'Bengaluru, India' }], metadata: [] }
  change?.(job)
  return extractIndiaJobsFromGreenhousePayload({ jobs: [job], meta: { total: 1 } }, { scrapedAt: '2026-10-31T06:00:00.000Z' })[0]
}

test('Calendly retains native first publication rather than promoting the later modification time', () => {
  const job = mapped()
  assert.equal(job.postingDate, '2026-08-19T23:07:05.000Z')
  assert.equal(job.sourcePostingDateRaw, '2026-08-19T19:07:05-04:00')
  assert.equal(job.nativeUpdatedAtOriginal, '2026-10-26T11:34:16-04:00')
  assert.equal(job.originalPublicationDateQualified, true)
  assert.equal(job.publicationDateProvenance, 'official-greenhouse-first_published')
})

test('Calendly leaves publication unknown when only a modification time is supplied', () => {
  const job = mapped(value => { delete value.first_published })
  assert.equal(job.postingDate, null)
  assert.equal(job.nativeDateUnknown, true)
  assert.equal(job.originalPublicationDateQualified, false)
  assert.equal(job.nativeUpdatedAtOriginal, '2026-10-26T11:34:16-04:00')
})

for (const value of ['2026-02-30T12:00:00Z', '2026-08-19 19:07:05', 'not-a-date', '2026-08-19T24:00:00Z', '2026-08-19T19:75:00Z', '2027-01-01T00:00:00Z']) test('Calendly rejects invalid or future native first publication ' + value, () => {
  assert.throws(() => mapped(job => { job.first_published = value }), /native.*date|publication/i)
})

test('Calendly retains the native application deadline and its exact timezone instant', () => {
  const job = mapped(value => { value.application_deadline = '2026-11-30T17:00:00-05:00' })
  assert.equal(job.closingDate, '2026-11-30T22:00:00.000Z')
  assert.equal(job.sourceClosingDateIsExact, true)
  assert.equal(job.nativeApplicationDeadlineOriginal, '2026-11-30T17:00:00-05:00')
})

test('Calendly preserves date-only application-deadline precision', () => {
  const job = mapped(value => { value.application_deadline = '2026-11-30' })
  assert.equal(job.closingDate, '2026-11-30')
  assert.equal(job.sourceClosingDateIsExact, false)
})
