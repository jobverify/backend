import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {gunzipSync,gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {extractionRawJobMetrics} from '../scraper-support/utils/extractionRawJobMetrics.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome,classifyScraperError} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'
import {saveRawSourceCapture,saveRawSourceFailure} from '../scraper-support/utils/rawCapture.js'

// Twelve separately acquired original components, including two Q responses
// acquired 24 minutes apart, are delivered with CONTROLLED Fetch metadata and
// reused closings. This replay proves no current publisher interval.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/hyperscience-server-programme-components-20261111.json.gz',import.meta.url))))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const original=kind=>{
  const row=fixture.responses.find(value=>value.kind===kind)
  assert.ok(row,'A complete original component is required: '+kind)
  const body=Buffer.from(row.bodyBase64,'base64')
  assert.equal(body.length,row.receipt.bodyBytes);assert.equal(sha(body),row.receipt.bodySHA256)
  return{body,receipt:structuredClone(row.receipt)}
}
const C0=original('C0').receipt.requestedURL,C1=original('C1').receipt.requestedURL,A=original('A').receipt.requestedURL
const H=original('H').receipt.requestedURL,M=original('M').receipt.requestedURL,S=original('S').receipt.requestedURL,Q=original('Q-first').receipt.requestedURL
const request=Buffer.from(fixture.request.bodyBase64,'base64'),originalPayload=JSON.parse(original('A').body)
assert.equal(request.length,1983);assert.equal(sha(request),'26301b880ec3355a303c0431fa61fdc78c804d4d3964711771061c44876e51a8')
const registered=()=>{const scraper=buildScrapers().find(row=>row.name==='hyperscience');assert.ok(scraper);return scraper}
const provider=()=>getScraperCatalog().find(row=>row.source==='hyperscience')
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Registered Hyperscience replay forbids public HTTP'))
function setBody(row,body){row.body=Buffer.from(body);row.receipt.bodyBytes=row.body.length;row.receipt.bodySHA256=sha(row.body)}
function dataset(N=4){
  const byURL=new Map(fixture.responses.filter(row=>!row.kind.startsWith('Q')).map(row=>[row.receipt.requestedURL,original(row.kind)]))
  const payload=structuredClone(originalPayload)
  if(N<4){
    let html=byURL.get(C1).body.toString()
    for(const job of payload.jobs.slice(N)){
      const card=new RegExp('<a href="https://jobs\\.ashbyhq\\.com/hyperscience/'+job.id+'"[\\s\\S]*?</a>')
      assert.match(html,card);html=html.replace(card,'')
    }
    payload.jobs=payload.jobs.slice(0,N);setBody(byURL.get(A),JSON.stringify(payload));setBody(byURL.get(C1),html)
  }
  const owns=payload.jobs.map(job=>job.jobUrl)
  const plan=[...[C0,C1,A,...owns,H,M,S,Q].map(url=>({url,phase:'opening'})),...[...owns.toReversed(),Q,S,M,H,A,C1,C0].map(url=>({url,phase:'closing'}))]
  return{byURL,payload,plan,N}
}
function replay({data=dataset(),changePrimary=value=>value,primaryError,changeNative=row=>row,nativeFetch}={}){
  const primaryCalls=[],nativeCalls=[]
  const options={requestIntervalMs:0,
    fetchPage:async url=>{
      primaryCalls.push({url,kind:'page'})
      const row=data.byURL.get(url)
      if(!row)throw Error('No retained body for optional legacy resource: '+url)
      return{url:row.receipt.finalURL,status:row.receipt.status,headers:structuredClone(row.receipt.headers),html:row.body.toString('utf8')}
    },
    fetchJson:async url=>{
      primaryCalls.push({url,kind:'json'});assert.equal(url,A)
      if(primaryError)throw primaryError
      return changePrimary(structuredClone(data.payload))
    },
    fetchImpl:async(url,init)=>{
      const step=data.plan[nativeCalls.length];assert.ok(step,'No undeclared native read is allowed');assert.equal(url,step.url)
      nativeCalls.push({url,phase:step.phase,method:init.method,signal:init.signal,cache:init.cache,credentials:init.credentials,redirect:init.redirect})
      assert.equal(init.cache,'no-store');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
      if(url===Q){assert.equal(init.method,'POST');assert.deepEqual(Buffer.from(init.body),request);assert.deepEqual(init.headers,original('Q-first').receipt.requestHeaders)}else assert.equal(init.method,'GET')
      if(nativeFetch)return nativeFetch(url,init,step,nativeCalls.length)
      const row=url===Q?original(step.phase==='opening'?'Q-first':'Q-repeat'):{body:Buffer.from(data.byURL.get(url).body),receipt:structuredClone(data.byURL.get(url).receipt)}
      const packet=changeNative(row,{...step,index:nativeCalls.length,init})
      const response=new Response(packet.body,{status:packet.receipt.status,headers:packet.receipt.headers})
      Object.defineProperty(response,'url',{value:packet.receipt.finalURL});return response
    }}
  return{data,options,primaryCalls,nativeCalls}
}
const reportRoot=fileURLToPath(new URL('../../reports/soft-failures-1000-2026-11-11/empty-native/hyperscience-task4-registered-wrapper-20261112h/',import.meta.url))
function evidenceDirectory(){
  const value=process.env.HYPERSCIENCE_REGISTERED_EVIDENCE_DIR
  if(!value)return null
  const target=path.resolve(value),relative=path.relative(path.resolve(reportRoot),target)
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Evidence stays under the owned report directory')
  fs.mkdirSync(target,{recursive:true});return target
}
function evidence(name,value){const dir=evidenceDirectory();if(dir)fs.writeFileSync(path.join(dir,name+'.json.gz'),gzipSync(Buffer.from(JSON.stringify({controlledHistoricalReplayOnly:true,currentPublisherEvidence:false,HTTP:0,...value}))),{flag:'wx'})}
async function archiveDirectory(t,name){
  const dir=evidenceDirectory()
  if(dir){const child=path.join(dir,name);await fsp.mkdir(child,{recursive:true});return child}
  const prefix='hyperscience-registered-',temporary=await fsp.mkdtemp(path.join(os.tmpdir(),prefix))
  t.after(async()=>{const target=path.resolve(temporary),parent=path.resolve(os.tmpdir()),relative=path.relative(parent,target);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));assert.equal(relative,path.basename(target));assert.ok(relative.startsWith(prefix));await fsp.rm(target,{recursive:true,force:true})})
  return temporary
}
function checkedAudit(jobs,r){
  const audit=jobs.nativeCollectionEvidence,N=r.data.N
  assert.deepEqual(audit.nativePayload,r.data.payload);assert.deepEqual(audit.priorNativeObservation.nativePayload,r.data.payload)
  assert.equal(audit.priorNativePayloadReconciled,true);assert.equal(audit.nativeRecords.length,N);assert.equal(audit.nonVacancyRecords.length,1)
  assert.equal(audit.observedRecordCount,N+1);assert.equal(audit.observedVacancyCount,N);assert.equal(audit.reportedTotal,null)
  assert.equal(audit.nonVacancyRecords[0].workCountry,null);assert.equal(audit.nonVacancyRecords[0].applicantCountry,null)
  assert.equal(audit.nonVacancyRecords[0].comparison.opening.model.data.sourcingForm.sourcingFormRender.sections[0].fieldEntries.length,10)
  assert.equal(audit.rawPages.length,14+2*N);assert.equal(audit.programmeRequestCount,14+2*N);assert.equal(audit.totalPublicRequests,null)
  assert.equal(audit.QrawEntityEqual,false);assert.equal(audit.QserverDefinitionCriteriaEqual,true);assert.equal(audit.allWholeBodiesEqual,false)
  for(const field of ['currentTransactionQualified','currentDeclaredSourceProgramComplete','allChannelsClosed','allOpeningReadsBeforeClosing'])assert.equal(audit[field],true,field)
  for(const field of ['sourceScopeComplete','companyGlobalScopeQualified','applicantEligibilityQualified','legalEmployerQualified','rendererConsumptionQualified','UIOrApplicationEquivalent','lifecycleCleanupAllowed','sourceTimeSemanticsQualified'])assert.equal(audit[field],false,field)
  for(const raw of audit.rawPages){const body=Buffer.from(raw.bodyBase64,'base64');assert.equal(body.length,raw.bodyBytes);assert.equal(sha(body),raw.bodySHA256);assert.equal(raw.receipt.consumedBodyBytes,raw.bodyBytes);assert.equal(raw.receipt.discardedOverflowBytes,0);assert.equal(raw.receipt.overflowBytes,0)}
  return audit
}

