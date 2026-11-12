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

// These are eight genuine historical openings acquired in different phases.
// They are not a current transaction and contain no acquired closing responses.
// Native replay below reuses those openings as controlled closings. Response
// headers/entries produced by the test transport are controlled views, not newly
// acquired historical header entries or evidence of live currentness.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/front-current-programme-openings-20261111.json.gz',import.meta.url))))
const C='https://front.com/jobs'
const F='https://front.com/jobs/feed'
const A='https://api.ashbyhq.com/posting-api/job-board/frontcareers'
const originals=new Map(fixture.responses.map(row=>[row.requestedURL,row]))
for(const row of originals.values()){
  const body=Buffer.from(row.bodyBase64,'base64')
  assert.equal(body.length,row.bodyBytes)
  assert.equal(createHash('sha256').update(body).digest('hex'),row.bodySHA256)
}
const originalPayload=JSON.parse(Buffer.from(originals.get(A).bodyBase64,'base64').toString('utf8'))
const originalGroups=JSON.parse(Buffer.from(originals.get(F).bodyBase64,'base64').toString('utf8'))
const ownOrder=originalGroups.flatMap(group=>group.jobs.map(job=>job.link))
const nativeOrder=[C,F,A,...ownOrder,...ownOrder,A,F,C]
assert.equal(originalPayload.apiVersion,'1')
assert.equal(originalPayload.jobs.length,4)
assert.equal(nativeOrder.length,14)
const registered=()=>buildScrapers().find(row=>row.name==='front')
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Registered Front replay forbids public HTTP'))

function replay({changePrimary=value=>value,primaryError,nativeResponses=originals,
  changeNative=packet=>packet}={}){
  const primaryCalls=[],nativeCalls=[]
  return{primaryCalls,nativeCalls,options:{
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
      return changePrimary(structuredClone(originalPayload))
    },
    fetchImpl:async(url,init)=>{
      assert.equal(url,nativeOrder[nativeCalls.length],'All C/F/A/own openings precede the same-order own closings, then A/F/C')
      nativeCalls.push({url,...init})
      const original=nativeResponses.get(url)
      assert.ok(original,'A complete controlled native packet is required for '+url)
      const packet=changeNative({body:Buffer.from(original.bodyBase64,'base64'),status:original.status,
        headers:structuredClone(original.headers),finalURL:original.finalURL},url,nativeCalls.length)
      const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
      Object.defineProperty(response,'url',{value:packet.finalURL})
      return response
    },
  }}
}

