import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import test, {afterEach} from 'node:test'
import {runAdityaBirlaRealEstatePublicRead as run} from '../../scraper/adityabirlarealestate.workday/currentPublic.js'
import {classifyScraperError} from '../utils/failureClassification.js'

// Synthetic negative transport controls. These bodies are not public evidence.
// Removing the owned-response outage flag must fail the first five cases;
// moving that flag outside its typed HTTP guard must fail the boundary cases.
const HOME='https://www.adityabirlarealestate.com/career'
const REQUESTED='2026-11-07T01:00:00.000Z', COMPLETED='2026-11-07T01:00:00.125Z'
const HTTP_DATE='Sat, 07 Nov 2026 01:00:00 GMT'
const now=()=> '2026-11-07T04:00:00.000Z'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const rejection=pending=>pending.then(()=>assert.fail('Expected rejection, not an empty inventory'),error=>error)
const entity=status=>{
  const body=Buffer.from('Synthetic C37 original HTTP entity '+String(status))
  const headers={'content-type':'text/plain; charset=utf-8',date:HTTP_DATE,'retry-after':'60','x-synthetic-receipt':'C37'}
  const receipt={requestedUrl:HOME,finalUrl:HOME,status,headers,bytes:body.length,sha256:digest(body),
    sourceRequestedAt:REQUESTED,sourceCompletedAt:COMPLETED,sourceHttpDate:HTTP_DATE}
  return {url:HOME,...receipt,bodyBase64:body.toString('base64'),originalReceipt:structuredClone(receipt)}
}
const incomplete=audit=>{
  assert.equal(audit.outcome,'failed')
  assert.deepEqual(audit.observations,[])
  for(const key of ['sourceScopeComplete','sourceListingComplete','sourceDetailComplete','lifecycleCleanupAllowed',
    'redirectsFollowed','corporateJavaScriptExecuted','subresourcesRequested','applicationInteractionPerformed'])assert.equal(audit[key],false)
  for(const key of ['companyGlobalTotal','companyIndiaTotal','nativeReportedTotal','nativeIndiaTotal','inventoryVerifiedAt'])assert.equal(audit[key],null)
  assert.equal(audit.inventoryEvidence.status,'coverage-gap')
  assert.equal(audit.inventoryEvidence.listingComplete,false)
  assert.equal(audit.inventoryEvidence.reportedTotal,null)
  assert.equal(audit.inventoryEvidence.indiaFacetCount,null)
  assert.equal(audit.inventoryEvidence.verifiedAt,null)
}
const read=async page=>{
  const audits=[],records=[]
  const error=await rejection(run({now,onAudit:value=>audits.push(value),onRecords:value=>records.push(value),
    fetchPage:async(url,init)=>{
      assert.equal(url,HOME);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
      return page
    }}))
  assert.equal(audits.length,1);assert.deepEqual(records,[])
  incomplete(audits[0]);assert.equal(error.lifecycleCleanupAllowed,false)
  return {error,audit:audits[0]}
}

afterEach(()=>assert.deepEqual(globalThis[Symbol.for('realestate.c36.offline-network-attempts')]??[],[]))

for(const [status,failureKind] of [[403,'blocked_or_access_denied'],[429,'blocked_or_access_denied'],
  [500,'source_inventory_unavailable'],[503,'source_inventory_unavailable'],[599,'source_inventory_unavailable']]){
  test('C37 owned HTTP '+status+' reaches the classifier as outage with exact original receipt and clocks',async()=>{
    const page=entity(status),before=structuredClone(page),{error,audit}=await read(page),row=audit.responses[0]
    assert.equal(error.status,status);assert.equal(error.softFailure,true);assert.equal(error.abortRetries,true)
    assert.equal(error.failureKind,failureKind);assert.equal(error.upstreamOutage,true)
    assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind})
    assert.deepEqual(page,before);assert.deepEqual(audit.rawPages,[before])
    assert.equal(row.requestUrl,HOME);assert.equal(row.finalUrl,HOME);assert.equal(row.status,status)
    assert.deepEqual(row.headers,before.headers);assert.equal(row.bodyBase64,before.bodyBase64)
    assert.equal(row.bytes,before.bytes);assert.equal(row.sha256,before.sha256)
    assert.equal(row.sourceRequestedAt,REQUESTED);assert.equal(row.sourceCompletedAt,COMPLETED);assert.equal(row.sourceHttpDate,HTTP_DATE)
    assert.equal(row.acquisitionClocksQualified,true);assert.equal(row.bodyComplete,true);assert.equal(row.transportQualified,false)
    assert.equal(row.observedRequestedAt,'2026-11-07T04:00:00.000Z')
    assert.equal(row.observedCompletedAt,'2026-11-07T04:00:00.000Z')
    assert.deepEqual(error.sourceAudit,audit)
  })
}