test('registered Hyperscience requires the complete finite mixed programme after original primary zero',async t=>{
  forbidNetwork(t)
  assert.equal(provider().adapter,'script');assert.ok(provider().modulePath.replaceAll('\\','/').endsWith('/scraper/hyperscience/script.js'))
  const r=replay()
  let jobs
  try{jobs=await registered().run(r.options)}catch(error){
    const directory=await archiveDirectory(t,'baseline-held-archive')
    const file=await saveRawSourceFailure(error,{source:'hyperscience',dryRun:true,directory})
    evidence('baseline-held',{archive:file,saved:JSON.parse(await fsp.readFile(file,'utf8')),nativeReads:r.nativeCalls.length})
    throw error
  }
  t.diagnostic(JSON.stringify({controlledHistoricalReplayOnly:true,HTTP:0,primaryCalls:r.primaryCalls,nativeReads:r.nativeCalls.length,inventory:readInventoryEvidence(jobs)}))
  assert.equal(jobs.length,0);assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,originalPayload)
  assert.equal(readInventoryEvidence(jobs).status,'complete-inventory','Original discovery-only scope is not a qualified finite programme')
  assert.equal(r.nativeCalls.length,22);assert.deepEqual(r.nativeCalls.map(row=>row.url),r.data.plan.map(row=>row.url))
  const audit=checkedAudit(jobs,r),inventory=readInventoryEvidence(jobs),observation=readSourceObservationEvidence(jobs,'hyperscience')
  assert.equal(inventory.reportedTotal,null);assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.equal(observation.recordKind,'mixed');assert.equal(observation.observedRecordCount,5);assert.equal(observation.observedVacancyCount,4)
  assert.deepEqual(extractionRawJobMetrics(provider(),jobs,inventory),{rawJobs:4,rawJobsBasis:'observed-native-vacancy-rows'})
  const terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider()),zeroJobEvidence:resolveZeroJobOutcome({provider:provider()},jobs,[])})
  assert.equal(terminal.rawRecords,4);assert.equal(terminal.processingComplete,true);assert.equal(terminal.zeroJobEvidence,'fetched-zero');assert.deepEqual(inventoryCleanupOptions(terminal),{replaceExisting:false})
  const dir=await archiveDirectory(t,'success-archive'),file=await saveRawSourceCapture(jobs,{source:'hyperscience',dryRun:true,directory:dir}),saved=JSON.parse(await fsp.readFile(file,'utf8'))
  assert.deepEqual(saved.nativeCollectionEvidence,audit);assert.equal(saved.jobCount,0);assert.deepEqual(saved.jobs,[])
  evidence('complete-N4',{audit,terminal,observation,archive:file})
})

