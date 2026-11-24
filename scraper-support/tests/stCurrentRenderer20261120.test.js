import {readRecruitmentConsumers} from '../../scraper/stmicroelectronics/currentRenderer20261120.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import run from '../../scraper/stmicroelectronics/script.js'

const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/stmicroelectronics/fixtures/native-20261115.json.gz',import.meta.url))))
const current=gunzipSync(fs.readFileSync(new URL('../../scraper/stmicroelectronics/fixtures/renderer-20261120.js.gz',import.meta.url))).toString('utf8')
const oldURL=Object.keys(historical).find(url=>url.includes('/gen/js/smartApply.'))
const newURL='https://stmicroelectronics.eightfold.ai/gen/js/smartApply.bf8b5f58b2898efc.js'
function packetsFor(program=current){
 const packets={}
 for(const [url,packet]of Object.entries(historical))packets[url===oldURL?newURL:url]={...packet,html:url===oldURL?program:packet.html.replaceAll(oldURL,newURL).replaceAll(new URL(oldURL).pathname,new URL(newURL).pathname)}
 return packets
}
function fetchPackets(packets){return async url=>{
 const packet=packets[String(url)];assert.ok(packet,'Unrecorded request prohibited')
 const response=new Response(packet.html,{status:packet.status});Object.defineProperty(response,'url',{value:String(url)});return response
}}
function runPackets(program){return run({fetchImpl:fetchPackets(packetsFor(program)),now:'2026-11-20T16:00:00Z'})}
test('current actual SmartApply consumer accepts historical native DTO compatibility without a whole renderer byte gate',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Real network forbidden')})
 const jobs=await runPackets();assert.equal(jobs.length,10);assert.equal(jobs.nativeCollectionEvidence.selectedRowsObserved,10);assert.equal(jobs.nativeCollectionEvidence.reportedSelectedTotal,26);assert.ok(jobs.every(j=>j.lifecycleCleanupAllowed===false&&j.country==='India'&&j.sourceDetailComplete))
})
test('unrelated renderer comments and static non-recruiting stylesheet changes do not change recruitment authority',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Real network forbidden')})
 assert.ok(current.includes('React Select'))
 const changed=current.replace('React Select','React Select presentation-only revision')+';/* independent analytics release */'
 assert.equal((await runPackets(changed)).length,10)
})
test('renamed native position formal retains the same transport and role binding',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Real network forbidden')})
 const start=current.indexOf('e=>{var t,{mode:a,positionId:n,domain:r,cardIndex:o,includePeople:i}=e,')
 assert.ok(start>=0)
 const end=current.indexOf('})({mode:m',start)+1
 assert.ok(end>start)
 const part=current.slice(start,end)
 assert.ok(!/\.n\b/.test(part))
 const changed=current.slice(0,start)+part.replace(/\bn\b/g,'nativePosition')+current.slice(end)
 assert.equal((await runPackets(changed)).length,10)
})
for(const [name,change]of [
 ['authored description precedence',s=>{assert.ok(s.includes('__html:e.insights.job_description||e.job_description[0]'));return s.replaceAll('__html:e.insights.job_description||e.job_description[0]','__html:e.job_description[0]||e.insights.job_description')}],
 ['actual own role endpoint',s=>{assert.ok(s.includes('"/v2/jobs/"'));return s.replaceAll('"/v2/jobs/"','"/v2/other/"')}],
 ['current-open query',s=>{assert.ok(s.includes('/api/apply/v2/jobs/open?pids='));return s.replaceAll('/api/apply/v2/jobs/open?pids=','/api/apply/v2/jobs/open?other=')}],
 ['native URL write behavior',s=>{const before='ep.push({pathname:n?"/careers/apply/private":"/careers/apply"';assert.ok(s.includes(before));return s.replace(before,'window.open({pathname:n?"/careers/apply/private":"/careers/apply"')}],
 ['native apply control flow',s=>{assert.ok(s.includes('if("apply"===m&&ei.pcsApplyFormV2Enabled)'));return s.replace('if("apply"===m&&ei.pcsApplyFormV2Enabled)','if(false&&"apply"===m&&ei.pcsApplyFormV2Enabled)')}],
 ['native apply target',s=>{assert.ok(s.includes('"/careers/apply"'));return s.replaceAll('"/careers/apply"','"/unrelated/apply"')}],
])test('changed recruitment consumer holds '+name,async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Real network forbidden')})
 await assert.rejects(runPackets(change(current)),/renderer|consumer|transport|application|criteria/)
})

test('native GET export can be alpha renamed without changing its consumed implementation',()=>{
 const changed=current.replaceAll('.Jt','.nativeGet').replace('Jt:()=>B','nativeGet:()=>B')
 assert.notEqual(changed,current)
 assert.equal(readRecruitmentConsumers(changed).transport.method,'GET')
})
for(const [name,before,after]of [
 ['appended full-role URL query','StringUnused','StringUnused'],
 ['GET implementation switched to POST','method:"GET",signal:t','method:"POST",signal:t'],
 ['current-open ID binding','"/api/apply/v2/jobs/open?pids=".concat(i,"&domain=")','"/api/apply/v2/jobs/open?pids=".concat("unrelated","&domain=")'],
 ['current-open domain binding','"/api/apply/v2/jobs/open?pids=".concat(i,"&domain=").concat(t.props.domain)','"/api/apply/v2/jobs/open?pids=".concat(i,"&domain=").concat(t.props.otherDomain)'],
 ['literal disabled application button','dataTestId:"apply-button",disabled:b.insights.applied_at?"disabled":null','dataTestId:"apply-button",disabled:true'],
])test('closed current client rejects '+name,()=>{
 let changed
 if(name==='appended full-role URL query'){const tail='.concat(u?"&".concat(u):"")';assert.ok(current.includes(tail));changed=current.replaceAll(tail,tail+'.concat("&unreviewed=1")')}
 else{assert.ok(current.includes(before));changed=current.replaceAll(before,after)}
 assert.throws(()=>readRecruitmentConsumers(changed),/renderer/)
})

test('late source audit attachment preserves exact opaque caller cancellation',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Real network forbidden')})
 const controller=new AbortController(),reason=Object.freeze({source:'controlled audit cancellation'}),define=Object.defineProperty
 t.mock.method(Object,'defineProperty',function(target,name,descriptor){
  const value=define(target,name,descriptor)
  if(Array.isArray(target)&&name==='nativeCollectionEvidence'&&descriptor.value?.source==='stmicroelectronics')controller.abort(reason)
  return value
 })
 await assert.rejects(run({signal:controller.signal,fetchImpl:fetchPackets(packetsFor()),now:'2026-11-20T16:00:00Z'}),e=>e===reason)
})

for(const [name,insert]of [
 ['GET URL formal reassignment','e="/unrelated-api";'],
 ['shadowed global fetch','var fetch=(url,options)=>window.fetch(url,{...options,method:"POST"});'],
])test('native transport dataflow holds '+name,()=>{
 const before='B=function(e,t,a){var n=arguments.length>3'
 assert.equal(current.split(before).length-1,1)
 const changed=current.replace(before,'B=function(e,t,a){'+insert+'var n=arguments.length>3')
 assert.throws(()=>readRecruitmentConsumers(changed),/renderer/)
})
