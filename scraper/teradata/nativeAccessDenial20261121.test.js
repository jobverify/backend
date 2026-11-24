import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'
import {canRecoverSoftRecruitmentFailure} from '../../scraper-support/utils/softFailureRecruitmentRecovery.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {API,createNativeTeradataScraper} from './native.js'

const current=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-access-denial-20261121.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/teradata-native-quality.json.gz',import.meta.url))))
const sha=body=>createHash('sha256').update(body).digest('hex')
const denied=current.packets.find(packet=>packet.requestedURL===API)
const denial=JSON.parse(Buffer.from(denied.bodyBase64,'base64'))
const provider=()=>getScraperCatalog().find(row=>row.source==='teradata')

async function observe(t,{registered=false,code='UNAUTHENTICATED',closingPage=0,openingPage=0,mixed=false,changeObserved,abortReason}={}){
 const calls=[],changedObservedKeys=[],controller=new AbortController();let searches=0
 const fetchImpl=async(url,init={})=>{
  const address=String(url),method=init.method||'GET'
  calls.push({url:address,method})
  const packets=closingPage||openingPage?historical.packets:current.packets
  const packet=packets.find(row=>row.requestedURL===address&&(row.method||'GET')===method
   &&(method!=='POST'||JSON.parse(row.body??row.requestBody).variables.start===JSON.parse(init.body).variables.start))
  assert.ok(packet,'Unexpected acquisition after reviewed native operation: '+address)
  let body=packet.bodyBase64?Buffer.from(packet.bodyBase64,'base64'):Buffer.from(packet.bodyText)
  assert.equal(sha(body),packet.bodySHA256)
  if(address===API){
   searches++
   const expectedBody=packet.body??packet.requestBody
   assert.deepEqual(JSON.parse(init.body),JSON.parse(expectedBody))
   if(!(closingPage||openingPage)||searches===(openingPage||2+closingPage)){
    const payload=structuredClone(denial)
    payload.errors[0].extensions.code=code
    if(mixed)payload.data=JSON.parse(body).data
    if(changeObserved){
     assert.equal(mixed,true)
     const row=payload.data.searchJobs.results.nodes.find(value=>JSON.parse(value.structuredDataJSON).jobLocation.address.addressCountry==='India')
     assert.ok(row)
     const schema=JSON.parse(row.structuredDataJSON)
     if(changeObserved==='own-country')schema.jobLocation.address.addressCountry='Canada'
     else{assert.equal(changeObserved,'mandatory-criteria');row.descriptionHTML+='<p>Additional mandatory eligibility requirement.</p>';schema.description=row.descriptionHTML}
     row.structuredDataJSON=JSON.stringify(schema)
     changedObservedKeys.push(row.key)
    }
    body=code==='UNAUTHENTICATED'&&!mixed?Buffer.from(denied.bodyBase64,'base64'):Buffer.from(JSON.stringify(payload))
    if(abortReason!==undefined)controller.abort(abortReason)
   }
  }
  const response=new Response(body,{status:packet.status,headers:{'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.finalURL})
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 let jobs,error,didReject=false
 try{
  const options=registered?{}:{fetchImpl,minIntervalMs:0,signal:controller.signal,now:()=>closingPage||openingPage?'2026-11-05T08:00:00.000Z':'2026-11-21T00:00:00.000Z'}
  jobs=await(registered?createCatalogScraper(provider()).run(options):createNativeTeradataScraper().run(options))
 }catch(failure){error=failure;didReject=true}
 return{jobs,error,didReject,calls,changedObservedKeys}
}

function assertPartial(result,count,code,{firstPageOnly=false}={}){
 assert.equal(result.didReject,false,'Preserve previously acquired facts as explicit partial observations')
 assert.equal(result.error,undefined)
 const packets=historical.packets.filter(packet=>packet.requestedURL===API)
 const opened=firstPageOnly?packets.slice(0,1):packets
 const rows=opened.flatMap(packet=>JSON.parse(packet.bodyText).data.searchJobs.results.nodes)
 const india=rows.filter(row=>JSON.parse(row.structuredDataJSON).jobLocation.address.addressCountry==='India')
 assert.equal(india.length,firstPageOnly?53:86)
 const expected=india.filter(row=>!result.changedObservedKeys.includes(row.key))
 assert.equal(result.jobs.length,expected.length)
 assert.deepEqual(result.jobs.map(job=>job.jobId).sort(),expected.map(row=>row.key).sort())
 for(const job of result.jobs){
  const row=rows.find(original=>original.key===job.jobId)
  assert.deepEqual(job.nativeSourceRecord.posting,row)
  assert.deepEqual(job.nativeSourceRecord.jobPosting,JSON.parse(row.structuredDataJSON))
  assert.equal(job.sourceDescription,row.descriptionHTML)
  assert.equal(job.postingDate,row.postedOn)
  assert.equal(job.country,'India')
  assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceDetailStatus,'partial')
  assert.equal(job.nativeRoleClosingReconciled,false)
  assert.equal(job.sourceListingComplete,false)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 const audit=result.jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(audit.publisherAccessHeld,true)
 assert.equal(audit.failureKind,'blocked_or_access_denied')
 assert.deepEqual(audit.nativeSearchEvidence.applicationErrorCodes,[code])
 assert.equal(audit.nativeSearchEvidence.httpStatus,200)
 assert.match(audit.nativeSearchEvidence.responseSHA256,/^[a-f0-9]{64}$/)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 const inventory=readInventoryEvidence(result.jobs)
 assert.equal(inventory.status,'coverage-gap')
 assert.equal(inventory.listingComplete,false)
 assert.equal(inventory.reportedTotal,null)
 assert.equal(inventory.indiaFacetCount,null)
 assert.equal(inventory.pagesFetched,count)
 assert.equal(sourceLifecycleCleanupForbidden(result.jobs),true)
 assert.equal(result.calls.length,count,'No page, client, closing or alternate request after the denial')
}

function nativeFailure(error){
 const seen=new Set()
 for(let current=error;current&&typeof current==='object'&&!seen.has(current);current=current.cause){
  seen.add(current)
  if(current.code==='TERADATA_NATIVE_ACCESS_DENIED')return current
 }
 return error
}
function assertDenied(result,count,code){
 assert.equal(result.didReject,true)
 assert.equal(result.jobs,undefined)
 const error=nativeFailure(result.error)
 assert.equal(error.code,'TERADATA_NATIVE_ACCESS_DENIED')
 assert.equal(error.status,200,'Preserve the actual HTTP status; GraphQL denied access at application level')
 assert.equal(error.requestUrl,API)
 assert.equal(error.finalUrl,API)
 assert.equal(error.publisherAccessHeld,true)
 assert.equal(error.abortRetries,true)
 assert.equal(error.lifecycleCleanupAllowed,false)
 assert.deepEqual(classifyScraperError(result.error),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'})
 assert.equal(canRecoverSoftRecruitmentFailure(result.error),false)
 assert.deepEqual(error.nativeSearchEvidence.applicationErrorCodes,[code])
 assert.equal(error.nativeSearchEvidence.httpStatus,200)
 assert.match(error.nativeSearchEvidence.responseSHA256,/^[a-f0-9]{64}$/)
 assert.equal(error.recruitmentObservations.sourceScopeComplete,false)
 assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false)
 assert.equal(error.recruitmentObservations.receipts.length,count)
 assert.equal(error.inventoryEvidence.status,'coverage-gap')
 assert.equal(error.inventoryEvidence.listingComplete,false)
 assert.equal(error.inventoryEvidence.reportedTotal,null)
 assert.equal(error.inventoryEvidence.indiaFacetCount,null)
 assert.equal(error.inventoryEvidence.pagesFetched,count)
 assert.equal(result.calls.length,count,'No alternative surface, repeated page or closing read after denial')
}

test('registered Teradata stops at the actual original HTTP200 GraphQL denial without generic recovery',async t=>{
 const result=await observe(t,{registered:true})
 assertDenied(result,5,'UNAUTHENTICATED')
 assert.equal(nativeFailure(result.error).nativeSearchEvidence.responseSHA256,denied.bodySHA256)
})
for(const code of ['UNAUTHENTICATED','FORBIDDEN']){
 test('Teradata retains the exact application access error '+code+' separately from HTTP status',async t=>{
  assertDenied(await observe(t,{code}),5,code)
 })
 test('Teradata '+code+' on the second opening page preserves all earlier partial native facts',async t=>{
  assertPartial(await observe(t,{code,openingPage:2}),6,code,{firstPageOnly:true})
 })
 for(const closingPage of [1,2])test('Teradata '+code+' on closing page '+closingPage+' retains original opening facts without detail promotion',async t=>{
  assertPartial(await observe(t,{code,closingPage}),6+closingPage,code)
 })
}
test('Teradata access denial with simultaneous plausible closing data retains only explicit partial facts',async t=>{
 assertPartial(await observe(t,{closingPage:1,mixed:true}),7,'UNAUTHENTICATED')
})
for(const [changeObserved,closingPage] of [['own-country',1],['mandatory-criteria',2]])test('Teradata denied closing data cannot resurrect the known changed '+changeObserved+' opening role',async t=>{
 const result=await observe(t,{closingPage,mixed:true,changeObserved})
 assert.equal(result.changedObservedKeys.length,1)
 assertPartial(result,6+closingPage,'UNAUTHENTICATED')
 assert.equal(result.jobs.length,85)
})
for(const code of ['INTERNAL_SERVER_ERROR','UNREVIEWED_SCHEMA'])test('Teradata keeps unrelated GraphQL '+code+' as an unqualified contract failure',async t=>{
 const result=await observe(t,{code})
 assert.equal(result.didReject,true)
 assert.equal(result.jobs,undefined)
 assert.equal(result.error.code,'TERADATA_NATIVE_PROOF')
 assert.notEqual(result.error.failureKind,'blocked_or_access_denied')
 assert.equal(result.calls.length,5)
})
for(const reason of [null,Object.freeze({caller:'cancelled'}),Error('original caller cancellation')])test('Teradata caller cancellation wins over a simultaneous application denial: '+String(reason),async t=>{
 const result=await observe(t,{abortReason:reason})
 assert.equal(result.didReject,true)
 assert.equal(result.error,reason)
 assert.equal(result.jobs,undefined)
 assert.equal(result.calls.length,5)
})
