import assert from 'node:assert/strict'
import test, {after} from 'node:test'
import fs from 'node:fs'
import https from 'node:https'
import {EventEmitter} from 'node:events'

const homepage=fs.readFileSync(new URL('./fixtures/official-homepage.html',import.meta.url),'utf8')
const listing=JSON.parse(fs.readFileSync(new URL('./fixtures/alljobs-page-1.json',import.meta.url),'utf8'))
// Explicit unit transport installed before the default Darwinbox instance is
// constructed. Unexpected defaults are counted and rejected without real I/O.
const originalFetch=globalThis.fetch
let defaultCalls=[]
let defaultTransport=async()=>{throw Error('CONTROLLED unexpected default transport; no native availability claim')}
globalThis.fetch=async(...args)=>{defaultCalls.push(args);return defaultTransport(...args)}
after(()=>{globalThis.fetch=originalFetch})
const hub=await import('./script.js')
const alias=await import('../greenko/script.js')
const {buildScrapers}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
const variants=[['Hub',()=>hub.createGreenkoHubScraper({now:()=> '2026-07-10T00:00:00.000Z'})],['effective Greenko',()=>alias.createGreenkoScraper({now:()=> '2026-07-10T00:00:00.000Z'})]]
const reasonFactories=[
  ['frozen HTTP403 Error',()=>Object.freeze(new Error('HTTP 403: opaque caller cancellation'))],
  ['frozen object',()=>Object.freeze({kind:'opaque caller cancellation'})],
  ['string',()=> 'opaque caller cancellation'],
  ['null',()=>null],
  ['default reason',()=>undefined],
  ['throwing code/surface getters',()=>Object.freeze(Object.defineProperties(new Error('opaque caller cancellation'),{
    code:{get(){throw Error('Caller code getter must remain opaque')}},
    surface:{get(){throw Error('Caller surface getter must remain opaque')}},
  }))],
]
const abort=(controller,reason)=>reason===undefined?controller.abort():controller.abort(reason)
const pending=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}}
const outcome=async(promise,ms=100)=>{
  let timer
  try{return await Promise.race([promise.then(value=>({kind:'fulfilled',value}),reason=>({kind:'rejected',reason})),new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'unsettled'}),ms)})])}
  finally{clearTimeout(timer)}
}
const exactAbort=(result,signal)=>{assert.equal(result.kind,'rejected','caller abort must settle the run');assert.ok(Object.is(result.reason,signal.reason),'opaque caller reason identity must survive')}
const noDetail=async()=>{throw Error('CONTROLLED missing-detail transport failure; no native upstream assertion')}
const emptyPage={status:'success',data:[],job_counts:0}

for(const [label,create] of variants)for(const [kind,reason]of reasonFactories){
  test(label+' pre-abort makes zero homepage/listing/detail calls: '+kind,async()=>{
    const controller=new AbortController();abort(controller,reason())
    const calls=[]
    const result=await outcome(create().run({signal:controller.signal,fetchText:async()=>{calls.push('homepage');return homepage},fetchListingPage:async()=>{calls.push('listing');return emptyPage},fetchJobDetail:async()=>{calls.push('detail');return null}}))
    assert.deepEqual(calls,[]);exactAbort(result,controller.signal)
  })
  test(label+' noncooperative homepage abort settles exactly and starts no next call: '+kind,async()=>{
    const controller=new AbortController(),wait=pending(),entered=pending(),calls=[]
    const resultPromise=outcome(create().run({signal:controller.signal,fetchText:async()=>{calls.push('homepage');entered.resolve();return wait.promise},fetchListingPage:async()=>{calls.push('listing');return emptyPage},fetchJobDetail:noDetail}))
    await entered.promise;abort(controller,reason())
    const result=await resultPromise
    wait.resolve(homepage);await new Promise(resolve=>setImmediate(resolve))
    exactAbort(result,controller.signal);assert.deepEqual(calls,['homepage'])
  })
}

