import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'
import {saveRawSourceCapture,saveRawSourceFailure} from '../scraper-support/utils/rawCapture.js'

// Ten separately acquired historical openings are reused as CONTROLLED
// closings. Generated Fetch header views and clocks are controlled deliveries,
// and none of these tests establishes a current publisher transaction.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/jasper-server-programme-originals-20261111.json.gz',import.meta.url))))
const C='https://www.jasper.ai/careers'
const B='https://jobs.ashbyhq.com/Jasper%20AI'
const A='https://api.ashbyhq.com/posting-api/job-board/Jasper%20AI'
const originals=new Map(fixture.responses.map(row=>[row.originalReceipt.requestedURL,row]))
const sha=body=>createHash('sha256').update(body).digest('hex')
for(const row of originals.values()){
  const body=Buffer.from(row.bodyBase64,'base64')
  assert.equal(body.length,row.originalReceipt.bodyBytes)
  assert.equal(sha(body),row.originalReceipt.bodySHA256)
}
const originalPayload=JSON.parse(Buffer.from(originals.get(A).bodyBase64,'base64'))
const ownOrder=originalPayload.jobs.map(job=>job.jobUrl)
const nativeOrder=[C,B,A,...ownOrder,...ownOrder.toReversed(),A,B,C]
assert.equal(originalPayload.jobs.length,7)
assert.equal(nativeOrder.length,20)
const registered=()=>buildScrapers().find(row=>row.name==='jasper')
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Registered Jasper replay forbids public HTTP'))

function replay({changePrimary=value=>value,primaryError,changeNative=packet=>packet}={}){
  const primaryCalls=[],nativeCalls=[]
  return{primaryCalls,nativeCalls,options:{
    requestIntervalMs:0,
    fetchPage:async url=>{
      primaryCalls.push({url,kind:'page'})
      const row=originals.get(url)
      if(!row)throw Error('No original for optional legacy resource: '+url)
      const receipt=row.originalReceipt
      return{url:receipt.finalURL,status:receipt.status,headers:structuredClone(receipt.headers),html:Buffer.from(row.bodyBase64,'base64').toString('utf8')}
    },
    fetchJson:async url=>{
      primaryCalls.push({url,kind:'json'})
      assert.equal(url,A)
      if(primaryError)throw primaryError
      return changePrimary(structuredClone(originalPayload))
    },
    fetchImpl:async(url,init)=>{
      assert.equal(url,nativeOrder[nativeCalls.length],'Every opening precedes reverse API-order own closings, then A/B/C')
      nativeCalls.push({url,...init})
      const row=originals.get(url)
      assert.ok(row,'Only a declared original source route may be read')
      const packet=changeNative({body:Buffer.from(row.bodyBase64,'base64'),...structuredClone(row.originalReceipt)},url,nativeCalls.length)
      const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
      Object.defineProperty(response,'url',{value:packet.finalURL})
      return response
    },
  }}
}

