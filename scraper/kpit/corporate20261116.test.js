import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
// Historical Nov15/16 finite renderer-profile proof. Current registered acquisition
// is verified by currentNativeFacts/nativeProtocol/currentNativeBoundaries20261121.
import {runCurrentKpit as run} from './currentNative20261115.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const old=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-20261116.json.gz',import.meta.url))))
async function replay(change=()=>{}){
 const counts=new Map()
 const jobs=await run({requestIntervalMs:0,now:()=>current.capturedAt,fetchImpl:async(value)=>{
  const url=String(value),visit=counts.get(url)??0;counts.set(url,visit+1)
  const original=current.packets.find(p=>p.requestedURL===url)??old.packets.filter(p=>p.requestedURL===url)[visit]
  assert.ok(original,'Only original reviewed public endpoints: '+url)
  const packet=structuredClone(original);change(packet,url,visit)
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 return jobs
}
const body=(p,change)=>{p.bodyBase64=Buffer.from(change(Buffer.from(p.bodyBase64,'base64').toString('utf8'))).toString('base64')}
test('November16 exact KPIT nonce variant retains thirteen full native India roles and three explicit holds',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,13);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,16);assert.equal(jobs.nativeCollectionEvidence.heldRows.length,3)
 assert.deepEqual(jobs.nativeCollectionEvidence.heldRows.map(r=>r.nativeID).sort(),['82118','84154','84167'])
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(j=>j.postingDate===null&&j.sourceDateSemanticsUnresolved))
 assert.equal(jobs.find(j=>j.jobId==='83922').sourceNativeUpdatedAtRaw,'2026-11-16 04:48:50 UTC')
})
for(const[name,change]of[
 ['unreviewed nonce',(p,u)=>{if(u.includes('www.kpit.com/')&&p.status===200)body(p,h=>h.replace('f1b37e37d6','0000000000'))}],
 ['hidden hiring markup',(p,u)=>{if(u.includes('/careers-overview/'))body(p,h=>h.replace('</head>','<style>.search_job_box{display:none}</style></head>'))}],
 ['changed native criteria',(p,u)=>{if(u.includes('/service/jobs/'))body(p,h=>{const value=JSON.parse(h);value.job.country='United States';return JSON.stringify(value)})}],
 ['unreviewed metadata marker',(p,u)=>{if(u.endsWith('/service/jobs/83922'))body(p,h=>h.replace('2026-11-16 04:48:50 UTC','2026-11-16 05:48:50 UTC'))}],
])test('November16 KPIT preserves rejection of '+name,async()=>{await assert.rejects(replay(change),/KPIT current native:/)})