test('registered Hyperscience preserves a positive primary India result with no native reads',async t=>{
  forbidNetwork(t)
  const r=replay({changePrimary:value=>{const job=value.jobs[0];job.location='Bengaluru, India';job.address.postalAddress.addressCountry='India';job.address.postalAddress.addressLocality='Bengaluru';job.address.postalAddress.addressRegion='Karnataka';job.secondaryLocations=[];value.jobs=[job];return value}})
  const jobs=await registered().run(r.options)
  assert.equal(jobs.length,1);assert.equal(jobs[0].source,'hyperscience');assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(r.nativeCalls.length,0)
})

test('registered Hyperscience preserves the exact original primary Error and does not fall back',async t=>{
  forbidNetwork(t)
  const error=Object.assign(Error('Controlled original primary rejection'),{abortRetries:true}),r=replay({primaryError:error})
  await assert.rejects(registered().run(r.options),held=>held===error);assert.equal(r.nativeCalls.length,0)
})

test('preaborted registered Hyperscience preserves the reason without any request',async t=>{
  forbidNetwork(t)
  const r=replay(),parent=new AbortController(),reason=Error('Controlled registered preabort');parent.abort(reason)
  await assert.rejects(registered().run({...r.options,signal:parent.signal}),held=>held===reason)
  assert.equal(r.primaryCalls.length,0);assert.equal(r.nativeCalls.length,0)
})

test('registered native prefix abort retains actual acquired headers and128 bytes',async t=>{
  forbidNetwork(t)
  const parent=new AbortController(),reason=Error('Controlled registered prefix parent abort'),prefix=Buffer.alloc(128,65)
  let reads=0,cancels=0,releases=0,held,released=false
  const reader={read(){reads++;if(reads===1){parent.abort(reason);return Promise.resolve({done:false,value:prefix})}return new Promise(()=>{})},cancel(){cancels++;return new Promise(()=>{})},releaseLock(){releases++}}
  const r=replay({data:dataset(1),nativeFetch:(url)=>({url,status:200,headers:new Headers(original('C0').receipt.headers),body:{getReader:()=>reader,cancel(){cancels++;return new Promise(()=>{})}}})})
  try{await registered().run({...r.options,signal:parent.signal});released=true}catch(error){held=error}
  const directory=await archiveDirectory(t,'registered-prefix-archive')
  const file=await saveRawSourceFailure(held,{source:'hyperscience',dryRun:true,directory})
  const saved=JSON.parse(await fsp.readFile(file,'utf8'))
  const own=Object.getOwnPropertyDescriptor(held,'nativeCollectionEvidence')
  evidence('registered-prefix',{released,reads,cancels,releases,nativeCalls:r.nativeCalls.map(({signal,...row})=>row),ownAuditPresent:!!own,archive:file,saved})
  assert.equal(released,false);assert.equal(reads,1);assert.equal(cancels,1);assert.equal(releases,1)
  assert.ok(Object.hasOwn(saved,'nativeCollectionEvidence'),'The actual registered outer abort must retain the native acquired prefix audit')
  const raw=saved.nativeCollectionEvidence.rawPages[0]
  assert.equal(raw.bodyBase64,prefix.toString('base64'));assert.equal(raw.bodyBytes,128);assert.equal(raw.consumedBodyBytes,128)
  assert.equal(raw.bodyComplete,false);assert.deepEqual(raw.receipt.headers,Object.fromEntries(new Headers(original('C0').receipt.headers)))
  assert.equal(saved.nativeCollectionEvidence.currentTransactionQualified,false);assert.equal(saved.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false)
  assert.equal(Object.hasOwn(saved,'jobs'),false)
})
