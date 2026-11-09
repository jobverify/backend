import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {setTimeout as schedule, clearTimeout as unschedule} from 'node:timers'
import test from 'node:test'
import * as adpushup from '../../scraper/adpushup/script.js'
import {buildScrapers, createCatalogScraper, getScraperCatalog} from '../providers/index.js'
import {isVerifiedEmptyEvidence, readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const HOME = 'https://www.adpushup.com/careers/'
const folder = new URL('./fixtures/adpushupPublicReads20261107C35/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder)))
const receipt = manifest.records[0]
const bytes = gunzipSync(fs.readFileSync(new URL('0001.body.gz', folder)))
const original = () => ({url: HOME, requestedUrl: HOME, status: 200, headers: structuredClone(receipt.headers),
  bodyBase64: bytes.toString('base64'), sourceRequestedAt: receipt.sourceRequestedAt,
  sourceCompletedAt: receipt.sourceCompletedAt, sourceHttpDate: receipt.sourceHttpDate,
  originalReceipt: structuredClone(receipt), provenance: {transport: manifest.transport, bodyFile: receipt.bodyFile}})
const provider = getScraperCatalog().find(row => row.source === 'adpushup')
const catalog = () => createCatalogScraper(provider)
const now = () => '2026-11-07T03:00:00.000Z'
const never = () => new Promise(() => {})
// Every changed HTML/transport below is a synthetic boundary control. The
// unmodified gzip and manifest above are the only genuine acquired fixture.
const html = content => '<!doctype html><html><head><title>Careers &mdash; AdPushup</title></head><body><p>AdPushup company story.</p>' + content + '</body></html>'
const changed = (content, extra = {}) => ({url:HOME, requestedUrl:HOME, status:200,
  headers:{'content-type':'text/html; charset=utf-8'},bodyBase64:Buffer.from(content).toString('base64'),
  sourceRequestedAt:'2026-11-07T00:00:00.000Z',sourceCompletedAt:'2026-11-07T00:00:00.001Z',syntheticBoundaryEntity:true,...extra})
const watchdog = async pending => {
  let timer
  try {return await Promise.race([pending,new Promise((_,reject) => {timer=schedule(() => reject(Error('Test watchdog exceeded')),1000)})])}
  finally {unschedule(timer)}
}
const failure = async pending => {
  try {await watchdog(pending)} catch (error) {return {rejected: true, error}}
  return {rejected: false}
}
const incomplete = jobs => {
  assert.equal(jobs.length, 0)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory?.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.verifiedAt, null)
  assert.equal(isVerifiedEmptyEvidence(inventory), false)
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.sourceScopeComplete, false)
  for (const key of ['companyGlobalTotal','companyIndiaTotal','nativeReportedTotal','nativeIndiaTotal']) assert.equal(audit[key], null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.inventoryVerifiedAt, null)
  assert.equal(audit.redirectsFollowed, false)
  assert.equal(audit.corporateJavaScriptExecuted, false)
  assert.equal(audit.subresourcesRequested, false)
  return audit
}

test('actual default catalog acquires its exact configured document instead of returning unread empty', async () => {
  const calls = []
  const jobs = await catalog().run({now, fetchPage: async (url, init) => {calls.push({url, ...init}); return original()}})
  assert.deepEqual(calls.map(row => row.url), [HOME])
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].redirect, 'manual')
  assert.equal(calls[0].credentials, 'omit')
  const audit = incomplete(jobs)
  assert.equal(audit.responses[0].sha256, '7b2c9ec2f3cb277507b52920ad9797c668a7b7396bafc54ee273af3ca41fbbbf')
})

test('actual default preserves an original frozen acquisition rejection', async () => {
  const originalError = Object.freeze(Error('original acquisition failure'))
  const result = await failure(catalog().run({now, fetchPage: async () => {throw originalError}}))
  assert.equal(result.rejected, true)
  assert.equal(result.error, originalError)
})

test('actual default preserves an original frozen denial and records a host hold', async () => {
  const originalError = Object.freeze(Object.assign(Error('original deny'), {status: 403, headers: {'retry-after':'60'}}))
  const heldHosts = new Set(), audits = []
  const result = await failure(catalog().run({now, heldHosts, onAudit: value => audits.push(value), fetchPage: async () => {throw originalError}}))
  assert.equal(result.rejected, true)
  assert.equal(result.error, originalError)
  assert.equal(heldHosts.has('www.adpushup.com'), true)
  assert.equal(audits[0].responses[0].status, 403)
})