for(const [label,create] of variants){
  test(label+' forwards the same signal and existing role detail callback with honest partial qualifiers',async()=>{
    const controller=new AbortController(),calls=[],beforeDefault=defaultCalls.length
    const jobs=await create().run({signal:controller.signal,fetchText:async(url,options)=>{calls.push(['homepage',url,options?.signal]);return homepage},fetchListingPage:async options=>{calls.push(['listing',options.page,options.signal]);return listing},fetchJobDetail:async options=>{calls.push(['detail',options.jobId,options.signal]);return noDetail()}})
    assert.equal(defaultCalls.length,beforeDefault,'provided detail transport must prevent all default requests')
    assert.deepEqual(calls.map(row=>row.slice(0,2)),[['homepage',hub.OFFICIAL_HOMEPAGE_URL],['listing',1],['detail','a6a366a37046e4'],['detail','a6a225d73da6e0']])
    assert.ok(calls.every(row=>row[2]===controller.signal))
    assert.deepEqual(jobs.map(job=>job.jobDescription),[null,'<p><br /></p>'])
    assert.deepEqual(jobs.map(job=>job.postingDate),['20-Jun-2026','05-Jun-2026'])
    assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.sourceDetailFailureKind==='upstream'&&job.sourceListingComplete===false))
    assert.ok(jobs.every(job=>job.source===(label==='Hub'?'greenkohub':'greenko')))
    const evidence=readInventoryEvidence(jobs)
    // Hub preserves the lower inventory diagnostic. Existing Greenko .map
    // does not carry that array symbol; this task introduces no scope proof.
    if(label==='Hub'){assert.equal(evidence.status,'discovery-only');assert.equal(evidence.reportedTotal,2);assert.equal(evidence.listingComplete,false)}
  })
  for(const stage of ['listing','detail'])test(label+' abort bounds a noncooperative '+stage+' callback and prevents the next role',async()=>{
    const controller=new AbortController(),wait=pending(),entered=pending(),calls=[],beforeDefault=defaultCalls.length
    const run=create().run({signal:controller.signal,fetchText:async()=>{calls.push('homepage');return homepage},fetchListingPage:async()=>{calls.push('listing');if(stage==='listing'){entered.resolve();return wait.promise}return listing},fetchJobDetail:async({jobId})=>{calls.push(jobId);entered.resolve();return wait.promise}})
    const resultPromise=outcome(run)
    const began=await outcome(entered.promise)
    abort(controller,null)
    wait.resolve(stage==='listing'?emptyPage:null)
    const result=await resultPromise
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(began.kind,'fulfilled','existing callback must reach the lower runner')
    exactAbort(result,controller.signal)
    assert.equal(defaultCalls.length,beforeDefault)
    assert.deepEqual(calls,stage==='listing'?['homepage','listing']:['homepage','listing','a6a366a37046e4'])
  })
  test(label+' immediately propagates typed listing denial with the exact original cause and no shell',async()=>{
    const denial=Object.freeze(Object.assign(new Error('HTTP 403 for controlled listing'),{status:403})),calls=[]
    const result=await outcome(create().run({fetchText:async url=>{calls.push(url);return homepage},fetchListingPage:async()=>{calls.push('listing');throw denial},fetchJobDetail:noDetail}))
    assert.equal(result.kind,'rejected')
    assert.equal(result.reason.name,'DarwinboxUpstreamUnavailableError');assert.ok(result.reason.cause===denial)
    assert.deepEqual(calls,[hub.OFFICIAL_HOMEPAGE_URL,'listing'])
  })
  test(label+' ordinary non-403 listing failure remains the same object without another URL',async()=>{
    const failure=Object.freeze(new Error('CONTROLLED ordinary listing failure')),calls=[]
    const result=await outcome(create().run({fetchText:async url=>{calls.push(url);return homepage},fetchListingPage:async()=>{throw failure},fetchJobDetail:noDetail}))
    assert.equal(result.kind,'rejected');assert.ok(result.reason===failure);assert.deepEqual(calls,[hub.OFFICIAL_HOMEPAGE_URL])
  })
}

