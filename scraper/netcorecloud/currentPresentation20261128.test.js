import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run, PROVIDER_METADATA} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261128/current-presentation.json.gz',import.meta.url))))
const presentation='https://careerpagenetcore.lovable.app/'
const board='https://netcoreai.mynexthire.com/employer/jobs/careers'
const tenant='https://netcoreai.mynexthire.com/employer/jobboard/details_by_shortname/get/netcoreai/'
const listing='https://netcoreai.mynexthire.com/employer/careers/reqlist/get'
const detail='https://netcoreai.prod.us1.mynexthire.io/d17/careers/requisition/object'
const client='https://netcoreai.mynexthire.com/employer/ui/js/jobboard/careers.js'
const globals='https://netcoreai.mynexthire.com/employer/ui/js/wow/wow-global-classes.js'
const encoder='https://netcoreai.mynexthire.com/employer/ui/js/wowjsons/encoder.js'
const entry=presentation+'assets/index-q-Djt2Ye.js'
const route=presentation+'assets/routes-rr1TnxQN.js'
const styles=presentation+'assets/styles-CiWsseNz.css'
const hash=value=>createHash('sha256').update(value).digest('hex')
const clone=value=>structuredClone(value)
const original=url=>fixture.packets.find(p=>p.requestedUrl===url)
const listBody={source:'careers',code:'',filterByBuId:-1}
const createHarness=({legacyIdentityFixture=false,ids,mutatePage,mutateJson,signal,onPage}={})=>{
 const calls=[],records=[],audits=[],counts=new Map()
 const packetsAt=url=>fixture.packets.filter(p=>p.requestedUrl===url)
 const invoke=()=>run({signal,now:()=> '2026-11-28T01:54:07.000Z',
  onRecords:value=>records.push(clone(value)),onAudit:value=>audits.push(clone(value)),
  fetchPage:async(url,options={})=>{
   calls.push({url,method:options.method??'GET',signal:options.signal})
   const packet=original(url);assert.ok(packet,'Unexpected public page: '+url)
   let page={status:packet.status,url:packet.url,html:packet.body}
   if(legacyIdentityFixture&&url===presentation)page.html=readFileSync(new URL('../../scraper-support/tests/fixtures/netcorecloud/presentation.html',import.meta.url),'utf8')
   page=mutatePage?.(url,page)??page;onPage?.(url)
   return page
  },
  fetchJson:async(url,options={})=>{
   const number=(counts.get(url)??0)+1;counts.set(url,number)
   calls.push({url,method:options.method??'GET',body:options.body,signal:options.signal})
   let packet
   if(url===listing){assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),listBody);packet=packetsAt(url)[number-1]}
   else if(url===tenant){assert.equal(options.method,undefined);packet=packetsAt(url)[number-1]}
   else {
    assert.equal(url,detail);assert.equal(options.method,'POST')
    const input=JSON.parse(options.body);assert.deepEqual(input,{source:'careers',id:'',code:'',reqId:input.reqId})
    packet=fixture.packets.find(p=>p.requestedUrl===url&&JSON.parse(p.requestBody).reqId===input.reqId)
   }
   assert.ok(packet,'Unexpected/repeated native request '+url)
   let value=JSON.parse(packet.body)
   if(ids&&url===listing)value.reqDetailsBOList=value.reqDetailsBOList.filter(row=>ids.includes(row.reqId))
   value=mutateJson?.(url,value,number,options)??value
   return value
  },
 })
 return {invoke,calls,records,audits}
}
const held=(jobs,count)=>{
 assert.equal(jobs.length,0,'Unknown-country/criterion/employer observations cannot be returned as publishable jobs')
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'discovery-only');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.lifecycleCleanupAllowed,false);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const observation=readSourceObservationEvidence(jobs,'netcorecloud')
 assert.equal(observation.observedRecordCount,count);assert.equal(observation.observedVacancyCount,count)
 assert.equal(observation.sourceScopeComplete,false);assert.equal(observation.companyIndiaTotal,null);assert.equal(observation.companyGlobalTotal,null)
 const audit=jobs.nativeCollectionEvidence
 for(const key of ['sourceScopeComplete','lifecycleCleanupAllowed','inventoryComplete','detailComplete','applicationAuthority','criterionRenderingQualified'])assert.equal(audit[key],false,key)
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
 assert.equal(audit.observations.length,count)
 return audit
}

