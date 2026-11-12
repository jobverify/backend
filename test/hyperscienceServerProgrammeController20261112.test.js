import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {gunzipSync,gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentHyperscienceProgramme,runCurrentHyperscienceProgramme} from '../scraper/hyperscience/currentProgramme.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'

// Original separately acquired components are delivered through explicitly
// controlled complete metadata and simulated closings. No publisher read or
// genuine current interval is established by this test fixture.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/hyperscience-server-programme-components-20261111.json.gz',import.meta.url))))
const hash=b=>createHash('sha256').update(b).digest('hex')
const original=kind=>{const row=fixture.responses.find(r=>r.kind===kind);assert.ok(row);const body=Buffer.from(row.bodyBase64,'base64');assert.equal(hash(body),row.receipt.bodySHA256);return{body,receipt:structuredClone(row.receipt)}}
const C0=original('C0').receipt.requestedURL,C1=original('C1').receipt.requestedURL,A=original('A').receipt.requestedURL,H=original('H').receipt.requestedURL
const M=original('M').receipt.requestedURL,S=original('S').receipt.requestedURL,Q=original('Q-first').receipt.requestedURL
const request=Buffer.from(fixture.request.bodyBase64,'base64')
const payload=JSON.parse(original('A').body)
function setBody(row,body){row.body=Buffer.from(body);row.receipt.bodyBytes=row.body.length;row.receipt.bodySHA256=hash(row.body);row.receipt.consumedBodyBytes=row.body.length}
function dataset({N=4,reverseApi=false}={}){
  const byURL=new Map(fixture.responses.filter(r=>!r.kind.startsWith('Q')).map(r=>[r.receipt.requestedURL,original(r.kind)]))
  const api=structuredClone(payload)
  let html=byURL.get(C1).body.toString()
  if(N<4){for(const job of api.jobs.slice(N)){const card=new RegExp('<a href="https://jobs\\.ashbyhq\\.com/hyperscience/'+job.id+'"[\\s\\S]*?</a>');assert.match(html,card);html=html.replace(card,'')};api.jobs=api.jobs.slice(0,N)}
  for(let i=4;i<N;i++){
    const source=payload.jobs[(i-4)%4],id='00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')
    const job=JSON.parse(JSON.stringify(source).replaceAll(source.id,id));api.jobs.push(job)
    const card=new RegExp('<a href="https://jobs\\.ashbyhq\\.com/hyperscience/'+source.id+'"[\\s\\S]*?</a>').exec(html)[0]
    html=html.replace(card,card+card.replaceAll(source.id,id))
    const row=original('O-'+source.id.slice(0,8));setBody(row,row.body.toString().replaceAll(source.id,id));row.receipt.requestedURL=job.jobUrl;row.receipt.finalURL=job.jobUrl;byURL.set(job.jobUrl,row)
  }
  if(reverseApi)api.jobs.reverse()
  if(N!==4||reverseApi)setBody(byURL.get(A),JSON.stringify(api))
  if(N!==4)setBody(byURL.get(C1),html)
  const own=api.jobs.map(j=>j.jobUrl)
  const plan=[...[C0,C1,A,...own,H,M,S,Q].map(url=>({url,phase:'opening'})),...[...own.toReversed(),Q,S,M,H,A,C1,C0].map(url=>({url,phase:'closing'}))]
  const totalBytes=plan.reduce((sum,p)=>sum+(p.url===Q?original(p.phase==='opening'?'Q-first':'Q-repeat'):byURL.get(p.url)).body.length,0)
  return{byURL,payload:api,plan,totalBytes}
}
function controlledPacket(data,step){
  const originalRow=step.url===Q?original(step.phase==='opening'?'Q-first':'Q-repeat'):data.byURL.get(step.url)
  const row={body:Buffer.from(originalRow.body),receipt:structuredClone(originalRow.receipt)}
  const at=new Date().toISOString()
  Object.assign(row.receipt,{headerEntries:Object.entries(row.receipt.headers),bodyComplete:true,streamDone:true,decodedPrefixOnly:false,error:null,
    requestedAt:at,responseAt:at,completedAt:at,consumedBodyBytes:row.body.length,discardedOverflowBytes:0,overflowBytes:0,
    evidenceKind:'controlled-delivery-of-historical-original-body'})
  return row
}
function rawReplay({data=dataset(),mutate=row=>row,beforeRead}={}){
  const calls=[]
  return{calls,data,readPage:async(url,init)=>{
    const step=data.plan[calls.length];assert.equal(url,step.url);calls.push({url,phase:step.phase,method:init.method,maxBodyBytes:init.maxBodyBytes})
    assert.equal(init.cache,'no-store');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
    if(url===Q){assert.equal(init.method,'POST');assert.deepEqual(Buffer.from(init.body),request)}else assert.equal(init.method,'GET')
    beforeRead?.(step,calls.length,init)
    return mutate(controlledPacket(data,step),{...step,index:calls.length,init})
  }}
}
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Controller tests forbid publisher HTTP'))
function fetchReplay({data=dataset(),mutate=row=>row}={}){
  const calls=[]
  return{calls,data,fetchImpl:async(url,init)=>{
    const step=data.plan[calls.length];assert.equal(url,step.url);calls.push({url,method:init.method,body:init.body?Buffer.from(init.body):null})
    assert.equal(init.cache,'no-store');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
    if(url===Q){assert.equal(init.method,'POST');assert.deepEqual(Buffer.from(init.body),request);assert.deepEqual(init.headers,original('Q-first').receipt.requestHeaders)}
    const row=mutate(controlledPacket(data,step),{...step,index:calls.length})
    const response=new Response(row.body,{status:row.receipt.status,headers:row.receipt.headers})
    Object.defineProperty(response,'url',{value:row.receipt.finalURL});return response
  }}
}
function evidence(name,value){
  const dir=process.env.HYPERSCIENCE_CONTROLLER_EVIDENCE_DIR
  if(!dir)return
  const expected=path.resolve(new URL('../../reports/soft-failures-1000-2026-11-11/empty-native/hyperscience-task3-controller-20261112f/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))
  const relative=path.relative(expected,path.resolve(dir))
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));fs.mkdirSync(dir,{recursive:true})
  fs.writeFileSync(path.join(dir,name+'.json.gz'),gzipSync(Buffer.from(JSON.stringify({controlledHistoricalReplayOnly:true,currentPublisherEvidence:false,audit:value}))),{flag:'wx'})
}
function checkedAudit(jobs,data){
  const audit=jobs.nativeCollectionEvidence,N=data.payload.jobs.length
  assert.deepEqual(audit.nativePayload,data.payload)
  assert.equal(audit.nativeRecords.length,N);assert.equal(audit.nonVacancyRecords.length,1)
  assert.equal(audit.observedRecordCount,N+1);assert.equal(audit.observedVacancyCount,N)
  assert.equal(audit.nonVacancyRecords[0].workCountry,null);assert.equal(audit.nonVacancyRecords[0].applicantCountry,null)
  assert.equal(audit.nonVacancyRecords[0].comparison.opening.model.data.sourcingForm.sourcingFormRender.sections[0].fieldEntries.length,10)
  assert.equal(audit.rawPages.length,14+2*N);assert.equal(audit.rawPages.filter(r=>r.kind==='Q').length,2)
  assert.equal(audit.QrawEntityEqual,false);assert.equal(audit.QserverDefinitionCriteriaEqual,true);assert.equal(audit.allWholeBodiesEqual,false)
  assert.equal(audit.currentTransactionQualified,true);assert.equal(audit.allChannelsClosed,true)
  assert.equal(audit.reportedTotal,null);assert.equal(audit.totalPublicRequests,null)
  assert.equal(audit.allOpeningReadsBeforeClosing,true)
  for(const field of ['sourceScopeComplete','companyGlobalScopeQualified','applicantEligibilityQualified','legalEmployerQualified','rendererConsumptionQualified','UIOrApplicationEquivalent','lifecycleCleanupAllowed','sourceTimeSemanticsQualified'])assert.equal(audit[field],false,field)
  assert.equal(readInventoryEvidence(jobs).status,'complete-inventory');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.deepEqual(readSourceObservationEvidence(jobs,'hyperscience'),{...readSourceObservationEvidence(jobs,'hyperscience'),recordKind:'mixed',observedRecordCount:N+1,observedVacancyCount:N})
  assert.deepEqual(JSON.parse(JSON.stringify(audit)),audit)
  const byOpening=new Map(audit.rawPages.filter(r=>r.phase==='opening').map(r=>[r.requestedURL,r]))
  for(const row of audit.rawPages.filter(r=>r.phase==='closing'))assert.equal(row.maximumBodyBytes,byOpening.get(row.requestedURL).bodyBytes)
  for(const row of audit.rawPages){assert.equal(row.bodySHA256,hash(Buffer.from(row.bodyBase64,'base64')));assert.equal(row.receipt.consumedBodyBytes,row.bodyBytes);assert.equal(row.receipt.discardedOverflowBytes,0);assert.equal(row.receipt.overflowBytes,0)}
  return audit
}
async function rejection(operation,gate){
  let held;try{await operation();assert.fail('Controller must not release zero')}catch(error){held=error}
  assert.ok(held.nativeCollectionEvidence,'Held evidence is own and complete')
  assert.equal(held.nativeCollectionEvidence.currentTransactionQualified,false)
  assert.equal(held.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false)
  if(gate)assert.equal(held.gate,gate)
  return held
}