test('actual default honors caller cancellation before any acquisition', async () => {
  const controller = new AbortController(), reason = Object.freeze({reason:'caller stop'})
  controller.abort(reason)
  let called = false
  const result = await failure(catalog().run({now, signal: controller.signal, fetchPage: async () => {called = true; return original()}}))
  assert.equal(result.rejected, true)
  assert.equal(result.error, reason)
  assert.equal(called, false)
})

test('genuine original replay retains all bytes, status, headers, digest and original acquisition clocks', async () => {
  const audits=[], metadata=[],records=[]
  const jobs=await adpushup.run({now,fetchPage:async()=>original(),onAudit:value=>audits.push(value),
    onMetadata:value=>metadata.push(value),onRecords:value=>records.push(value)})
  const audit=incomplete(jobs), row=audit.responses[0]
  assert.equal(bytes.length,391959)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'7b2c9ec2f3cb277507b52920ad9797c668a7b7396bafc54ee273af3ca41fbbbf')
  assert.equal(row.status,200)
  assert.equal(row.finalUrl,HOME)
  assert.deepEqual(row.headers,receipt.headers)
  assert.equal(row.bodyBase64,bytes.toString('base64'))
  assert.equal(row.bytes,391959)
  assert.equal(row.sourceRequestedAt,'2026-11-07T02:47:14.927Z')
  assert.equal(row.sourceCompletedAt,'2026-11-07T02:47:28.124Z')
  assert.equal(row.sourceHttpDate,'Sat, 07 Nov 2026 02:47:50 GMT')
  assert.equal(row.observedRequestedAt,'2026-11-07T03:00:00.000Z')
  assert.deepEqual(audit.rawPages[0].originalReceipt,receipt)
  assert.equal(row.transportQualified,true)
  assert.equal(readInventoryEvidence(jobs).firstParty,true)
  assert.equal(audit.observations.length,1)
  assert.equal(audit.observations[0].kind,'hiring-context')
  assert.equal(audit.observations[0].vacancy,false)
  assert.equal(audit.observations[0].heading,'Open Positions')
  assert.equal(audit.observations[0].country,null)
  assert.deepEqual(readSourceObservationEvidence(jobs,'adpushup'),{source:'adpushup',recordKind:'hiring-signals',
    observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  assert.equal(audits.length,1)
  assert.equal(metadata[0].verifiedOn,null)
  assert.equal(metadata[0].verifiedPublicJobCount,null)
  assert.equal(metadata[0].verifiedIndiaJobCount,null)
  assert.equal(metadata[0].runtimeInventoryVerification,false)
  assert.equal(metadata[0].sourceScopeComplete,false)
  assert.equal(metadata[0].lifecycleCleanupAllowed,false)
  assert.deepEqual(records,[[]])
})

test('actual buildScrapers route keeps runtime gap evidence despite historical catalog snapshot fields',async()=>{
  const route=buildScrapers().find(row=>row.name==='adpushup')
  assert.equal(provider.modulePath.endsWith('adpushup\\script.js')||provider.modulePath.endsWith('adpushup/script.js'),true)
  let requests=0
  const audit=incomplete(await route.run({now,fetchPage:async()=>{requests++;return original()}}))
  assert.equal(requests,1)
  assert.equal(audit.responses[0].sha256,receipt.sha256)
  assert.equal(audit.sourceMetadata.verifiedOn,null)
  assert.equal(audit.sourceMetadata.verifiedPublicJobCount,null)
  assert.equal(audit.sourceMetadata.verifiedIndiaJobCount,null)
})

test('composed transport uses fetchPage first and never discards its original metadata',async()=>{
  const audit=incomplete(await catalog().run({now,fetchPage:async()=>original(),
    fetchImpl:()=>assert.fail('fetchImpl must not replace fetchPage'),fetchText:()=>assert.fail('fetchText must not replace fetchPage')}))
  assert.equal(audit.responses[0].sourceRequestedAt,receipt.sourceRequestedAt)
  assert.equal(audit.responses[0].sha256,receipt.sha256)
})

test('native fetchImpl stream acquires one anonymous GET and preserves its entity',async()=>{
  let calls=0
  const audit=incomplete(await catalog().run({now,fetchImpl:async(url,init)=>{
    calls++;assert.equal(url,HOME);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.method,'GET')
    const response=new Response(bytes,{status:200,headers:receipt.headers})
    Object.defineProperty(response,'url',{value:HOME})
    return response
  }}))
  assert.equal(calls,1)
  assert.equal(audit.responses[0].bodyBase64,bytes.toString('base64'))
  assert.equal(audit.responses[0].sha256,receipt.sha256)
  assert.equal(audit.responses[0].sourceRequestedAt,'2026-11-07T03:00:00.000Z')
  assert.equal(audit.responses[0].sourceCompletedAt,'2026-11-07T03:00:00.000Z')
})

