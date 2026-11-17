import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261116.json.gz',import.meta.url))))
async function replay(mutate){
 const used=new Map(),reads=[]
 const jobs=await run({fetchImpl:async(url,options)=>{
  reads.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'manual')
  const matching=fixture.packets.filter(p=>p.requestedURL===url),at=used.get(url)||0,p=matching[at];used.set(url,at+1);assert.ok(p,'Fresh captured response for '+url)
  const raw=Buffer.from(p.bodyBase64,'base64'),response=new Response(mutate?.(raw,url,at)||raw,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 }})
 return{jobs,reads}
}
test('current six-card Drip cohort pairs all five India original roles and keeps all scope holds',async()=>{
 const{jobs,reads}=await replay();assert.equal(reads.length,16);assert.equal(jobs.length,5)
 assert.deepEqual(jobs.map(j=>j.sourceJobId),['fk0znmm','fk0zlaf','fk0zldg','fk0z117','fk0pfc9'])
 assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.country==='India'&&j.postingDate===null&&j.sourceScopeComplete===false));assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(readInventoryEvidence(jobs).reason,/advertised6native/)
})
for(const[name,match,before,after]of[
 ['changed cohort','/?','Logistics Associate','Other Associate'],
 ['changed new-role criteria','/jobs/fk0z117/','Logistics','Operations'],
 ['new role executable program','/jobs/fk0z117/','</head>','<script>unreviewed()</script></head>'],
 ['changed native country','/jobs/fk0z117/','>India<','>Canada<'],
])test('current Drip rejects '+name,async()=>assert.rejects(replay((raw,url)=>url.endsWith(match)?Buffer.from(raw.toString().replace(before,after)):raw)))
