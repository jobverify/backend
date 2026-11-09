import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseNativeDetail } from './script.js'

const html = readFileSync(new URL('./test-data/2026-10-31-rid-3388.html', import.meta.url), 'utf8')
const row = {
  jobId: '3388', title: 'Managing Director – Public Sector Business Development & Capture',
  sourceUrl: 'https://phg.tbe.taleo.net/phg02/ats/careers/v2/viewRequisition?org=EXCELACOM&cws=38&rid=3388',
}
const withDate = (key, value) => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i, (_, open, json, close) => {
  return open + JSON.stringify({ ...JSON.parse(json), [key]: value }) + close
})

test('Excelacom preserves the explicit GMT native posting instant on the October 31 role', () => {
  const job = parseNativeDetail(html, row)
  assert.equal(job.postingDate, '2026-10-30T00:00:00.000Z')
  assert.equal(job.sourcePostingDateRaw, 'Fri Oct 30 00:00:00 GMT 2026')
  assert.equal(job.sourcePostingDateProvenance, 'native JobPosting.datePosted')
  assert.equal(job.country, 'United States')
  assert.equal(job.sourceDetailComplete, true)
})

test('Excelacom handles the same native GMT format for a genuine closing instant', () => {
  const job = parseNativeDetail(withDate('validThrough', 'Mon Nov 30 23:59:59 GMT 2026'), row)
  assert.equal(job.closingDate, '2026-11-30T23:59:59.000Z')
  assert.equal(job.sourceClosingDateIsExact, true)
})

for (const value of [
  'Thu Oct 30 00:00:00 GMT 2026', 'Mon Feb 30 00:00:00 GMT 2026',
  'Fri Oct 30 24:00:00 GMT 2026', 'Fri Oct 30 00:60:00 GMT 2026',
  'Fri Oct 30 00:00:00 PST 2026', 'Fri Oct 30 00:00:00 GMT 2026 trailing',
]) test(`Excelacom rejects malformed or contradictory native date ${value}`, () => {
  assert.throws(() => parseNativeDetail(withDate('datePosted', value), row), /invalid native job date/)
})

