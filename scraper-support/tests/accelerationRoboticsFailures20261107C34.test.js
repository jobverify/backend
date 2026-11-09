import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run, CAREERS_URL, createAccelerationRoboticsScraper, extractJobListings, extractJobDetail} from '../../scraper/accelerationrobotics/script.js'
import {createCatalogScraper, getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

// The 530 and its receipt are real C33 originals. The two named synthetic HTML
// files come from the pre-existing local unit test and establish compatibility,
// never present-day publisher availability, count, status or geography.
const fixture = name => fs.readFileSync(new URL('./fixtures/accelerationRoboticsFailures20261107C34/' + name, import.meta.url))
const manifest = JSON.parse(fixture('manifest.json'))
const receipt = manifest.records[0], originalBytes = gunzipSync(fixture('0001.body.gz'))
const careers = fixture('synthetic-careers.html').toString('utf8'), detail = fixture('synthetic-detail.html').toString('utf8')
const role = 'https://recruit.accelerationrobotics.in/jobs/123e4567-e89b-12d3-a456-426614174000'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const originalPage = () => ({...structuredClone(receipt), url:receipt.finalUrl, bodyBase64:originalBytes.toString('base64'),
  html:originalBytes.toString('utf8'), text:originalBytes.toString('utf8'), requestedAt:receipt.sourceRequestedAt, completedAt:receipt.sourceCompletedAt})
const syntheticPage = (url, html, status=200) => ({url, requestedUrl:url, status, headers:{'content-type':'text/html; charset=utf-8'}, bodyBase64:Buffer.from(html).toString('base64')})
const catalog = () => {
  const providers = getScraperCatalog().filter(item => item.source === 'accelerationrobotics')
  assert.equal(providers.length, 1)
  return createCatalogScraper(providers[0])
}
const rejected = async operation => {
  let timer
  try {
    const outcome=await Promise.race([Promise.resolve().then(operation).then(value=>({caught:false,value}),value=>({caught:true,value})),
      new Promise(resolve=>{timer=setTimeout(()=>resolve({expired:true}),750)})])
    assert.equal(outcome.expired,undefined,'A bounded source read must settle even when an injected transport ignores its signal')
    assert.equal(outcome.caught,true,'A failed public read must reject, including falsy rejection reasons')
    return outcome.value
  } finally {clearTimeout(timer)}
}
const globalFetch = globalThis.fetch
globalThis.fetch = async () => {throw Error('Focused offline tests forbid public network reads')}
test.after(() => {globalThis.fetch=globalFetch})

test('real C33 HTTP530 bytes and original acquisition receipt are preserved', () => {
  assert.equal(originalBytes.length,7710)
  assert.equal(digest(originalBytes),'781e5b8cd3585c4a7223ba627d8e13bcbac1bbb9ef4fbc7341f4575844ac677e')
  assert.equal(receipt.status,530)
  assert.equal(receipt.sourceRequestedAt,'2026-11-07T01:24:54.345Z')
  assert.equal(receipt.sourceCompletedAt,'2026-11-07T01:25:04.464Z')
  assert.match(originalBytes.toString('utf8'),/Cloudflare Tunnel error/)
  assert.match(originalBytes.toString('utf8'),/1033/)
})

for(const entry of ['direct','default catalog']) test(entry+' keeps genuine530 fetchText rejection identity instead of returning empty',async()=>{
  const page=originalPage(), failure=Object.assign(Error('Original public HTTP 530 is not decoded text'),{status:530,headers:page.headers,originalResponse:page})
  const requests=[], audits=[]
  const reader=entry==='direct'?run:catalog().run
  const error=await rejected(()=>reader({fetchText:async url=>{requests.push(url);throw failure},onAudit:audit=>audits.push(audit)}))
  assert.equal(error,failure)
  assert.deepEqual(requests,[CAREERS_URL])
  assert.equal(audits.length,1)
  assert.equal(audits[0].outcome,'failed')
  assert.equal(audits[0].responses[0].status,530)
  assert.equal(audits[0].responses[0].sha256,receipt.sha256)
  assert.equal(audits[0].responses[0].bodyBase64,page.bodyBase64)
  assert.deepEqual(audits[0].responses[0].headers,receipt.headers)
  assert.equal(audits[0].responses[0].sourceRequestedAt,receipt.sourceRequestedAt)
  assert.equal(audits[0].responses[0].sourceCompletedAt,receipt.sourceCompletedAt)
  assert.equal(error.originalResponse,page)
  assert.equal(error.sourceAudit.sourceScopeComplete,false)
  assert.equal(error.sourceAudit.companyGlobalTotal,null)
  assert.equal(error.sourceAudit.companyIndiaTotal,null)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.lifecycleCleanupAllowed,false)
})

