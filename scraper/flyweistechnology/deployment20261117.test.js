import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/deployment-20261117.json.gz',import.meta.url))))
const records=[...capture.requests,...capture.auxiliary]
const css='https://www.flyweis.technology/_next/static/css/c37ef131e7ddc94a.css'
const packet=url=>{
 const record=records.find(record=>record.requestedURL===url)
 assert.ok(record,'Only currently declared original requests: '+url)
 assert.equal(record.status,200);assert.equal(record.url,url)
 const bytes=Buffer.from(record.bodyBase64,'base64')
 assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256)
 return {record,bytes}
}
const response=(url,bytes)=>Object.defineProperty(new Response(bytes,{status:200,headers:packet(url).record.headers}),'url',{value:url})

test('Flyweis current original primary declaration reaches its exact reviewed stylesheet',async()=>{
 const stop=Error('Original current stylesheet read reached'),reads=[]
 await assert.rejects(run({fetchImpl:async url=>{
  reads.push(url)
  if(url===css)throw stop
  return response(url,packet(url).bytes)
 }}),error=>error===stop)
 assert.deepEqual(reads,['https://www.flyweis.technology/',css])
})

test('Flyweis still rejects edited bytes at the currently declared stylesheet URL',async()=>{
 await assert.rejects(run({fetchImpl:async url=>{
  const {bytes}=packet(url)
  return response(url,url===css?Buffer.concat([bytes,Buffer.from('body{display:none}')]):bytes)
 }}),/unreviewed native stylesheet bytes/)
})

const native=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
const fullReplay=async(mutate=value=>value)=>{
 const pending=[...native.requests]
 const jobs=await run({fetchImpl:async(url,init)=>{
  const packet=pending.shift();assert.equal(packet.requestedURL,url)
  assert.equal(packet.url,url);assert.equal(packet.status,200);assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  const body=mutate(bytes.toString('utf8'),url,pending.length)
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:url})
 }})
 assert.equal(pending.length,0)
 return jobs
}
test('Flyweis30 original current responses retain six full India roles and all scope holds',async()=>{
 const jobs=await fullReplay()
 assert.equal(jobs.length,6)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.originalResponses.length,30)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Flyweis cannot mix the two reviewed stylesheet releases at closing',async()=>{
 await assert.rejects(fullReplay((html,url,remaining)=>url==='https://www.flyweis.technology/'&&remaining<5
  ?html.replace('c37ef131e7ddc94a.css','8ac2af147fdd4582.css'):html),/stylesheet release changed/)
})