test('registered Jasper requires the complete finite programme after its original primary zero',async t=>{
  forbidNetwork(t)
  const provider=getScraperCatalog().find(row=>row.source==='jasper')
  assert.equal(provider.adapter,'script')
  assert.ok(provider.modulePath.replaceAll('\\','/').endsWith('/scraper/jasper/script.js'))
  const r=replay(),jobs=await registered().run(r.options)
  assert.equal(jobs.length,0)
  assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,originalPayload)
  assert.deepEqual(r.primaryCalls,[{url:C,kind:'page'},{url:A,kind:'json'}])
  assert.equal(r.nativeCalls.length,20,'The original discovery-only zero still needs an independent closed programme')
  assert.deepEqual(r.nativeCalls.map(row=>row.url),nativeOrder)
  assert.ok(r.nativeCalls.every(row=>row.method==='GET'&&row.cache==='no-store'&&row.credentials==='omit'&&row.redirect==='manual'))
  const inventory=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
  assert.equal(inventory.status,'complete-inventory')
  assert.equal(inventory.firstParty,true)
  assert.equal(inventory.listingComplete,true)
  assert.equal(inventory.reportedTotal,null)
  assert.equal(inventory.indiaFacetCount,0)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.equal(audit.priorNativePayloadReconciled,true)
  assert.deepEqual(audit.priorNativeObservation.nativePayload,originalPayload)
  assert.equal(audit.programmeRequestCount,20)
  assert.equal(audit.totalPublicRequests,null)
  assert.equal(audit.observedRecordCount,7)
  assert.equal(audit.observedVacancyCount,7)
  assert.equal(audit.nativeRecords.length,7)
  for(const field of ['sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed','sourceBodiesQualified',
    'rendererConsumptionQualified','fullRenderedCriteriaQualified','applicationVisited','screeningCriteriaAcquired','applicantEligibilityQualified'])assert.equal(audit[field],false,field)
  const observation=readSourceObservationEvidence(jobs,'jasper')
  assert.equal(observation.recordKind,'vacancy-rows')
  assert.equal(observation.observedRecordCount,7)
  assert.equal(observation.observedVacancyCount,7)
  assert.equal(observation.companyGlobalTotal,null)
  const terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),
    zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
  assert.equal(terminal.success,true)
  assert.equal(terminal.processingComplete,true)
  assert.equal(terminal.rawRecords,7)
  assert.equal(terminal.zeroJobEvidence,'fetched-zero')
  assert.deepEqual(inventoryCleanupOptions(JSON.parse(JSON.stringify(terminal))),{replaceExisting:false})
})

for(const [label,changePrimary]of [
  ['complete original criteria',value=>{value.jobs[0].descriptionHtml+='<p>Earlier authored requirement.</p>';return value}],
  ['native array order',value=>{value.jobs.reverse();return value}],
  ['an extra native envelope field',value=>{value.additionalPublishedCriterion='Earlier original value';return value}],
])test('registered Jasper withholds zero when prior '+label+' differs',async t=>{
  forbidNetwork(t)
  const r=replay({changePrimary}),seen=[]
  await assert.rejects(registered().run({...r.options,onAudit:audit=>seen.push(audit)}),error=>{
    assert.equal(error.softFailure,true)
    assert.equal(error.failureKind,'coverage_gap')
    assert.equal(error.nativeCollectionEvidence.priorNativePayloadReconciled,false)
    assert.deepEqual(error.nativeCollectionEvidence.nativePayload,originalPayload)
    assert.deepEqual(error.nativeCollectionEvidence.priorNativeObservation.nativePayload,changePrimary(structuredClone(originalPayload)))
    return true
  })
  assert.equal(r.nativeCalls.length,20)
  assert.equal(seen.length,0,'Full prior A must reconcile before an external observer')
})

test('registered Jasper preserves a positive primary India result',async t=>{
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
  assert.equal(jobs[0].source,'jasper')
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.equal(r.nativeCalls.length,0)
})

test('registered Jasper preserves the original primary API error identity',async t=>{
  forbidNetwork(t)
  const primaryError=Object.assign(Error('Controlled original API failure'),{abortRetries:true}),r=replay({primaryError})
  await assert.rejects(registered().run(r.options),error=>error===primaryError)
  assert.equal(r.nativeCalls.length,0)
})

test('registered Jasper preserves the primary numeric apiVersion rejection',async t=>{
  forbidNetwork(t)
  const r=replay({changePrimary:value=>{value.apiVersion=1;return value}})
  await assert.rejects(registered().run(r.options),error=>error.message==='[jasper] Invalid ashby inventory: unsupported native schema')
  assert.equal(r.nativeCalls.length,0)
})

test('pre-aborted registered Jasper starts no primary or native read',async t=>{
  forbidNetwork(t)
  const r=replay(),parent=new AbortController(),reason=new DOMException('Controlled preabort','AbortError')
  parent.abort(reason)
  await assert.rejects(registered().run({...r.options,signal:parent.signal}),error=>error===reason)
  assert.equal(r.primaryCalls.length,0)
  assert.equal(r.nativeCalls.length,0)
})