test('default catalog fetchPage retains genuine530 status headers bytes and clocks without fallback',async()=>{
  const page=originalPage(),requests=[],audits=[]
  const error=await rejected(()=>catalog().run({fetchPage:async url=>{requests.push(url);return page},
    fetchText:()=>{throw Error('No fallback after original error status')},onAudit:audit=>audits.push(audit)}))
  assert.equal(error.status,530)
  assert.equal(error.originalResponse,page)
  assert.deepEqual(requests,[CAREERS_URL])
  assert.equal(audits[0].responses[0].sha256,receipt.sha256)
  assert.equal(audits[0].responses[0].sourceHttpDate,'Sat, 07 Nov 2026 01:25:27 GMT')
  assert.equal(audits[0].responses[0].sourceRequestedAt,receipt.sourceRequestedAt)
  assert.equal(audits[0].responses[0].sourceCompletedAt,receipt.sourceCompletedAt)
  assert.equal(audits[0].inventoryEvidence.reportedTotal,null)
  assert.equal(audits[0].inventoryEvidence.indiaFacetCount,null)
})

for(const status of [403,429]) test('HTTP'+status+' is terminal and never tries another transport or guessed URL',async()=>{
  const requests=[]
  const error=await rejected(()=>run({fetchPage:async url=>{requests.push(url);return syntheticPage(url,'Denied',status)},
    fetchImpl:()=>{throw Error('Forbidden fallback')},fetchText:()=>{throw Error('Forbidden fallback')}}))
  assert.equal(error.status,status)
  assert.equal(error.failureKind,'blocked_or_access_denied')
  assert.deepEqual(requests,[CAREERS_URL])
})

test('frozen opaque and falsy injected read failures preserve exact identity and deliver failure audit',async()=>{
  for(const value of [Object.freeze(Error('fetch failed')),Object.freeze({kind:'opaque'}),null,undefined,false,0,'']){
    const audits=[]
    const error=await rejected(()=>run({fetchText:async()=>{throw value},onAudit:audit=>audits.push(audit)}))
    assert.equal(error,value)
    assert.equal(audits.length,1)
    assert.equal(audits[0].outcome,'failed')
    assert.equal(audits[0].sourceScopeComplete,false)
  }
})

test('detail failures reject the entire run instead of fabricating complete listing success',async()=>{
  const failure=Object.freeze(Object.assign(TypeError('fetch failed'),{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}})),requests=[]
  const error=await rejected(()=>createAccelerationRoboticsScraper().run({fetchText:async url=>{requests.push(url);if(url===CAREERS_URL)return careers;throw failure}}))
  assert.equal(error,failure)
  assert.deepEqual(requests,[CAREERS_URL,role])
})

test('a frozen status-bearing failure retains available HTTP evidence without inventing a body',async()=>{
  const originalHeaders={'retry-after':'120','content-type':'text/html'},audits=[]
  const failure=Object.freeze(Object.assign(Error('Public request denied'),{status:429,headers:originalHeaders}))
  const heldHosts=new Set()
  const error=await rejected(()=>run({fetchText:async()=>{throw failure},heldHosts,onAudit:audit=>audits.push(audit)}))
  assert.equal(error,failure)
  assert.equal(audits[0].responses[0].status,429)
  assert.deepEqual(audits[0].responses[0].headers,originalHeaders)
  assert.equal(audits[0].responses[0].bodyBase64,null)
  assert.equal(audits[0].responses[0].sourceRequestedAt,null)
  assert.equal(heldHosts.has('recruit.accelerationrobotics.in'),true)
})

