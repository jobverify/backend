import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-extension-20261118.json.gz',import.meta.url))))
const replay=async(change=()=>{})=>{
 let reads=0
 const jobs=await run({now:'2026-11-18T18:20:00.000Z',minIntervalMs:0,fetchImpl:async(url,init)=>{
  const original=packets.find(packet=>packet.url===url);assert.ok(original,'Only declared current official public requests')
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');reads++
  const packet=structuredClone(original);change(packet)
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }})
 assert.equal(reads,4)
 return jobs
}

test('C-DOT exact administrative deadline extension keeps the native PDF post identity intact',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].closingDate,'2026-12-02')
 assert.match(jobs[0].title,/Young Professional.*Product Engineering.*Sustenance/)
 assert.equal(jobs[0].numberOfOpenings,5)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceNativePDFPages,17)
 assert.equal(jobs[0].nativeRoleClosingReconciled,true)
 assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const [label,replace]of[
 ['closing date contradiction',html=>html.replace('extended to 02/12/2026','extended to 03/12/2026')],
 ['unrelated post title',html=>html.replace(/Young Professionals - Product Engineering &(?:amp;)? Sustenance\./,'Unrelated Software Engineer.')],
 ['unreviewed annotation',html=>html.replace('due to administrative reasons.','all positions now accept worldwide applicants.')],
])test('C-DOT administrative extension cannot disguise '+label,async()=>{
 await assert.rejects(replay(packet=>{
  if(!packet.url.includes('.php'))return
  const html=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),changed=replace(html)
  assert.notEqual(changed,html)
  packet.bodyBase64=Buffer.from(changed).toString('base64');delete packet.headers['content-length']
 }),/deadline|post identity conflict/)
})
