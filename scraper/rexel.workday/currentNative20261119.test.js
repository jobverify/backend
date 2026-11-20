import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
const replay=(change=()=>{})=>{
 const queues=new Map(),calls=[];for(const row of fixture.packets){if(!queues.has(row.requestedURL))queues.set(row.requestedURL,[]);queues.get(row.requestedURL).push(row)}
 return{calls,fetchImpl:async(url,init)=>{const original=queues.get(url)?.shift();assert.ok(original,'Uncaptured source request '+url);const row={...structuredClone(original),html:Buffer.from(original.bodyBase64,'base64').toString('utf8')};change(row,url);calls.push({url,method:init.method});return Object.defineProperties(new Response(row.html,{status:row.status,headers:row.headers}),{url:{value:row.url},redirected:{value:row.redirected}})}}
}
test('current native role IDs remain dynamic within the independently reviewed complete role layout',async()=>{
 const io=replay(),jobs=await run({fetchImpl:io.fetchImpl,now:()=>fixture.capturedAt})
 assert.equal(jobs.length,10);assert.ok(jobs.some(job=>job.sourceNativeAttraxID==='6165'))
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceNativeClosingReconciled&&job.sourceNativeJobPosting&&job.sourceNativeFullCriteria))
 assert.equal(io.calls.length,32);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const [name,value]of [['missing',undefined],['redirected',true]])test(name+' original HTTP redirect metadata is rejected',async()=>{
 const io=replay(row=>{row.redirected=value});await assert.rejects(run({fetchImpl:io.fetchImpl,now:()=>fixture.capturedAt}),/HTTP identity or redirect metadata/)
})

test('known denied HTTP status rejects before a stalled response body',async()=>{
 let reads=0,canceled=0
 await assert.rejects(run({fetchImpl:async url=>({status:403,url,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader(){reads++;throw Error('Denied body must not be read')},cancel(){canceled++}}})}),error=>error.status===403)
 assert.equal(reads,0);assert.equal(canceled,1)
})