// C34-IR-04: these are the reviewer's explicitly synthetic frozen rejection
// shapes. They carry available failure evidence directly, not originalResponse.
for(const [status,text,clocks] of [
  [429,'Independent original HTTP 429 entity',{sourceRequestedAt:'2026-11-07T00:00:00.000Z',sourceCompletedAt:'2026-11-07T00:00:00.001Z'}],
  [530,'Independent status rejection entity',{requestedAt:'2026-11-07T00:00:00.000Z',completedAt:'2026-11-07T00:00:00.001Z'}],
]) test('C34-IR-04 frozen direct '+status+' retains bounded entity and supported acquisition clocks',async()=>{
  const entity=Buffer.from(text),headers={'content-type':'text/html',...(status===429?{'retry-after':'120'}:{})}
  const failure=Object.freeze(Object.assign(Error('Independent status rejection'),{status,headers,bodyBase64:entity.toString('base64'),...clocks}))
  const audits=[],heldHosts=new Set(),error=await rejected(()=>run({fetchText:async()=>{throw failure},heldHosts,onAudit:audit=>audits.push(audit)}))
  assert.equal(error,failure)
  assert.equal(audits.length,1)
  const row=audits[0].responses[0]
  assert.equal(row.status,status)
  assert.deepEqual(row.headers,headers)
  assert.equal(row.bodyBase64,entity.toString('base64'))
  assert.equal(row.bytes,entity.length)
  assert.equal(row.sha256,digest(entity))
  assert.equal(row.sourceRequestedAt,'2026-11-07T00:00:00.000Z')
  assert.equal(row.sourceCompletedAt,'2026-11-07T00:00:00.001Z')
  assert.equal(row.finalUrl,null,'No original final URL was supplied')
  assert.equal(row.transportQualified,false)
  assert.equal(audits[0].inventoryEvidence.firstParty,false)
  assert.equal(audits[0].inventoryEvidence.reportedTotal,null)
  assert.equal(audits[0].sourceScopeComplete,false)
  if(status===429)assert.equal(heldHosts.has('recruit.accelerationrobotics.in'),true)
})

test('C34-IR-04 matching direct clock conventions are retained without qualification',async()=>{
  const entity=Buffer.from('Matching direct evidence'),clocks={sourceRequestedAt:'2026-11-07T00:00:00.000Z',requestedAt:'2026-11-07T00:00:00.000Z',
    sourceCompletedAt:'2026-11-07T00:00:00.001Z',completedAt:'2026-11-07T00:00:00.001Z'}
  const failure=Object.freeze(Object.assign(Error('Direct evidence'),{status:530,bodyBase64:entity.toString('base64'),bytes:entity.length,sha256:digest(entity),...clocks}))
  const audits=[],error=await rejected(()=>run({fetchText:async()=>{throw failure},onAudit:audit=>audits.push(audit)}))
  assert.equal(error,failure)
  const row=audits[0].responses[0]
  assert.equal(row.bodyBase64,entity.toString('base64'))
  assert.equal(row.sourceRequestedAt,clocks.sourceRequestedAt)
  assert.equal(row.sourceCompletedAt,clocks.sourceCompletedAt)
  assert.deepEqual(row.directAcquisitionClocks,clocks)
  assert.equal(row.transportQualified,false)
})

test('C34-IR-04 conflicting direct clocks retain raw evidence and denial hold without replacing the failure',async()=>{
  for(const clocks of [
    {sourceRequestedAt:'2026-11-07T00:00:00.000Z',requestedAt:'2026-11-07T00:00:00.001Z'},
    {sourceCompletedAt:'2026-11-07T00:00:00.000Z',completedAt:'2026-11-07T00:00:00.001Z'},
    {requestedAt:'2026-11-07T00:00:00.001Z',completedAt:'2026-11-07T00:00:00.000Z'},
  ]){
    const entity=Buffer.from('Conflicting-clock entity'),failure=Object.freeze(Object.assign(Error('Direct evidence'),{status:429,bodyBase64:entity.toString('base64'),...clocks}))
    const audits=[],heldHosts=new Set(),error=await rejected(()=>run({fetchText:async()=>{throw failure},heldHosts,onAudit:audit=>audits.push(audit)}))
    assert.equal(error,failure)
    const row=audits[0].responses[0]
    assert.equal(row.bodyBase64,entity.toString('base64'))
    assert.equal(row.sourceRequestedAt,null)
    assert.equal(row.sourceCompletedAt,null)
    assert.deepEqual(row.directAcquisitionClocks,clocks)
    assert.equal(row.transportQualified,false)
    assert.equal(heldHosts.has('recruit.accelerationrobotics.in'),true)
    assert.ok(audits[0].issues.some(issue=>issue.kind==='rejected-status-retention-incomplete'&&/acquisition clock/.test(issue.message)))
  }
})

