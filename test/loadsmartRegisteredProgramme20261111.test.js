import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'
import {saveRawSourceCapture} from '../scraper-support/utils/rawCapture.js'

// The fixture contains actual opening responses. Reusing them below for
// controlled closing responses tests the protocol; it is not live currentness.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/loadsmart-current-programme-20261111.json.gz',import.meta.url))))
const C='https://loadsmart.com/careers/'
const B='https://jobs.lever.co/loadsmart/'
const L='https://jobs.lever.co/js/list.js'
const A='https://api.lever.co/v0/postings/loadsmart?mode=json'
const order=[C,B,L,A,A,L,B,C]
const originals=new Map(fixture.responses.map(row=>[row.requestedURL,row]))
for(const url of [C,B,L,A]){
  const row=originals.get(url)
  assert.ok(row,'The exact declared original opening entity must exist')
  const bytes=Buffer.from(row.bodyBase64,'base64')
  assert.equal(bytes.length,row.bodyBytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)
}
const originalFlat=JSON.parse(Buffer.from(originals.get(A).bodyBase64,'base64').toString('utf8'))
const registered=()=>buildScrapers().find(row=>row.name==='loadsmart')
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Controlled registered replay forbids public HTTP'))
function replay({changePrimary=value=>value,primaryError,nativeResponses=originals}={}){
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
      const row=nativeResponses.get(url)
      nativeCalls.push({url,...init})
      const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers})
      Object.defineProperty(response,'url',{value:row.finalURL})
      return response
    },
  }}
}

test('registered Loadsmart qualifies only the reconciled finite programme and forbids cleanup',async t=>{
  forbidNetwork(t)
  const r=replay(),jobs=await registered().run(r.options)
  const inventory=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
  assert.equal(jobs.length,0)
  assert.equal(inventory?.status,'complete-inventory','The current finite native programme needs its own completion proof')
  assert.equal(inventory.firstParty,true)
  assert.equal(inventory.listingComplete,true)
  assert.equal(inventory.reportedTotal,null,'No independently reported server total exists')
  assert.equal(inventory.indiaFacetCount,0)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.equal(audit.source,'loadsmart')
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
  const observation=readSourceObservationEvidence(jobs,'loadsmart')
  assert.equal(observation.observedRecordCount,originalFlat.length)
  assert.equal(observation.observedVacancyCount,originalFlat.length)
  assert.equal(observation.sourceScopeComplete,false)
  const provider=getScraperCatalog().find(row=>row.source==='loadsmart')
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
])test(`registered Loadsmart withholds zero when earlier ${name} differs`,async t=>{
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

test('registered Loadsmart retains the primary positive India branch without invoking the zero reader',async t=>{
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
  assert.equal(jobs[0].source,'loadsmart')
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.equal(r.nativeCalls.length,0)
})

test('registered Loadsmart preserves a primary API error without invoking the zero reader',async t=>{
  forbidNetwork(t)
  const primaryError=Object.assign(new Error('Controlled primary API failure'),{abortRetries:true})
  const r=replay({primaryError})
  await assert.rejects(registered().run(r.options),error=>error===primaryError)
  assert.equal(r.nativeCalls.length,0)
})

test('pre-aborted registered Loadsmart acquires no legacy or native entity',async t=>{
  forbidNetwork(t)
  const r=replay(),controller=new AbortController()
  controller.abort(new DOMException('Root registered cancellation control','AbortError'))
  await assert.rejects(registered().run({...r.options,signal:controller.signal}),error=>error.name==='AbortError')
  assert.equal(r.nativeCalls.length,0)
  assert.equal(r.primaryCalls.length,0)
})

test('registered empty Loadsmart output archives the full native transaction without inventing a job',async t=>{
  forbidNetwork(t)
  const r=replay(),jobs=await registered().run(r.options)
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'loadsmart-native-archive-'))
  t.after(async()=>{
    const target=path.resolve(directory),parent=path.resolve(os.tmpdir()),relative=path.relative(parent,target)
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Remove only this owned temporary child')
    await fs.rm(target,{recursive:true,force:true})
  })
  const file=await saveRawSourceCapture(jobs,{source:'loadsmart',dryRun:true,directory})
  const saved=JSON.parse(await fs.readFile(file,'utf8'))
  assert.equal(saved.jobCount,0)
  assert.deepEqual(saved.jobs,[])
  assert.deepEqual(saved.inventoryEvidence,readInventoryEvidence(jobs))
  assert.ok(saved.nativeCollectionEvidence,'The opted-in full native transaction must survive empty-array capture')
  assert.deepEqual(saved.nativeCollectionEvidence,jobs.nativeCollectionEvidence)
  assert.deepEqual(saved.nativeCollectionEvidence.nativePayload,originalFlat)
  assert.equal(saved.nativeCollectionEvidence.rawPages.length,8)
  for(const row of saved.nativeCollectionEvidence.rawPages){
    const original=originals.get(row.requestedURL)
    assert.equal(row.bodyBase64,original.bodyBase64)
    assert.equal(row.bodySHA256,original.bodySHA256)
    assert.deepEqual(row.headers,original.headers)
  }
})

test('registered Loadsmart compares the actual32 opaque literal only within a controlled complete server publication replay',async t=>{
  forbidNetwork(t)
  const actual=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/lever-request-metadata-loadsmart-actual32-20261111.json.gz',import.meta.url))))
  assert.equal(actual.observationOnly,true)
  assert.equal(actual.acquiredClosings,false)
  assert.equal(actual.completeSourceTransaction,false)
  assert.equal(actual.responses.length,1)
  const board=actual.responses[0],body=Buffer.from(board.bodyBase64,'base64')
  assert.equal(board.requestedURL,B)
  assert.equal(board.finalURL,B)
  assert.equal(board.bodyBytes,body.length)
  assert.equal(board.bodySHA256,createHash('sha256').update(body).digest('hex'))
  const nativeResponses=new Map(originals)
  nativeResponses.set(B,board)
  // Other entities and every closing are controlled reuses. Neither this
  // mixed opening packet nor actual32 constitutes a fresh complete programme.
  const r=replay({nativeResponses}),jobs=await registered().run(r.options)
  const audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs)
  assert.equal(jobs.length,0)
  assert.equal(inventory.status,'complete-inventory')
  assert.equal(inventory.reportedTotal,null)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.equal(audit.priorNativePayloadReconciled,true)
  assert.deepEqual(audit.nativePayload,originalFlat)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.companyGlobalScopeQualified,false)
  assert.equal(audit.programmeRequestCount,8)
  assert.equal(audit.rawPages.length,8)
  for(const index of [1,6]){
    const row=audit.rawPages[index],certificate=row.requestMetadataCertificate
    assert.equal(row.bodyBase64,board.bodyBase64)
    assert.equal(row.bodySHA256,board.bodySHA256)
    assert.equal(certificate.comparisonProfile,'loadsmart-server-publication-v1')
    assert.equal(certificate.tDateBound,false)
    assert.equal(certificate.sourceTimeSemanticsQualified,false)
    assert.equal(certificate.literalSlots.find(slot=>slot.name==='params.t').originalValue,'MTc5NDQyMTEyNA==')
  }
  assert.deepEqual(r.nativeCalls.map(row=>row.url),order)
})
