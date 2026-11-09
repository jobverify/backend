import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as citi from '../../scraper/citiindia/script.js'
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../native-sources/citiSpec/fixtures/actual-http-20261031.json.gz', import.meta.url))))
const primary = fixture.entities.find(page => page.receipt.url === citi.CAREER_PAGE_URL)
const html = Buffer.from(primary.bodyBase64, 'base64').toString('utf8')
test('Citi current script exposes all native page metadata and actual firstparty card IDs', () => {
  assert.equal(citi.SOURCE, 'citiindia');assert.equal(citi.COMPANY_NAME, 'Citi India')
  assert.equal(citi.buildSearchUrl(), citi.CAREER_PAGE_URL)
  assert.deepEqual(citi.extractPaginationSummary(html), { hasNext: true, currentPage: 1, totalPages: 42, totalJobCount: 620 })
  const cards = citi.extractSearchResults(html);assert.equal(cards.length, 15)
  assert.equal(cards[0].jobId, '102670756800');assert.equal(cards[0].country, null)
})
test('Citi current own details preserve actual source-owned criteria and requisition labels', () => {
  const expected = fixture.citiOracle[0], page = fixture.entities.find(page => page.receipt.url === expected.url)
  const job = citi.extractJobDetail(Buffer.from(page.bodyBase64, 'base64').toString('utf8'), { sourceUrl: expected.url, jobId: expected.sourceTBID })
  assert.equal(job.jobDescription, expected.ownDescriptionText)
  assert.equal(job.requisitionId, expected.nativeRequisitionLabel)
  assert.equal(job.sourceEmploymentType, 'Full time');assert.equal(job.remoteStatus, 'Hybrid')
})