test('complete controlled native programme requires all22 reads and both actual Q responses',async t=>{
  forbidNetwork(t)
  const replay=rawReplay();let jobs,held,observed=0
  try{jobs=await readCurrentHyperscienceProgramme({readPage:replay.readPage,onAudit:audit=>{observed++;audit.rawPages.length=0;audit.nativePayload.jobs.length=0}})}catch(error){held=error}
  if(held)t.diagnostic(JSON.stringify({code:held.code,gate:held.gate,reads:replay.calls.length,firstOriginalBodySHA256:original('C0').receipt.bodySHA256}))
  assert.equal(replay.calls.length,22,'One corporate entry is not the complete closed server programme')
  assert.equal(held,undefined)
  assert.equal(jobs.length,0)
  assert.deepEqual(replay.calls.map(r=>r.url),replay.data.plan.map(r=>r.url))
  assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
  assert.equal(readSourceObservationEvidence(jobs,'hyperscience').observedVacancyCount,4)
  const audit=checkedAudit(jobs,replay.data);assert.equal(observed,1);assert.equal(Object.isFrozen(audit),true)
  assert.equal(audit.bounds.entity,6291456);assert.ok(audit.rawPages.find(r=>r.kind==='S').bodyBytes>4194304)
  assert.ok(audit.byteReserveLedger[3].pendingOpeningKinds.includes('S'));assert.ok(audit.byteReserveLedger[3].pendingOpeningKinds.includes('Q'))
  const provider={source:'hyperscience'},terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
  assert.equal(terminal.rawRecords,4);assert.equal(terminal.processingComplete,true);assert.equal(terminal.zeroJobEvidence,'fetched-zero')
  assert.deepEqual(inventoryCleanupOptions(terminal),{replaceExisting:false})
  evidence('complete-N4',audit)
})