test('official fetch passes caller signal to the existing retry transport and preserves the deadline',async()=>{
  const controller=new AbortController(),calls=[]
  const value=await hub.fetchOfficialGreenkoText(hub.OFFICIAL_HOMEPAGE_URL,{signal:controller.signal,fetchTextWithRetryImpl:async(url,options)=>{calls.push({url,options});return homepage},insecureHtmlFetch:async()=>assert.fail('healthy fetch must not use the alternate transport')})
  assert.equal(value,homepage);assert.equal(calls.length,1);assert.equal(calls[0].options.signal,controller.signal);assert.equal(calls[0].options.timeoutMs,15000)
})
for(const [kind,makeReason]of reasonFactories)test('official certificate path cannot inspect/replace caller cancellation: '+kind,async()=>{
  const controller=new AbortController(),wait=pending(),entered=pending();let alternate=0
  const resultPromise=outcome(hub.fetchOfficialGreenkoText(hub.OFFICIAL_HOMEPAGE_URL,{signal:controller.signal,fetchTextWithRetryImpl:async()=>{entered.resolve();return wait.promise},insecureHtmlFetch:async()=>{alternate++;return homepage}}))
  await entered.promise;abort(controller,makeReason());const result=await resultPromise
  wait.resolve(homepage);await new Promise(resolve=>setImmediate(resolve))
  exactAbort(result,controller.signal);assert.equal(alternate,0)
})
test('a synchronous aborting certificate failure cannot start a fallback read',async()=>{
  const controller=new AbortController(),reason=Object.freeze(new Error('caller cancellation'));let alternate=0
  const result=await outcome(hub.fetchOfficialGreenkoText(hub.OFFICIAL_HOMEPAGE_URL,{signal:controller.signal,fetchTextWithRetryImpl:async()=>{controller.abort(reason);throw Error('unable to verify the first certificate')},insecureHtmlFetch:async()=>{alternate++;return homepage}}))
  exactAbort(result,controller.signal);assert.equal(alternate,0)
})
test('the existing scoped certificate fallback forwards signal without changing TLS verification or timeout',async t=>{
  const controller=new AbortController(),calls=[];let timeout
  t.mock.method(https,'request',(url,options,callback)=>{
    const request=new EventEmitter();request.setTimeout=(ms,handler)=>{timeout={ms,handler};return request};request.end=()=>{const response=new EventEmitter();response.statusCode=200;response.setEncoding=()=>{};callback(response);queueMicrotask(()=>{response.emit('data',homepage);response.emit('end')})};request.destroy=error=>request.emit('error',error);calls.push({url,options});return request
  })
  const result=await hub.fetchOfficialGreenkoText(hub.OFFICIAL_HOMEPAGE_URL,{signal:controller.signal,fetchTextWithRetryImpl:async()=>{throw Error('unable to verify the first certificate')}})
  assert.equal(result,homepage);assert.equal(calls.length,1);assert.equal(calls[0].options.signal,controller.signal);assert.equal(calls[0].options.rejectUnauthorized,true);assert.equal(timeout.ms,15000)
})
test('direct HTTPS reader pre-abort performs zero request calls',async t=>{
  const controller=new AbortController();controller.abort(null);let calls=0
  t.mock.method(https,'request',()=>{calls++;throw Error('unexpected request')})
  const result=await outcome(hub.fetchOfficialGreenkoTextWithoutTlsVerification(hub.OFFICIAL_HOMEPAGE_URL,{signal:controller.signal}))
  assert.equal(calls,0);exactAbort(result,controller.signal)
})
test('direct HTTPS reader abort settles a noncooperative injected request with exact reason',async t=>{
  const controller=new AbortController(),started=pending();let calls=0
  t.mock.method(https,'request',()=>{calls++;const request=new EventEmitter();request.setTimeout=()=>request;request.end=()=>started.resolve();return request})
  const resultPromise=outcome(hub.fetchOfficialGreenkoTextWithoutTlsVerification(hub.OFFICIAL_HOMEPAGE_URL,{signal:controller.signal}))
  await started.promise;controller.abort(null);const result=await resultPromise
  exactAbort(result,controller.signal);assert.equal(calls,1)
})
test('caller listeners are cleaned after successful and ordinary failed wrapper runs',async()=>{
  const controller=new AbortController(),signal=controller.signal,add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal),active=new Set()
  signal.addEventListener=(type,listener,options)=>{if(type==='abort')active.add(listener);return add(type,listener,options)}
  signal.removeEventListener=(type,listener,options)=>{if(type==='abort')active.delete(listener);return remove(type,listener,options)}
  await alias.createGreenkoScraper().run({signal,fetchText:async()=>homepage,fetchListingPage:async()=>emptyPage,fetchJobDetail:noDetail})
  assert.equal(active.size,0)
  const error=Error('CONTROLLED listing error')
  const result=await outcome(alias.createGreenkoScraper().run({signal,fetchText:async()=>homepage,fetchListingPage:async()=>{throw error},fetchJobDetail:noDetail}))
  assert.ok(result.reason===error);assert.equal(active.size,0)
})
test('real registered Greenko pre-abort preserves caller identity before any default read',async()=>{
  const scraper=buildScrapers().find(row=>row.name==='greenko');assert.ok(scraper)
  const controller=new AbortController();controller.abort(Object.freeze(new Error('HTTP 403: registered caller reason')))
  const beforeDefault=defaultCalls.length,result=await outcome(scraper.run({signal:controller.signal}))
  assert.equal(defaultCalls.length,beforeDefault);exactAbort(result,controller.signal)
})
test('real registered Greenko pending default homepage abort stops before native listing requests',async()=>{
  const scraper=buildScrapers().find(row=>row.name==='greenko'),controller=new AbortController(),wait=pending(),entered=pending(),beforeDefault=defaultCalls.length
  defaultTransport=async url=>{assert.equal(String(url),hub.OFFICIAL_HOMEPAGE_URL);entered.resolve();return wait.promise}
  const resultPromise=outcome(scraper.run({signal:controller.signal}))
  await entered.promise;controller.abort(null);const result=await resultPromise
  wait.resolve(new Response(homepage,{status:200}));await new Promise(resolve=>setImmediate(resolve))
  exactAbort(result,controller.signal);assert.equal(defaultCalls.length,beforeDefault+1)
})