test('all40 genuine fixture bodies and all28 full native details retain their immutable original bytes',()=>{
 assert.equal(fixture.packets.length,40)
 for(const packet of fixture.packets)assert.equal(hash(packet.body),packet.sha256)
 assert.equal(fixture.packets.filter(p=>p.requestedUrl===detail).length,28)
 assert.equal(original(presentation).sha256,'2de04f0f97c6d3d4935aa436d1bbf187026007a16a0e66f0afcaa99493786d6d')
 assert.match(original(route).body,/wr=`https:\/\/netcore\.ai\/careers-list\?job_category=`/)
})

test('current declared presentation and native graph retain all28 full raw models while assessment remains held',async()=>{
 const h=createHarness(),jobs=await h.invoke(),audit=held(jobs,28)
 assert.equal(h.calls.length,40)
 assert.equal(h.calls.filter(c=>c.url===detail).length,28)
 assert.equal(h.calls.filter(c=>c.url===listing).length,2);assert.equal(h.calls.filter(c=>c.url===tenant).length,2)
 assert.equal(h.calls.some(c=>c.url.startsWith('https://netcore.ai/')||c.url.startsWith('https://netcorecloud.com/')),false)
 assert.equal(h.records.length,1);assert.deepEqual(h.records[0],audit.observations)
 assert.equal(h.audits.length,1);assert.deepEqual(h.audits[0],audit)
 for(const observation of audit.observations){
  const row=JSON.parse(original(listing).body).reqDetailsBOList.find(r=>r.reqId===observation.listingRecord.reqId)
  const payload=JSON.parse(fixture.packets.find(p=>p.requestedUrl===detail&&JSON.parse(p.requestBody).reqId===row.reqId).body)
  assert.deepEqual(observation.listingRecord,row);assert.deepEqual(observation.detailResponse,payload)
  assert.deepEqual(observation.detailRecord,payload.data.reqDetailsBO)
  assert.equal(observation.jobDescription,payload.data.reqDetailsBO.jdDisplay)
  for(const key of ['country','city','remoteStatus','postingDate','applyUrl'])assert.equal(observation[key],null,key)
  assert.equal(observation.sourceUrl,board);assert.equal(observation.sourceDetailComplete,false)
 }
 assert.ok(audit.observations.find(o=>o.listingRecord.reqId===1086).jobDescription.length>20000)
 assert.match(audit.observations.find(o=>o.listingRecord.reqId===1076).jobDescription,/Netcore Unbxd/)
 const assessment=assessSoftFailureAcquisition(PROVIDER_METADATA,jobs)
 assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0)
 assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true)
 assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

test('known legacy identity fixture with genuine current native Mumbai/Bengaluru rows cannot infer India or normalize eligible records',async()=>{
 const h=createHarness({legacyIdentityFixture:true,ids:[1046,1034]}),jobs=await h.invoke()
 const audit=held(jobs,2)
 assert.deepEqual(audit.observations.map(o=>[o.listingRecord.reqId,o.country]),[[1046,null],[1034,null]])
 const assessment=assessSoftFailureAcquisition({...PROVIDER_METADATA,verifiedZeroJobs:true},jobs)
 assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.runnerOutcome.success,false)
})