test('controlled N1 real Fetch path fits the exact aggregate and retains ordinary header variation',async t=>{
  forbidNetwork(t)
  const data=dataset({N:1}),replay=fetchReplay({data,mutate:(row,step)=>{if(step.phase==='closing'&&step.url!==Q)row.receipt.headers.date='Wed, 11 Nov 2026 01:00:00 GMT';return row}})
  const jobs=await runCurrentHyperscienceProgramme({fetchImpl:replay.fetchImpl,requestIntervalMs:0,maxAggregateBytes:data.totalBytes})
  const audit=checkedAudit(jobs,data);assert.equal(audit.nativeProgrammeRequests,16);assert.equal(audit.aggregateBytes,data.totalBytes)
  assert.ok(audit.openingClosingEquality.some(r=>r.rawHeaderViewsEqual===false));assert.equal(audit.allChannelSecurityEqual,true)
})

test('controlled N6 with independent corporate/API order returns full models without a subset',async t=>{
  forbidNetwork(t)
  const data=dataset({N:6,reverseApi:true}),replay=rawReplay({data})
  const jobs=await readCurrentHyperscienceProgramme({readPage:replay.readPage}),audit=checkedAudit(jobs,data)
  assert.equal(audit.nativeProgrammeRequests,26);assert.deepEqual(audit.nativeRecords.map(r=>r.id),data.payload.jobs.map(r=>r.id))
  assert.notDeepEqual(audit.pureOpeningResult.originalCorporate.independentCorporateOrder,data.payload.jobs.map(r=>r.jobUrl))
})

