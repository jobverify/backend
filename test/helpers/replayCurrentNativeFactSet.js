import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {RECRUITMENT_OBSERVATIONS} from '../../scraper-support/utils/verifiedRecruitment.js'

export const expectedRegistrationParser=Object.freeze({factsetresearchsystems:'runtime-verified-recruitment'})
export const supportedSources=new Set(Object.keys(expectedRegistrationParser))
const primary='https://www.factset.com/careers',employer='30097 FactSet Systems India Private Limited'
const ids=['R31560','R32222','R32233','R32287','R32319','R32323','R32544','R32571','R32656','R32775','R32945','R33066','R33133','R33211','R33490','R33491','R33492']
function assertProvider(provider){
 assert.equal(provider.source,'factsetresearchsystems')
 assert.equal(provider.companyName,'FactSet Research Systems')
 assert.equal(provider.parser,'runtime-verified-recruitment')
 assert.equal(provider.companyCareerPage,primary)
 assert.match(provider.modulePath,/[\\/]factsetresearchsystems\.workday[\\/]script\.js$/)
 assert.equal(provider.sourceScopeComplete,false)
 assert.equal(provider.lifecycleCleanupAllowed,false)
 assert.equal(provider.verifiedPublicJobCount,null)
 assert.equal(provider.verifiedIndiaJobCount,null)
}
export async function assertCurrentNativeExtraction(t,provider){
 assertProvider(provider)
 const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/factsetresearchsystems.workday/test-data/current-declared-board-20261110.json.gz',import.meta.url))))
 const reads=[],counts=new Map()
 const jobs=await createCatalogScraper(provider).run({now:()=>fixture.capturedAt,fetchImpl:async(url,init)=>{
  const key=JSON.stringify([init.method,url,init.body||null]),index=counts.get(key)||0;counts.set(key,index+1)
  const matches=fixture.captures.filter(p=>JSON.stringify([p.requestMethod,p.requestUrl,p.requestBody])===key),packet=matches[index]
  assert.ok(packet,'Unexpected FactSet native request '+url+' #'+index)
  reads.push(url);assert.equal(init.credentials,'omit')
  const response=new Response(packet.body,{status:packet.status,headers:{'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }})
 assert.deepEqual(jobs.map(job=>job.jobId).sort(),ids)
 for(const job of jobs){
  assert.equal(job.source,'factsetresearchsystems');assert.equal(job.company,employer);assert.equal(job.nativeLegalEmployer,employer)
  assert.equal(job.nativeHiringOrganization.name,employer);assert.equal(job.nativeSourceRecord.hiringOrganization.name,employer)
  assert.equal(job.country,'India');assert.equal(job.nativeSourceRecord.jobPostingInfo.country.descriptor,'India')
  assert.equal(job.nativeSourceRecord.jobPostingInfo.jobRequisitionLocation.country.alpha2Code,'IN')
  assert.equal(job.sourceDescription,job.nativeSourceRecord.jobPostingInfo.jobDescription);assert.ok(job.sourceDescription.length>6000)
  assert.equal(job.sourceOfficialBinding.currentHandoffRechecked,true)
  assert.equal(job.sourceOfficialBinding.bindingMethod,'runtime-current-careers-publisher-declaration')
  assert.equal(job.sourceNativeClosingContext.eachFullRoleRechecked,true)
  assert.equal(job.sourceNativeClosingContext.allSelectedListingPagesRechecked,true)
  assert.equal(job.postingDate,job.nativeSourceRecord.jobPostingInfo.startDate)
  assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false)
 }
 assert.equal(jobs.find(job=>job.jobId==='R33211').postingDate,'2026-11-09')
 assert.equal(reads.length,48);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const observed=jobs[RECRUITMENT_OBSERVATIONS]
 assert.equal(observed.publisherDeclarations.length,2);assert.equal(observed.nativeRecords,18)
 assert.ok(observed.exclusions.some(row=>row.country==='United Kingdom'))
 assert.equal(observed.sourceScopeComplete,false);assert.equal(observed.lifecycleCleanupAllowed,false)
 t.diagnostic('factsetresearchsystems: authentic current publisher/native replay retains 17 full explicit-India subsidiary roles, exact legal employer and dates, one UK exclusion; opening/closing stable, company scope and cleanup remain unverified')
}
export async function assertCurrentNativeDenial(t,provider){
 assertProvider(provider)
 const reads=[]
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:async(url,init)=>{
  reads.push(url);assert.equal(url,primary);assert.equal(init.method,'GET')
  const response=new Response('<html><body>Controlled current primary denial</body></html>',{status:403,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),error=>{
  assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.status,403)
  assert.equal(error.softFailure,true);assert.equal(error.upstreamOutage,true);assert.equal(error.abortRetries,true)
  assert.equal(error.recruitmentObservations.sourceScopeComplete,false)
  assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false)
  assert.ok(error.recruitmentObservations.receipts.every(receipt=>receipt.status===403))
  return true
 })
 assert.deepEqual(reads,[primary])
 t.diagnostic('factsetresearchsystems: current primary HTTP403 stops before any renderer/CMS/native request and does not certify empty inventory')
}
