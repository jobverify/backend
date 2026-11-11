import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'

// The fixture contains actual opening responses. Reusing them below for
// controlled closing responses tests the protocol; it is not live currentness.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/immuta-current-programme-20261111.json.gz',import.meta.url))))
const C='https://www.immuta.com/careers'
const G='https://api.lever.co/v0/postings/immuta?mode=json&group=department'
const A='https://api.lever.co/v0/postings/immuta?mode=json'
const I='https://jobs.lever.co/immuta/4372d3ba-00d6-4ae0-986c-e65d8dbf9def'
const order=[C,G,A,I,I,A,G,C]
const originals=new Map(fixture.responses.map(row=>[row.requestedURL,row]))
for(const url of [C,G,A,I]){
  const row=originals.get(url)
  assert.ok(row,'The exact declared original opening entity must exist')
  const bytes=Buffer.from(row.bodyBase64,'base64')
  assert.equal(bytes.length,row.bodyBytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)
}
const originalFlat=JSON.parse(Buffer.from(originals.get(A).bodyBase64,'base64').toString('utf8'))
const registered=()=>buildScrapers().find(row=>row.name==='immuta')
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Controlled registered replay forbids public HTTP'))
function replay({changePrimary=value=>value,primaryError}={}){
  const nativeCalls=[],primaryCalls=[]
  return{nativeCalls,primaryCalls,options:{
    requestIntervalMs:0,
    fetchPage:async url=>{
      primaryCalls.push({url,kind:'page'})
      const row=originals.get(url)
      if(!row)throw new Error('No acquired original for optional legacy resource: '+url)
      return{url:row.finalURL,status:row.status,headers:row.headers,html:Buffer.from(row.bodyBase64,'base64').toString('utf8')}
    },
    fetchJson:async url=>{
      primaryCalls.push({url,kind:'json'})
      assert.equal(url,A)
      if(primaryError)throw primaryError
      return changePrimary(structuredClone(originalFlat))
    },
    fetchImpl:async(url,init)=>{
      assert.equal(url,order[nativeCalls.length],'Bounded native protocol uses all openings before reverse closings')
      const row=originals.get(url)
      nativeCalls.push({url,...init})
      const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers})
      Object.defineProperty(response,'url',{value:row.finalURL})
      return response
    },
  }}
}

test('registered Immuta qualifies only the reconciled finite programme and forbids cleanup',async t=>{
  forbidNetwork(t)
  const r=replay(),jobs=await registered().run(r.options)
  const inventory=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
  assert.equal(jobs.length,0)
  assert.equal(inventory?.status,'complete-inventory','The current finite native programme needs its own completion proof')
  assert.equal(inventory.firstParty,true)
  assert.equal(inventory.listingComplete,true)
  assert.equal(inventory.reportedTotal,originalFlat.length)
  assert.equal(inventory.indiaFacetCount,0)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.equal(audit.source,'immuta')
  assert.equal(audit.archiveNativeCollectionEvidence,true)
  assert.equal(audit.priorNativePayloadReconciled,true)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.companyGlobalScopeQualified,false)
  assert.equal(audit.programmeRequestCount,8)
  assert.equal(audit.totalPublicRequests,null)
  assert.deepEqual(audit.nativePayload,originalFlat)
  assert.deepEqual(audit.priorNativeObservation.nativePayload,originalFlat)
  assert.deepEqual(r.nativeCalls.map(row=>row.url),order)
  assert.ok(r.nativeCalls.every(row=>row.cache==='no-store'&&row.credentials==='omit'&&row.redirect==='manual'))
  const observation=readSourceObservationEvidence(jobs,'immuta')
  assert.ok(observation.observedRecordCount>=originalFlat.length)
  assert.equal(observation.sourceScopeComplete,false)
  const provider=getScraperCatalog().find(row=>row.source==='immuta')
  const terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),
    zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
  assert.equal(terminal.success,true)
  assert.equal(terminal.processingComplete,true)
  assert.equal(terminal.zeroJobEvidence,'fetched-zero')
  assert.deepEqual(inventoryCleanupOptions(JSON.parse(JSON.stringify(terminal))),{replaceExisting:false})
})

for(const [name,changePrimary]of [
  ['complete criteria',value=>{value[0].description+='<p>Earlier same-attempt authored requirement.</p>';return value}],
  ['native array order',value=>value.reverse()],
])test(`registered Immuta withholds zero when earlier ${name} differs`,async t=>{
  forbidNetwork(t)
  const r=replay({changePrimary})
  await assert.rejects(registered().run(r.options),error=>{
    assert.equal(error.softFailure,true)
    assert.equal(error.failureKind,'coverage_gap')
    assert.equal(error.nativeCollectionEvidence?.priorNativePayloadReconciled,false)
    assert.deepEqual(error.nativeCollectionEvidence?.nativePayload,originalFlat)
    return true
  })
  assert.equal(r.nativeCalls.length,8)
})

test('registered Immuta retains the primary positive India branch without invoking the zero reader',async t=>{
  forbidNetwork(t)
  const r=replay({changePrimary:value=>{
    const row=value[0]
    row.country='IN'
    row.categories.location='Bengaluru, India'
    row.categories.allLocations=['Bengaluru, India']
    return[row]
  }})
  const jobs=await registered().run(r.options)
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].source,'immuta')
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.equal(r.nativeCalls.length,0)
})

test('registered Immuta preserves a primary API error without invoking the zero reader',async t=>{
  forbidNetwork(t)
  const primaryError=Object.assign(new Error('Controlled primary API failure'),{abortRetries:true})
  const r=replay({primaryError})
  await assert.rejects(registered().run(r.options),error=>error===primaryError)
  assert.equal(r.nativeCalls.length,0)
})

test('pre-aborted registered Immuta acquires no legacy or native entity',async t=>{
  forbidNetwork(t)
  const r=replay(),controller=new AbortController()
  controller.abort(new DOMException('Root registered cancellation control','AbortError'))
  await assert.rejects(registered().run({...r.options,signal:controller.signal}),error=>error.name==='AbortError')
  assert.equal(r.nativeCalls.length,0)
  assert.equal(r.primaryCalls.length,0)
})