for(const label of ['HTTP 403','existing timeout'])test('official '+label+' failure remains the same object without another transport',async()=>{
  const error=Object.freeze(Error('CONTROLLED '+label)),calls=[]
  const result=await outcome(hub.fetchOfficialGreenkoText(hub.OFFICIAL_HOMEPAGE_URL,{fetchTextWithRetryImpl:async()=>{calls.push('normal');throw error},insecureHtmlFetch:async()=>{calls.push('alternate');return homepage}}))
  assert.equal(result.kind,'rejected');assert.ok(result.reason===error);assert.deepEqual(calls,['normal'])
})
test('the existing HTTPS timeout still destroys and rejects the same request error',async t=>{
  let timeout,destroyed,calls=0
  t.mock.method(https,'request',()=>{calls++;const request=new EventEmitter();request.setTimeout=(ms,handler)=>{assert.equal(ms,15000);timeout=handler;return request};request.end=()=>queueMicrotask(timeout);request.destroy=error=>{destroyed=error;request.emit('error',error)};return request})
  const result=await outcome(hub.fetchOfficialGreenkoTextWithoutTlsVerification(hub.OFFICIAL_HOMEPAGE_URL))
  assert.equal(result.kind,'rejected');assert.ok(result.reason===destroyed);assert.match(destroyed.message,/Request timed out after 15000ms/);assert.equal(calls,1)
})
test('caller listeners are cleaned immediately when a noncooperative wrapper read is aborted',async()=>{
  const controller=new AbortController(),signal=controller.signal,wait=pending(),entered=pending(),add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal),active=new Set()
  signal.addEventListener=(type,listener,options)=>{if(type==='abort')active.add(listener);return add(type,listener,options)}
  signal.removeEventListener=(type,listener,options)=>{if(type==='abort')active.delete(listener);return remove(type,listener,options)}
  const promise=outcome(alias.createGreenkoScraper().run({signal,fetchText:async()=>{entered.resolve();return wait.promise},fetchListingPage:async()=>emptyPage,fetchJobDetail:noDetail}))
  await entered.promise;controller.abort(null);const result=await promise
  exactAbort(result,signal);assert.equal(active.size,0)
  wait.resolve(homepage);await new Promise(resolve=>setImmediate(resolve));assert.equal(active.size,0)
})
test('real registered Greenko keeps supplied detail failures explicit and forwards the native signal',async()=>{
  const scraper=buildScrapers().find(row=>row.name==='greenko'),controller=new AbortController(),details=[],beforeDefault=defaultCalls.length
  const jobs=await scraper.run({signal:controller.signal,fetchText:async()=>homepage,fetchListingPage:async()=>listing,fetchJobDetail:async options=>{details.push(options);return noDetail()}})
  assert.equal(defaultCalls.length,beforeDefault)
  assert.deepEqual(details.map(row=>row.jobId),['a6a366a37046e4','a6a225d73da6e0']);assert.ok(details.every(row=>row.signal===controller.signal))
  assert.deepEqual(jobs.map(row=>row.jobId),['a6a366a37046e4','a6a225d73da6e0'])
  assert.ok(jobs.every(row=>row.source==='greenko'&&row.company==='Greenko'&&row.sourceDetailComplete===false&&row.sourceDetailFailureKind==='upstream'&&row.sourceListingComplete===false))
})
test('real registered Greenko propagates denial with the original cause and never returns fabricated rows',async()=>{
  const scraper=buildScrapers().find(row=>row.name==='greenko'),denial=Object.freeze(Object.assign(Error('HTTP 403: controlled listing denial'),{status:403})),calls=[]
  const result=await outcome(scraper.run({fetchText:async url=>{calls.push(url);return homepage},fetchListingPage:async()=>{throw denial},fetchJobDetail:noDetail}))
  assert.equal(result.kind,'rejected');assert.equal(result.reason.name,'DarwinboxUpstreamUnavailableError');assert.ok(result.reason.cause===denial);assert.deepEqual(calls,[hub.OFFICIAL_HOMEPAGE_URL])
})