test('decoded fetchText compatibility is read but explicitly lacks original transport qualification',async()=>{
  let calls=0
  const jobs=await catalog().run({now,fetchText:async(url,init)=>{calls++;assert.equal(url,HOME);assert.equal(init.method,'GET');return html('<h2>Open Positions</h2>')}})
  const audit=incomplete(jobs),row=audit.responses[0]
  assert.equal(calls,1)
  assert.equal(row.bodyBase64,null)
  assert.equal(row.sourceRequestedAt,null)
  assert.equal(row.sourceCompletedAt,null)
  assert.equal(row.transportQualified,false)
  assert.equal(readInventoryEvidence(jobs).firstParty,false)
  assert.deepEqual(audit.observations,[])
  assert.ok(audit.issues.some(row=>row.kind==='unqualified-decoded-only-transport'))
})

test('a read document with no hiring section remains an incomplete zero observation',async()=>{
  const jobs=await catalog().run({now,fetchPage:async()=>changed(html('<p>Offices in New Delhi, India.</p>'))})
  const audit=incomplete(jobs)
  assert.deepEqual(audit.observations,[])
  assert.equal(readInventoryEvidence(jobs).firstParty,true)
})

test('literal role, frame and script declarations never authorize a second read or become vacancies',async()=>{
  const content=html('<h2>Open Positions</h2><a href="/jobs/engineer">Engineer, India</a><iframe src="https://jobs.example.invalid/roles"></iframe>'+ 
    '<script src="https://jobs.example.invalid/widget.js"></script><script>globalThis.__adpushupExecuted=true</script>')
  let calls=0
  const audit=incomplete(await catalog().run({now,fetchPage:async()=>{calls++;return changed(content)}}))
  assert.equal(calls,1)
  assert.equal(globalThis.__adpushupExecuted,undefined)
  assert.equal(audit.observations.every(row=>row.vacancy===false&&row.country===null),true)
})

for(const [label,content] of [
  ['missing title','<html><body>AdPushup<h2>Open Positions</h2></body></html>'],
  ['foreign publisher',html('<h2>Open Positions</h2>').replace('Careers &mdash; AdPushup','Careers - Someone Else')],
  ['inert title','<html><head><template><title>Careers - AdPushup</title></template></head><body>AdPushup</body></html>'],
  ['foreign title','<html><head><math><title>Careers - AdPushup</title></math></head><body>AdPushup</body></html>'],
  ['malformed attribute','<html><head><title>Careers - AdPushup</title></head><body><p title="unterminated>AdPushup</body></html>'],
]) test('malformed or nonmatching publisher document fails instead of an empty inventory: '+label,async()=>{
  const audits=[]
  const result=await failure(catalog().run({now,onAudit:value=>audits.push(value),fetchPage:async()=>changed(content)}))
  assert.equal(result.rejected,true)
  assert.equal(audits[0].outcome,'failed')
  assert.equal(audits[0].responses[0].bodyBase64,Buffer.from(content).toString('base64'))
})

for(const [label,content] of [
  ['inert heading','<template><h2>Open Positions</h2></template>'],
  ['script heading','<script>"<h2>Open Positions</h2>"</script>'],
  ['foreign heading','<math><h2>Open Positions</h2></math>'],
  ['hidden heading','<div hidden><h2>Open Positions</h2></div>'],
]) test('inert or foreign context does not become a qualified hiring observation: '+label,async()=>{
  assert.deepEqual(incomplete(await catalog().run({now,fetchPage:async()=>changed(html(content))})).observations,[])
})

