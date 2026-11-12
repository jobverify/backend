import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {saveRawSourceCapture,saveRawSourceFailure} from '../scraper-support/utils/rawCapture.js'
import {readCurrentFrontProgramme,runCurrentFrontProgramme} from '../scraper/front/currentProgramme.js'

globalThis.fetch=()=>{throw Error('Front controller tests forbid public HTTP')}
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/front-current-programme-openings-20261111.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const C='https://front.com/jobs',F=C+'/feed',A='https://api.ashbyhq.com/posting-api/job-board/frontcareers'
const originalRows=()=>structuredClone(fixture.responses.filter(row=>row.kind!=='native-board'))
const rowOf=(rows,kind)=>rows.find(row=>row.kind===kind)
const bodyOf=row=>Buffer.from(row.bodyBase64,'base64')
const ownOrder=rows=>JSON.parse(bodyOf(rowOf(rows,'corporate-feed')).toString('utf8')).flatMap(group=>group.jobs.map(job=>job.link))
const setBody=(row,text)=>{const body=Buffer.from(text);row.bodyBase64=body.toString('base64');row.bodyBytes=body.length;row.bodySHA256=sha(body)}
function changeJSON(row,change){const value=JSON.parse(bodyOf(row).toString('utf8'));change(value);setBody(row,JSON.stringify(value))}
function changeNext(row,change){
  const html=bodyOf(row).toString('utf8'),script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(match=>match[0].includes('id="__NEXT_DATA__"'))
  assert.ok(script);const value=JSON.parse(script[1]);change(value);setBody(row,html.replace(script[1],JSON.stringify(value)))
}
function removeRole(rows,id){
  const url='https://jobs.ashbyhq.com/frontcareers/'+id,corporate=rowOf(rows,'corporate')
  changeNext(corporate,value=>{for(const group of value.props.pageProps.jobs)group.jobs=group.jobs.filter(job=>job.key!==id)})
  const html=bodyOf(corporate).toString('utf8'),at=html.indexOf('href="'+url+'"'),start=html.lastIndexOf('<li',at),end=html.indexOf('</li>',at)+5
  assert.ok(at>=0&&start>=0&&end>at);setBody(corporate,html.slice(0,start)+html.slice(end))
  changeJSON(rowOf(rows,'corporate-feed'),groups=>{for(const group of groups)group.jobs=group.jobs.filter(job=>job.key!==id)})
  changeJSON(rowOf(rows,'native-api'),value=>{value.jobs=value.jobs.filter(job=>job.id!==id)})
  rows.splice(rows.findIndex(row=>row.requestedURL===url),1)
}
function sixRoles(){
  const rows=originalRows(),id='91e4b4ad-9ce3-4bc7-896e-f36ff234eca1',url='https://jobs.ashbyhq.com/frontcareers/'+id
  const corporate=rowOf(rows,'corporate'),own=rows.find(row=>row.requestedURL===url),html=bodyOf(corporate).toString('utf8')
  const at=html.indexOf('href="'+url+'"'),start=html.lastIndexOf('<li',at),end=html.indexOf('</li>',at)+5,card=html.slice(start,end)
  assert.ok(at>=0&&start>=0&&end>at)
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']
  for(const next of ids){
    const clone=structuredClone(own);clone.kind='own-'+next.slice(0,8);clone.requestedURL=clone.finalURL=url.replace(id,next);setBody(clone,bodyOf(own).toString('utf8').replaceAll(id,next));rows.push(clone)
    changeNext(corporate,value=>{const group=value.props.pageProps.jobs.find(group=>group.jobs.some(job=>job.key===id)),job=structuredClone(group.jobs.find(job=>job.key===id));job.key=next;job.link=url.replace(id,next);group.jobs.push(job)})
    changeJSON(rowOf(rows,'corporate-feed'),groups=>{const group=groups.find(group=>group.jobs.some(job=>job.key===id)),job=structuredClone(group.jobs.find(job=>job.key===id));job.key=next;job.link=url.replace(id,next);group.jobs.push(job)})
    changeJSON(rowOf(rows,'native-api'),value=>{const job=structuredClone(value.jobs.find(job=>job.id===id));job.id=next;job.jobUrl=job.jobUrl.replace(id,next);job.applyUrl=job.applyUrl.replace(id,next);value.jobs.push(job)})
  }
  const changed=bodyOf(corporate).toString('utf8'),position=changed.indexOf(card)+card.length
  assert.ok(position>=card.length);setBody(corporate,changed.slice(0,position)+ids.map(next=>card.replaceAll(id,next)).join('')+changed.slice(position))
  return rows
}
function replay(rows=originalRows(),change=page=>page){
  const calls=[],byURL=new Map(rows.map(row=>[row.requestedURL,row]))
  return{calls,readPage:async(url,init={})=>{
    const row=byURL.get(url);assert.ok(row,'No unacquired route is allowed: '+url)
    const occurrence=calls.filter(call=>call.url===url).length
    calls.push({url,occurrence,init})
    // Historical maps lack headerEntries. This second view is derived ONLY for
    // a controlled unit replay. Both closing responses and these views are
    // controlled; this fixture contains no genuine complete current interval.
    const page={requestedURL:url,finalURL:row.finalURL,status:row.status,headers:structuredClone(row.headers),
      headerEntries:Object.entries(row.headers),body:bodyOf(row),bodyComplete:true}
    return change(page,{url,occurrence,index:calls.length-1,calls,row})
  }}
}
const header=(page,name,value)=>{if(value===undefined)delete page.headers[name];else page.headers[name]=value;page.headerEntries=Object.entries(page.headers);return page}
async function held(r,options={}){
  let caught
  try{await readCurrentFrontProgramme({readPage:r.readPage,...options})}catch(error){caught=error}
  assert.ok(caught,'Unqualified source must hold rather than release zero')
  assert.equal(caught.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false)
  assert.equal(caught.nativeCollectionEvidence.archiveNativeCollectionEvidence,true)
  return caught
}
function fetchReplay(r){return async(url,init)=>{const page=await r.readPage(url,init),response=new Response(page.body,{status:page.status,headers:page.headers});Object.defineProperty(response,'url',{value:page.finalURL});return response}}