test('registered Jasper holds exact closing API whitespace drift before external audit',async t=>{
  forbidNetwork(t)
  const r=replay({changeNative:(packet,url,n)=>url===A&&n===18?{...packet,body:Buffer.concat([packet.body,Buffer.from(' ')])}:packet}),seen=[]
  await assert.rejects(registered().run({...r.options,onAudit:audit=>seen.push(audit)}),error=>{
    assert.equal(error.reason,'closing')
    assert.equal(error.nativeCollectionEvidence.rawPages.length,18)
    assert.equal(error.nativeCollectionEvidence.rawPages.at(-1).requestedURL,A)
    return true
  })
  assert.equal(seen.length,0)
})

test('registered Jasper observer sees reconciled evidence and cannot mutate retained originals',async t=>{
  forbidNetwork(t)
  const r=replay(),seen=[]
  const jobs=await registered().run({...r.options,onAudit:audit=>{
    assert.equal(audit.priorNativePayloadReconciled,true)
    seen.push(structuredClone(audit))
    audit.nativePayload.jobs.length=0
    audit.rawPages.length=0
  }})
  assert.equal(seen.length,1)
  assert.equal(seen[0].rawPages.length,20)
  assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,originalPayload)
  assert.equal(jobs.nativeCollectionEvidence.rawPages.length,20)
})

test('registered Jasper observer rejection holds with all acquired original records',async t=>{
  forbidNetwork(t)
  const r=replay(),reason=Error('Controlled registered observer rejection')
  await assert.rejects(registered().run({...r.options,onAudit:()=>{throw reason}}),error=>{
    assert.equal(error,reason)
    assert.equal(error.nativeCollectionEvidence?.rawPages.length,20,'Registered release failures retain the acquired native audit')
    assert.deepEqual(error.nativeCollectionEvidence.nativePayload,originalPayload)
    assert.equal(error.nativeCollectionEvidence.priorNativePayloadReconciled,true)
    assert.equal(error.nativeCollectionEvidence.currentTransactionQualified,false)
    assert.equal(Object.isFrozen(error.nativeCollectionEvidence),true)
    return true
  })
})

test('a frozen observer error retains its cause and the complete private release audit',async t=>{
  forbidNetwork(t)
  const r=replay(),reason=Object.freeze(Error('Controlled frozen observer rejection'))
  await assert.rejects(registered().run({...r.options,onAudit:()=>{throw reason}}),error=>{
    assert.equal(error.cause,reason)
    assert.equal(error.nativeCollectionEvidence.rawPages.length,20)
    assert.deepEqual(error.nativeCollectionEvidence.nativePayload,originalPayload)
    assert.equal(error.nativeCollectionEvidence.registeredReleaseCompleted,false)
    return true
  })
})

test('an observer cannot replace acquired failure evidence through its thrown audit payload',async t=>{
  forbidNetwork(t)
  const r=replay(),reason=Error('Controlled forged error audit')
  Object.defineProperty(reason,'nativeCollectionEvidence',{value:{source:'forged',rawPages:[]},configurable:false})
  await assert.rejects(registered().run({...r.options,onAudit:()=>{throw reason}}),error=>{
    assert.equal(error.cause,reason)
    assert.equal(error.nativeCollectionEvidence.source,'jasper')
    assert.equal(error.nativeCollectionEvidence.rawPages.length,20)
    assert.equal(error.nativeCollectionEvidence.priorNativePayloadReconciled,true)
    return true
  })
})

test('registered final caller abort retains all20 reads and prevents a zero release',async t=>{
  forbidNetwork(t)
  const r=replay(),parent=new AbortController(),reason=new DOMException('Controlled registered final abort','AbortError')
  let observed=0
  await assert.rejects(registered().run({...r.options,signal:parent.signal,onAudit:()=>{
    observed++
    parent.abort(reason)
    return new Promise(()=>{})
  }}),error=>{
    assert.equal(error,reason)
    assert.equal(error.nativeCollectionEvidence.rawPages.length,20)
    assert.equal(error.nativeCollectionEvidence.priorNativePayloadReconciled,true)
    assert.equal(error.nativeCollectionEvidence.currentTransactionQualified,false)
    return true
  })
  assert.equal(observed,1)
  assert.equal(r.nativeCalls.length,20)
})