for(const [label,mutate,gate,calls]of [
  ['complete C0 context',(r,s)=>{if(s.url===C0&&s.phase==='opening')setBody(r,r.body.toString().replace('Careers at Hyperscience','Hireers at Hyperscience'));return r},'corporate-programme',1],
  ['new visible C1 vacancy',(r,s)=>{if(s.url===C1&&s.phase==='opening')setBody(r,Buffer.concat([r.body,Buffer.from('<p>Current India vacancy: Engineer.</p>')]));return r},'corporate-programme',2],
  ['numeric apiVersion',(r,s)=>{if(s.url===A&&s.phase==='opening'){const a=JSON.parse(r.body);a.apiVersion=1;setBody(r,JSON.stringify(a))}return r},'api',3],
  ['empty full A',(r,s)=>{if(s.url===A&&s.phase==='opening'){const a=JSON.parse(r.body);a.jobs=[];setBody(r,JSON.stringify(a))}return r},'membership',3],
  ['typed India work-country',(r,s)=>{if(s.url===A&&s.phase==='opening'){const a=JSON.parse(r.body);a.jobs[0].address.postalAddress.addressCountry='India';setBody(r,JSON.stringify(a))}return r},'country',3],
  ['unknown API header',(r,s)=>{if(s.url===A){r.receipt.headers.age='21';r.receipt.headerEntries=Object.entries(r.receipt.headers)}return r},'security',3],
  ['actual selected S integrity',(r,s)=>{if(s.url===S&&s.phase==='opening')setBody(r,Buffer.concat([r.body,Buffer.from('\n')]));return r},'source-integrity',10],
  ['malformed opening Q',(r,s)=>{if(s.url===Q&&s.phase==='opening')setBody(r,Buffer.from('{}'));return r},null,11],
  ['closing Q consumption',(r,s)=>{if(s.url===Q&&s.phase==='closing')r.receipt.consumedBodyBytes--;return r},'transport',16],
  ['closing Q overflow alias',(r,s)=>{if(s.url===Q&&s.phase==='closing')r.receipt.overflowBytes=1;return r},'transport',16],
])test('initial/phase guard holds '+label+' at its actual channel',async t=>{
  forbidNetwork(t)
  const replay=rawReplay({mutate}),held=await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage}),gate)
  assert.equal(replay.calls.length,calls)
  if(label==='malformed opening Q')assert.equal(held.code,'HYPERSCIENCE_FORM_COMPARISON_HOLD')
})

test('manifest selection holds before any selected source or Q read',async t=>{
  forbidNetwork(t)
  const replay=rawReplay({mutate:(row,step)=>{if(step.url===M){const m=JSON.parse(row.body);m['index.html'].file='../foreign.js';setBody(row,JSON.stringify(m))}return row}})
  await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage}))
  assert.equal(replay.calls.length,9);assert.equal(replay.calls.some(c=>c.url===S||c.url===Q),false)
})

test('full salary consistency is rechecked after actual Qclose without a dummy Q',async t=>{
  forbidNetwork(t)
  const first=payload.jobs[0].jobUrl,replay=rawReplay({mutate:(row,step)=>{
    if(step.url===first){const html=row.body.toString(),match=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);assert.ok(match);const ld=JSON.parse(match[1]);ld.baseSalary.value.minValue++;setBody(row,html.replace(match[1],JSON.stringify(ld)))}return row
  }})
  await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage}),'salary')
  assert.equal(replay.calls.length,16);assert.equal(replay.calls.filter(c=>c.url===Q).length,2)
})

