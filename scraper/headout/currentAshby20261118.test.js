import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/ashby-20261118.json.gz',import.meta.url))))
const client='https://assets.headout.com/hobrandpages/_next/static/chunks/app/careers/page-ca49d493ce1106d7.js'
const native='https://api.ashbyhq.com/posting-api/job-board/headout',declared='https://www.headout.com/brand-pages/api/open-roles/'
async function replay(change=()=>{}){
 const calls=[]
 const read=async url=>{calls.push(url);const packet=structuredClone(fixture.rows.find(r=>r.url===url));assert.ok(packet,url);change(packet,url,calls.filter(u=>u===url).length);return packet.body}
 const jobs=await run({fetchText:read,fetchJson:async url=>JSON.parse(await read(url))});return{jobs,calls}
}
test('current Headout first-party roles API binds the new Ashby board and retains full India jobs',async()=>{
 const {jobs,calls}=await replay();assert.equal(jobs.length,13);assert.ok(jobs.every(j=>j.source==='headout'&&j.company==='Headout'&&j.country==='India'&&j.jobDescription.length>500));assert.ok(jobs.some(j=>j.title==='Frontend Developer'))
 assert.ok(calls.includes(client));assert.equal(calls.filter(u=>u===native).length,2);assert.equal(calls.filter(u=>u===declared).length,2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.publisherRoles.length,21)
 assert.equal(calls.some(u=>u.includes('greenhouse')),false)
})
for(const [label,change,expected] of [
 ['modified jobs executable',(p,u)=>{if(u===client)p.body+=';fetch("https://foreign.example/jobs")'},/client contract/],
 ['foreign board in publisher API',(p,u)=>{if(u===declared)p.body=p.body.replace('jobs.ashbyhq.com/headout/','jobs.ashbyhq.com/foreign/')},/publisher role identity/],
 ['same-ID native title contradiction',(p,u)=>{if(u===native){const data=JSON.parse(p.body);data.jobs[0].title='Another title';p.body=JSON.stringify(data)}},/publisher.*native/],
 ['closing membership change',(p,u,n)=>{if(u===declared&&n===2){const data=JSON.parse(p.body);data.roles.pop();p.body=JSON.stringify(data)}},/changed during|membership conflict/],
])test('current Headout rejects '+label,()=>assert.rejects(replay(change),expected))
test('Headout generic remote label never acquires India scope',async()=>{
 const {jobs}=await replay((p,u)=>{if(u===native){const data=JSON.parse(p.body);data.jobs.find(j=>j.location==='Remote (India)').location='Remote';p.body=JSON.stringify(data)}
  if(u===declared){const data=JSON.parse(p.body);data.roles.find(j=>j.locations[0]==='Remote (India)').locations=['Remote'];p.body=JSON.stringify(data)}})
 assert.equal(jobs.length,12);assert.equal(jobs.some(j=>j.jobId==='244ff3b7-8f98-4dd0-99d6-663b142227af'),false)
})
test('Headout caller cancellation prevents the first public read',async()=>{
 let reads=0
 await assert.rejects(run({signal:AbortSignal.abort(Error('caller stopped')),fetchText:async()=>{reads++;return ''}}),/caller stopped/)
 assert.equal(reads,0)
})
test('Headout aggregate deadline bounds an ignoring public reader',async()=>{
 await assert.rejects(run({timeoutMs:25,fetchText:()=>new Promise(()=>{})}),/timeout|abort/i)
})
