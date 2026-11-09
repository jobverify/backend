import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {runAdityaBirlaRealEstatePublicRead as run} from './currentPublic.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

// Synthetic negative transport controls only. No denied public acquisition or
// qualified India vacancy is represented by the response bodies in this file.
const HOME='https://www.adityabirlarealestate.com/career'
const now=()=> '2026-11-07T04:00:00.000Z'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const rejection=promise=>promise.then(()=>assert.fail('Expected a source failure'),error=>error)
const kind=status=>[401,403,429,451].includes(status)?'blocked_or_access_denied':'source_inventory_unavailable'

async function originalHTTP(status){
 const body=Buffer.from('Synthetic original HTTP entity '+String(status)),audits=[]
 let requests=0
 const error=await rejection(run({now,onAudit:audit=>audits.push(audit),fetchPage:async(url,init)=>{
  requests++;assert.equal(url,HOME);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  assert.equal(init.headers.Accept,'text/html');assert.ok(init.signal instanceof AbortSignal)
  return {url:HOME,finalUrl:HOME,requestedUrl:HOME,status,headers:{'content-type':'text/plain','retry-after':'60'},bodyBase64:body.toString('base64')}
 }}))
 assert.equal(requests,1);assert.equal(audits.length,1)
 const audit=audits[0],row=audit.responses[0]
 assert.equal(audit.outcome,'failed');assert.equal(audit.responses.length,1);assert.equal(row.requestUrl,HOME);assert.equal(row.finalUrl,HOME)
 assert.equal(row.status,status);assert.equal(row.bodyBase64,body.toString('base64'));assert.equal(row.sha256,digest(body));assert.equal(row.bytes,body.length)
 assert.equal(row.bodyComplete,true);assert.equal(row.transportQualified,false);assert.equal(row.headers['retry-after'],'60')
 assert.equal(audit.rawPages[0].bodyBase64,body.toString('base64'));assert.deepEqual(audit.observations,[])
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.sourceListingComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.applicationInteractionPerformed,false)
 assert.equal(error.sourceAudit.responses[0].sha256,digest(body));assert.equal(error.lifecycleCleanupAllowed,false)
 assert.equal(error.inventoryEvidence.status,'coverage-gap');assert.equal(error.inventoryEvidence.reportedTotal,null)
 return {error,audit}
}

for(const status of [403,429,500,502,503,599])test('synthetic own HTTP '+status+' keeps original evidence and exposes upstream outage to the shared classifier',async()=>{
 const {error}=await originalHTTP(status)
 assert.equal(error.status,status);assert.equal(error.softFailure,true);assert.equal(error.abortRetries,true);assert.equal(error.failureKind,kind(status))
 assert.equal(error.upstreamOutage,true)
 assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:kind(status)})
})

for(const status of [201,301,400,401,404,405,406,408,422,451,499])test('synthetic non-target HTTP '+status+' retains its previous explicit source failure policy',async()=>{
 const {error}=await originalHTTP(status)
 assert.equal(error.status,status);assert.equal(error.softFailure,true);assert.equal(error.abortRetries,true);assert.equal(error.failureKind,kind(status))
 assert.equal(Object.hasOwn(error,'upstreamOutage'),false)
 assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:false,failureKind:kind(status)})
})

for(const status of ['403','429','503',null,undefined])test('untyped '+String(status)+' status never acquires the numeric outage metadata',async()=>{
 const audits=[]
 const error=await rejection(run({now,onAudit:value=>audits.push(value),fetchPage:async()=>({url:HOME,status,headers:{'content-type':'text/html'},bodyBase64:Buffer.from('Synthetic untyped status').toString('base64')})}))
 assert.equal(error.upstreamOutage,undefined);assert.equal(error.failureKind,'source_inventory_unavailable');assert.equal(classifyScraperError(error).upstreamOutage,false)
 assert.equal(audits[0].sourceScopeComplete,false);assert.equal(audits[0].lifecycleCleanupAllowed,false)
})

for(const status of [403,429,503])test('synthetic own HTTP '+status+' preserves status, body failure cause and outage without inventing missing bytes',async()=>{
 const cause=Object.freeze(Error('Synthetic original body failure')),audits=[];let cancelled=0,released=0
 const error=await rejection(run({now,onAudit:value=>audits.push(value),fetchImpl:async()=>({url:HOME,status,headers:{'content-type':'text/plain'},body:{getReader:()=>({read(){throw cause},cancel(){cancelled++},releaseLock(){released++}})}})}))
 assert.equal(error.status,status);assert.equal(error.bodyReadError,cause);assert.equal(error.failureKind,kind(status));assert.equal(error.upstreamOutage,true)
 assert.equal(classifyScraperError(error).upstreamOutage,true)
 const row=audits[0].responses[0];assert.equal(row.status,status);assert.equal(row.bodyComplete,false);assert.equal(row.bodyBase64,null);assert.equal(row.sha256,null)
 assert.equal(cancelled,1);assert.equal(released,1);assert.equal(audits[0].lifecycleCleanupAllowed,false)
})

test('a synthetic malformed200 retains its parser failure instead of acquiring an outage',async()=>{
 const error=await rejection(run({now,fetchPage:async()=>({url:HOME,status:200,headers:{'content-type':'text/html'},bodyBase64:Buffer.from('<html><head><title>Wrong publisher</title></head><body></body></html>').toString('base64')})}))
 assert.equal(Object.hasOwn(error,'upstreamOutage'),false);assert.equal(error.status,undefined);assert.equal(error.sourceAudit.observations.length,0)
 assert.equal(error.sourceAudit.responses[0].status,200);assert.equal(error.sourceAudit.responses[0].bodyComplete,true)
})

for(const properties of [{status:403},{status:503,softFailure:true,failureKind:'foreign-owned-policy',upstreamOutage:false}])test('foreign frozen error metadata and identity remain authoritative '+properties.status,async()=>{
 const reason=Object.freeze(Object.assign(Error('Synthetic foreign HTTP error'),properties)),before=classifyScraperError(reason),audits=[]
 const error=await rejection(run({now,onAudit:value=>audits.push(value),fetchPage:async()=>{throw reason}}))
 assert.equal(error,reason);assert.deepEqual(classifyScraperError(error),before);assert.equal(audits[0].responses[0].status,properties.status)
 assert.equal(audits[0].responses[0].bodyComplete,false);assert.equal(audits[0].lifecycleCleanupAllowed,false)
})

test('caller opaque abort wins even when a numeric denial resolves from the acquisition callback',async()=>{
 const controller=new AbortController(),reason=Object.freeze(Object.create(null))
 const error=await rejection(run({now,signal:controller.signal,fetchPage:async()=>{controller.abort(reason);return {url:HOME,status:403,bodyBase64:Buffer.from('Synthetic denied').toString('base64')}}}))
 assert.equal(error,reason);assert.deepEqual(Object.getOwnPropertyNames(reason),[])
})

