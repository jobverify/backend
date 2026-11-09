import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const directory=new URL('../../scraper-support/tests/fixtures/twoUCurrent20261107C31/',import.meta.url)
const fixture=JSON.parse(readFileSync(new URL('manifest.json',directory),'utf8'))
const originals=new Map(fixture.records.map(row=>{
 const body=gunzipSync(readFileSync(new URL(row.bodyFile,directory)))
 assert.equal(body.length,row.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),row.sha256)
 return[row.requestedUrl,{url:row.finalUrl,status:row.status,headers:row.headers,bodyBase64:body.toString('base64'),
  requestedAt:row.sourceRequestedAt,completedAt:row.sourceCompletedAt}]
}))
function transport(india=false){
 const calls=[]
 return{calls,fetchPage:async(url,init)=>{
  assert.ok(originals.has(url),'Only retained original 2U public requests: '+url)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  calls.push(url)
  const row=structuredClone(originals.get(url))
  if(!india)return row
  // Explicit synthetic country controls leave all genuine fixtures immutable.
  let body=Buffer.from(row.bodyBase64,'base64').toString('utf8')
  if(url.endsWith('/1843004117.json')){const model=JSON.parse(body);model.data.greenhouseJobs.jobs[0].offices[0].name='India Remote';body=JSON.stringify(model)}
  if(url.endsWith('/3494932948.json')){const model=JSON.parse(body),office=model.data.cms.pages.find(r=>r.id==='215');office.title='Remote: India';office.abbreviation='IN';body=JSON.stringify(model)}
  if(url==='https://2u.com/careers/jobs/8871017002/')body=body.replaceAll('Remote: US, US','Remote: India, IN')
  return{...row,bodyBase64:Buffer.from(body).toString('base64')}
 }}
}
export async function assertTwoUPublicExtraction(t,provider){
 const current=transport();let audit
 const jobs=await createCatalogScraper(provider).run({...current,now:()=> '2026-11-06T21:25:00.000Z',onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(current.calls.length,16)
 assert.equal(audit.observations.length,1)
 assert.equal(audit.observations[0].id,'8871017002')
 assert.equal(audit.observations[0].country,'United States')
 assert.equal(audit.observations[0].sourceDetailComplete,true)
 assert.equal(readSourceObservationEvidence(jobs,'2u').observedVacancyCount,1)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 const controlled=transport(true),india=await createCatalogScraper(provider).run({...controlled,now:()=> '2026-11-06T21:25:00.000Z'})
 assert.equal(india.length,1);assert.equal(controlled.calls.length,16)
 const role=india[0]
 assert.equal(role.source,'2u');assert.equal(role.country,'India');assert.equal(role.company,'2U')
 assert.equal(role.jobId,'8871017002');assert.equal(role.postingDate,null)
 assert.equal(role.nativeUpdatedAt,'2026-10-26T16:31:47-04:00')
 assert.equal(role.sourceDetailComplete,true);assert.equal(role.sourceScopeComplete,false)
 assert.equal(role.sourceListingComplete,false);assert.equal(role.lifecycleCleanupAllowed,false)
 assert.ok(role.jobDescription.includes('Responsibilities Include'))
 assert.ok(role.jobDescription.includes('Things That Should Be In Your Background'))
 assert.equal(readInventoryEvidence(india).reportedTotal,null)
 assert.equal(readInventoryEvidence(india).indiaFacetCount,null)
 return{jobs:india,calls:controlled.calls,currentPublicJobs:jobs}
}
export async function assertTwoUPublicDenial(t,provider){
 let calls=0
 await assert.rejects(createCatalogScraper(provider).run({fetchPage:async url=>{
  calls++;return{url,status:403,headers:{'content-type':'text/html'},bodyBase64:Buffer.from('Forbidden').toString('base64')}
 }}),error=>{
  assert.equal(error.status,403);assert.equal(error.failureKind,'blocked_or_access_denied')
  assert.equal(error.softFailure,true);assert.equal(error.upstreamOutage,true);assert.equal(error.abortRetries,true)
  assert.equal(error.sourceAudit.originalPages.length,1);assert.equal(error.sourceAudit.originalPages[0].status,403)
  assert.deepEqual(error.sourceAudit.heldHosts,['2u.com'])
  assert.equal(error.sourceAudit.sourceScopeComplete,false);assert.equal(error.sourceAudit.lifecycleCleanupAllowed,false)
  assert.equal(error.recruitmentObservations.receipts.length,1);assert.equal(error.recruitmentObservations.receipts[0].status,403)
  return true
 })
 assert.equal(calls,1)
}