for(const [label,options,expectedKind]of [
  ['one-byte-short aggregate',data=>({maxAggregateBytes:data.totalBytes-1}),'Q'],
  ['pending S/Q byte pressure',data=>({maxAggregateBytes:data.totalBytes-2*8405}),'S'],
  ['downward4MiB source cap',()=>({maxResponseBytes:4194304}),'S'],
])test('complete reserves hold '+label+' without dropping a channel',async t=>{
  forbidNetwork(t)
  const data=dataset({N:1}),replay=rawReplay({data})
  const held=await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage,...options(data)}),'body')
  const raw=held.nativeCollectionEvidence.rawPages.at(-1)
  assert.equal(raw.kind,expectedKind);assert.equal(raw.phase,'opening');assert.ok(raw.discardedOverflowBytes>0)
  assert.equal(held.nativeCollectionEvidence.rawPages.some(r=>r.phase==='closing'),false)
  if(expectedKind==='S')assert.ok(held.nativeCollectionEvidence.byteReserveLedger.at(-1).pendingOpeningKinds.includes('Q'))
})

test('request capacity covers all roles and future H/M/S/Q before any own read',async t=>{
  forbidNetwork(t)
  const replay=rawReplay();await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage,maxRequests:21}),'bounds')
  assert.equal(replay.calls.length,3)
})

test('an extra closing source byte exceeds the exact opening allowance',async t=>{
  forbidNetwork(t)
  const replay=rawReplay({mutate:(row,s)=>{if(s.url===S&&s.phase==='closing')setBody(row,Buffer.concat([row.body,Buffer.from(' ')]));return row}})
  const held=await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage}),'body')
  const raw=held.nativeCollectionEvidence.rawPages.at(-1)
  assert.equal(raw.kind,'S');assert.equal(raw.phase,'closing');assert.equal(raw.discardedOverflowBytes,1)
  assert.equal(raw.maximumBodyBytes,original('S').body.length)
})

test('closing security requalifies independently before raw equality',async t=>{
  forbidNetwork(t)
  const replay=rawReplay({mutate:(row,s)=>{if(s.phase==='closing'&&s.url===payload.jobs.at(-1).jobUrl){row.receipt.headers['referrer-policy']='no-referrer';row.receipt.headerEntries=Object.entries(row.receipt.headers)}return row}})
  const held=await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage}),'security')
  assert.equal(replay.calls.length,12);assert.equal(held.nativeCollectionEvidence.rawPages.at(-1).bodyBase64,original('O-'+payload.jobs.at(-1).id.slice(0,8)).body.toString('base64'))
})

test('missing actual historical entry views cannot become a current controller success',async t=>{
  forbidNetwork(t)
  const replay=rawReplay({mutate:(row,s)=>{if(s.url===C0)delete row.receipt.headerEntries;return row}})
  const held=await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage}),'transport')
  assert.equal(replay.calls.length,1);assert.equal(Object.hasOwn(held.nativeCollectionEvidence.rawPages[0].receipt,'headerEntries'),false)
  assert.equal(fixture.responses.filter(r=>!Object.hasOwn(r.receipt,'headerEntries')).length,5)
})

test('option accessor and Proxy carriers execute no caller hooks',async t=>{
  forbidNetwork(t);let callbacks=0
  const option={};Object.defineProperty(option,'readPage',{get(){callbacks++;throw Error('getter')}})
  await assert.rejects(readCurrentHyperscienceProgramme(option),e=>e.gate==='options')
  const proxy=new Proxy({},{get(){callbacks++;throw Error('get')},getPrototypeOf(){callbacks++;throw Error('proto')},ownKeys(){callbacks++;throw Error('keys')}})
  await assert.rejects(runCurrentHyperscienceProgramme(proxy),e=>e.gate==='options');assert.equal(callbacks,0)
})

test('raw receipt accessor and body conversion hooks execute zero callbacks',async t=>{
  forbidNetwork(t);let callbacks=0
  const replay=rawReplay({mutate:row=>{Object.defineProperty(row.receipt,'headers',{get(){callbacks++;throw Error('headers')}});return row}})
  await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage}),'ownership');assert.equal(callbacks,0)
  const bodyReplay=rawReplay({mutate:row=>{row.body.valueOf=()=>{callbacks++;return Buffer.from('replacement')};return row}})
  await rejection(()=>readCurrentHyperscienceProgramme({readPage:bodyReplay.readPage}),'ownership');assert.equal(callbacks,0)
})

