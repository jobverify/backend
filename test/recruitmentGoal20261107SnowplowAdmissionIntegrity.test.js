import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {createCurrentSnowplowScraper} from '../scraper/snowplow/currentNative.js'
import {fixtureTransport as legacyTransport} from '../scraper/snowplow/current.fixture.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/snowplow/test-data/current-native-20261106-evening.json.gz',import.meta.url))))
const HOME='https://snowplow.io/careers',BOARD='https://snowplow.careers.hibob.com/',SITE=BOARD+'api/career-site',FEED=BOARD+'api/job-ad'
const source=createCatalogScraper(getScraperCatalog().find(p=>p.source==='snowplow'))
const original=url=>fixture.packets.find(p=>p.requestUrl===url)
const sha=b=>createHash('sha256').update(b).digest('hex')
function io(change){const calls=[];return{calls,fetchPage:async(url,init)=>{calls.push(url);const p=original(url);assert.ok(p,'Retained exact endpoint only');assert.equal(init.method,'GET');const value={status:p.status,url:p.url,contentType:p.contentType,body:p.body};return change?change(value,url):value}}}
const settled=async promise=>{let timer;try{return await Promise.race([promise.then(value=>({kind:'fulfilled',value}),reason=>({kind:'rejected',reason})),new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'pending'}),180)})])}finally{clearTimeout(timer)}}
function incomplete(error,calls,expected){assert.equal(error.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.deepEqual(calls,expected);assert.equal(error.inventoryEvidence.listingComplete,false);assert.equal(error.inventoryEvidence.reportedTotal,null);assert.equal(error.inventoryEvidence.indiaFacetCount,null);assert.equal(error.sourceScopeComplete,false);assert.equal(error.abortRetries,true);return true}
test('Snowplow registered corporate/native disagreement stops before resources forms or closing reads',async()=>{
 const r=io();await assert.rejects(source.run(r),e=>{incomplete(e,r.calls,[HOME,BOARD,SITE,FEED]);assert.match(e.message,/corporate\/native inventory identity mismatch/);assert.equal(e.retainedNativeResponses.length,4);assert.equal(e.retainedNativeResponses[0].response.body,original(HOME).body);assert.equal(e.retainedNativeResponses.at(-1).response.body,original(FEED).body);return true})
})
for(const [label,change,pattern]of[
 ['unknown country',p=>{const n=JSON.parse(p.body);n.jobAdDetails[0].country='Unqualified native country';return{...p,body:JSON.stringify(n)}},/country/],
 ['changed role title',p=>{const n=JSON.parse(p.body);n.jobAdDetails[0].title+=' changed';return{...p,body:JSON.stringify(n)}},/criteria/],
 ['unknown raw native field',p=>{const n=JSON.parse(p.body);n.jobAdDetails[0].unreviewedHiringScope='India';return{...p,body:JSON.stringify(n)}},/fields|criteria/],
 ['invalid numeric precision',p=>({...p,body:p.body.replace('"jobAdDetails":','"unknownUnsafeValue":9007199254740993,"jobAdDetails":')}),/numeric/],
 ['malformed native JSON',p=>({...p,body:'{"original":"truncated"'}),/JSON/],
])test('Snowplow unqualified '+label+' stops at its first feed response',async()=>{
 const r=io((p,url)=>url===FEED?change(p):p)
 await assert.rejects(source.run(r),e=>{incomplete(e,r.calls,[HOME,BOARD,SITE,FEED]);assert.match(e.message,pattern);return true})
})
for(const status of [403,429,503])test('Snowplow primary HTTP'+status+' preserves original denial and stops immediately',async()=>{
 const r=io((p,url)=>url===HOME?{...p,status,headers:{'retry-after':'120'},body:'original denied entity'}:p)
 await assert.rejects(source.run(r),e=>{assert.deepEqual(r.calls,[HOME]);assert.equal(e.status,status);assert.equal(e.abortRetries,true);assert.equal(e.retainedNativeResponses[0].response.body,'original denied entity');if(status!==503)assert.equal(e.failureKind,'blocked_or_access_denied');return true})
})
for(const key of ['maxJobs','maxPages'])test('Snowplow zero '+key+' has no acquisition or source observation',async()=>{
 let calls=0,clock=0;const jobs=await source.run({[key]:0,fetchPage:()=>{calls++;assert.fail('zero cap admitted IO')},now:()=>{clock++;return'2026-11-07T00:00:00.000Z'}})
 const evidence=readInventoryEvidence(jobs);assert.equal(jobs.length,0);assert.equal(calls,0);assert.equal(clock,0);assert.equal(evidence.firstParty,false);assert.equal(evidence.pagesFetched,0);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.verifiedAt,null)
})
for(const key of ['maxPages','maxRequests'])test('Snowplow finite '+key+' stops before the next GET and retains the first original',async()=>{
 const r=io();await assert.rejects(source.run({...r,[key]:1}),e=>{assert.deepEqual(r.calls,[HOME]);assert.equal(e.code,key==='maxPages'?'SNOWPLOW_PAGE_BUDGET':'SNOWPLOW_REQUEST_BUDGET');assert.equal(e.retainedNativeResponses.length,1);assert.equal(e.retainedNativeResponses[0].response.body,original(HOME).body);return true})
})
test('Snowplow undefined runtime override preserves its factory page cap',async()=>{
 const r=io();await assert.rejects(createCurrentSnowplowScraper({...r,maxPages:1}).run({maxPages:undefined}),e=>{assert.equal(e.code,'SNOWPLOW_PAGE_BUDGET');assert.deepEqual(r.calls,[HOME]);return true})
})
test('Snowplow invalid acquisition controls reject before callbacks',async()=>{
 for(const options of [{maxPages:-1},{maxRequests:0},{readTimeoutMs:0},{sourceTimeoutMs:0},{auditTimeoutMs:0},{onAudit:true},{now:true}]){let calls=0;await assert.rejects(source.run({...options,fetchPage:()=>{calls++;return{}}}),e=>e.code==='SNOWPLOW_INVALID_OPTIONS');assert.equal(calls,0)}
})
for(const reason of [Object.freeze({opaque:'caller'}),false,0,''])test('Snowplow pre-abort keeps exact caller reason '+String(reason),async()=>{
 const c=new AbortController();c.abort(reason);const r=await settled(source.run({signal:c.signal,fetchPage:()=>assert.fail('pre-abort read')}));assert.equal(r.kind,'rejected');assert.equal(r.reason,reason)
})
test('Snowplow caller abort bounds ignored transport without wrapping its opaque reason',async()=>{
 const c=new AbortController(),reason=Object.freeze({opaque:'in-flight'});let start;const began=new Promise(r=>{start=r})
 const promise=source.run({signal:c.signal,fetchPage:()=>{start();return new Promise(()=>{})}});await began;c.abort(reason);const result=await settled(promise);assert.equal(result.kind,'rejected');assert.equal(result.reason,reason)
})
test('Snowplow source deadline bounds ignored transport and retains its admitted attempt',async()=>{
 const result=await settled(source.run({sourceTimeoutMs:5,fetchPage:()=>new Promise(()=>{})}));assert.equal(result.kind,'rejected');assert.equal(result.reason.code,'SNOWPLOW_SOURCE_TIMEOUT');assert.equal(result.reason.nativeEvidence.attempts.length,1);assert.equal(result.reason.retainedNativeResponses.length,0)
})
test('Snowplow zero-scan audit is bounded without manufacturing an observation',async()=>{
 const result=await settled(source.run({maxJobs:0,auditTimeoutMs:5,fetchPage:()=>assert.fail('skipped scan'),onAudit:()=>new Promise(()=>{})}));assert.equal(result.kind,'rejected');assert.equal(result.reason.code,'SNOWPLOW_AUDIT_TIMEOUT')
})
test('Snowplow first source failure survives failed audit output',async()=>{
 const r=io();await assert.rejects(source.run({...r,onAudit:()=>{throw Error('secondary audit failure')}}),e=>{assert.equal(e.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.match(e.message,/corporate\/native/);assert.match(e.nativeEvidence.auditSinkFailure.message,/secondary audit/);return true})
})
test('Snowplow synchronous late materialized response preserves returned original bytes',async()=>{
 let calls=0;const result=await settled(source.run({sourceTimeoutMs:5,fetchPage:url=>{calls++;const begin=performance.now();while(performance.now()-begin<25){};return{status:200,url,contentType:'text/html',body:original(HOME).body}}}));assert.equal(result.kind,'rejected');assert.equal(result.reason.code,'SNOWPLOW_SOURCE_TIMEOUT');assert.equal(calls,1);assert.equal(sha(result.reason.retainedNativeResponses[0].response.body),sha(original(HOME).body))
})
test('Snowplow native denied headers do not wait for a hanging entity',async t=>{
 let read=false,canceled=false;t.mock.method(globalThis,'fetch',async url=>({url,status:403,headers:new Headers({'content-type':'text/html','retry-after':'120'}),body:new ReadableStream({pull(){read=true;return new Promise(()=>{})},cancel(){canceled=true}},{highWaterMark:0})}))
 const result=await settled(source.run({readTimeoutMs:20}));assert.equal(result.kind,'rejected');assert.equal(result.reason.status,403);assert.equal(result.reason.failureKind,'blocked_or_access_denied');assert.equal(result.reason.retainedNativeResponses[0].response.headers['retry-after'],'120');assert.equal(result.reason.retainedNativeResponses[0].response.body,null);assert.equal(read,false);assert.equal(canceled,true)
})

const busy=()=>{const at=performance.now();while(performance.now()-at<25){}}
test('Snowplow native late headers retain original denial before deadline rejection',async t=>{
 let canceled=false;t.mock.method(globalThis,'fetch',url=>{busy();return{url,status:403,headers:new Headers({'retry-after':'120','content-type':'text/html'}),body:{cancel(){canceled=true}}}})
 const result=await settled(source.run({readTimeoutMs:5}));assert.equal(result.kind,'rejected');const p=result.reason.retainedNativeResponses[0];assert.equal(p.url,HOME);assert.equal(p.response.status,403);assert.equal(p.response.headers['retry-after'],'120');assert.equal(p.response.body,null);assert.equal(canceled,true)
})
test('Snowplow native partial returned bytes survive read deadline rejection',async t=>{
 const bytes=Buffer.from('Original returned partial entity');let reads=0,canceled=false
 t.mock.method(globalThis,'fetch',async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read(){reads++;busy();return{done:false,value:bytes}},cancel(){canceled=true},releaseLock(){}})}}))
 const result=await settled(source.run({readTimeoutMs:5}));assert.equal(result.kind,'rejected');const p=result.reason.retainedNativeResponses[0].response;assert.equal(reads,1);assert.equal(canceled,true);assert.equal(p.bodyComplete,false);assert.equal(p.receivedBodyBytes,bytes.length);assert.equal(p.rawBodyBase64,bytes.toString('base64'))
})
test('Snowplow native completed returned entity keeps completion state at deadline',async t=>{
 const bytes=Buffer.from('Original complete entity');let reads=0
 t.mock.method(globalThis,'fetch',async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read(){if(reads++===0)return{done:false,value:bytes};busy();return{done:true}},cancel(){},releaseLock(){}})}}))
 const result=await settled(source.run({readTimeoutMs:5}));assert.equal(result.kind,'rejected');const p=result.reason.retainedNativeResponses[0].response;assert.equal(reads,2);assert.equal(p.bodyComplete,true);assert.equal(p.rawBodyBase64,bytes.toString('base64'));assert.ok(p.completedAt)
})
test('Snowplow native invalid final identity retains available metadata before any entity read',async t=>{
 let read=false,canceled=false;t.mock.method(globalThis,'fetch',async()=>({url:'https://wrong.example/original',status:200,headers:new Headers({'content-type':'text/html','x-original':'retained'}),body:{getReader(){read=true},cancel(){canceled=true}}}))
 const result=await settled(source.run());assert.equal(result.kind,'rejected');const p=result.reason.retainedNativeResponses[0];assert.equal(p.url,HOME);assert.equal(p.response.url,'https://wrong.example/original');assert.equal(p.response.headers['x-original'],'retained');assert.equal(read,false);assert.equal(canceled,true)
})