test('complete server controller reconciles all seven original entities and fourteen controlled phases',async()=>{
  const rows=originalRows(),r=replay(rows),jobs=await readCurrentFrontProgramme({readPage:r.readPage})
  assert.equal(readInventoryEvidence(jobs)?.status,'complete-inventory','The real legacy discovery-only zero lacks the finite server controller')
  assert.equal(jobs.length,0)
  assert.deepEqual(r.calls.map(call=>call.url),[C,F,A,...ownOrder(rows),...ownOrder(rows),A,F,C])
  const audit=jobs.nativeCollectionEvidence,payload=JSON.parse(bodyOf(rowOf(rows,'native-api')).toString('utf8'))
  assert.deepEqual(audit.nativePayload,payload)
  assert.equal(audit.requests,14);assert.equal(audit.nativeProgrammeRequests,14)
  assert.equal(audit.nativeRecords.length,4)
  assert.deepEqual(audit.nativeRecords.map(record=>record.id),payload.jobs.map(record=>record.id))
  assert.deepEqual(audit.nativeRecords.map(record=>record.country),['Chile','United States','United States','United States'])
  const observation=readSourceObservationEvidence(jobs,'front')
  assert.equal(observation.recordKind,'vacancy-rows');assert.equal(observation.observedRecordCount,4);assert.equal(observation.observedVacancyCount,4)
  assert.equal(audit.archiveNativeCollectionEvidence,true)
  assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
  for(const page of audit.rawPages){assert.equal(page.bodyComplete,true);assert.equal(sha(Buffer.from(page.bodyBase64,'base64')),page.bodySHA256)}
  assert.equal(audit.currentTransactionQualified,true);assert.equal(audit.rawPages.length,14)
  assert.equal(audit.sourceBodiesQualified,false);assert.equal(audit.rendererConsumptionQualified,false);assert.equal(audit.boardAcquired,false);assert.equal(audit.fullRenderedCriteriaQualified,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('controlled six-role expansion is fully acquired in eighteen reads without a frozen count',async()=>{
  const rows=sixRoles(),r=replay(rows),jobs=await readCurrentFrontProgramme({readPage:r.readPage})
  assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,6);assert.equal(r.calls.length,18)
  assert.deepEqual(r.calls.map(call=>call.url),[C,F,A,...ownOrder(rows),...ownOrder(rows),A,F,C])
})
test('controlled one-role source uses its complete eight-read programme',async()=>{
  const rows=originalRows();for(const id of ['22e1f989-12d6-4c59-86a7-77335831e313','625c97e4-2f4f-4109-82c2-4c5fa6ac837b','cbcfb59d-506f-426d-8446-c13cfba928ac'])removeRole(rows,id)
  const r=replay(rows),jobs=await readCurrentFrontProgramme({readPage:r.readPage,maxRequests:8});assert.equal(r.calls.length,8);assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,1)
})
test('API order remains independent from corporate acquisition order',async()=>{
  const rows=originalRows();changeJSON(rowOf(rows,'native-api'),value=>value.jobs.reverse())
  const r=replay(rows),jobs=await readCurrentFrontProgramme({readPage:r.readPage})
  assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,JSON.parse(bodyOf(rowOf(rows,'native-api')).toString('utf8')))
  assert.deepEqual(r.calls.slice(3,7).map(call=>call.url),ownOrder(rows))
})
test('later selected role acquisition precedes every own closing and cannot leave stale first criteria',async()=>{
  let acquiredLater=false,observer=0
  const r=replay(originalRows(),(page,context)=>{
    if(context.index===6)acquiredLater=true
    if(context.index===7){assert.equal(acquiredLater,true);page.body=Buffer.concat([page.body,Buffer.from('<!--changed-after-later-role-->')])}
    return page
  })
  const error=await held(r,{onAudit:()=>{observer++}})
  assert.equal(r.calls.length,8);assert.equal(observer,0);assert.equal(error.nativeCollectionEvidence.rawPages[7].bodyComplete,true)
})
for(const target of [C,F,A])test('whole '+target+' closing bytes cannot drift',async()=>{
  let observer=0;const r=replay(originalRows(),(page,{url,occurrence})=>{if(url===target&&occurrence===1)page.body=Buffer.concat([page.body,Buffer.from(' ') ]);return page})
  await held(r,{onAudit:()=>{observer++}});assert.equal(observer,0)
})
test('a parsed-only or missing own page cannot be silently omitted',async()=>{
  const r=replay(originalRows(),(page,{index})=>{if(index===3){delete page.body;page.json={}}return page})
  await held(r);assert.equal(r.calls.length,4)
})
for(const key of ['requestedURL','finalURL','status','headerEntries','bodyComplete'])test('original '+key+' provenance is mandatory',async()=>{
  const r=replay(originalRows(),page=>{delete page[key];return page});await held(r);assert.equal(r.calls.length,1)
})
test('redirected own/account identity cannot be substituted',async()=>{
  const r=replay(originalRows(),page=>{page.finalURL='https://example.com/foreign';return page});await held(r);assert.equal(r.calls.length,1)
})
test('transport metadata accessors are rejected without invocation',async()=>{
  let getters=0;const r=replay(originalRows(),page=>{Object.defineProperty(page,'headers',{get(){getters++;return{}}});return page})
  await held(r);assert.equal(getters,0)
})
test('typed entity snapshots ignore overridden valueOf and preserve exact bytes',async()=>{
  let invoked=0;const r=replay(originalRows(),page=>{page.body.valueOf=()=>{invoked++;return Buffer.from('truncated')};return page})
  const jobs=await readCurrentFrontProgramme({readPage:r.readPage});assert.equal(invoked,0)
  assert.equal(jobs.nativeCollectionEvidence.rawPages[0].bodySHA256,rowOf(originalRows(),'corporate').bodySHA256)
})
test('proxy entity carriers hold without their traps',async()=>{
  let traps=0;const r=replay(originalRows(),page=>{page.body=new Proxy(page.body,{get(){traps++;throw Error('trap')}});return page})
  await held(r);assert.equal(traps,0)
})
test('duplicate/incoherent original header entries hold',async()=>{
  const r=replay(originalRows(),page=>{page.headerEntries.push(['content-type',page.headers['content-type']]);return page});await held(r)
})
for(const value of ['text/html; charset=utf-16le','text/html; charset=utf-8; charset=utf-8','text/plain','text/html; unsupported=yes'])test('unreviewed MIME or charset '+value+' holds',async()=>{
  const r=replay(originalRows(),page=>header(page,'content-type',value));await held(r);assert.equal(r.calls.length,1)
})
test('invalid UTF8 entity holds before carrier qualification',async()=>{
  const r=replay(originalRows(),page=>{page.body=Buffer.from([0xc0,0xaf]);return page});await held(r)
})
for(const name of ['refresh','location','content-location','www-authenticate','cf-mitigated','cf-chl-out','cf-chl-bypass','x-captcha','x-captcha-required','x-challenge','permissions-policy','document-policy'])test('new '+name+' header is a hold even consistently in both phases',async()=>{
  const r=replay(originalRows(),page=>header(page,name,name==='cf-mitigated'?'challenge':'unreviewed'));await held(r);assert.equal(r.calls.length,1)
})
test('corporate exact inline disposition is not a general attachment exception',async()=>{
  const r=replay(originalRows(),page=>header(page,'content-disposition','attachment'));await held(r)
})
test('the corporate disposition exception never applies to feed or own roles',async()=>{
  const r=replay(originalRows(),(page,{url})=>url===F?header(page,'content-disposition','inline'):page);await held(r);assert.equal(r.calls.length,2)
})
test('foreign CORS policy cannot consistently replace the original profile',async()=>{
  const r=replay(originalRows(),page=>header(page,'access-control-allow-origin','https://foreign.example'));await held(r)
})
test('native script-disabled CSP cannot qualify unchanged boot data',async()=>{
  const r=replay(originalRows(),(page,{index})=>index===3?header(page,'content-security-policy',"script-src 'none'"):page);await held(r);assert.equal(r.calls.length,4)
})
test('native same-channel closing policy cannot drift',async()=>{
  const r=replay(originalRows(),(page,{index})=>index===7?header(page,'referrer-policy','no-referrer'):page);await held(r);assert.equal(r.calls.length,8)
})
for(const status of [302,403,429,503])test('HTTP '+status+' stops the transaction without alternatives or zero',async()=>{
  const r=replay(originalRows(),page=>{page.status=status;return page}),error=await held(r)
  assert.equal(r.calls.length,1);assert.equal(error.nativeCollectionEvidence.rawPages[0].status,status)
  if([403,429].includes(status))assert.equal(error.failureKind,'blocked_or_access_denied')
})
test('all closing request capacity is reserved before role acquisition',async()=>{
  const r=replay();await held(r,{maxRequests:13});assert.ok(r.calls.length<4)
})
test('an impossible minimum request budget performs no reads',async()=>{
  const r=replay();await assert.rejects(readCurrentFrontProgramme({readPage:r.readPage,maxRequests:7}));assert.equal(r.calls.length,0)
})
test('new India/unknown full models hold instead of producing a subset',async()=>{
  const rows=originalRows();changeJSON(rowOf(rows,'native-api'),value=>{value.jobs[0].address.postalAddress.addressCountry='India'})
  const r=replay(rows);await held(r)
})
test('source monotonic one-ms bound holds even when CPU work starves the timer',async()=>{
  const r=replay(originalRows(),page=>{const until=performance.now()+6;while(performance.now()<until){}return page})
  const error=await held(r,{sourceTimeoutMs:1});assert.equal(error.name,'TimeoutError');assert.equal(r.calls.length,1)
})
test('pre-aborted source does not call transport',async()=>{
  const aborter=new AbortController();aborter.abort();const r=replay()
  await assert.rejects(readCurrentFrontProgramme({readPage:r.readPage,signal:aborter.signal}),error=>error.name==='AbortError');assert.equal(r.calls.length,0)
})
test('an uncooperative readPage cannot defeat request cancellation',async()=>{
  let calls=0;const error=await held({readPage:()=>{calls++;return new Promise(()=>{})}},{requestTimeoutMs:15,sourceTimeoutMs:1000})
  assert.equal(error.name,'TimeoutError');assert.equal(calls,1)
})
test('observer receives a clone and cannot rewrite retained material originals',async()=>{
  const r=replay(),jobs=await readCurrentFrontProgramme({readPage:r.readPage,onAudit:audit=>{audit.nativePayload.jobs[0].descriptionHtml='changed';audit.rawPages[0].bodyBase64='changed'}})
  assert.notEqual(jobs.nativeCollectionEvidence.nativePayload.jobs[0].descriptionHtml,'changed')
  assert.equal(jobs.nativeCollectionEvidence.rawPages[0].bodySHA256,rowOf(originalRows(),'corporate').bodySHA256)
})
test('uncooperative observer is bounded and cannot release a completed zero after abort',async()=>{
  const aborter=new AbortController(),r=replay();let observer=0
  const error=await held(r,{signal:aborter.signal,onAudit:()=>{observer++;aborter.abort(new DOMException('Controlled observer abort','AbortError'));return new Promise(()=>{})}})
  assert.equal(observer,1);assert.equal(error.name,'AbortError');assert.equal(error.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false)
})
test('run adapter preserves every complete original packet and exact request policy',async()=>{
  const r=replay(),jobs=await runCurrentFrontProgramme({fetchImpl:fetchReplay(r),requestIntervalMs:0})
  assert.equal(r.calls.length,14);assert.equal(jobs.nativeCollectionEvidence.rawPages.length,14)
  for(const call of r.calls){assert.equal(call.init.method,'GET');assert.equal(call.init.credentials,'omit');assert.equal(call.init.redirect,'manual');assert.equal(call.init.cache,'no-store')}
})
test('stream overflow keeps only a genuine bounded prefix and never a false complete entity',async()=>{
  const r=replay();let error
  try{await runCurrentFrontProgramme({fetchImpl:fetchReplay(r),requestIntervalMs:0,maxResponseBytes:64})}catch(value){error=value}
  assert.ok(error);const page=error.nativeCollectionEvidence.rawPages[0]
  assert.equal(page.bodyComplete,false);assert.equal(page.bodyBytes,64);assert.equal(Buffer.from(page.bodyBase64,'base64').length,64)
  assert.ok(page.discardedOverflowBytes>0);assert.equal(page.consumedBodyBytes,page.bodyBytes+page.discardedOverflowBytes)
  assert.equal(sha(Buffer.from(page.bodyBase64,'base64')),page.bodySHA256);assert.equal(r.calls.length,1)
})
test('aggregate budget reserves complete whole-body closings',async()=>{
  const rows=originalRows(),r=replay(rows);await held(r,{maxAggregateBytes:bodyOf(rowOf(rows,'corporate')).length*2-1});assert.equal(r.calls.length,1)
})
test('uncooperative stream and cancellation settle once without hanging source',async()=>{
  let cancels=0
  const fetchImpl=async url=>{const response=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancels++;return new Promise(()=>{})}}),{headers:rowOf(originalRows(),'corporate').headers});Object.defineProperty(response,'url',{value:url});return response}
  let error;try{await runCurrentFrontProgramme({fetchImpl,requestIntervalMs:0,requestTimeoutMs:15,sourceTimeoutMs:1000})}catch(value){error=value}
  assert.ok(error);assert.equal(error.name,'TimeoutError');assert.equal(cancels,1)
  assert.equal(error.nativeCollectionEvidence.rawPages[0].bodyComplete,false)
})
test('actual stream error retains an acquired128-byte prefix and releases/cancels once',async()=>{
  let reads=0,cancels=0,releases=0
  const fetchImpl=async url=>{const response=new Response('',{headers:rowOf(originalRows(),'corporate').headers});Object.defineProperty(response,'url',{value:url});Object.defineProperty(response,'body',{value:{getReader:()=>({read:async()=>{if(reads++===0)return{done:false,value:new Uint8Array(128).fill(65)};throw Error('Controlled stream read failure')},cancel:()=>{cancels++;return new Promise(()=>{})},releaseLock:()=>{releases++}})}});return response}
  let error;try{await runCurrentFrontProgramme({fetchImpl,requestIntervalMs:0})}catch(value){error=value}
  const page=error.nativeCollectionEvidence.rawPages[0];assert.equal(page.bodyComplete,false);assert.equal(page.bodyBytes,128);assert.equal(cancels,1);assert.ok(releases>=1)
})
for(const mode of ['parent-abort','request-timeout','source-timeout'])test('cancellation after128 original bytes retains prefix and headers: '+mode,async()=>{
  const aborter=new AbortController(),row=rowOf(originalRows(),'corporate'),original=bodyOf(row).subarray(0,128)
  let reads=0,cancels=0,releases=0,fetchCalls=0,observer=0,expectedHeaders,expectedEntries
  const fetchImpl=async url=>{
    assert.equal(url,C);fetchCalls++
    const response=new Response('',{status:200,headers:row.headers})
    Object.defineProperty(response,'url',{value:url})
    // Both views originate from this controlled Response. The original
    // historical receipt did not acquire headerEntries or a closing entity.
    expectedHeaders=Object.fromEntries(response.headers);expectedEntries=[...response.headers]
    Object.defineProperty(response,'body',{value:{getReader:()=>({
      read:async()=>{
        if(reads++===0)return{done:false,value:new Uint8Array(original)}
        if(mode==='parent-abort')queueMicrotask(()=>aborter.abort(new DOMException('Controlled abort after original prefix','AbortError')))
        return new Promise(()=>{})
      },cancel:()=>{cancels++;return new Promise(()=>{})},releaseLock:()=>{releases++},
    })}})
    return response
  }
  let error
  try{await runCurrentFrontProgramme({fetchImpl,requestIntervalMs:0,signal:aborter.signal,
    requestTimeoutMs:mode==='request-timeout'?40:1000,sourceTimeoutMs:mode==='source-timeout'?40:1000,onAudit:()=>{observer++}})}catch(value){error=value}
  assert.ok(error);assert.equal(error.name,mode==='parent-abort'?'AbortError':'TimeoutError')
  const audit=error.nativeCollectionEvidence,page=audit.rawPages[0]
  assert.equal(fetchCalls,1);assert.equal(reads,2);assert.equal(cancels,1);assert.ok(releases>=1);assert.equal(observer,0)
  assert.equal(page.bodyComplete,false);assert.equal(page.bodyBytes,128,'Already acquired128-byte prefix must survive the outer cancellation race')
  assert.equal(page.bodySHA256,sha(original));assert.deepEqual(Buffer.from(page.bodyBase64,'base64'),original)
  assert.deepEqual(page.headers,expectedHeaders);assert.deepEqual(page.headerEntries,expectedEntries)
  assert.equal(page.requestedURL,C);assert.equal(page.finalURL,C);assert.equal(page.status,200)
  assert.equal(page.discardedOverflowBytes,0);assert.equal(page.consumedBodyBytes,128);assert.ok(page.responseAt);assert.ok(page.completedAt)
  assert.equal(audit.aggregateBytes,128);assert.equal(audit.requests,1);assert.equal(audit.nativeProgrammeRequests,1)
  assert.equal(audit.currentDeclaredSourceProgramComplete,false);assert.equal(audit.currentTransactionQualified,false)
  const returnedAudit=JSON.stringify(audit);await new Promise(resolve=>setImmediate(resolve))
  assert.equal(JSON.stringify(audit),returnedAudit,'The returned held audit must not rely on late adapter mutation')
})

