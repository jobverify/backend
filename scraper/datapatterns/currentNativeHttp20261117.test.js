import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=capture.source
const api=capture.originals.find(p=>p.status===403&&p.requestedURL.includes('/ms/candidateapi/')).requestedURL
async function replay(t,edit=()=>{},settings={}){
 const calls=[],counts=new Map()
 t.mock.method(globalThis,'fetch',()=>assert.fail('Source tests cannot access uncaptured network'))
 const fetchImpl=async(url,init={})=>{
  const rows=capture.originals.filter(p=>p.requestedURL===String(url)),n=counts.get(String(url))??0
  assert.ok(rows.length,'Only a currently observed original URL may be read: '+url)
  // Reusing the final exact captured seed/denial only reproduces the legacy
  // retry in red. A corrected reader must stop at the first observed denial.
  const packet=structuredClone(rows[Math.min(n,rows.length-1)]);counts.set(String(url),n+1)
  calls.push({url:String(url),method:init.method??'GET'});edit(packet)
  return Object.defineProperty(new Response(Object.hasOwn(packet,'responseBody')?packet.responseBody:Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }
 let error
 try{await createCatalogScraper(getScraperCatalog().find(p=>p.source===source)).run({fetchImpl,...settings})}catch(caught){error=caught}
 return {error,calls}
}
test(`${source} current original authority and first403 retain exact bytes and native API identity`,()=>{
 assert.equal(capture.originals.filter(p=>p.status===403).length,1)
 for(const p of capture.originals){const body=Buffer.from(p.bodyBase64,'base64');assert.equal(body.length,p.bodyBytes);assert.equal(createHash('sha256').update(body).digest('hex'),p.bodySHA256)}
 assert.ok(capture.originals.some(p=>p.requestedURL.includes('/ms/candidatev2/')&&p.status===200))
 assert.equal(capture.originals.at(-1).requestedURL,api)
})
test(`${source} registered current native403 remains an observed access hold and is never retried`,async t=>{
 const {error,calls}=await replay(t)
 assert.equal(error?.httpStatus,403);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.softFailure,true);assert.equal(error.abortRetries,true)
 assert.equal(error.sourceScopeComplete,false);assert.equal(error.lifecycleCleanupAllowed,false)
 assert.equal(calls.filter(c=>c.url===api).length,1);assert.equal(calls.length,capture.originals.length)
})
for(const [status,headers]of [[429,{}],[202,{'x-amzn-waf-action':'challenge'}],[200,{'x-amzn-waf-action':'challenge'}]])test(`${source} native HTTP${status} challenge keeps observed status and stops the source`,async t=>{
 const {error,calls}=await replay(t,p=>{if(p.requestedURL===api){p.status=status;Object.assign(p.headers,headers)}})
 assert.equal(error?.httpStatus,status);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.abortRetries,true)
 assert.equal(calls.filter(c=>c.url===api).length,1);assert.equal(calls.length,capture.originals.length)
})
test(`${source} a denied foreign response keeps a hard original identity error`,async t=>{
 const {error}=await replay(t,p=>{if(p.requestedURL===api)p.finalURL='https://unrelated.invalid/api'})
 assert.equal(error?.httpStatus,403);assert.equal(error.failureKind,'parser_or_contract_error');assert.equal(error.softFailure,false)
})
test(`${source} exact opaque pre-abort makes no public reads`,async t=>{
 const reason=Object.freeze({owner:source}),{error,calls}=await replay(t,()=>{},{signal:AbortSignal.abort(reason)})
 assert.equal(error,reason);assert.equal(calls.length,0)
})
test(`${source} caller cancellation during denied-body disposal retains its exact opaque reason`,async t=>{
 const controller=new AbortController(),reason=Object.freeze({owner:source,stage:'denied-body-cleanup'});let timer,canceled=0
 try{
  const {error,calls}=await replay(t,p=>{if(p.requestedURL===api){p.responseBody=new ReadableStream({cancel(){canceled++;return new Promise(()=>{})}});timer=setTimeout(()=>controller.abort(reason),10)}},{signal:controller.signal})
  assert.equal(error,reason);assert.equal(canceled,1);assert.equal(calls.filter(c=>c.url===api).length,1)
 }finally{clearTimeout(timer)}
})