for(const status of [99,100,199,201,499,600,1500,'503',null]){
  test('C37 non-outage or untyped HTTP '+String(status)+' does not acquire owned outage metadata',async()=>{
    const {error,audit}=await read(entity(status))
    assert.equal(Object.hasOwn(error,'upstreamOutage'),false)
    assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:false,failureKind:'source_inventory_unavailable'})
    assert.equal(audit.responses[0].status,status)
  })
}

test('C37 owned 503 body failure keeps the original cause and honest incomplete entity',async()=>{
  const cause=Object.freeze(Error('Synthetic C37 body stream failure')),audits=[]
  let cancelled=0,released=0
  const error=await rejection(run({now,onAudit:value=>audits.push(value),fetchImpl:async()=>({url:HOME,status:503,
    headers:{'content-type':'text/plain',date:HTTP_DATE},body:{getReader:()=>({read(){throw cause},cancel(){cancelled++},releaseLock(){released++}})}})}))
  assert.equal(error.bodyReadError,cause);assert.equal(error.status,503);assert.equal(error.upstreamOutage,true)
  assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'source_inventory_unavailable'})
  const row=audits[0].responses[0]
  assert.equal(row.status,503);assert.equal(row.bodyComplete,false);assert.equal(row.bodyBase64,null);assert.equal(row.sha256,null)
  assert.equal(row.sourceRequestedAt,'2026-11-07T04:00:00.000Z');assert.equal(row.sourceCompletedAt,null)
  assert.equal(row.sourceHttpDate,HTTP_DATE);assert.equal(cancelled,1);assert.equal(released,1)
  incomplete(audits[0])
})

test('C37 owned 403 retains raw contradictory acquisition clocks without replacing its HTTP failure',async()=>{
  const page={...entity(403),requestedAt:'2026-11-07T01:01:00.000Z'},before=structuredClone(page)
  const {error,audit}=await read(page),row=audit.responses[0]
  assert.equal(error.status,403);assert.equal(error.upstreamOutage,true)
  assert.match(error.message,/original public HTTP 403/)
  assert.match(error.bodyReadError.message,/original acquisition clock/)
  assert.equal(row.sourceRequestedAt,null);assert.equal(row.sourceCompletedAt,COMPLETED);assert.equal(row.acquisitionClocksQualified,false)
  assert.equal(row.rawAcquisitionClocks.sourceRequestedAt,REQUESTED)
  assert.equal(row.rawAcquisitionClocks.requestedAt,'2026-11-07T01:01:00.000Z')
  assert.equal(row.bodyComplete,true);assert.equal(row.bodyBase64,before.bodyBase64);assert.equal(row.sha256,before.sha256)
  assert.deepEqual(audit.rawPages,[before]);assert.deepEqual(page,before)
})

for(const properties of [{status:403},{status:503,softFailure:true,upstreamOutage:false,failureKind:'foreign-owned-policy'}]){
  test('C37 frozen foreign '+properties.status+' retains exact error identity and authoritative policy',async()=>{
    const page=entity(properties.status),reason=Object.freeze(Object.assign(Error('Synthetic C37 foreign original rejection'),properties,{originalResponse:page}))
    const descriptors=Object.getOwnPropertyDescriptors(reason),before=classifyScraperError(reason),audits=[]
    const error=await rejection(run({now,onAudit:value=>audits.push(value),fetchPage:async()=>{throw reason}}))
    assert.equal(error,reason);assert.deepEqual(classifyScraperError(error),before)
    assert.deepEqual(Object.getOwnPropertyDescriptors(reason),descriptors)
    assert.deepEqual(audits[0].rawPages,[page]);assert.equal(audits[0].responses[0].sourceRequestedAt,REQUESTED)
    assert.equal(audits[0].responses[0].sourceCompletedAt,COMPLETED);incomplete(audits[0])
  })
}

test('C37 caller opaque abort takes priority over a returned numeric 503 response',async()=>{
  const controller=new AbortController(),reason=Object.freeze(Object.create(null))
  const error=await rejection(run({now,signal:controller.signal,fetchPage:async()=>{controller.abort(reason);return entity(503)}}))
  assert.equal(error,reason);assert.deepEqual(Object.getOwnPropertyNames(reason),[])
})

test('C37 malformed 200 remains a source contract failure without outage or role observations',async()=>{
  const page=entity(200)
  page.headers={'content-type':'text/html',date:HTTP_DATE};page.originalReceipt.headers=structuredClone(page.headers)
  const {error,audit}=await read(page)
  assert.equal(error.status,undefined);assert.equal(Object.hasOwn(error,'upstreamOutage'),false)
  assert.deepEqual(classifyScraperError(error),{softFailure:false,upstreamOutage:false,failureKind:'hard_failure'})
  assert.equal(audit.responses[0].status,200);assert.equal(audit.responses[0].bodyComplete,true)
})