for(const status of [302,403,429,500]) test('returned HTTP '+status+' retains original error entity and cannot become empty success',async()=>{
  const page=changed('synthetic original HTTP error body',{status,headers:{'content-type':'text/plain','location':'https://example.invalid/','date':'Sat, 07 Nov 2026 00:00:00 GMT'}})
  const audits=[],heldHosts=new Set()
  const result=await failure(catalog().run({now,heldHosts,onAudit:value=>audits.push(value),fetchPage:async()=>page}))
  assert.equal(result.rejected,true)
  assert.equal(result.error.status,status)
  assert.equal(audits[0].responses[0].status,status)
  assert.equal(audits[0].responses[0].bodyBase64,page.bodyBase64)
  assert.equal(audits[0].responses[0].sha256,createHash('sha256').update(Buffer.from('synthetic original HTTP error body')).digest('hex'))
  assert.equal(audits[0].responses[0].sourceCompletedAt,page.sourceCompletedAt)
  assert.equal(heldHosts.has('www.adpushup.com'),[403,429].includes(status))
})

for(const [label,mutation] of [
  ['missing body',page=>({...page,bodyBase64:undefined})],
  ['invalid base64',page=>({...page,bodyBase64:'!!!!'})],
  ['bad digest',page=>({...page,sha256:'0'.repeat(64)})],
  ['bad bytes',page=>({...page,bytes:1})],
  ['contradictory decoded text',page=>({...page,html:'other text'})],
  ['wrong URL',page=>({...page,url:HOME+'other'})],
  ['wrong requested URL',page=>({...page,requestedUrl:HOME+'other'})],
  ['missing status',page=>({...page,status:undefined})],
  ['XML MIME',page=>({...page,headers:{'content-type':'application/xhtml+xml'}})],
  ['invalid UTF8',page=>({...page,bodyBase64:Buffer.from([0xff]).toString('base64')})],
  ['reversed acquisition clocks',page=>({...page,sourceRequestedAt:'2026-11-07T01:00:00.000Z'})],
  ['contradictory clock alias',page=>({...page,requestedAt:'2026-11-07T01:00:00.000Z'})],
]) test('unavailable or contradictory original response rejects: '+label,async()=>{
  const result=await failure(catalog().run({now,fetchPage:async()=>mutation(changed(html('<h2>Open Positions</h2>')))}))
  assert.equal(result.rejected,true)
})

for(const key of ['maxResponseBytes','maxSourceBytes','maxTotalBytes']) test('configured '+key+' bounds the original body before parsing',async()=>{
  const audits=[]
  const result=await failure(catalog().run({now,[key]:100,onAudit:value=>audits.push(value),fetchPage:async()=>original()}))
  assert.equal(result.rejected,true)
  assert.match(result.error.message,/byte/)
  assert.equal(audits[0].responses[0].bodyBase64,null)
  assert.equal(audits[0].rawPages.some(page=>typeof page.bodyBase64==='string'),false)
})

for(const [key,value] of [['maxRequests',0],['maxPages',0],['maxResponseBytes',0],['maxTotalBytes',NaN],
  ['maxJobs',-1],['requestTimeoutMs',0],['sourceTimeoutMs',Infinity],['timeoutMs',-1],['collectionTimeoutMs',-1],
  ['fetchPage',true],['onAudit',{}],['now','not-a-clock'],['signal',{}],['heldHosts',[]]]) {
  test('invalid control rejects before acquisition: '+key,async()=>{
    let called=false
    const result=await failure(catalog().run({fetchPage:async()=>{called=true;return original()},[key]:value}))
    assert.equal(result.rejected,true)
    assert.equal(called,false)
  })
}

test('held host refuses acquisition without trying a replacement URL',async()=>{
  let called=false
  const result=await failure(catalog().run({now,heldHosts:new Set(['adpushup.com']),fetchPage:async()=>{called=true;return original()}}))
  assert.equal(result.rejected,true)
  assert.equal(called,false)
  assert.equal(result.error.failureKind,'blocked_or_access_denied')
})

for(const reason of [null,0,false,'original primitive',Object.freeze({opaque:true})]) test('opaque or falsy original rejection retains identity: '+String(reason),async()=>{
  const result=await failure(catalog().run({now,fetchPage:async()=>{throw reason}}))
  assert.equal(result.rejected,true)
  assert.equal(result.error,reason)
})