test('C34-IR-04 malformed or oversized direct entities preserve clocks and exact rejection within bounds',async()=>{
  for(const bodyBase64 of ['%%%bad',Buffer.alloc(129,65).toString('base64')]){
    const failure=Object.freeze(Object.assign(Error('Direct evidence'),{status:530,bodyBase64,requestedAt:'2026-11-07T00:00:00.000Z',completedAt:'2026-11-07T00:00:00.001Z'}))
    const audits=[],error=await rejected(()=>run({maxResponseBytes:128,fetchText:async()=>{throw failure},onAudit:audit=>audits.push(audit)}))
    assert.equal(error,failure)
    const row=audits[0].responses[0]
    assert.equal(row.bodyBase64,null)
    assert.equal(row.bytes,null)
    assert.equal(row.sha256,null)
    assert.equal(row.bodyComplete,false)
    assert.equal(row.sourceRequestedAt,'2026-11-07T00:00:00.000Z')
    assert.equal(row.sourceCompletedAt,'2026-11-07T00:00:00.001Z')
    assert.equal(row.transportQualified,false)
    assert.ok(audits[0].issues.some(issue=>issue.kind==='rejected-status-retention-incomplete'&&/body/.test(issue.message)))
  }
})

test('C34-IR-04 contradictory direct entity provenance stays unqualified with its actual bytes',async()=>{
  const entity=Buffer.from('Entity with contradictory supplied evidence')
  for(const provenance of [{bytes:1},{sha256:'0'.repeat(64)}]){
    const failure=Object.freeze(Object.assign(Error('Direct evidence'),{status:530,bodyBase64:entity.toString('base64'),...provenance}))
    const audits=[],error=await rejected(()=>run({fetchText:async()=>{throw failure},onAudit:audit=>audits.push(audit)}))
    assert.equal(error,failure)
    const row=audits[0].responses[0]
    assert.equal(row.bodyBase64,entity.toString('base64'))
    assert.equal(row.bytes,entity.length)
    assert.equal(row.sha256,digest(entity))
    assert.equal(row.transportQualified,false)
    assert.ok(audits[0].issues.some(issue=>issue.kind==='rejected-status-retention-incomplete'&&/contradicts/.test(issue.message)))
  }
})

test('C34-IR-04 direct evidence uses own data fields without invoking getters or inherited clocks',async()=>{
  let accesses=0
  const failure=Object.create({requestedAt:'2026-11-07T00:00:00.000Z',bodyBase64:Buffer.from('Inherited entity').toString('base64')})
  Object.defineProperties(failure,{status:{value:530},headers:{value:{'content-type':'text/html'}},
    sourceRequestedAt:{get(){accesses++;throw Error('No accessor execution')}},completedAt:{get(){accesses++;throw Error('No accessor execution')}},
    originalResponse:{get(){accesses++;throw Error('No accessor execution')}},url:{get(){accesses++;throw Error('No accessor execution')}}})
  Object.freeze(failure)
  const audits=[],error=await rejected(()=>run({fetchText:async()=>{throw failure},onAudit:audit=>audits.push(audit)}))
  assert.equal(error,failure)
  assert.equal(accesses,0)
  const row=audits[0].responses[0]
  assert.equal(row.status,530)
  assert.equal(row.bodyBase64,null)
  assert.equal(row.sourceRequestedAt,null)
  assert.equal(row.sourceCompletedAt,null)
  assert.equal(row.finalUrl,null)
})