test('Snowplow registered options cannot enable archived continuation',async()=>{const r=io();await assert.rejects(source.run({...r,diagnostic:true,mode:{diagnostic:true}}),e=>incomplete(e,r.calls,[HOME,BOARD,SITE,FEED]))})

// Whole-review regressions: every first qualified/failed surface owns its receipt.
for(const [label,change]of[
 ['unknown site scope',data=>{data.unknownMandatoryScope={country:'India'}}],
 ['missing native listing',data=>{data.sections=data.sections.filter(s=>s.type!=='job_listing')}],
])test('Snowplow rejects '+label+' at SITE before FEED',async()=>{
 const r=io((p,url)=>{if(url!==SITE)return p;const data=JSON.parse(p.body);change(data);return{...p,body:JSON.stringify(data)}})
 await assert.rejects(source.run(r),e=>{incomplete(e,r.calls,[HOME,BOARD,SITE]);assert.match(e.message,/site|configuration|scope/i);return true})
})
test('Snowplow legacy site scope is rejected before its feed or closing reads',async()=>{
 const r=legacyTransport((p,url)=>{if(url===SITE){const data=JSON.parse(p.body);data.unknownMandatoryScope=true;p.body=JSON.stringify(data)}})
 await assert.rejects(createCurrentSnowplowScraper(r).run(),e=>{assert.equal(e.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.deepEqual(r.calls.map(c=>c.url),[HOME,BOARD,SITE]);assert.match(e.message,/site|configuration|scope/i);assert.equal(e.retainedNativeResponses.at(-1).url,SITE);return true})
})
test('Snowplow legacy extra feed envelope cannot admit closing requests',async()=>{
 const r=legacyTransport((p,url)=>{if(url===FEED){const data=JSON.parse(p.body);data.nextPage='unreviewed-next-scope';p.body=JSON.stringify(data)}})
 await assert.rejects(createCurrentSnowplowScraper(r).run(),e=>{assert.equal(e.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.deepEqual(r.calls.map(c=>c.url),[HOME,BOARD,SITE,FEED]);assert.match(e.message,/scope|envelope/i);assert.equal(e.retainedNativeResponses.at(-1).url,FEED);return true})
})
for(const reason of [false,0,'',null,undefined])test('Snowplow preserves falsy transport rejection '+String(reason),async()=>{
 await assert.rejects(source.run({fetchPage:()=>Promise.reject(reason)}),e=>{assert.equal(e.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.ok(Object.hasOwn(e,'cause'));assert.equal(e.cause,reason);assert.equal(e.nativeEvidence.attempts.length,1);assert.equal(e.retainedNativeResponses.length,0);return true})
})
for(const reason of [false,0,'',null,undefined])test('Snowplow falsy audit rejection cannot return a successful legacy inventory: '+String(reason),async()=>{
 const r=legacyTransport();await assert.rejects(createCurrentSnowplowScraper({...r,onAudit:()=>Promise.reject(reason)}).run(),e=>{assert.equal(e.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.ok(Object.hasOwn(e,'cause'));assert.equal(e.cause,reason);assert.equal(e.retainedNativeResponses.length,r.calls.length);assert.equal(e.inventoryEvidence.listingComplete,false);return true})
})
test('Snowplow first falsy transport failure survives a later audit rejection',async()=>{
 await assert.rejects(source.run({fetchPage:()=>Promise.reject(false),onAudit:()=>Promise.reject(Error('secondary audit error'))}),e=>{assert.equal(e.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.equal(e.cause,false);assert.match(e.nativeEvidence.auditSinkFailure.message,/secondary audit/);return true})
})
for(const freeze of [false,true])test('Snowplow audit mutation'+(freeze?' and freezing/rejection':'')+' cannot erase or replace a primary denial',async()=>{
 const r=io(p=>({...p,status:403,body:'original denied evidence'}))
 await assert.rejects(source.run({...r,onAudit:value=>{value.retainedNativeResponses.length=0;value.attempts.length=0;if(freeze){Object.freeze(value);throw Error('observer freeze failure')}}}),e=>{
  assert.equal(e.status,403);assert.equal(e.failureKind,'blocked_or_access_denied');assert.deepEqual(r.calls,[HOME]);assert.equal(e.retainedNativeResponses.length,1);assert.equal(e.retainedNativeResponses[0].response.body,'original denied evidence');assert.equal(e.nativeEvidence.attempts.length,1);assert.equal(e.inventoryEvidence.pagesFetched,1);if(freeze)assert.match(e.nativeEvidence.auditSinkFailure.message,/observer freeze failure/);return true
 })
})
for(const earlier of [false,true])test('Snowplow native byte limit retains available original prefix '+(earlier?'after earlier chunks':'from oversized first chunk'),async t=>{
 const cap=8*1024*1024,first=earlier?Buffer.from('original earlier bytes'):Buffer.alloc(0),last=Buffer.alloc(cap+1-first.length,0x71),chunks=earlier?[first,last]:[last];let reads=0,canceled=false
 t.mock.method(globalThis,'fetch',async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read(){return{done:false,value:chunks[reads++]}},cancel(){canceled=true},releaseLock(){}})}}))
 await assert.rejects(source.run(),e=>{assert.equal(e.code,'SNOWPLOW_BODY_LIMIT');const p=e.retainedNativeResponses[0].response;assert.equal(reads,chunks.length);assert.equal(canceled,true);assert.equal(p.bodyComplete,false);assert.equal(p.receivedBodyBytes,cap+1);assert.equal(p.bodyBytes,cap);const expected=Buffer.concat(chunks).subarray(0,cap);assert.equal(sha(Buffer.from(p.rawBodyBase64,'base64')),sha(expected));return true})
})
test('Snowplow reused transport object preserves each original response occurrence',async()=>{
 const scratch={},r=io(p=>Object.assign(scratch,p))
 await assert.rejects(source.run(r),e=>{incomplete(e,r.calls,[HOME,BOARD,SITE,FEED]);assert.equal(e.retainedNativeResponses.length,4);assert.equal(e.retainedNativeResponses[0].response.body,original(HOME).body);assert.equal(e.retainedNativeResponses[1].response.body,original(BOARD).body);assert.equal(e.retainedNativeResponses[3].response.body,original(FEED).body);return true})
})
test('Snowplow valid legacy transport may reuse a response object without losing native scope',async()=>{
 const scratch={},r=legacyTransport(),jobs=await createCurrentSnowplowScraper({fetchPage:async(url,init)=>Object.assign(scratch,await r.fetchPage(url,init))}).run()
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.reportedTotal,7);assert.equal(evidence.pagesFetched,r.calls.length)
})
