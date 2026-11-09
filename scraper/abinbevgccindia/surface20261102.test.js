import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createABInBevGccIndiaScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const fetchText = async url => {
  const row = captures.find(row => row.requestedUrl === url && row.status === 200)
  assert.ok(row, 'unrecorded successful request ' + url)
  return row.html
}

test('follows the current AB InBev Grow with us handoff and reconciles four native India jobs', async () => {
  const jobs = await createABInBevGccIndiaScraper().run({ fetchText })
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.company === 'AB InBev' && job.country === 'India' && job.jobDescription.length > 1500))
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 4)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('rejects another native role body even when its employer and title still match', async () => {
  await assert.rejects(createABInBevGccIndiaScraper().run({ fetchText: async url => {
    const html = await fetchText(url)
    return url.includes('/jobs/view/') ? html.replaceAll('4474682286', '9999999999') : html
  } }), /identity|role|canonical/i)
})

test('does not certify a partial native search as the complete AB InBev India inventory', async () => {
  const jobs = await createABInBevGccIndiaScraper().run({ fetchText: async url => {
    const html = await fetchText(url)
    return url.includes('f_C=255188') ? html.replace('results-context-header__job-count">4<', 'results-context-header__job-count">5<') : html
  } })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