test('registered Jasper projects downward native bounds while keeping primary hooks on primary',async t=>{
  forbidNetwork(t)
  const r=replay()
  await assert.rejects(registered().run({...r.options,maxRequests:19}),error=>error.reason==='bounds')
  assert.deepEqual(r.primaryCalls,[{url:C,kind:'page'},{url:A,kind:'json'}])
  assert.deepEqual(r.nativeCalls.map(row=>row.url),[C,B])
})

test('registered Jasper uses one outer source deadline including primary work',async t=>{
  forbidNetwork(t)
  const r=replay(),originalFetchJson=r.options.fetchJson
  r.options.fetchJson=async url=>{
    const result=await originalFetchJson(url),until=performance.now()+5
    while(performance.now()<until){/* Controlled primary CPU work. */}
    return result
  }
  await assert.rejects(registered().run({...r.options,sourceTimeoutMs:1}),error=>error.name==='TimeoutError')
  assert.equal(r.nativeCalls.length,0)
})

test('registered empty Jasper output archives all20 complete packets and seven original vacancies',async t=>{
  forbidNetwork(t)
  const r=replay(),jobs=await registered().run(r.options)
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'jasper-registered-archive-'))
  t.after(async()=>{
    const target=path.resolve(directory),parent=path.resolve(os.tmpdir()),relative=path.relative(parent,target)
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))
    await fs.rm(target,{recursive:true,force:true})
  })
  const file=await saveRawSourceCapture(jobs,{source:'jasper',dryRun:true,directory})
  const saved=JSON.parse(await fs.readFile(file,'utf8'))
  assert.equal(saved.jobCount,0)
  assert.deepEqual(saved.jobs,[])
  assert.deepEqual(saved.nativeCollectionEvidence,jobs.nativeCollectionEvidence)
  assert.deepEqual(saved.nativeCollectionEvidence.nativePayload,originalPayload)
  assert.equal(saved.nativeCollectionEvidence.rawPages.length,20)
  assert.equal(saved.nativeCollectionEvidence.nativeRecords.length,7)
  assert.equal(saved.nativeCollectionEvidence.priorNativePayloadReconciled,true)
  for(const raw of saved.nativeCollectionEvidence.rawPages){
    const original=originals.get(raw.requestedURL)
    assert.equal(raw.bodyBase64,original.bodyBase64)
    assert.equal(raw.bodySHA256,original.originalReceipt.bodySHA256)
    assert.deepEqual(raw.headers,Object.fromEntries(new Headers(original.originalReceipt.headers)))
    assert.deepEqual(raw.headerEntries,[...new Headers(original.originalReceipt.headers)])
  }
})

function observerProxy({callable=false,revoked=false}={}){
  const callbacks=[]
  const trap=name=>()=>{callbacks.push(name);throw Error('Controlled observer Proxy callback: '+name)}
  const traps=Object.fromEntries(['get','getOwnPropertyDescriptor','getPrototypeOf','isExtensible','ownKeys',
    'set','defineProperty','deleteProperty','preventExtensions','setPrototypeOf','apply','construct'].map(name=>[name,trap(name)]))
  const target=callable?function controlledObserverPayload(){}:{}
  const created=Proxy.revocable(target,traps)
  if(revoked)created.revoke()
  return{reason:created.proxy,callbacks}
}

async function heldArchiveDirectory(t){
  const prefix='jasper-registered-held-archive-'
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),prefix))
  t.after(async()=>{
    const target=path.resolve(directory),parent=path.resolve(os.tmpdir()),relative=path.relative(parent,target)
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))
    assert.equal(relative,path.basename(target))
    assert.ok(relative.startsWith(prefix))
    await fs.rm(target,{recursive:true,force:true})
  })
  return directory
}