test('registered Front requires a complete finite programme after its original primary returns zero India jobs',async t=>{
  forbidNetwork(t)
  const provider=getScraperCatalog().find(row=>row.source==='front')
  assert.equal(provider.adapter,'script')
  assert.ok(provider.modulePath.replaceAll('\\','/').endsWith('/scraper/front/script.js'))
  const r=replay(),jobs=await registered().run(r.options)
  assert.equal(jobs.length,0)
  assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,originalPayload,'The earlier full original envelope and job order must survive')
  assert.deepEqual(r.primaryCalls,[{url:C,kind:'page'},{url:A,kind:'json'}])
  const inventory=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
  assert.equal(inventory?.status,'complete-inventory','The existing discovery-only result needs the independent finite programme proof')
  assert.equal(inventory.firstParty,true)
  assert.equal(inventory.listingComplete,true)
  assert.equal(inventory.reportedTotal,null)
  assert.equal(inventory.indiaFacetCount,0)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.deepEqual(r.nativeCalls.map(row=>row.url),nativeOrder)
  assert.ok(r.nativeCalls.every(row=>row.method==='GET'&&row.cache==='no-store'&&row.credentials==='omit'&&row.redirect==='manual'))
  assert.equal(audit.source,'front')
  assert.equal(audit.archiveNativeCollectionEvidence,true)
  assert.equal(audit.priorNativePayloadReconciled,true)
  assert.deepEqual(audit.priorNativeObservation.nativePayload,originalPayload)
  assert.equal(audit.programmeRequestCount,14)
  assert.equal(audit.totalPublicRequests,null)
  for(const key of ['sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed',
    'sourceBodiesQualified','rendererConsumptionQualified','boardAcquired','fullRenderedCriteriaQualified',
    'applicationVisited','screeningCriteriaAcquired','applicantEligibilityQualified'])assert.equal(audit[key],false,key)
  assert.equal(audit.recordKind,'vacancy-rows')
  assert.equal(audit.observedRecordCount,4)
  assert.equal(audit.observedVacancyCount,4)
  const observation=readSourceObservationEvidence(jobs,'front')
  assert.equal(observation.observedRecordCount,4)
  assert.equal(observation.observedVacancyCount,4)
  assert.equal(observation.sourceScopeComplete,false)
  assert.equal(observation.companyGlobalTotal,null)
  assert.equal(observation.companyIndiaTotal,null)
  assert.equal(audit.nativeRecords.length,4)
  for(const record of audit.nativeRecords){
    assert.deepEqual(record.originalPublicRecord,originalPayload.jobs.find(row=>row.id===record.id))
    assert.equal(record.originalNativePosting.descriptionHtml,record.originalSchema.description)
    assert.equal(record.applicantEligibilityQualified,false)
  }
  const terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),
    zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
  assert.equal(terminal.success,true)
  assert.equal(terminal.processingComplete,true)
  assert.equal(terminal.rawRecords,4)
  assert.equal(terminal.zeroJobEvidence,'fetched-zero')
  assert.deepEqual(inventoryCleanupOptions(JSON.parse(JSON.stringify(terminal))),{replaceExisting:false})
})

for(const [name,changePrimary]of [
  ['full original criteria',value=>{value.jobs[0].descriptionHtml+='<p>Earlier same-attempt authored requirement.</p>';return value}],
  ['independent native array order',value=>{value.jobs.reverse();return value}],
  ['an extra envelope field',value=>{value.additionalPublishedCriterion='Earlier original value';return value}],
])test(`registered Front withholds zero when earlier ${name} differs`,async t=>{
  forbidNetwork(t)
  const r=replay({changePrimary}),seen=[]
  await assert.rejects(registered().run({...r.options,onAudit:audit=>seen.push(audit)}),error=>{
    assert.equal(error.softFailure,true)
    assert.equal(error.failureKind,'coverage_gap')
    assert.equal(error.nativeCollectionEvidence?.priorNativePayloadReconciled,false)
    assert.deepEqual(error.nativeCollectionEvidence?.nativePayload,originalPayload)
    return true
  })
  assert.equal(r.nativeCalls.length,14)
  assert.equal(seen.length,0,'No observer receives a qualified zero before the complete earlier payload reconciles')
})

test('registered Front preserves the primary rejection of a numeric apiVersion without starting native recovery',async t=>{
  forbidNetwork(t)
  const r=replay({changePrimary:value=>{value.apiVersion=1;return value}}),seen=[]
  await assert.rejects(registered().run({...r.options,onAudit:audit=>seen.push(audit)}),
    error=>error.message==='[front] Invalid ashby inventory: unsupported native schema')
  assert.deepEqual(r.primaryCalls,[{url:C,kind:'page'},{url:A,kind:'json'}])
  assert.equal(r.nativeCalls.length,0)
  assert.equal(seen.length,0)
})

test('registered Front holds a changed first own closing and emits no qualified observer',async t=>{
  forbidNetwork(t)
  const r=replay({changeNative:(packet,url,request)=>{
    if(url===ownOrder[0]&&request===8)packet.body=Buffer.concat([packet.body,Buffer.from('\n')])
    return packet
  }}),seen=[]
  await assert.rejects(registered().run({...r.options,onAudit:audit=>seen.push(audit)}),error=>{
    assert.equal(error.softFailure,true)
    assert.equal(error.failureKind,'coverage_gap')
    return true
  })
  assert.equal(r.nativeCalls.length,8)
  assert.equal(seen.length,0)
})