test('failure audit delivery and a failing completion clock do not mask an original frozen rejection',async()=>{
  const reason=Object.freeze(Error('original frozen failure')),audits=[]
  let ticks=0
  const result=await failure(catalog().run({now:()=>{if(++ticks>2)throw Error('completion clock failed');return now()},
    fetchPage:async()=>{throw reason},onMetadata:()=>{throw Error('metadata callback failed')},onAudit:value=>{audits.push(value);throw Error('audit callback failed')}}))
  assert.equal(result.rejected,true)
  assert.equal(result.error,reason)
  assert.equal(audits[0].outcome,'failed')
  assert.ok(audits[0].issues.some(row=>row.kind==='completion-clock-unavailable'))
})

for(const callback of ['onMetadata','onAudit','onRecords']) test('successful-read '+callback+' failure remains its exact original rejection',async()=>{
  const reason=Object.freeze(Error(callback+' original rejection'))
  const result=await failure(catalog().run({now,fetchPage:async()=>original(),[callback]:()=>{throw reason}}))
  assert.equal(result.rejected,true)
  assert.equal(result.error,reason)
})

for(const callback of ['onMetadata','onAudit','onRecords']) test('ignored '+callback+' signal cannot exceed callback allowance',async()=>{
  const result=await failure(catalog().run({now,callbackTimeoutMs:15,fetchPage:async()=>original(),[callback]:never}))
  assert.equal(result.rejected,true)
  assert.notEqual(result.error.message,'Test watchdog exceeded')
  assert.match(result.error.message,/deadline/)
})

for(const [label,options] of [
  ['request',{requestTimeoutMs:15,fetchPage:never}],
  ['source',{sourceTimeoutMs:15,fetchPage:never}],
  ['entity',{entityTimeoutMs:15,fetchImpl:async()=>({url:HOME,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:never,cancel:never,releaseLock(){}}),cancel:never}})}],
]) test('ignored '+label+' signal cannot exceed its elapsed allowance',async()=>{
  const result=await failure(catalog().run({now,...options}))
  assert.equal(result.rejected,true)
  assert.notEqual(result.error.message,'Test watchdog exceeded')
  assert.match(result.error.message,/deadline/)
})

test('synchronous acquisition overrun is caught by monotonic time checks',async()=>{
  let tick=0
  const result=await failure(catalog().run({now,requestTimeoutMs:20,monotonicNow:()=>tick,fetchPage:()=>{tick=100;return original()}}))
  assert.equal(result.rejected,true)
  assert.match(result.error.message,/deadline/)
})

test('caller cancellation during a pending acquisition retains the caller reason',async()=>{
  const controller=new AbortController(),reason=Object.freeze({cancelled:true})
  const timer=schedule(()=>controller.abort(reason),10)
  try {
    const result=await failure(catalog().run({now,signal:controller.signal,fetchPage:never}))
    assert.equal(result.rejected,true)
    assert.equal(result.error,reason)
  } finally {unschedule(timer)}
})

test('native oversize chunk cancels and releases its reader once even when cancellation hangs',async()=>{
  let cancelled=0,released=0
  const reader={read:async()=>({done:false,value:new Uint8Array(101)}),cancel(){cancelled++;return never()},releaseLock(){released++}}
  const result=await failure(catalog().run({now,maxResponseBytes:100,fetchImpl:async()=>({url:HOME,status:200,
    headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>reader}})}))
  assert.equal(result.rejected,true)
  assert.match(result.error.message,/byte/)
  assert.equal(cancelled,1)
  assert.equal(released,1)
})

test('source-local historical helper stays a historical isolated contract',async()=>{
  const helper=await import('../../scraper/adpushup/verifiedCareersEmptyState.js')
  assert.deepEqual(await helper.createVerifiedCareersEmptyStateScraper().run(),[])
  assert.deepEqual(await helper.run(),[])
})

