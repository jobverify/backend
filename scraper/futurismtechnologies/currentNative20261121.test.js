import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const corporate=fixture.packets[0]
const url=packet=>packet.requestedURL
const jsonBody=packet=>JSON.parse(Buffer.from(packet.bodyBase64,'base64').toString())
async function replay(t,{change,changeOnRead,options={}}={}){
 t.mock.method(globalThis,'fetch',()=>{throw Error('Real network prohibited in native protocol regression')})
 const packets=structuredClone(fixture.packets),calls=[],counts=new Map()
 if(change)change(packets)
 const jobs=await run({maxNativeDetails:1,now:()=>fixture.packets.at(-1).physicalCompletedAt,requestIntervalMs:0,
  ...options,fetchText:async()=>Buffer.from(corporate.bodyBase64,'base64').toString(),
  fetchImpl:async(value,init={})=>{
   const requestedURL=String(value);let packet=structuredClone(packets.find(packet=>url(packet)===requestedURL))
   assert.ok(packet,'Only exact current original URLs are available: '+requestedURL)
   assert.equal(init.method??'GET',packet.request.method)
   assert.equal(init.body??null,packet.request.body??null)
   const ordinal=(counts.get(requestedURL)??0)+1;counts.set(requestedURL,ordinal);if(changeOnRead)changeOnRead(packet,ordinal);calls.push(requestedURL)
   const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers})
   Object.defineProperty(response,'url',{value:packet.url});return response
  }})
 return{jobs,calls}
}
test('actual current25-row publication and first full native JD recover an individually qualified India role under explicit detail budget',async t=>{
 const{jobs}=await replay(t)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'1142');assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].postingDate,null)
 assert.equal(jobs[0].sourceNativeCountryEvidence.rawCountryCode,null)
 assert.equal(jobs[0].sourceNativeRole.reqId,1142)
 assert.equal(jobs[0].sourceNativeRole.jdDisplay,jsonBody(fixture.packets.find(packet=>url(packet).includes('/d17/'))).data.reqDetailsBO.jdDisplay)
 assert.equal(jobs.nativeCollectionEvidence.observedNativeRecords,25)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.detailBudget,1)
 const decoded=decodeURIComponent(new URL(jobs[0].applyUrl).search.slice(1)),context=JSON.parse(Buffer.from(decoded.split('&p=')[1],'base64').toString())
 assert.equal(context.reqId,1142);assert.equal(context.pageType,'application')
})
for(const[name,mutate]of[
 ['foreign role identity',data=>{data.data.reqDetailsBO.reqId=999999}],
 ['foreign role workplace',data=>{data.data.reqDetailsBO.locationList[0].office='Australia'}],
 ['inactive native publication',data=>{data.data.reqDetailsBO.requisitionPublished=false}],
 ['new unreviewed role criterion field',data=>{data.data.reqDetailsBO.additionalRequirements='A new qualification'}],
])test('actual native records retain a role hold for '+name,async t=>{
 const{jobs}=await replay(t,{change:packets=>{
  const packet=packets.find(packet=>url(packet).includes('/d17/')),data=jsonBody(packet);mutate(data);packet.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')
 }})
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.observedNativeRecords,25)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})

