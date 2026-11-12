import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createNttDataServicesScraper } from '../scraper/nttdataservices/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { cases as phenomCases, changedDetail } from './helpers/phenomCurrentDetails20261112.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/ntt-rmk-native-handoffs-20261112.json.gz', import.meta.url))))
const uncertainMiddleEastRole = 'b8115d18cddee00'
const replay = async (sample, handoffHtml = sample.html, nativeHtml) => {
  const native = phenomCases.find(row => row.jobId === sample.request.sourceJobId)
  const listing = '<title>Search results | Find the available job openings at NTT DATA</title>'
    + '<script>var phApp = phApp || {"widgetApiEndpoint":"https://careers.nttdata.com/widgets","pageName":"search-results"}; phApp.ddo = '
    + JSON.stringify({ eagerLoadRefineSearch: { status: 200, totalHits: 1, hits: 1,
      data: { jobs: [native.listing], aggregations: [{ field: 'country', value: { India: 1 } }] } } }) + '</script>'
  return createNttDataServicesScraper().run({ maxPages: 1, maxJobs: 1, detailEnrichmentBudgetMs: 5000,
    fetchText: async url => {
      if (fixture.preflightPages[url]) return fixture.preflightPages[url]
      if (url === 'https://careers.nttdata.com/global/en/search-results') return listing
      if (url === native.sourceUrl) return nativeHtml ?? native.html
      assert.equal(url, sample.request.requestedUrl, 'Only the native observed employer handoff may supply the missing body')
      return handoffHtml
    } })
}

for (const sample of fixture.cases.filter(c => c.request.sourceJobId !== uncertainMiddleEastRole)) test('NTT observed original ' + sample.request.sourceJobId + ' recovers its reviewed native footer JD', async () => {
  const jobs = await replay(sample)
  assert.equal(jobs.length, 1)
  const [job] = jobs
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, sample.request.sourceJobId)
  assert.equal(job.country, 'India')
  assert.equal(job.title, sample.expectedTitle)
  assert.ok(job.jobDescription.length > 1500)
  assert.equal(job.sourceNativeHandoffEvidence.tenant, 'itelliP')
  assert.equal(job.sourceNativeHandoffEvidence.descriptionCarrier, 'active-native-unifyJobFooter-description')
  assert.equal(job.sourceNativeHandoffEvidence.sourceUrl, sample.request.requestedUrl)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('NTT original with explicit Middle East location stays unresolved against the India mirror', async () => {
  const sample = fixture.cases.find(c => c.request.sourceJobId === uncertainMiddleEastRole)
  const [job] = await replay(sample)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const [name, change] of [
  ['visible native closure', html => html + '<p>This job is no longer available</p>'],
  ['foreign canonical', html => html.replace('href="https://careers.nttdata-solutions.com/job/', 'href="https://foreign.example/job/')],
  ['another native canonical role', html => html.replace('/14665-en_US/"', '/99999-en_US/"')],
  ['another native application ID', html => html.replace(/jobID\s*:\s*14665/, 'jobID : 99999')],
  ['another tenant', html => html.replace(/ssoCompanyId"\s*:\s*'itelliP'/, 'ssoCompanyId" : \'foreignTenant\'')],
  ['hidden footer', html => html.replace('id="unifyJobFooter"', 'id="unifyJobFooter" hidden')],
  ['missing footer ID', html => html.replace('id="unifyJobFooter"', 'id="unusedFooter"')],
  ['duplicated footer', html => html.replace('id="unifyJobFooter"', 'id="unifyJobFooter"') + '<div id="unifyJobFooter"><span itemprop="description">Unrelated content</span></div>'],
  ['different native title', html => html.replaceAll('Lead Consultant-ITAM', 'Unrelated role')],
  ['foreign typed native country', html => html.replace('id="unifyJobFooter"', 'id="unifyJobFooter"><meta itemprop="addressCountry" content="US"')],
  ['unreviewed JD text', html => html.replace('ServiceNow ITAM Developer', 'Unreviewed replacement role')],
]) test('NTT native handoff rejects ' + name, async () => {
  const sample = fixture.cases[0]
  const [job] = await replay(sample, change(sample.html))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const [name, mutate] of [
  ['foreign Phenom country', model => { model.structured.country = 'United States' }],
  ['another Phenom requisition', model => { model.structured.reqId = 'unrelated-role' }],
]) test('NTT handoff cannot repair ' + name, async () => {
  const sample = fixture.cases[0]
  const native = phenomCases.find(row => row.jobId === sample.request.sourceJobId)
  const [job] = await replay(sample, sample.html, changedDetail(native, mutate))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