test('immutable thrown original-response denial preserves entity evidence without replacing its rejection',async()=>{
  const page=changed('synthetic original denied body',{status:403,headers:{'content-type':'text/plain'}})
  const reason=Object.freeze(Object.assign(Error('original response denied'),{originalResponse:page})),audits=[]
  const result=await failure(catalog().run({now,fetchPage:async()=>{throw reason},onAudit:value=>audits.push(value)}))
  assert.equal(result.rejected,true)
  assert.equal(result.error,reason)
  assert.equal(audits[0].responses[0].status,403)
  assert.equal(audits[0].responses[0].bodyBase64,page.bodyBase64)
  assert.equal(audits[0].responses[0].sourceCompletedAt,page.sourceCompletedAt)
  assert.equal(audits[0].responses[0].transportQualified,false)
})

test('frozen direct denial fields retain original body and clocks through the real catalog',async()=>{
  const page=changed('synthetic direct denied body',{status:429,headers:{'content-type':'text/plain','retry-after':'60'}})
  const reason=Object.freeze(Object.assign(Error('direct denial'),page)),audits=[]
  const result=await failure(catalog().run({now,fetchPage:async()=>{throw reason},onAudit:value=>audits.push(value)}))
  assert.equal(result.rejected,true)
  assert.equal(result.error,reason)
  assert.equal(audits[0].responses[0].status,429)
  assert.equal(audits[0].responses[0].bodyBase64,page.bodyBase64)
  assert.equal(audits[0].responses[0].sourceCompletedAt,page.sourceCompletedAt)
})

test('error diagnostic accessors and inherited setters are never invoked',async()=>{
  let accessed=0
  const reason=Object.create({set inventoryEvidence(value){accessed++}})
  Object.defineProperty(reason,'status',{get(){accessed++;throw Error('status accessor must remain inert')}})
  Object.defineProperty(reason,'sourceAudit',{configurable:true,get(){accessed++;throw Error('audit accessor must remain inert')}})
  const result=await failure(catalog().run({now,fetchPage:async()=>{throw reason}}))
  assert.equal(result.rejected,true)
  assert.equal(result.error,reason)
  assert.equal(accessed,0)
})

test('callback snapshots can be edited without altering the retained original',async()=>{
  const jobs=await catalog().run({now,fetchPage:async()=>original(),onAudit:(value,control)=>{
    assert.equal(control.signal instanceof AbortSignal,true)
    control.throwIfAborted()
    value.responses[0].bodyBase64='edited';value.observations.length=0
  },onMetadata:value=>{value.verifiedPublicJobCount=0}})
  const audit=incomplete(jobs)
  assert.equal(audit.responses[0].bodyBase64,bytes.toString('base64'))
  assert.equal(audit.observations.length,1)
  assert.equal(audit.sourceMetadata.verifiedPublicJobCount,null)
})

test('the native default transport uses the same exact anonymous read contract',async()=>{
  const previous=globalThis.fetch
  let calls=0
  globalThis.fetch=async(url,init)=>{
    calls++;assert.equal(url,HOME);assert.equal(init.method,'GET');assert.equal(init.credentials,'omit')
    const response=new Response(bytes,{status:200,headers:receipt.headers})
    Object.defineProperty(response,'url',{value:HOME})
    return response
  }
  try {assert.equal(incomplete(await catalog().run({now})).responses[0].sha256,receipt.sha256)}
  finally {globalThis.fetch=previous}
  assert.equal(calls,1)
})

test('late native response is canceled after the request deadline',async()=>{
  let resolve,cancelled=0
  const pending=new Promise(done=>{resolve=done})
  const result=await failure(catalog().run({now,requestTimeoutMs:10,fetchImpl:()=>pending}))
  assert.equal(result.rejected,true)
  assert.match(result.error.message,/deadline/)
  resolve({body:{cancel(){cancelled++;return never()}}})
  await new Promise(done=>schedule(done,0))
  assert.equal(cancelled,1)
})

test('missing decoded-only body is unavailable and cannot become empty success',async()=>{
  const result=await failure(catalog().run({now,fetchText:async()=>''}))
  assert.equal(result.rejected,true)
  assert.match(result.error.message,/unavailable/)
})

