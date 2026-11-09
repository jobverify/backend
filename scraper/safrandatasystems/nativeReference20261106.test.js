import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, extractJobCards } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const previous = JSON.parse(readFileSync(new URL('../../scraper-support/tests/fixtures/safrandatasystems-india/native-group-india.json', import.meta.url), 'utf8'))
const current = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261106/role191810.json.gz', import.meta.url))))
const firstOldCard = extractJobCards(previous.pages[0])[0]
const firstPage = previous.pages[0].replace(/<li class="ts-offer-list-item offerlist-item [\s\S]*?<ul class="ts-offer-list-item__description [\s\S]*?<\/ul>/i, current.card)
assert.ok(!previous.verifiedSdsIndiaIds.includes(firstOldCard.jobId), 'The real unrelated role replaces another unrelated group role')

const fetcher = change => async url => {
  if (url === current.url) return change ? change(current.detail) : current.detail
  const parsed = new URL(url)
  if (parsed.pathname.endsWith('liste-offres.aspx')) {
    const page = Number(parsed.searchParams.get('page') || 1)
    return page === 1 ? firstPage : previous.pages[page - 1]
  }
  assert.ok(previous.details[url], 'Only native-listed detail URLs may be fetched')
  return previous.details[url]
}

test('a native requisition with spaces reconciles exactly without aborting the six validated SDS roles', async () => {
  const jobs = await run({ fetchText: fetcher() })
  assert.deepEqual(jobs.map(job => job.jobId).sort(), [...previous.verifiedSdsIndiaIds].sort())
  assert.equal(jobs.some(job => job.jobId === '191810'), false)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('spaced native requisitions still reject mismatched role identities', async () => {
  await assert.rejects(run({ fetchText: fetcher(html => html.replace('2026.11. HRD SESI -191810.', '2026.11. HRD SESI -191811.')) }),
    /detail identity or workplace country conflicts/)
})

test('a legitimate spaced native reference cannot hide a foreign workplace country', async () => {
  await assert.rejects(run({ fetchText: fetcher(html => html.replace('Asia, India', 'Europe, France')) }),
    /detail identity or workplace country conflicts/)
})
