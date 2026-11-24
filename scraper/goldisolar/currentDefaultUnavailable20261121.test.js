import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {createGoldiSolarScraper} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-registered-unavailable-20261121.json.gz',import.meta.url)))),sha=b=>createHash('sha256').update(b).digest('hex'),provider=getScraperCatalog().find(row=>row.source==='goldisolar')
for(const row of fixture.requests)assert.equal(sha(Buffer.from(row.bodyBase64,'base64')),row.sha256)
async function exercise({bodyChange=body=>body,signal=AbortSignal.timeout(20000)}={}){
 const saved=globalThis.fetch,reads=[];let jobs=null,error=null
 globalThis.fetch=async(url,init={})=>{
  const target=String(url);reads.push({url:target,method:init.method??'GET'});const occurrence=reads.filter(row=>row.url===target).length,row=fixture.requests.filter(row=>row.requestedURL===target)[occurrence-1]
  if(!row)return Object.defineProperty(new Response('not found',{status:404,headers:{'content-type':'text/html'}}),'url',{value:target})
  const body=bodyChange(Buffer.from(row.bodyBase64,'base64').toString('utf8'));return Object.defineProperty(new Response(body,{status:row.status,headers:row.headers}),'url',{value:row.url})
 }
 try{jobs=await createCatalogScraper(provider).run({signal})}catch(cause){error=cause}finally{globalThis.fetch=saved}
 return{jobs,error,reads}
}
test('actual Goldi password-gated default stops after native read before generic recovery',async()=>{
 const r=await exercise();assert.equal(r.error?.code,'GOLDISOLAR_INVENTORY_UNAVAILABLE');assert.equal(r.jobs,null);assert.equal(r.reads.length,1,'A native password gate must hold default recovery: '+JSON.stringify(r.reads))
})
test('Goldi native-only routing metadata makes no inventory-completeness or historical zero claim',()=>{
 assert.equal(provider.authoritativeCurrentPublication,true);for(const key of ['sourceScopeComplete','sourceListingComplete','lifecycleCleanupAllowed'])assert.notEqual(provider[key],true);assert.equal(provider.verifiedPublicJobCount??null,null);assert.equal(provider.verifiedIndiaJobCount??null,null)
})
test('unreviewed Goldi document remains a held error with no generic escape or empty success',async()=>{
 const r=await exercise({bodyChange:()=>'<html><title>Goldi Solar</title><main>Unreviewed publisher document.</main></html>'});assert(r.error);assert.equal(r.jobs,null);assert.equal(r.reads.length,1)
})
test('Goldi stock preaborted opaque caller preserves reason with zero fetches',async()=>{
 const c=new AbortController(),reason=Object.freeze({caller:'goldi-unavailable-default'});c.abort(reason);const r=await exercise({signal:c.signal});assert.strictEqual(r.error,reason);assert.equal(r.jobs,null);assert.equal(r.reads.length,0)
})


test('Goldi default native request forwards caller cancellation signal',async()=>{
 const saved=globalThis.fetch,controller=new AbortController(),calls=[]
 globalThis.fetch=async(url,init={})=>{calls.push({url:String(url),signal:init.signal});return new Response(Buffer.from(fixture.requests[0].bodyBase64,'base64'),{status:200})}
 let error=null;try{await createGoldiSolarScraper().run({signal:controller.signal})}catch(cause){error=cause}finally{globalThis.fetch=saved}
 assert.equal(error?.code,'GOLDISOLAR_INVENTORY_UNAVAILABLE');assert.equal(calls.length,1);assert.strictEqual(calls[0].signal,controller.signal)
})
test('Goldi cancellation during native read preserves frozen caller reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'goldi-abort-in-flight'});let error=null,calls=0
 try{await createGoldiSolarScraper().run({signal:controller.signal,fetchText:async()=>{calls++;controller.abort(reason);return Buffer.from(fixture.requests[0].bodyBase64,'base64').toString('utf8')}})}catch(cause){error=cause}
 assert.equal(calls,1);assert.strictEqual(error,reason)
})
test('Goldi native preaborted null cancellation makes no publisher read',async()=>{
 const controller=new AbortController();controller.abort(null);let reads=0,error='not-rejected'
 try{await createGoldiSolarScraper().run({signal:controller.signal,fetchText:async()=>{reads++;return Buffer.from(fixture.requests[0].bodyBase64,'base64').toString('utf8')}})}catch(cause){error=cause}
 assert.strictEqual(error,null);assert.equal(reads,0)
})
