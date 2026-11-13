import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const empty = gunzipSync(readFileSync(new URL('./fixtures/no-results-20261113.html.gz', import.meta.url))).toString()
const listing = `<ul class="spHGqe"><li><h3 class="QJPWVe">Software Engineer</h3>
  <span class="r0wTof">Bengaluru, India</span><h4>Minimum qualifications</h4><ul><li>5 years of experience</li></ul>
  <a href="/about/careers/applications/jobs/results/123456789-software-engineer">Learn more</a></li></ul>
  <a aria-label="Go to next page" href="?location=India&amp;page=2">Next</a>`

test('Google retains collected roles when an advertised continuation reaches the native no-results page', async () => {
  let reads = 0
  const jobs = await run({ detailEnrichmentBudgetMs: 0,
    fetchListingsText: async () => ++reads === 1 ? listing : empty })
  assert.equal(reads, 2)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '123456789')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('Google native empty first page remains an incomplete source observation', async () => {
  const jobs = await run({ fetchListingsText: async () => empty })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

for (const html of ['<title>Access denied</title><h2>No results</h2>',
  '<title>Search Jobs — Google Careers</title><h2 hidden class="r4nke">No results</h2><span class="ij8cu">Search again or try updating your filters</span>']) {
  test('Google does not interpret a blocked or hidden empty-state message as pagination exhaustion: ' + html.slice(0, 30), async () => {
    await assert.rejects(run({ fetchListingsText: async () => html }), /Google job list not found/)
  })
}
