import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-registered-unavailable-20261121.json.gz',import.meta.url))))
const sha=b=>createHash('sha256').update(b).digest('hex')
for(const row of fixture.requests)assert.equal(sha(Buffer.from(row.body)),row.sha256)
const provider=getScraperCatalog().find(p=>p.source==='2070health')
const exercise=async(change=body=>body,signal=AbortSignal.timeout(30000))=>{
 const original=globalThis.fetch,reads=[];let error=null,jobs=null
 globalThis.fetch=async(url,init={})=>{
  const target=String(url);reads.push(target);assert.equal(init.method??'GET','GET');assert.equal(init.body,undefined);const occurrence=reads.filter(value=>value===target).length;const row=fixture.requests.filter(packet=>packet.requestedURL===target)[occurrence-1];if(!row)return Object.defineProperty(new Response('<html><title>Not found</title></html>',{status:404,headers:{'content-type':'text/html'}}),'url',{value:target})
  const response=new Response(change(row.body,reads.length),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});return response
 }
 try{jobs=await createCatalogScraper(provider).run({signal})}catch(cause){error=cause}finally{globalThis.fetch=original}
 return{reads,error,jobs}
}
test('current registered2070Health preserves unavailable canonical role without generic fallback reads',async()=>{
 const r=await exercise();assert.equal(r.error?.code,'HEALTH2070_NATIVE_ROLE_UNAVAILABLE');assert.equal(r.jobs,null);assert.equal(r.reads.length,3,'An explicit unavailable native role must stop before generic recovery: '+JSON.stringify(r.reads))
})
test('registered2070Health metadata holds generic recovery without claiming complete inventory',()=>{
 assert.equal(provider.authoritativeCurrentPublication,true);assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false);assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.verifiedInventoryStatus,'unverified')
})
test('current default unavailable role retains all native listing observations with unknown employer/publication/criteria',async()=>{
 const r=await exercise();assert.equal(r.error?.code,'HEALTH2070_NATIVE_ROLE_UNAVAILABLE');assert.equal(r.error.lifecycleCleanupAllowed,false);const a=r.error.nativeEvidence;assert.equal(a.primary.records.length,fixture.expectedListingRecords);assert.equal(a.companyIndiaTotal,null);assert.equal(a.companyGlobalTotal,null);assert.equal(a.detailRecords[0].nativeAvailability.status,'unavailable');assert.equal(a.rawResponses.length,3)
 assert(a.observations.every(row=>row.company===null&&row.jobId===null&&row.requisitionId===null&&row.postingDate===null&&row.sourceDetailComplete===false&&row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false));assert.equal(r.jobs,null)
})
test('unreviewed missing content stays identity-unqualified and does not become absence or generic jobs',async()=>{
 const r=await exercise((body,ordinal)=>ordinal===3?body.replace('No data found in results.','Temporary unavailable text.'):body);assert.equal(r.error?.code,'HEALTH2070_NATIVE_IDENTITY_CONFLICT');assert.equal(r.jobs,null);assert.equal(r.error.nativeEvidence.companyIndiaTotal,null);assert.equal(r.reads.length,3)
})
test('current registered2070Health preserves an opaque preaborted caller without reads',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'2070health-retained-current-test'});controller.abort(reason);const r=await exercise(undefined,controller.signal);assert.strictEqual(r.error,reason);assert.equal(r.reads.length,0)
})
