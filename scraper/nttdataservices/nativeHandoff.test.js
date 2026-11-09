import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {run,HOMEPAGE_URL,CAREERS_URL,JOBS_HOME_URL,SEARCH_RESULTS_URL} from './script.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/native-workday-handoff-20261020.json',import.meta.url),'utf8'))
const detail = readFileSync(new URL('./fixtures/native-workday-handoff-20261020.html',import.meta.url),'utf8')
const homepage = readFileSync(new URL('./fixtures/homepage-title-20261020.html',import.meta.url),'utf8')
const careers = readFileSync(new URL('./fixtures/careers-title-20261020.html',import.meta.url),'utf8')
// This shell exercises the wrapper guards; the role row and complete detail body
// below are exact captured native data, not a legacy catalog-company binding.
const jobsHome = `<title>NTT DATA Careers</title><script>var phApp={"widgetApiEndpoint":"https://careers.nttdata.com/widgets"}</script>
  <p>Sales jobs Consulting jobs Data center jobs global.careers@nttdata.com</p>`
const listingPage = listing => `<title>Search results | Find the available job openings at NTT Data</title>
  <script>var phApp={"widgetApiEndpoint":"https://careers.nttdata.com/widgets","pageName":"search-results"};
  phApp.ddo = ${JSON.stringify({eagerLoadRefineSearch:{status:200,totalHits:1,hits:1,data:{jobs:[listing],aggregations:[{field:'country',value:{India:1}}]}}})}</script>`
const replay = listing => run({fetchText:async url=>{
  if(url===HOMEPAGE_URL)return homepage
  if(url===CAREERS_URL)return careers
  if(url===JOBS_HOME_URL)return jobsHome
  if(url===SEARCH_RESULTS_URL)return listingPage(listing)
  assert.equal(url,fixture.requestedURL)
  return detail
}})

test('current native NTT listing and detail corroborate the same exact Workday application and full description',async()=>{
  assert.equal(createHash('sha256').update(detail).digest('hex'),fixture.nativeBodySha256)
  const jobs=await replay(fixture.listing)
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].jobId,fixture.listing.jobId)
  assert.equal(jobs[0].requisitionId,fixture.listing.reqId)
  assert.equal(jobs[0].title,fixture.listing.title)
  assert.equal(jobs[0].sourceUrl,fixture.requestedURL)
  assert.equal(jobs[0].applyUrl,fixture.listing.applyUrl)
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].country,'India')
  assert.ok(jobs[0].jobDescription.length>6000)
  assert.match(jobs[0].jobDescription,/Security Platform Engineer/)
})

test('removing the actual native listing application cannot let the detail invent an external handoff',async()=>{
  const listing={...fixture.listing}
  delete listing.applyUrl
  const jobs=await replay(listing)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].sourceDetailFailureKind,'identity-mismatch')
  assert.equal(jobs[0].jobDescription,null)
  assert.equal(jobs[0].applyUrl,fixture.requestedURL)
})