test('C34-IR-04 direct retained evidence survives broken completion clocks with original failure precedence',async()=>{
  const entity=Buffer.from('Evidence before completion failure'),failure=Object.freeze(Object.assign(Error('Direct failure'),{status:530,bodyBase64:entity.toString('base64'),
    requestedAt:'2026-11-07T00:00:00.000Z',completedAt:'2026-11-07T00:00:00.001Z'})),completion=Object.freeze(Error('Completion clock unavailable'))
  let calls=0
  const audits=[],error=await rejected(()=>run({fetchText:async()=>{throw failure},now:()=>{if(++calls>2)throw completion;return '2026-11-07T00:00:00.002Z'},onAudit:audit=>audits.push(audit)}))
  assert.equal(error,failure)
  assert.equal(audits.length,1)
  const row=audits[0].responses[0]
  assert.equal(row.bodyBase64,entity.toString('base64'))
  assert.equal(row.sourceRequestedAt,'2026-11-07T00:00:00.000Z')
  assert.equal(row.sourceCompletedAt,'2026-11-07T00:00:00.001Z')
  assert.equal(row.observedCompletedAt,null)
  assert.equal(audits[0].completedAt,null)
  assert.ok(audits[0].issues.some(issue=>issue.kind==='completion-clock-unavailable'))
})

test('an already aborted caller starts no GET and keeps the caller reason',async()=>{
  const controller=new AbortController(),reason=Object.freeze(Error('Caller stopped acquisition'));controller.abort(reason)
  let requests=0
  const error=await rejected(()=>run({signal:controller.signal,fetchText:async()=>{requests++;return careers}}))
  assert.equal(error,reason)
  assert.equal(requests,0)
})

test('caller abort bounds an injected transport that ignores its signal',async()=>{
  const controller=new AbortController(),reason=Object.freeze({stopped:true})
  let signal
  const pending=run({signal:controller.signal,fetchPage:async(url,init)=>{signal=init.signal;return new Promise(()=>{})}})
  const timer=setTimeout(()=>controller.abort(reason),10)
  try {assert.equal(await rejected(()=>pending),reason);assert.equal(signal.aborted,true)} finally {clearTimeout(timer)}
})

for(const name of ['requestTimeoutMs','sourceTimeoutMs','entityTimeoutMs','processingTimeoutMs','callbackTimeoutMs','timeoutMs','collectionTimeoutMs',
  'maxResponseBytes','maxSourceBytes','maxTotalBytes','maxRequests','maxPages','maxJobs']) test(name+' rejects invalid negative fractional or excessive bounds before reading',async()=>{
  for(const value of [-1,0.5,Number.MAX_SAFE_INTEGER,NaN]){
    let requests=0
    const error=await rejected(()=>run({[name]:value,fetchText:async()=>{requests++;return careers}}))
    assert.ok(error instanceof RangeError)
    assert.equal(requests,0)
  }
})

test('request deadline bounds a transport that never settles',async()=>{
  const error=await rejected(()=>run({requestTimeoutMs:15,sourceTimeoutMs:200,fetchText:()=>new Promise(()=>{})}))
  assert.equal(error.failureKind,'network_or_timeout')
  assert.match(error.message,/request.*deadline/i)
})

test('source deadline covers multiple work stages instead of restarting per request',async()=>{
  const error=await rejected(()=>run({requestTimeoutMs:200,sourceTimeoutMs:15,fetchText:()=>new Promise(()=>{})}))
  assert.equal(error.failureKind,'network_or_timeout')
  assert.match(error.message,/source.*deadline/i)
})

test('request limit refuses the detail before a second GET',async()=>{
  const requests=[]
  const error=await rejected(()=>run({maxRequests:1,fetchText:async url=>{requests.push(url);return careers}}))
  assert.match(error.message,/request.*limit/i)
  assert.deepEqual(requests,[CAREERS_URL])
})

test('decoded body budget rejects oversize pages and preserves original evidence as unparsed',async()=>{
  const error=await rejected(()=>run({maxResponseBytes:128,fetchPage:async()=>originalPage()}))
  assert.equal(error.status,530)
  assert.equal(error.originalResponse.bodyBase64,originalPage().bodyBase64)
  assert.equal(error.sourceAudit.responses[0].bodyComplete,false)
  assert.equal(error.sourceAudit.sourceScopeComplete,false)
})

test('unavailable malformed or contradictory bodies cannot produce empty success',async()=>{
  for(const change of [page=>{delete page.bodyBase64},page=>{page.bodyBase64='not base64'},page=>{page.html='different text'},page=>{page.bytes=1}]){
    const page=syntheticPage(CAREERS_URL,careers);change(page)
    const error=await rejected(()=>run({fetchPage:async()=>page}))
    assert.ok(error.sourceAudit)
    assert.equal(error.sourceAudit.outcome,'failed')
  }
})