for(const options of [{},{callable:true},{revoked:true},{callable:true,revoked:true}]){
  const label=(options.revoked?'revoked ':'')+(options.callable?'callable':'object')
  test('registered Jasper contains '+label+' observer Proxy and archives its complete held audit',async t=>{
    forbidNetwork(t)
    const r=replay(),proxy=observerProxy(options)
    let held,zeroReleased=false,observed=0
    try{
      await registered().run({...r.options,onAudit:()=>{observed++;throw proxy.reason}})
      zeroReleased=true
    }catch(error){held=error}
    assert.equal(zeroReleased,false,'An observer rejection must never release a verified zero')
    assert.ok(held instanceof Error)
    const descriptor=Object.getOwnPropertyDescriptor(held,'nativeCollectionEvidence')
    const directory=await heldArchiveDirectory(t)
    const file=await saveRawSourceFailure(held,{source:'jasper',dryRun:true,directory})
    const archiveBody=await fs.readFile(file),saved=JSON.parse(archiveBody)
    t.diagnostic(JSON.stringify({controlledHistoricalReplayOnly:true,HTTP:0,label,nativeReads:r.nativeCalls.length,
      observed,callbacks:proxy.callbacks,zeroReleased,ownAuditPresent:!!descriptor,
      archivedAuditPresent:Object.hasOwn(saved,'nativeCollectionEvidence'),archiveBytes:archiveBody.length,archiveSHA256:sha(archiveBody)}))
    assert.deepEqual(proxy.callbacks,[],'The source and registered cause traversal must never inspect the Proxy')
    assert.equal(r.nativeCalls.length,20)
    assert.equal(observed,1)
    assert.equal(held.softFailure,true)
    assert.equal(held.abortRetries,true)
    assert.equal(held.failureKind,'coverage_gap')
    assert.ok(descriptor&&Object.hasOwn(descriptor,'value'))
    const audit=descriptor.value
    assert.equal(audit.source,'jasper')
    assert.equal(audit.currentTransactionQualified,false)
    assert.equal(audit.currentDeclaredSourceProgramComplete,false)
    assert.equal(audit.registeredReleaseCompleted,false)
    assert.equal(audit.priorNativePayloadReconciled,true)
    assert.deepEqual(audit.nativePayload,originalPayload)
    assert.deepEqual(audit.priorNativeObservation.nativePayload,originalPayload)
    assert.equal(Object.isFrozen(audit),true)
    assert.equal(audit.rawPages.length,20)
    assert.equal(audit.nativeRecords.length,7)
    for(const field of ['sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed'])assert.equal(audit[field],false)
    for(let error=held,depth=0;error&&depth<8;depth++){
      assert.equal(types.isProxy(error),false,'No registered-traversable cause may be the uninspectable payload')
      const cause=Object.getOwnPropertyDescriptor(error,'cause')
      error=cause&&Object.hasOwn(cause,'value')?cause.value:undefined
    }
    assert.equal(Object.hasOwn(saved,'jobs'),false)
    assert.equal(Object.hasOwn(saved,'jobCount'),false)
    assert.deepEqual(saved.nativeCollectionEvidence,audit)
    assert.deepEqual(saved.nativeCollectionEvidence.nativePayload,originalPayload)
    assert.deepEqual(saved.nativeCollectionEvidence.priorNativeObservation.nativePayload,originalPayload)
    assert.deepEqual(saved.nativeCollectionEvidence.rawPages.map(raw=>raw.requestedURL),nativeOrder)
    for(const raw of saved.nativeCollectionEvidence.rawPages){
      const original=originals.get(raw.requestedURL)
      assert.equal(raw.bodyBase64,original.bodyBase64)
      assert.equal(raw.bodyBytes,original.originalReceipt.bodyBytes)
      assert.equal(raw.bodySHA256,original.originalReceipt.bodySHA256)
      assert.equal(raw.status,original.originalReceipt.status)
      assert.equal(raw.finalURL,original.originalReceipt.finalURL)
      assert.deepEqual(raw.headers,Object.fromEntries(new Headers(original.originalReceipt.headers)))
      assert.deepEqual(raw.headerEntries,[...new Headers(original.originalReceipt.headers)])
      assert.ok(raw.requestedAt&&raw.responseAt&&raw.completedAt)
    }
    assert.deepEqual(proxy.callbacks,[],'Failure archival must not inspect an opaque observer payload')
  })
}
