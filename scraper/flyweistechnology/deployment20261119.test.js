import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/deployment-20261119.json.gz',import.meta.url))))
const css='https://www.flyweis.technology/_next/static/css/d5216807d843bf9d.css'
const replay=change=>({fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
 const packet=structuredClone(fixture.packets.find(packet=>packet.url===url))
 assert.ok(packet,'only actual declared current public resources '+url)
 change?.(packet)
 return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:url})
}})
test('Flyweis current actual publisher reaches the new whole reviewed modal stylesheet',async()=>{
 const stop=Error('current whole modal CSS reached'),options=replay(packet=>{if(packet.url===css)throw stop})
 await assert.rejects(run(options),error=>error===stop)
})
test('Flyweis current modal stylesheet remains pinned and cannot hide the careers handoff',async()=>{
 await assert.rejects(run(replay(packet=>{if(packet.url===css)packet.text+='a{display:none!important}'})),/unreviewed native stylesheet bytes/)
})

const native=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
async function full(edit=()=>{}){
 const pending=[...native.packets],visits=new Map()
 const jobs=await run({now:native.capturedAt,fetchImpl:async(url,init)=>{
  const p=structuredClone(pending.shift());assert.equal(p.requestedUrl,url)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const visit=(visits.get(url)??0)+1;visits.set(url,visit);edit(p,url,visit)
  return Object.defineProperty(new Response(p.text,{status:p.status,headers:p.headers}),'url',{value:p.finalUrl})
 }})
 assert.equal(pending.length,0);return jobs
}
test('Flyweis30 current original responses retain six complete India roles with full raw array evidence and cleanup hold',async()=>{
 const jobs=await full()
 assert.equal(jobs.length,6)
 assert.equal(jobs.nativeCollectionEvidence.originalResponses.length,30)
 assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.country==='India'&&j.lifecycleCleanupAllowed===false&&j.sourceScopeComplete===false))
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Flyweis cannot mix the current and preceding reviewed CSS deployment tuples on closing',async()=>{
 await assert.rejects(full((p,url,visit)=>{
  if(url==='https://www.flyweis.technology/'&&visit===2)p.text=p.text.replace('d5216807d843bf9d.css','c37ef131e7ddc94a.css')
 }),/native stylesheet release changed/)
})
for(const [label,edit]of[
 ['foreign employer',p=>{p.text=p.text.replaceAll('"name":"Flyweis Technology"','"name":"Other Company"')}],
 ['foreign country',p=>{p.text=p.text.replaceAll('"addressCountry":"IN"','"addressCountry":"US"')}],
 ['closing mandatory criteria',p=>{p.text=p.text.replaceAll('Redux Toolkit','Additional mandatory certification')}],
])test('Flyweis current deployment rejects '+label,async()=>{
 let changed=0
 await assert.rejects(full((p,url,visit)=>{
  if(url==='https://flyweis.technology/careers/senior-react-developer'&&(label!=='closing mandatory criteria'||visit===2)){
   const before=p.text;edit(p);assert.notEqual(p.text,before);changed++
  }
 }),/Flyweis/)
 assert.ok(changed>0)
})
