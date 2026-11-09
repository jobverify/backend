import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const currentPublicFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/anaptycodeemy/test-data/current-public-20261103.json.gz',import.meta.url))))
import assert from 'node:assert/strict'
import test from 'node:test'

const loadAnaptyCodeemyModule = async () => {
  try {
    return await import('../../scraper/anaptycodeemy/script.js')
  } catch {
    assert.fail('Expected ANAPTY CodeEmy scraper module at ../../scraper/scraper/anaptycodeemy/script.js')
  }
}

const sampleCompanyHtml = `
<html>
  <head><title>Anapty CodeEmy Technologies Pvt. Ltd.™ | LinkedIn</title></head>
  <body>
    <meta content="urn:li:organization:108095496">
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

test('extractSearchResults returns an empty list when ANAPTY CodeEmy LinkedIn guest search has no public India jobs', async () => {
  const anaptyCodeemy = await loadAnaptyCodeemyModule()

  assert.equal(anaptyCodeemy.pageIndicatesAnaptyCodeemyCompany(sampleCompanyHtml), true)
  assert.deepEqual(anaptyCodeemy.extractSearchResults(sampleSearchHtml), [])
})

test("run reconciles current native employer/announcement and keyword-search observations without employer-zero authority",async () => {
  const mod=await loadAnaptyCodeemyModule(),calls=[];let audit
  const jobs=await mod.run({fetchPage:async url=>{calls.push(url);const row=currentPublicFixture().responses.find(row=>row.url===url);assert.ok(row);return{url:row.finalURL,status:row.status,html:row.body}},onAudit:value=>{audit=value}})
  assert.deepEqual(calls,[mod.LINKEDIN_COMPANY_PAGE_URL,mod.LINKEDIN_INDIA_JOBS_URL,mod.LINKEDIN_COMPANY_PAGE_URL,mod.LINKEDIN_INDIA_JOBS_URL]);assert.deepEqual(jobs,[])
  assert.equal(audit.inventoryEvidence.reportedTotal,null);assert.equal(audit.inventoryEvidence.indiaFacetCount,null);assert.equal(audit.configuredSearch.unexpectedKeywordRestriction,true);assert.equal(audit.nativeOrganizationId,'108095496');assert.equal(audit.lifecycleCleanupAllowed,false)
 })
