import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {collect,runNative} from '../scraper/imtf/native.js'
import {createNativeTransport,MAX_BYTES} from '../scraper/imtf/transport.js'
import {HOME,CAREERS,parseListing} from '../scraper/imtf/parser.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/imtf/test-data/current-board-20261105.json.gz',import.meta.url))))
const originals=new Map(Object.entries(fixture.responses).map(([url,p])=>[url,{...p,body:Buffer.from(p.bodyBase64,'base64')}]))
const listing=parseListing(originals.get(HOME).body.toString('utf8'),originals.get(CAREERS).body.toString('utf8'))
const first=listing.candidates[0].url
const provider=getScraperCatalog().find(p=>p.source==='imtf')
const registered=options=>createCatalogScraper(provider).run(options)
const noRead=()=>assert.fail('No public acquisition was authorized by these caller limits')
function reader(change){const calls=[];return{calls,transport:async(url,init)=>{
 calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
 const page=originals.get(url);assert.ok(page,'Only retained source-owned original endpoints: '+url)
 return change?change({...page,body:Buffer.from(page.body)},url):{...page,body:Buffer.from(page.body)}
}}}
const bounded=async promise=>{let timer;try{return await Promise.race([promise.then(value=>({kind:'fulfilled',value}),reason=>({kind:'rejected',reason})),new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'pending'}),150)})])}finally{clearTimeout(timer)}}

