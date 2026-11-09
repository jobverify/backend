import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const currentCaptures=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/arms4ai/test-data/current-public-20261103.json.gz',import.meta.url))))

const loadArms4AiModule = async () => {
  try {
    return await import('../../scraper/arms4ai/script.js')
  } catch {
    assert.fail('Expected ARMS 4 AI scraper module at ../../scraper/scraper/arms4ai/script.js')
  }
}

const sampleCompanyHtml = `
<html>
  <head><title>ARMS 4 AI | LinkedIn</title></head>
  <body>
    <meta content="urn:li:organization:69828325">
  </body>
</html>
`

const sampleSearchHtml = `
<html>
  <head><title>0 Jobs jobs in India</title></head>
  <body>
    <div class="empty-state">No matching jobs found.</div>
  </body>
</html>
`

test('extractSearchResults returns an empty list when ARMS 4 AI LinkedIn guest search has no public India jobs', async () => {
  const arms4ai = await loadArms4AiModule()

  assert.equal(arms4ai.pageIndicatesArms4AiCompany(sampleCompanyHtml), true)
  assert.deepEqual(arms4ai.extractSearchResults(sampleSearchHtml), [])
})

test('run reconciles current ARMS announcements and retains the unwanted guest-query keyword gap', async () => {
  const arms4ai = await loadArms4AiModule()
  const requestedUrls = []
  const scraper = arms4ai.createArms4AiScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      const row=currentCaptures.find(row=>row.url===url);assert.ok(row)
      return{status:row.status,url:row.finalURL,html:row.body}
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      arms4ai.LINKEDIN_COMPANY_PAGE_URL,
      arms4ai.LINKEDIN_INDIA_JOBS_URL,
      arms4ai.LINKEDIN_COMPANY_PAGE_URL,
      arms4ai.LINKEDIN_INDIA_JOBS_URL,
    ],
  )
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