test('no explicit caller board/source bypass or over-max bound selects another profile',async()=>{
  for(const options of [{skipBoard:true},{sourceInput:{}},{maxRequests:19},{sourceTimeoutMs:120001},{maxResponseBytes:4194305}]){
    const r=replay();await assert.rejects(readCurrentFrontProgramme({readPage:r.readPage,...options}));assert.equal(r.calls.length,0)
  }
})
test('run rejects a caller authority accessor without evaluating it',async()=>{
  let getters=0;const r=replay(),options={fetchImpl:fetchReplay(r),requestIntervalMs:0}
  Object.defineProperty(options,'skipBoard',{enumerable:true,get(){getters++;return true}})
  await assert.rejects(runCurrentFrontProgramme(options));assert.equal(getters,0);assert.equal(r.calls.length,0)
})
function archiveDirectory(t){
  const root=path.resolve(os.tmpdir()),directory=fs.mkdtempSync(path.join(root,'front-server-controller-'))
  t.after(()=>{const target=path.resolve(directory);assert.ok(target.startsWith(root+path.sep)&&path.basename(target).startsWith('front-server-controller-'));fs.rmSync(target,{recursive:true,force:true})})
  return directory
}
test('zero archive retains the complete plain fourteen-packet audit and every original full criterion',async t=>{
  const r=replay(),jobs=await readCurrentFrontProgramme({readPage:r.readPage}),file=await saveRawSourceCapture(jobs,{source:'front',dryRun:true,directory:archiveDirectory(t)})
  const archived=JSON.parse(fs.readFileSync(file,'utf8'))
  assert.equal(archived.jobs.length,0);assert.equal(archived.nativeCollectionEvidence.rawPages.length,14)
  assert.deepEqual(archived.nativeCollectionEvidence,jobs.nativeCollectionEvidence)
  assert.equal(archived.nativeCollectionEvidence.recordKind,'vacancy-rows');assert.equal(archived.nativeCollectionEvidence.observedVacancyCount,4)
  assert.equal(archived.inventoryEvidence.lifecycleCleanupAllowed,false)
})
test('held archive retains the eight genuine controlled responses and has no jobs or false completion',async t=>{
  const r=replay(originalRows(),(page,{index})=>{if(index===7)page.body=Buffer.concat([page.body,Buffer.from(' ')]);return page}),error=await held(r)
  const file=await saveRawSourceFailure(error,{source:'front',dryRun:true,directory:archiveDirectory(t)}),archived=JSON.parse(fs.readFileSync(file,'utf8'))
  assert.equal(Object.hasOwn(archived,'jobs'),false);assert.equal(archived.nativeCollectionEvidence.rawPages.length,8)
  assert.equal(archived.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false)
  assert.deepEqual(archived.nativeCollectionEvidence,error.nativeCollectionEvidence)
})