for(const status of [403,429,503])test('IMTF role HTTP'+status+' stops admission before all other roles and inventories',async()=>{
 const io=reader((p,url)=>url===first?{...p,status,body:Buffer.from('Original upstream failure')} :p)
 const result=await collect(io)
 assert.deepEqual(io.calls,[HOME,CAREERS,first])
 assert.equal(result.verifiedZeroInventory,false);assert.equal(result.sourceScopeComplete,false)
 assert.equal(result.retainedResponses.at(-1).status,status)
})
test('IMTF unavailable injected role read stops after the first failed attempt',async()=>{
 const reason=Object.assign(Error('Original unavailable role'),{code:'ECONNRESET'})
 const io=reader((p,url)=>{if(url===first)throw reason;return p})
 const result=await collect(io)
 assert.deepEqual(io.calls,[HOME,CAREERS,first]);assert.equal(result.failures.length,1)
 assert.equal(result.failures[0].code,'ECONNRESET');assert.equal(result.verifiedZeroInventory,false)
})
test('IMTF incomplete original role entity stops admission and cannot qualify another inventory',async()=>{
 const io=reader((p,url)=>url===first?{...p,bodyComplete:false}:p)
 const result=await collect(io)
 assert.deepEqual(io.calls,[HOME,CAREERS,first]);assert.equal(result.verifiedZeroInventory,false)
 assert.equal(result.retainedResponses.at(-1).bodyComplete,false)
})
test('IMTF unqualified primary role metadata stops admission rather than invoking its fallback',async()=>{
 const io=reader((p,url)=>url===first?{...p,body:Buffer.from('<html><head><title>Changed role</title></head><body>Unqualified role identity</body></html>')}:p)
 const result=await collect(io)
 assert.deepEqual(io.calls,[HOME,CAREERS,first]);assert.equal(result.verifiedZeroInventory,false)
})
test('IMTF registered primary403 retains blocked classification and original denied evidence',async()=>{
 const io=reader((p,url)=>url===HOME?{...p,status:403,body:Buffer.from('Original denied body')}:p)
 await assert.rejects(registered(io),e=>{
  assert.equal(e.status,403);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.abortRetries,true)
  assert.equal(e.nativeEvidence.retainedResponses[0].status,403)
  assert.equal(e.nativeEvidence.retainedResponses[0].rawBodyBase64,Buffer.from('Original denied body').toString('base64'))
  return true
 })
 assert.deepEqual(io.calls,[HOME])
})
for(const option of ['maxJobs','maxPages'])test('IMTF registered zero '+option+' performs no reads and cannot certify empty inventory',async()=>{
 const jobs=await registered({[option]:0,transport:noRead})
 assert.equal(jobs.length,0);const e=readInventoryEvidence(jobs)
 assert.equal(e.status,'coverage-gap');assert.equal(e.firstParty,false);assert.equal(e.pagesFetched,0)
 assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.listingComplete,false)
})
test('IMTF finite request budget stops before the next original GET',async()=>{
 const io=reader(),result=await collect({...io,maxRequests:1})
 assert.deepEqual(io.calls,[HOME]);assert.equal(result.failures[0].code,'IMTF_REQUEST_BUDGET')
 assert.equal(result.verifiedZeroInventory,false)
})
for(const reason of [Object.freeze({cancel:'opaque'}),false,0,''])test('IMTF pre-aborted caller reason stays exact: '+String(reason),async()=>{
 const c=new AbortController();c.abort(reason)
 const result=await bounded(registered({signal:c.signal,transport:noRead,maxJobs:0}))
 assert.equal(result.kind,'rejected');assert.equal(result.reason,reason)
})
test('IMTF caller cancellation bounds a signal-ignoring injected read',async()=>{
 const c=new AbortController(),reason=Object.freeze({cancel:'late'});let admitted
 const started=new Promise(resolve=>{admitted=resolve})
 const promise=registered({signal:c.signal,transport:()=>{admitted();return new Promise(()=>{})}})
 await started;c.abort(reason);const result=await bounded(promise)
 assert.equal(result.kind,'rejected');assert.equal(result.reason,reason)
})
test('IMTF source deadline bounds a signal-ignoring injected read',async()=>{
 const result=await bounded(registered({sourceTimeoutMs:10,transport:()=>new Promise(()=>{})}))
 assert.equal(result.kind,'rejected');assert.equal(result.reason.code,'IMTF_SOURCE_TIMEOUT')
})
test('IMTF actual denied headers return before reading a hanging entity',async()=>{
 let read=false,cancel=false
 const response={url:HOME,status:403,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read(){read=true;return new Promise(()=>{})},cancel(){cancel=true},releaseLock(){}}),cancel(){cancel=true}}}
 const result=await bounded(createNativeTransport({fetchImpl:async()=>response,timeoutMs:100})(HOME))
 assert.equal(result.kind,'fulfilled');assert.equal(result.value.status,403)
 assert.equal(result.value.body,null);assert.equal(result.value.bodyComplete,false)
 assert.equal(read,false);assert.equal(cancel,true)
})
test('IMTF finite page budget stops before the next original GET',async()=>{
 const io=reader(),result=await collect({...io,maxPages:1})
 assert.deepEqual(io.calls,[HOME]);assert.equal(result.failures[0].code,'IMTF_PAGE_BUDGET')
})
test('IMTF invalid runtime controls reject before transport callbacks',async()=>{
 for(const options of [{maxJobs:-1},{maxPages:1.5},{maxRequests:0},{readTimeoutMs:0},{sourceTimeoutMs:0},{onAudit:true}])
  await assert.rejects(registered({...options,transport:noRead}),e=>e.code==='IMTF_INVALID_OPTIONS')
})
test('IMTF skipped audit callback remains bounded without acquisition',async()=>{
 await assert.rejects(registered({maxJobs:0,transport:noRead,auditTimeoutMs:5,onAudit:()=>new Promise(()=>{})}),e=>e.code==='IMTF_AUDIT_TIMEOUT')
})
test('IMTF synchronously blocking reads cannot reset the source deadline',async()=>{
 let calls=0
 const result=await collect({sourceTimeoutMs:2,transport:()=>{calls++;const at=performance.now();while(performance.now()-at<20){};return {...originals.get(HOME),body:Buffer.from(originals.get(HOME).body)}}})
 assert.equal(calls,1);assert.equal(result.failures[0].code,'IMTF_SOURCE_TIMEOUT')
 assert.equal(result.retainedResponses.length,1)
 assert.equal(result.retainedResponses[0].rawBodyBase64,originals.get(HOME).body.toString('base64'))
})
test('IMTF native byte limits use intrinsic chunk length even when shadowed',async()=>{
 const chunk=new Uint8Array(MAX_BYTES+1);Object.defineProperty(chunk,'byteLength',{value:0})
 const adapter=createNativeTransport({fetchImpl:async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:new ReadableStream({start(c){c.enqueue(chunk);c.close()}})})})
 await assert.rejects(adapter(HOME),e=>e.code==='IMTF_BODY_LIMIT')
})
test('IMTF native cancellation settles before an ignored fetch and cancels its late body',async()=>{
 const c=new AbortController(),reason=Object.freeze({cancel:'native late response'});let release,entered,canceled=false
 const started=new Promise(resolve=>{entered=resolve})
 const promise=createNativeTransport({signal:c.signal,fetchImpl:()=>{entered();return new Promise(resolve=>{release=resolve})}})(HOME)
 await started;c.abort(reason);const result=await bounded(promise)
 assert.equal(result.kind,'rejected');assert.equal(result.reason,reason)
 release({url:HOME,status:200,headers:new Headers({'content-type':'text/html'}),body:{cancel(){canceled=true}}})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(canceled,true)
})
test('IMTF materialized response limits cannot be bypassed by shadowed typed-array lengths',async()=>{
 const body=new Uint8Array(MAX_BYTES+1);body.fill(120);Object.defineProperty(body,'length',{value:0});Object.defineProperty(body,'byteLength',{value:0})
 let reads=0
 const result=await collect({transport:async url=>{reads++;return{url,status:200,headers:{'content-type':'text/html'},body,bodyComplete:true}}})
 assert.equal(reads,1);assert.equal(result.failures[0].code,'IMTF_BODY_LIMIT')
 assert.equal(result.retainedResponses[0].bodyComplete,false)
 assert.equal(result.retainedResponses[0].receivedBodyBytes,MAX_BYTES+1)
 assert.ok(result.retainedResponses[0].bodyBytes===null||result.retainedResponses[0].bodyBytes<=MAX_BYTES)
})