// The original54-control prefix records v1's existing metadata loss. The
// following paired controls require that same partial diagnostic to survive.
for(const kind of ['direct effective wrapper','real registered decorator'])test('partial inventory diagnostic survives '+kind,async()=>{
  const scraper=kind==='direct effective wrapper'?alias.createGreenkoScraper({now:()=> '2026-07-10T00:00:00.000Z'}):buildScrapers().find(row=>row.name==='greenko')
  const jobs=await scraper.run({fetchText:async()=>homepage,fetchListingPage:async()=>listing,fetchJobDetail:noDetail})
  assert.equal(listing.data.length,3);assert.equal(listing.job_counts,2)
  assert.deepEqual(jobs.map(job=>job.jobId),['a6a366a37046e4','a6a225d73da6e0'])
  assert.ok(jobs.every(job=>job.source==='greenko'&&job.company==='Greenko'&&job.sourceDetailComplete===false&&job.sourceListingComplete===false))
  const evidence=readInventoryEvidence(jobs)
  assert.ok(evidence,'the validated existing lower inventory carrier must not disappear')
  assert.equal(evidence.reportedTotal,2);assert.equal(evidence.pagesFetched,1)
  assert.equal(evidence.status,'discovery-only');assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.firstParty,true)
  assert.equal(evidence.surface,'https://greenkogroup.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.equal(evidence.reason,'darwinbox-incomplete-or-limited-pagination')
  const {isFreshCompleteInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
  assert.equal(isFreshCompleteInventoryEvidence(evidence),false)
})