test('typed empty native array remains a held source observation rather than verified company zero',async()=>{
 const h=createHarness({legacyIdentityFixture:true,ids:[]}),jobs=await h.invoke()
 held(jobs,0)
 const assessment=assessSoftFailureAcquisition({...PROVIDER_METADATA,verifiedZeroJobs:true},jobs)
 assert.equal(assessment.runnerOutcome.success,false);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

test('current six handoffs must be active, unique and bound to the exact category targets',async()=>{
 for(const change of [
  html=>html.replaceAll('https://netcore.ai/careers-list?job_category=engineering','https://other.example/jobs'),
  html=>html.replaceAll('https://netcore.ai/careers-list?job_category=engineering','https://netcore.ai/careers-list?job_category=sales'),
  html=>'<template>'+html+'</template>',
  html=>html.replace('<body','<body hidden'),
 ]){
  const h=createHarness({mutatePage:(url,p)=>url===presentation?{...p,html:change(p.html)}:p})
  await assert.rejects(h.invoke(),/presentation|handoff|category/i)
  assert.equal(h.calls.some(c=>c.url===listing),false)
 }
})

test('current entry, route, styles, native globals, encoder and producer whole programs are finite checked dependencies',async()=>{
 for(const url of [entry,route,styles,globals,encoder,client]){
  const h=createHarness({mutatePage:(at,p)=>at===url?{...p,html:p.html+'\n/* unreviewed whole-program change */'}:p})
  await assert.rejects(h.invoke(),/client|program|styles|contract/i)
  assert.equal(h.calls.some(c=>c.url===listing),false,url)
 }
})

test('foreign program response identity and passive replacement entry cannot authorize native reads',async()=>{
 for(const mutatePage of [
  (url,p)=>url===route?{...p,url:'https://other.example/routes.js'}:p,
  (url,p)=>url===presentation?{...p,html:p.html.replace('type="module" async="" src="/assets/index-q-Djt2Ye.js"','type="application/json" async="" src="/assets/index-q-Djt2Ye.js"')}:p,
 ]){
  const h=createHarness({mutatePage});await assert.rejects(h.invoke(),/identity|unavailable|presentation|handoff|program/i)
  assert.equal(h.calls.some(c=>c.url===listing),false)
 }
})

test('native country labels, contradictory fields and foreign roles remain raw held data without company admission',async()=>{
 const h=createHarness({ids:[1046,935],mutateJson:(url,value)=>{
  if(url===listing)for(const row of value.reqDetailsBOList)row.countryCode=row.reqId===1046?'IN':'PH'
  if(url===detail)value.data.reqDetailsBO.countryCode=value.data.reqDetailsBO.reqId===1046?'US':'PH'
  return value
 }}),jobs=await h.invoke(),audit=held(jobs,2)
 const role=audit.observations.find(o=>o.listingRecord.reqId===1046)
 assert.equal(role.listingRecord.countryCode,'IN');assert.equal(role.detailRecord.countryCode,'US');assert.equal(role.country,null)
 assert.ok(audit.reasons.includes('native-role-country-conflicts:1046'))
})

test('full HTML including hidden/style/script criteria is preserved without granting formal detail or application authority',async()=>{
 const extra='<style>.new{display:none}</style><p hidden>Hidden criteria retained</p><script>window.__unreviewed=1</script>'
 const h=createHarness({ids:[1046],mutateJson:(url,value)=>{if(url===detail)value.data.reqDetailsBO.jdDisplay+=extra;return value}})
 const audit=held(await h.invoke(),1)
 assert.ok(audit.observations[0].jobDescription.endsWith(extra));assert.equal(audit.criterionRenderingQualified,false)
 assert.equal(audit.observations[0].applyUrl,null)
})

test('closing-only country, criteria whitespace and previously unselected raw fields are terminal snapshot drift',async()=>{
 for(const change of [
  row=>({...row,country:'India'}),
  row=>({...row,jdDisplay:row.jdDisplay+' '}),
  row=>({...row,newNativeQualifier:'unreviewed'}),
 ]){
  const h=createHarness({legacyIdentityFixture:true,ids:[1046],mutateJson:(url,value,n)=>{if(url===listing&&n===2)value.reqDetailsBOList=value.reqDetailsBOList.map(change);return value}})
  await assert.rejects(h.invoke(),/inventory changed|closing|agreement/i)
  assert.equal(h.records.length,0)
 }
})

test('closing public tenant identity and configured routes remain required',async()=>{
 const h=createHarness({mutateJson:(url,value,n)=>{if(url===tenant&&n===2)value.companyWebsite='https://other.example/';return value}})
 await assert.rejects(h.invoke(),/tenant identity|closing|handoff/i)
 assert.equal(h.records.length,0)
})

test('unreviewed pagination/error/total envelopes and duplicate IDs remain terminal',async()=>{
 for(const change of [
  value=>({...value,hasMore:true}),value=>({...value,total:0}),value=>({...value,errorMessage:'failure'}),
  value=>({...value,reqDetailsBOList:[value.reqDetailsBOList[0],value.reqDetailsBOList[0]]}),
 ]){
  const h=createHarness({mutateJson:(url,value)=>url===listing?change(value):value})
  await assert.rejects(h.invoke(),/inventory|pagination|duplicate/i)
  assert.equal(h.calls.some(c=>c.url===detail),false)
 }
})

test('null-valued preabort and mid-fetch cancellation preserve the caller reason and stop further reads',async()=>{
 let requests=0
 await assert.rejects(run({signal:AbortSignal.abort(null),fetchPage:async()=>{requests++;assert.fail('network')}}),reason=>reason===null)
 assert.equal(requests,0)
 const controller=new AbortController(),reason=new Error('Stop current Netcore read')
 const h=createHarness({signal:controller.signal,onPage:url=>{if(url===presentation)controller.abort(reason)}})
 await assert.rejects(h.invoke(),error=>error===reason);assert.equal(h.calls.length,1)
})

test('separate fresh registered40response snapshot replays every default request and preserves full native models at the actual assessment boundary',async()=>{
 const packets=fixture.finalRegistered.packets,originalFetch=globalThis.fetch
 const provider=getScraperCatalog().find(value=>value.source==='netcorecloud')
 assert.equal(packets.length,40)
 let index=0,jobs
 try{
  globalThis.fetch=async(url,init)=>{
   const packet=packets[index++];assert.ok(packet);assert.equal(hash(packet.body),packet.sha256)
   assert.equal(String(url),packet.requestedUrl);assert.equal(init.method??'GET',packet.method)
   assert.equal(init.body??null,packet.requestBody);assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit')
   return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
  }
  jobs=await createCatalogScraper(provider).run()
 }finally{globalThis.fetch=originalFetch}
 assert.equal(index,40)
 const audit=held(jobs,28),listings=packets.filter(p=>p.requestedUrl===listing).map(p=>JSON.parse(p.body))
 assert.deepEqual(audit.openingInventory,listings[0]);assert.deepEqual(audit.closingInventory,listings[1]);assert.deepEqual(listings[0],listings[1])
 assert.deepEqual(audit.observations.map(o=>o.listingRecord),listings[0].reqDetailsBOList)
 for(const observation of audit.observations){
  const payload=JSON.parse(packets.find(p=>p.requestedUrl===detail&&JSON.parse(p.requestBody).reqId===observation.listingRecord.reqId).body)
  assert.deepEqual(observation.detailResponse,payload);assert.deepEqual(observation.detailRecord,payload.data.reqDetailsBO)
  assert.equal(observation.jobDescription,payload.data.reqDetailsBO.jdDisplay)
 }
 const assessment=assessSoftFailureAcquisition({...provider,zeroResultPolicy:'verified-empty'},jobs)
 assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.zeroJobEvidence,'blocked-zero')
 assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

test('default native JSON transport rejects a foreign final response before any inventory request',async()=>{
 const originalFetch=globalThis.fetch
 let calls=0
 try{
  globalThis.fetch=async url=>{
   calls++;assert.equal(String(url),tenant)
   return Object.defineProperty(new Response(original(tenant).body,{status:200,headers:{'content-type':'application/json'}}),'url',{value:'https://other.example/tenant'})
  }
  await assert.rejects(run({fetchPage:async url=>({status:200,url,html:original(url).body})}),/JSON response identity unavailable/)
 }finally{globalThis.fetch=originalFetch}
 assert.equal(calls,1)
})

test('oversized source pages and native JSON models fail before any interpretation or job admission',async()=>{
 const excessive='x'.repeat(4*1024*1024+1)
 const h=createHarness({mutatePage:(url,p)=>url===presentation?{...p,html:excessive}:p})
 await assert.rejects(h.invoke(),/byte contract/);assert.equal(h.calls.length,1)
 const jsonHarness=createHarness({mutateJson:(url,value)=>url===tenant?{...value,oversizedUnreviewedNativeValue:excessive}:value})
 await assert.rejects(jsonHarness.invoke(),/byte contract/)
 assert.equal(jsonHarness.calls.some(c=>c.url===listing),false)
})

for(const vector of [
 {label:'first200CF',index:0,status:200,header:['cf-mitigated','challenge'],reads:1},
 {label:'first403',index:0,status:403,reads:1},
 {label:'first429',index:0,status:429,header:['retry-after','60'],reads:1},
 {label:'native200AWS',index:6,status:200,header:['x-amzn-waf-action','challenge'],reads:7},
])for(const mode of ['default','injected'])test('typed page transport '+mode+' '+vector.label,async()=>{
 let count=0,jobs,error
 const originalFetch=globalThis.fetch
 try{
  const fetchPage=async(url,init={})=>{
   const index=count++,packet=fixture.finalRegistered.packets[index];assert.ok(packet);assert.equal(String(url),packet.requestedUrl)
   assert.equal(init.method??'GET',packet.method);assert.equal(init.body??null,packet.requestBody)
   const headers=new Headers(packet.headers),status=index===vector.index?vector.status:packet.status
   if(index===vector.index&&vector.header)headers.set(...vector.header)
   return{status,url:packet.url,headers,html:packet.body}
  }
  globalThis.fetch=async(url,init)=>{const p=await fetchPage(url,init);return Object.defineProperty(new Response(p.html,{status:p.status,headers:p.headers}),'url',{value:p.url})}
  try { jobs=await run(mode==='injected'?{fetchPage}:undefined) } catch(caught){error=caught}
 }finally{globalThis.fetch=originalFetch}
 assert.equal(jobs,undefined);assert.ok(error);assert.equal(count,vector.reads)
 assert.equal(error.httpStatus,vector.status);assert.equal(error.abortRetries,true);assert.equal(error.failureKind,'blocked_or_access_denied')
 assert.equal(error.lifecycleCleanupAllowed,false)
 if(vector.header&&vector.header[0]!=='retry-after')assert.equal(error.accessChallenge,true)
})