const delaySync=()=>{const began=performance.now();while(performance.now()-began<25){}}
test('IMTF native deadline retains returned denial headers before stopping acquisition',async()=>{
 let calls=0,canceled=false
 const result=await collect({readTimeoutMs:5,fetchImpl:url=>{calls++;delaySync();return{url,status:403,headers:new Headers({'retry-after':'120','content-type':'text/html'}),body:{cancel(){canceled=true}}}}})
 assert.equal(calls,1);assert.equal(result.retainedResponses.length,1)
 const receipt=result.retainedResponses[0]
 assert.equal(receipt.requestedURL,HOME);assert.equal(receipt.status,403);assert.equal(receipt.headers['retry-after'],'120')
 assert.equal(receipt.bodyComplete,false);assert.equal(receipt.rawBodyBase64,null);assert.equal(canceled,true)
 assert.ok(['ETIMEDOUT','IMTF_READ_TIMEOUT'].includes(result.failures[0].code))
})
test('IMTF native deadline retains an already-returned partial chunk before cancellation',async()=>{
 const bytes=Buffer.from('original bytes returned at deadline');let reads=0,canceled=false
 const result=await collect({readTimeoutMs:5,fetchImpl:async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read(){reads++;delaySync();return{done:false,value:bytes}},cancel(){canceled=true},releaseLock(){}})}})})
 const receipt=result.retainedResponses[0]
 assert.equal(reads,1);assert.equal(canceled,true);assert.equal(receipt.bodyComplete,false)
 assert.equal(receipt.receivedBodyBytes,bytes.length);assert.equal(receipt.bodyBytes,bytes.length)
 assert.equal(receipt.rawBodyBase64,bytes.toString('base64'));assert.equal(result.retainedResponses.length,1)
 assert.ok(['ETIMEDOUT','IMTF_READ_TIMEOUT'].includes(result.failures[0].code))
})
test('IMTF native deadline preserves actual completed entity state',async()=>{
 const bytes=Buffer.from('original completed entity');let reads=0,receipt
 const adapter=createNativeTransport({timeoutMs:5,onReceipt:p=>{receipt=p},fetchImpl:async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read(){if(reads++===0)return{done:false,value:bytes};delaySync();return{done:true}},cancel(){},releaseLock(){}})}})})
 await assert.rejects(adapter(HOME),e=>e.code==='ETIMEDOUT')
 assert.equal(reads,2);assert.equal(receipt.bodyComplete,true);assert.equal(receipt.receivedBodyBytes,bytes.length)
 assert.deepEqual(receipt.body,bytes);assert.ok(receipt.completedAt);assert.equal(receipt.bodyUnavailableReason??null,null)
})
test('IMTF invalid final identity retains requested URL and returned metadata without entity IO',async()=>{
 let calls=0,read=false,canceled=false
 const result=await collect({fetchImpl:async()=>{calls++;return{url:'https://wrong.example/returned',status:200,headers:new Headers({'content-type':'text/html','x-original':'retained'}),body:{getReader(){read=true},cancel(){canceled=true}}}}})
 assert.equal(calls,1);assert.equal(result.retainedResponses.length,1)
 const receipt=result.retainedResponses[0]
 assert.equal(receipt.requestedURL,HOME);assert.equal(receipt.finalURL,'https://wrong.example/returned')
 assert.equal(receipt.status,200);assert.equal(receipt.headers['x-original'],'retained')
 assert.equal(read,false);assert.equal(canceled,true);assert.equal(receipt.bodyComplete,false)
})
for(const [label,html]of[
 ['missing handoff','<html><body>Original home without careers handoff</body></html>'],
 ['ambiguous handoff',`<html><body><a href="/other" href="${CAREERS}">Careers</a></body></html>`],
 ['base ambiguity',`<html><head><base href="https://wrong.example/"></head><body><a href="${CAREERS}">Careers</a></body></html>`],
 ['malformed structure',`<html><body><a href="${CAREERS}">Careers</a><a href="`],
 ['unreviewed hiring carrier',`<html><body><a href="${CAREERS}">Careers</a><noscript><a href="https://jobs.lever.co/imtf/">Jobs</a></noscript></body></html>`],
])test('IMTF unqualified HOME '+label+' stops before CAREERS and preserves its original',async()=>{
 const calls=[],bytes=Buffer.from(html)
 const result=await collect({transport:async url=>{calls.push(url);if(url!==HOME)throw Error('Careers must not be admitted');return{url,status:200,headers:{'content-type':'text/html'},body:bytes,bodyComplete:true}}})
 assert.deepEqual(calls,[HOME]);assert.equal(result.failures.length,1)
 assert.equal(result.failures[0].stage,'official-home');assert.equal(result.failures[0].code,'IMTF_SOURCE_SHAPE')
 assert.equal(result.retainedResponses[0].rawBodyBase64,bytes.toString('base64'))
 assert.equal(result.observedListingCount,null);assert.equal(result.verifiedZeroInventory,false)
})