test('unsafe native Promise hooks are rejected before caller invocation',async t=>{
  forbidNetwork(t)
  for(const property of ['then','constructor']){
    let callbacks=0
    const pending=Promise.resolve(controlledPacket(dataset(),{url:C0,phase:'opening'}))
    Object.defineProperty(pending,property,{get(){callbacks++;throw Error('Caller Promise '+property+' hook')}})
    const held=await rejection(()=>readCurrentHyperscienceProgramme({readPage:()=>pending}))
    t.diagnostic(JSON.stringify({property,callbacks,gate:held.gate??null}))
    assert.equal(callbacks,0);assert.equal(held.gate,'ownership')
  }
})

test('pre-abort starts no native attempt',async t=>{
  forbidNetwork(t);const parent=new AbortController(),reason=Error('Controlled preabort'),replay=rawReplay();parent.abort(reason)
  await assert.rejects(readCurrentHyperscienceProgramme({readPage:replay.readPage,signal:parent.signal}),e=>e===reason);assert.equal(replay.calls.length,0)
})

test('never raw reads obey request and outer source deadlines',async t=>{
  forbidNetwork(t)
  for(const options of [{requestTimeoutMs:20,sourceTimeoutMs:1000},{requestTimeoutMs:1000,sourceTimeoutMs:20}]){
    const held=await rejection(()=>readCurrentHyperscienceProgramme({...options,readPage:()=>new Promise(()=>{})}))
    assert.equal(held.name,'TimeoutError');assert.equal(held.nativeCollectionEvidence.rawPages.length,1)
    assert.equal(Object.hasOwn(held.nativeCollectionEvidence.rawPages[0],'receipt'),false)
  }
})

function streamingFetch({parent,prefix=Buffer.from('known-prefix'),endless=true,late,abortAtHeaders=false}={}){
  let cancels=0,releases=0,reads=0,bodyCancels=0
  const headers=new Headers(original('C0').receipt.headers)
  const reader={read(){reads++;if(reads===1){if(parent&&!abortAtHeaders)parent.abort(Error('Controlled prefix parent abort'));return Promise.resolve({done:false,value:prefix})}if(late)return new Promise(resolve=>{late.resolve=resolve});return endless?new Promise(()=>{}):Promise.resolve({done:true})},cancel(){cancels++;return new Promise(()=>{})},releaseLock(){releases++}}
  const fetchImpl=()=>{const response={url:C0,status:200,headers,body:{getReader:()=>reader,cancel(){bodyCancels++;return new Promise(()=>{})}}};if(parent&&abortAtHeaders)parent.abort(Error('Controlled header parent abort'));return Promise.resolve(response)}
  return{fetchImpl,get facts(){return{cancels,releases,reads,bodyCancels}}}
}
for(const [label,mode]of [['parent','parent'],['request','request'],['source','source']])test('production Fetch retains genuine header/prefix before '+label+' abort and owns cancellation',async t=>{
  forbidNetwork(t)
  const parent=mode==='parent'?new AbortController():null,prefix=Buffer.alloc(128,65),transport=streamingFetch({parent,prefix})
  const held=await rejection(()=>runCurrentHyperscienceProgramme({fetchImpl:transport.fetchImpl,requestIntervalMs:0,...(parent?{signal:parent.signal}:{}),requestTimeoutMs:mode==='request'?20:1000,sourceTimeoutMs:mode==='source'?20:1000}))
  const raw=held.nativeCollectionEvidence.rawPages[0]
  assert.equal(raw.receipt.status,200);assert.equal(raw.receipt.finalURL,C0);assert.deepEqual(raw.receipt.headerEntries,[...new Headers(original('C0').receipt.headers)])
  assert.equal(raw.bodyBase64,prefix.toString('base64'));assert.equal(raw.bodyComplete,false);assert.equal(raw.consumedBodyBytes,128)
  assert.equal(transport.facts.cancels,1);assert.equal(transport.facts.releases,1)
  if(mode==='parent')evidence('held-prefix-parent',held.nativeCollectionEvidence)
})

