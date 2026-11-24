import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const originalFetch=globalThis.fetch,inactive=()=>{throw Error('Cleanup controls permit only exact retained native packets')}
let transport=inactive
globalThis.fetch=(...args)=>transport(...args)
// The global transport is installed before native and registry imports. In
// particular, the registered run receives only signal: no injected fetch or
// onAudit option that could disable recovery and hide the actual default.
const {runNativeBrihaspathi}=await import('./native.js')
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence,sourceLifecycleCleanupForbidden,isFreshCompleteInventoryEvidence,isVerifiedEmptyEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
const {inventoryCleanupOptions}=await import('../../scraper-support/utils/scraperOutcome.js')
const {analyzePublishableJobs}=await import('../../scraper-support/utils/publishableJobMetrics.js')
const {extractionDetailHealth}=await import('../../scraper-support/utils/extractionDetailHealth.js')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-empty-cleanup-20261121.json.gz',import.meta.url))))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),observations=[]
const provider=getScraperCatalog().find(row=>row.source==='brihaspathi');assert.ok(provider)

async function replay(run,mode){
 const calls=[]
 transport=async(value,init={})=>{
  const row=fixture.packets[calls.length]
  assert.ok(row,'No generic or extra request may replace the strict native route')
  assert.equal(String(value),row.requestedURL);assert.equal(init.redirect,'manual');assert.equal(init.method,'GET')
  const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(sha(bytes),row.sha256)
  calls.push({url:String(value),method:init.method,redirect:init.redirect})
  const response=new Response(bytes,{status:row.status,headers:row.headers})
  Object.defineProperties(response,{url:{value:row.url},redirected:{value:false}});return response
 }
 let jobs
 try{jobs=await run({signal:AbortSignal.timeout(20000)})}finally{transport=inactive}
 assert.equal(calls.length,6);assert.equal(jobs.length,0)
 const inventory=readInventoryEvidence(jobs),analysis=analyzePublishableJobs(jobs)
 const detailHealth=extractionDetailHealth(analysis.indiaJobs)
 const options=inventoryCleanupOptions({rawRecords:0,jobs:analysis.indiaJobs.length,eligibleJobs:analysis.eligibleJobs.length,inventoryEvidence:inventory,detailHealth})
 const forbidden=sourceLifecycleCleanupForbidden(jobs)
 const authoritativeEmpty=isFreshCompleteInventoryEvidence(inventory)&&isVerifiedEmptyEvidence(inventory)
 const incompleteSource=jobs.some(job=>job.sourceListingComplete===false||job.sourceDetailComplete===false)||detailHealth.missingDescriptions>0||forbidden
 const observation={mode,callerOptionKeys:['signal'],calls,inventoryEvidence:inventory,sourceLifecycleCleanupForbidden:forbidden,detailHealth,inventoryCleanupOptions:options,authoritativeEmpty,projectedSaverIncompleteSource:incompleteSource,
  projectedExistingJobsLifecyclePermitted:options.replaceExisting!==false&&!incompleteSource&&authoritativeEmpty,databaseModuleImportedOrInvoked:false,physicalHTTPRequests:0}
 observations.push(observation)
 // Board-only zero is still verified; it does not establish company coverage.
 assert.equal(inventory.status,'verified-empty');assert.equal(inventory.listingComplete,true);assert.equal(inventory.reportedTotal,0);assert.equal(authoritativeEmpty,true)
 assert.equal(inventory.lifecycleCleanupAllowed,false,'Normalized board inventory must explicitly retain the company lifecycle hold')
 assert.equal(forbidden,true);assert.deepEqual(options,{replaceExisting:false});assert.equal(incompleteSource,true)
 assert.equal(observation.projectedExistingJobsLifecyclePermitted,false)
 return jobs
}

test('direct native zero keeps effective lifecycle prohibition in standard inventory evidence',async()=>{
 const jobs=await replay(runNativeBrihaspathi,'direct native default original-response replay')
 assert.equal(jobs.nativeInventoryEvidence.sourceScopeComplete,false);assert.equal(jobs.nativeInventoryEvidence.lifecycleCleanupAllowed,false)
})

test('actual signal-only registered zero retains lifecycle prohibition after catalog audit mapping',async()=>{
 assert.equal(provider.lifecycleCleanupAllowed,false);assert.equal(provider.sourceScopeComplete,false)
 await replay(options=>createCatalogScraper(provider).run(options),'actual registered signal-only default original-response replay')
})

test.after(()=>{
 globalThis.fetch=originalFetch
 if(process.env.BRIHASPATHI_CLEANUP_RESULT)fs.writeFileSync(process.env.BRIHASPATHI_CLEANUP_RESULT,JSON.stringify({assessedAt:new Date().toISOString(),source:'brihaspathi',fixtureProvenance:fixture.provenance,observations},null,2)+'\n')
})