test('registered Front observer receives reconciled evidence without rewriting retained criteria',async t=>{
  forbidNetwork(t)
  const r=replay(),seen=[]
  const jobs=await registered().run({...r.options,onAudit:audit=>{
    seen.push(structuredClone(audit))
    audit.nativePayload.jobs[0].descriptionHtml='Controlled observer mutation'
  }})
  assert.equal(seen.length,1)
  assert.equal(seen[0].priorNativePayloadReconciled,true)
  assert.deepEqual(seen[0].nativePayload,originalPayload)
  assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,originalPayload)
  assert.equal(r.nativeCalls.length,14)
})

test('registered Front preserves the positive primary India branch',async t=>{
  forbidNetwork(t)
  const r=replay({changePrimary:value=>{
    const job=value.jobs[0]
    job.location='Bengaluru, India'
    job.address.postalAddress.addressCountry='India'
    job.address.postalAddress.addressLocality='Bengaluru'
    job.address.postalAddress.addressRegion='Karnataka'
    value.jobs=[job]
    return value
  }})
  const jobs=await registered().run(r.options)
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].source,'front')
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.equal(r.nativeCalls.length,0)
})

test('registered Front preserves the original primary API error',async t=>{
  forbidNetwork(t)
  const primaryError=Object.assign(new Error('Controlled original Front API failure'),{abortRetries:true})
  const r=replay({primaryError})
  await assert.rejects(registered().run(r.options),error=>error===primaryError)
  assert.equal(r.nativeCalls.length,0)
})

test('pre-aborted registered Front acquires no legacy or native entity',async t=>{
  forbidNetwork(t)
  const r=replay(),controller=new AbortController()
  controller.abort(new DOMException('Controlled registered Front cancellation','AbortError'))
  await assert.rejects(registered().run({...r.options,signal:controller.signal}),error=>error.name==='AbortError')
  assert.equal(r.primaryCalls.length,0)
  assert.equal(r.nativeCalls.length,0)
})

test('registered empty Front output archives all complete native packets and four original vacancies',async t=>{
  forbidNetwork(t)
  const r=replay(),jobs=await registered().run(r.options)
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'front-native-archive-'))
  t.after(async()=>{
    const target=path.resolve(directory),parent=path.resolve(os.tmpdir()),relative=path.relative(parent,target)
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Remove only this owned temporary child')
    await fs.rm(target,{recursive:true,force:true})
  })
  const file=await saveRawSourceCapture(jobs,{source:'front',dryRun:true,directory})
  const saved=JSON.parse(await fs.readFile(file,'utf8'))
  assert.equal(saved.jobCount,0)
  assert.deepEqual(saved.jobs,[])
  assert.deepEqual(saved.inventoryEvidence,readInventoryEvidence(jobs))
  assert.ok(saved.nativeCollectionEvidence,'A zero archive must retain the complete opt-in native audit')
  assert.deepEqual(saved.nativeCollectionEvidence,jobs.nativeCollectionEvidence)
  assert.deepEqual(saved.nativeCollectionEvidence.nativePayload,originalPayload)
  assert.equal(saved.nativeCollectionEvidence.recordKind,'vacancy-rows')
  assert.equal(saved.nativeCollectionEvidence.observedRecordCount,4)
  assert.equal(saved.nativeCollectionEvidence.observedVacancyCount,4)
  assert.equal(saved.nativeCollectionEvidence.nativeRecords.length,4)
  assert.equal(saved.nativeCollectionEvidence.rawPages.length,14)
  for(const row of saved.nativeCollectionEvidence.rawPages){
    const original=originals.get(row.requestedURL)
    assert.equal(row.bodyBase64,original.bodyBase64)
    assert.equal(row.bodySHA256,original.bodySHA256)
    assert.deepEqual(row.headers,original.headers)
  }
})