test('Fetch header-only acquisition survives a parent abort in the response callback',async t=>{
  forbidNetwork(t)
  const parent=new AbortController(),transport=streamingFetch({parent,abortAtHeaders:true})
  const held=await rejection(()=>runCurrentHyperscienceProgramme({fetchImpl:transport.fetchImpl,requestIntervalMs:0,signal:parent.signal}))
  const raw=held.nativeCollectionEvidence.rawPages[0];assert.equal(raw.receipt.status,200);assert.equal(raw.bodyBytes,0);assert.equal(raw.bodyComplete,false)
  assert.equal(transport.facts.cancels,0,'No reader exists in this header-only case')
  assert.equal(transport.facts.bodyCancels,1,'The acquired unconsumed body is canceled exactly once')
})

test('late read completion cannot mutate the frozen held prefix audit',async t=>{
  forbidNetwork(t)
  const late={},prefix=Buffer.from('observed-prefix'),transport=streamingFetch({prefix,late})
  const held=await rejection(()=>runCurrentHyperscienceProgramme({fetchImpl:transport.fetchImpl,requestIntervalMs:0,requestTimeoutMs:20,sourceTimeoutMs:1000}))
  const before=JSON.stringify(held.nativeCollectionEvidence);late.resolve({done:false,value:Buffer.from('late-data')})
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(JSON.stringify(held.nativeCollectionEvidence),before);assert.equal(transport.facts.cancels,1);assert.equal(transport.facts.releases,1)
})

test('a Proxy observer rejection retains all actual protocol evidence without cause hooks',async t=>{
  forbidNetwork(t)
  const replay=rawReplay({data:dataset({N:1})});let callbacks=0
  const reason=new Proxy({},{get(){callbacks++;throw Error('get')},getPrototypeOf(){callbacks++;throw Error('proto')},ownKeys(){callbacks++;throw Error('keys')},getOwnPropertyDescriptor(){callbacks++;throw Error('descriptor')}})
  const held=await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage,onAudit:()=>{throw reason}}))
  assert.equal(callbacks,0);assert.equal(Object.hasOwn(held,'cause'),false);assert.equal(held.nativeCollectionEvidence.rawPages.length,16)
  evidence('held-proxy-observer',held.nativeCollectionEvidence)
})

test('never audit observer is aborted without releasing zero or losing full models',async t=>{
  forbidNetwork(t)
  const parent=new AbortController(),replay=rawReplay({data:dataset({N:1})}),reason=Error('Controlled audit abort');let seen=0
  const held=await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage,signal:parent.signal,onAudit:()=>{seen++;parent.abort(reason);return new Promise(()=>{})}}))
  assert.equal(held,reason);assert.equal(seen,1);assert.equal(held.nativeCollectionEvidence.rawPages.length,16);assert.equal(held.nativeCollectionEvidence.nativeRecords.length,1)
})

test('monotonic checks catch immediate request and observer CPU-time overruns',async t=>{
  forbidNetwork(t)
  const realNow=performance.now.bind(performance);let offset=0;t.mock.method(performance,'now',()=>realNow()+offset)
  const early=rawReplay({beforeRead:()=>{offset+=1001}})
  const first=await rejection(()=>readCurrentHyperscienceProgramme({readPage:early.readPage,sourceTimeoutMs:120000,requestTimeoutMs:1000}))
  assert.equal(first.name,'TimeoutError');assert.equal(first.nativeCollectionEvidence.rawPages[0].bodyComplete,true)
  offset=0;const replay=rawReplay({data:dataset({N:1})});let seen=0
  const final=await rejection(()=>readCurrentHyperscienceProgramme({readPage:replay.readPage,sourceTimeoutMs:120000,onAudit:()=>{seen++;offset+=120001}}))
  assert.equal(final.name,'TimeoutError');assert.equal(seen,1);assert.equal(final.nativeCollectionEvidence.rawPages.length,16)
})