test('native fetchImpl reads a real Response and retains HTTP530 entity without fallback',async()=>{
  const response=new Response(originalBytes,{status:530,headers:receipt.headers})
  Object.defineProperty(response,'url',{value:CAREERS_URL})
  const requests=[]
  const error=await rejected(()=>run({fetchImpl:async(url,init)=>{requests.push(url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');return response}}))
  assert.equal(error.status,530)
  assert.equal(error.sourceAudit.responses[0].sha256,receipt.sha256)
  assert.deepEqual(requests,[CAREERS_URL])
})

test('body deadline bounds a native stream that never yields an entity',async()=>{
  const response=new Response(new ReadableStream({pull(){return new Promise(()=>{})}}),{headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:CAREERS_URL})
  const error=await rejected(()=>run({entityTimeoutMs:15,requestTimeoutMs:200,sourceTimeoutMs:300,fetchImpl:async()=>response}))
  assert.equal(error.failureKind,'network_or_timeout')
  assert.match(error.message,/entity.*deadline/i)
})

test('processing deadline detects synchronous parsing work beyond its monotonic allowance',async()=>{
  let elapsed=0
  const error=await rejected(()=>run({processingTimeoutMs:5,sourceTimeoutMs:1000,requestTimeoutMs:1000,
    fetchText:async()=>careers,monotonicNow:()=>{elapsed+=10;return elapsed}}))
  assert.match(error.message,/processing.*deadline/i)
})

test('a bounded audit callback cannot hide a primary genuine530 rejection',async()=>{
  const page=originalPage(),failure=Object.assign(Error('Original public HTTP 530 is not decoded text'),{status:530,originalResponse:page})
  const error=await rejected(()=>run({fetchText:async()=>{throw failure},callbackTimeoutMs:15,onAudit:()=>new Promise(()=>{})}))
  assert.equal(error,failure)
})

test('synthetic historical native control parses explicit role data without deriving India or inventory completeness',async()=>{
  const requests=[]
  const jobs=await catalog().run({fetchPage:async url=>{requests.push(url);return syntheticPage(url,url===CAREERS_URL?careers:detail)}})
  assert.deepEqual(requests,[CAREERS_URL,role])
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].title,'Robotics Software Engineer - Outdoor Autonomy')
  assert.equal(jobs[0].jobDescription,'Build reliable autonomy for outdoor robots.')
  assert.equal(jobs[0].country,null)
  assert.equal(jobs[0].location,'Pune')
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('historical exported parsers retain their historical local contract separately from acquisition',()=>{
  const listings=extractJobListings(careers),details=extractJobDetail(detail)
  assert.equal(listings.length,1)
  assert.equal(listings[0].country,'India')
  assert.equal(details.jobDescription,'Build reliable autonomy for outdoor robots.')
})

test('explicit changed detail geography clears the earlier India country rather than retaining a default',async()=>{
  const listing=careers.replace('<span class="location">Pune</span>','<span class="location">Pune, India</span>')
  const changed=detail.replace('<div class="job-meta">','<span class="location">Boston</span><div class="job-meta">')
  const jobs=await run({fetchText:async url=>url===CAREERS_URL?listing:changed})
  assert.equal(jobs[0].location,'Boston')
  assert.equal(jobs[0].country,null)
  assert.equal(jobs[0].sourceCountryScopeUnresolved,true)
})

test('empty readable root is coverage gap, never authoritative inventory zero',async()=>{
  const html=careers.replace(/<article[\s\S]*?<\/article>/,'')
  const jobs=await catalog().run({fetchPage:async url=>syntheticPage(url,html)})
  assert.equal(jobs.length,0)
  assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.status,'coverage-gap')
  assert.equal(inventory.listingComplete,false)
  assert.equal(inventory.reportedTotal,null)
  assert.equal(inventory.indiaFacetCount,null)
})

test('only active same-authority literal job links can authorize a detail GET',async()=>{
  for(const html of [careers.replace('href="/jobs/','href="https://elsewhere.invalid/jobs/'),careers.replace('<article','<template><article').replace('</article>','</article></template>'),careers.replace('<article','<article hidden')]){
    const requests=[]
    const jobs=await run({fetchPage:async url=>{requests.push(url);return syntheticPage(url,html)}})
    assert.equal(jobs.length,0)
    assert.deepEqual(requests,[CAREERS_URL])
    assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
  }
})
