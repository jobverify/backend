import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const options={now:()=>new Date('2026-11-15T17:30:00.000Z'),requestIntervalMs:0}
const originals=new Map(fixture.originalRegisteredPackets.map(packet=>[packet.requestedURL,packet]))
const groups=new Map()
for(const packet of fixture.packets){const key=packet.requestedURL??packet.url;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(packet)}
export function transport(mutate){
 const counts=new Map(),calls=[]
 const fetchImpl=async(url,init)=>{
  url=String(url);const count=(counts.get(url)??0)+1;counts.set(url,count);calls.push({url,init,count})
  const candidates=groups.get(url),original=candidates?.[Math.min(count-1,candidates.length-1)]??originals.get(url)
  assert.ok(original,'Only genuine observed native URLs may be requested: '+url)
  let packet={...original,headers:{...original.headers},html:Buffer.from(original.bodyBase64,'base64').toString('utf8')}
  packet=mutate?.(packet,{url,count,init})??packet
  const response=new Response(packet.html,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl??packet.url})
  return response
 }
 return{fetchImpl,calls,counts}
}

test('registered Sociowash uses the current corporate handoff and two complete typed India native roles while retaining all 48 observations',async()=>{
 const t=transport(),jobs=await run({...options,fetchImpl:t.fetchImpl})
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(job=>job.nativePublicJobId),['414709000015839005','414709000017915013'])
 for(const job of jobs){
  assert.equal(job.company,'Sociowash');assert.equal(job.country,'India');assert.equal(job.requisitionId,null);assert.equal(job.nativeLegalEmployer,null)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceRenderedApplicationQualified,false)
  assert.equal(job.sourceWholeOriginalCriteriaRetained,true);assert.equal(job.sourcePublicApplicationMetadataQualified,true)
  assert.ok(job.sourceNativeModel.Job_Description.length>14000);assert.ok(job.sourceDescription.includes(job.sourceNativeModel.Job_Description));assert.match(job.jobDescription,/Agency Experience: Yes/)
 }
 assert.match(jobs[0].jobDescription,/8\+ Years/);assert.match(jobs[1].jobDescription,/3\.5 to 5 Years/)
 assert.equal(jobs.sourceAudit.opening.rows.length,48);assert.equal(jobs.sourceAudit.closing.rows.length,48);assert.equal(jobs.sourceAudit.opening.held.length,46)
 assert.ok(t.calls.every(call=>call.init.method==='GET'&&call.init.redirect==='manual'&&call.init.credentials==='omit'))
 assert.ok(!t.calls.some(call=>/PortalDetail|candidateportal|candidatedetail|googletagmanager|password_strength|screening-bot-models|zia-skills-sdk/.test(call.url)))
})