for(const [label,extra,rawClocks] of [
  ['unavailable original clock',{sourceRequestedAt:'unavailable-original-clock'},
    {sourceRequestedAt:'unavailable-original-clock',sourceCompletedAt:'2026-11-07T00:00:00.001Z'}],
  ['contradictory requestedAt alias',{requestedAt:'2026-11-07T01:00:00.000Z'},
    {sourceRequestedAt:'2026-11-07T00:00:00.000Z',requestedAt:'2026-11-07T01:00:00.000Z',sourceCompletedAt:'2026-11-07T00:00:00.001Z'}],
]) for(const entry of ['returned denial','frozen thrown original denial','frozen direct denial']) {
  test('IR02 retains available original denial bytes independently of '+label+' through '+entry,async()=>{
    const body='Explicitly synthetic saved denial body'
    const page=changed(body,{status:403,headers:{'content-type':'text/plain'},...extra})
    const reason=Object.freeze(Object.assign(Error('synthetic original denial'),entry==='frozen direct denial'?page:{originalResponse:page}))
    const audits=[],heldHosts=new Set()
    const result=await failure(catalog().run({now,heldHosts,onAudit:value=>audits.push(value),fetchPage:async()=>{
      if(entry==='returned denial')return page
      throw reason
    }}))
    assert.equal(result.rejected,true)
    assert.equal(result.error.status??result.error.originalResponse?.status,403)
    if(entry!=='returned denial')assert.equal(result.error,reason)
    const row=audits[0].responses[0]
    assert.equal(row.bodyBase64,Buffer.from(body).toString('base64'))
    assert.equal(row.sha256,'64da2d60932b2f04d30b0ed0d328c0bf0a01707637a847f3de1e42a67718427c')
    assert.equal(row.bytes,38)
    assert.equal(row.bodyComplete,true)
    assert.equal(row.transportQualified,false)
    assert.equal(row.sourceRequestedAt,null)
    assert.equal(row.sourceCompletedAt,'2026-11-07T00:00:00.001Z')
    assert.equal(row.acquisitionClocksQualified,false)
    for(const [key,value] of Object.entries(rawClocks))assert.equal(row.rawAcquisitionClocks[key],value)
    assert.equal(audits[0].rawPages[0].bodyBase64,page.bodyBase64)
    assert.equal(heldHosts.has('www.adpushup.com'),true)
    assert.equal(audits[0].lifecycleCleanupAllowed,false)
    assert.equal(audits[0].inventoryEvidence.listingComplete,false)
    assert.equal(audits[0].inventoryEvidence.reportedTotal,null)
  })
}

for(const status of [200,403]) test('IR02 retains native acquisition start before a frozen entity failure for HTTP '+status,async()=>{
  const reason=Object.freeze(Error('Explicitly synthetic native denial entity read failure')),audits=[]
  const clock='2026-11-07T00:00:00.000Z'
  let cancelled=0,released=0
  const result=await failure(catalog().run({now:()=>clock,onAudit:value=>audits.push(value),fetchImpl:async()=>({
    url:HOME,status,headers:{'content-type':'text/plain'},body:{getReader:()=>({read(){throw reason},
      cancel(){cancelled++},releaseLock(){released++}})}
  })}))
  assert.equal(result.rejected,true)
  if(status===403){assert.equal(result.error.status,403);assert.equal(result.error.bodyReadError,reason)}
  else assert.equal(result.error,reason)
  const row=audits[0].responses[0]
  assert.equal(row.sourceRequestedAt,clock)
  assert.equal(row.sourceCompletedAt,null)
  assert.equal(row.bodyComplete,false)
  assert.equal(row.bodyBase64,null)
  assert.equal(row.sha256,null)
  assert.equal(row.transportQualified,false)
  assert.equal(row.rawAcquisitionClocks.sourceRequestedAt,clock)
  assert.equal(audits[0].rawPages[0].sourceRequestedAt,clock)
  assert.equal(cancelled,1)
  assert.equal(released,1)
})

test('IR02 conflicting clocks do not bypass body bounds or retain an oversized raw entity',async()=>{
  const page=original();page.sourceRequestedAt='unavailable-original-clock'
  const audits=[]
  const result=await failure(catalog().run({now,maxResponseBytes:100,onAudit:value=>audits.push(value),fetchPage:async()=>page}))
  assert.equal(result.rejected,true)
  assert.equal(audits[0].responses[0].bodyBase64,null)
  assert.equal(audits[0].rawPages.some(row=>typeof row.bodyBase64==='string'),false)
  assert.equal(audits[0].responses[0].rawAcquisitionClocks?.sourceRequestedAt,'unavailable-original-clock')
  assert.equal(audits[0].responses[0].acquisitionClocksQualified,false)
})