test('a closing native role criterion change holds that role and keeps reconciliation false',async t=>{
 const{jobs}=await replay(t,{changeOnRead:(packet,ordinal)=>{
  if(ordinal===2&&packet.requestedURL.includes('/d17/')){const data=jsonBody(packet);data.data.reqDetailsBO.jdDisplay+='<p>New mandatory native qualification.</p>';packet.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')}
 }})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.currentNativeClosingReconciled,false)
})
test('a newly added closing native row is retained as an observation without certifying the company inventory',async t=>{
 const{jobs}=await replay(t,{changeOnRead:(packet,ordinal)=>{
  if(ordinal===2&&packet.requestedURL.endsWith('/reqlist/get')){const data=jsonBody(packet);data.reqDetailsBOList.push({...data.reqDetailsBOList[0],reqId:999999,reqTitle:'New native role'});packet.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')}
 }})
 assert.equal(jobs.length,1);assert.equal(jobs.nativeCollectionEvidence.observedNativeRecords,26)
 assert.equal(jobs.nativeCollectionEvidence.currentNativeClosingReconciled,false)
 assert.equal(jobs.nativeCollectionEvidence.closing.listing.reqDetailsBOList.length,26)
})
test('passive detail envelope request metadata does not replace the complete same-role closing model',async t=>{
 const{jobs}=await replay(t,{changeOnRead:(packet,ordinal)=>{
  if(ordinal===2&&packet.requestedURL.includes('/d17/')){const data=jsonBody(packet);data.ts+=1;data.requestId='00000000-0000-4000-8000-000000000001';packet.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')}
 }})
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceRoleClosingReconciled,true)
 assert.notEqual(jobs.nativeCollectionEvidence.nativeRoleDetails[0].opening.requestId,jobs.nativeCollectionEvidence.nativeRoleDetails[0].closing.requestId)
})
test('changed full native account screening context holds the affected qualified output',async t=>{
 const{jobs}=await replay(t,{changeOnRead:(packet,ordinal)=>{
  if(ordinal===2&&packet.requestedURL.includes('/details_by_shortname/')){const data=jsonBody(packet);data.tenantPreferencesMap.newScreeningRequirement='Mandatory qualification';packet.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')}
 }})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.authorityReconciled,false)
})
test('new listing-only criteria cannot disappear behind an unchanged own detail',async t=>{
 const{jobs}=await replay(t,{change:packets=>{
  const packet=packets.find(p=>p.requestedURL.endsWith('/reqlist/get')),data=jsonBody(packet);data.reqDetailsBOList[0].jdDisplay+='\nA newly mandatory qualification.';packet.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')
 }})
 assert.equal(jobs.length,0)
 assert.match(jobs.nativeCollectionEvidence.heldRecords.find(r=>r.nativeID===1142).reason,/criteria disagree/)
})
test('caller cancellation during final native audit attachment owns the result',async t=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'final audit'}),original=Object.defineProperty
 t.mock.method(Object,'defineProperty',function(value,name,descriptor){const result=original(value,name,descriptor);if(name==='nativeCollectionEvidence'&&descriptor.value?.source==='futurismtechnologies')controller.abort(reason);return result})
 await assert.rejects(replay(t,{options:{signal:controller.signal}}),error=>error===reason)
})

for(const[name,path,pattern,replacement]of[
 ['duplicate native role ID','/d17/careers/requisition/object',/"reqId"\s*:\s*1142/,'"reqId":999999,"reqId":1142'],
 ['duplicate native country','/careers/reqlist/get',/"countryCode"\s*:\s*null/,'"countryCode":"DE","countryCode":null'],
 ['duplicate native criteria','/d17/careers/requisition/object',/"jdDisplay"\s*:/,'"jdDisplay":"An unacknowledged mandatory qualification","jdDisplay":'],
])test('strict original native JSON rejects '+name+' without losing the receipt',async t=>{
 await assert.rejects(replay(t,{change:packets=>{
  const packet=packets.find(p=>new URL(p.requestedURL).pathname.endsWith(path)),raw=Buffer.from(packet.bodyBase64,'base64').toString()
  assert.match(raw,pattern);packet.bodyBase64=Buffer.from(raw.replace(pattern,replacement)).toString('base64')
 }}),error=>error.nativeCollectionEvidence?.requests?.length>0&&/duplicate/i.test(error.message))
})
for(const failingOrdinal of [1,2])test('later native detail failure retains full opening and acquired prefix ordinal'+failingOrdinal,async t=>{
 await assert.rejects(replay(t,{changeOnRead:(packet,ordinal)=>{
  if(packet.requestedURL.includes('/d17/')&&ordinal===failingOrdinal)throw Object.assign(Error('Observed public native upstream503'),{httpStatus:503,failureKind:'network_or_timeout'})
 }}),error=>{
  const audit=error.nativeCollectionEvidence
  return audit?.observedNativeRecords===25&&audit.observations?.length===25&&audit.opening?.listing?.reqDetailsBOList?.length===25&&audit.currentNativeClosingReconciled===false&&audit.lifecycleCleanupAllowed===false&&audit.nativeRoleDetails?.length===failingOrdinal-1
 })
})
test('explicit native address country conflict remains a full held observation',async t=>{
 const{jobs}=await replay(t,{change:packets=>{
  for(const packet of packets){
   if(!packet.requestedURL.includes('/d17/')&&!packet.requestedURL.endsWith('/reqlist/get'))continue
   const data=jsonBody(packet),row=data.data?.reqDetailsBO??data.reqDetailsBOList[0]
   row.locationList[0].address='Munich, Germany';packet.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')
  }
 }})
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.observations[0].nativeRecord.locationList[0].address,'Munich, Germany')
})
for(const field of ['mandatorySkillList','nonMandatorySkillList','educationList'])test('supplementary native '+field+' disagreement is held explicitly',async t=>{
 const{jobs}=await replay(t,{change:packets=>{
  const packet=packets.find(p=>p.requestedURL.endsWith('/reqlist/get')),data=jsonBody(packet)
  data.reqDetailsBOList[0][field]=['A different published mandatory requirement'];packet.bodyBase64=Buffer.from(JSON.stringify(data)).toString('base64')
 }})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedNativeRecords,25)
 assert.ok(jobs.nativeCollectionEvidence.heldRecords.some(row=>row.nativeID===1142))
})
