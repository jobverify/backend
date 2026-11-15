import assert from 'node:assert/strict'
import test from 'node:test'
import * as smartstream from '../../scraper/smartstreamtechnologies/script.js'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {sourceLifecycleCleanupForbidden,readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {fixture,replay,ACCOUNT,CLIENT,LISTING,ROLES,detailURL,changeJSON} from '../../scraper/smartstreamtechnologies/test-data/replay20261114.js'

const BLOCKED_PAGE_HTML='<html><head><title>Error 403 Forbidden</title></head><body><h1>403 Forbidden</h1></body></html>'
const PUBLIC_JOBS_HTML='<html><body><p>Job Title: Senior Engineer</p><a href="https://apply.workable.com/smartstream/">View our job openings</a></body></html>'

test('SmartStream pure helpers retain the historical403 and public-catalog distinctions',()=>{
 assert.equal(smartstream.SOURCE,'smartstreamtechnologies')
 assert.equal(smartstream.COMPANY,'SmartStream Technologies')
 assert.equal(smartstream.HOMEPAGE_URL,'https://smart.stream/')
 assert.equal(smartstream.CAREERS_URL,'https://smart.stream/careers/')
 assert.equal(smartstream.VERIFIED_ON,'2026-11-14')
 assert.equal(smartstream.hasForbiddenShellSignal(BLOCKED_PAGE_HTML),true)
 assert.equal(smartstream.hasPublicJobsCatalogSignal(BLOCKED_PAGE_HTML),false)
 assert.equal(smartstream.hasPublicJobsCatalogSignal(PUBLIC_JOBS_HTML),true)
 const blocked={status:403,url:smartstream.CAREERS_URL,headers:{server:'cloudflare','cf-ray':'original-test-MAA'},html:BLOCKED_PAGE_HTML}
 assert.equal(smartstream.isVerifiedCloudflareBlockedPage(blocked,smartstream.CAREERS_URL),true)
 assert.equal(smartstream.isVerifiedCloudflareBlockedPage({...blocked,status:200},smartstream.CAREERS_URL),false)
 assert.equal(smartstream.isVerifiedCloudflareBlockedPage({...blocked,html:PUBLIC_JOBS_HTML},smartstream.CAREERS_URL),false)
})

test('registered SmartStream reads complete native role data instead of emitting a blocked corporate zero',async()=>{
 const provider=getScraperCatalog().find(row=>row.source===smartstream.SOURCE),transport=replay()
 assert.match(provider.modulePath,/nativeWorkable20261114\.js$/)
 const jobs=await createCatalogScraper(provider).run(transport.options)
 assert.equal(jobs.length,4)
 assert.deepEqual(transport.requests.map(row=>row.url),[ACCOUNT,CLIENT,LISTING,...ROLES.map(detailURL),ACCOUNT,CLIENT,LISTING,...ROLES.map(detailURL)])
 for(const [index,job]of jobs.entries()){
  const original=fixture.roles[index].original
  assert.equal(job.title,original.title)
  assert.equal(job.country,'India')
  assert.deepEqual(job.sourceNativeDetailRecord,original)
  assert.equal(job.sourceDescription,original.description+original.requirements+original.benefits)
  assert.equal(job.postingDate,original.published)
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.currentCorporateBindingVerified,false)
  assert.equal(job.currentCSSCoverage,false);assert.equal(job.activationVerified,false)
  assert.equal(job.nativeApplicationURL,null);assert.equal(job.applyUrl,null);assert.equal(job.link,null)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.unhydratedRecordCount,6)
 assert.equal(jobs.nativeCollectionEvidence.unseenAdvertisedCount,42)
})

for(const [name,target,mutate]of [
 ['employer drift',ACCOUNT,value=>{value.name='Different employer'}],
 ['no literal native India',LISTING,value=>{value.results[6].location.country=''}],
 ['unpublished native role',LISTING,value=>{value.results[6].state='draft'}],
 ['preview-only criteria',detailURL(ROLES[0]),value=>{value.description=value.title;value.requirements='';value.benefits=''}],
])test('registered SmartStream fails closed for '+name,async()=>{
 const transport=replay(({url,bytes})=>url===target?{bytes:changeJSON(bytes,mutate)}:{})
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(row=>row.source===smartstream.SOURCE)).run(transport.options),/native|Native|Reviewed/)
 assert.ok(transport.requests.length<=4)
})

test('historical body-only callbacks cannot establish current authority before I/O',async()=>{
 let reads=0
 await assert.rejects(smartstream.createSmartStreamTechnologiesScraper().run({fetchText:async()=>{reads++;return PUBLIC_JOBS_HTML}}),/Original HTTP metadata/)
 assert.equal(reads,0)
})

test('a corporate403 response cannot become a native empty inventory',async()=>{
 const transport=replay(()=>({status:403,headers:{'content-type':'text/html; charset=utf-8'},bytes:Buffer.from(BLOCKED_PAGE_HTML)}))
 await assert.rejects(smartstream.run(transport.options),error=>error.status===403&&error.lifecycleCleanupAllowed===false)
 assert.equal(transport.requests.length,1)
})
