import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as adapter from './script.js'
import {getScraperCatalog,buildScrapers} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-001.json.gz',import.meta.url))))
const read=n=>fixture.files[n]
const API='https://api.smartrecruiters.com/v1/companies/Entain/postings',CORPORATE='https://www.entaingroup.com/',at='2026-10-21T18:45:59.077Z'
const list=JSON.parse(read('native-india-node-001.body')),ids=list.content.map(r=>r.id)
function transport(transform=(x=>x)){
 const calls=[],counts=new Map()
 const fetchImpl=async(url,init)=>{
  assert.equal(init.method,'GET');calls.push({url,init});const n=counts.get(url)||0;counts.set(url,n+1)
  let body,type='application/json'
  if(url===CORPORATE){body=read('corporate-001.body');type='text/html'}
  else if(url.startsWith(API+'?')){
   const u=new URL(url);assert.equal(u.searchParams.get('destination'),'PUBLIC');assert.equal(u.searchParams.get('country'),'in');assert.equal(u.searchParams.get('limit'),'100')
   const offset=Number(u.searchParams.get('offset'));body=JSON.stringify({...list,offset,content:offset===0?list.content:[]})
  }else if(ids.some(id=>url===API+'/'+id))body=read('native-detail-'+url.split('/').at(-1)+'-001.body')
  else assert.fail('Unexpected endpoint '+url)
  const r=transform({url,status:200,type,body},n)
  return {status:r.status,ok:r.status===200,url:r.url,headers:{get:k=>k==='content-type'?r.type:null},text:async()=>r.body}
 }
 return {fetchImpl,calls}
}
test('native public India full-JD replay returns two active native roles with exact release and application fields',async()=>{
 const t=transport(),jobs=await adapter.run({...t,now:at})
 assert.equal(jobs.length,2)
 for(const j of jobs){const d=JSON.parse(read('native-detail-'+j.jobId+'-001.body'))
  assert.equal(j.source,'entain');assert.equal(j.title,d.name);assert.equal(j.country,'India');assert.equal(j.city,'Hyderabad')
  assert.equal(j.sourceUrl,d.postingUrl);assert.equal(j.applyUrl,d.applyUrl);assert.equal(j.postingDate,d.releasedDate);assert.equal(j.nativeReleasedDate,d.releasedDate)
  assert.equal(j.sourceDetailComplete,true);assert.ok(j.jobDescription.length>2000);assert.equal(j.nativePostingStatus.active,true)
  assert.equal(j.nativeLegalEmployer,null);assert.equal(j.nativeFirstPublicationDate,null);assert.equal(j.nativeUpdatedAt,null)
  assert.equal(j.applicationAccessValidated,false);assert.equal(j.applicationEligibilityQualified,false)
  assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.sourceGlobalJobCount,null);assert.equal(j.sourceIndiaJobCount,null)
  assert.equal(j.sourceObservedNativeIndiaRecords,2);assert.equal(j.scrapedAt,at)
 }
 const e=readInventoryEvidence(jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null)
 assert.equal(t.calls.filter(c=>c.url===CORPORATE).length,1)
 assert.equal(t.calls.filter(c=>c.url.startsWith(API+'?')).length,4)
 assert.equal(t.calls.filter(c=>ids.some(id=>c.url===API+'/'+id)).length,4)
 assert.ok(t.calls.every(c=>!c.url.includes('jobs.smartrecruiters.com')))
})

const geographicTransport=mutate=>transport(r=>{
 if(r.url.startsWith(API)){const p=JSON.parse(r.body);if(Array.isArray(p.content))p.content.forEach(mutate);else mutate(p);r.body=JSON.stringify(p)}
 return r
})
test('contradictory native city/fullLocation fails even when listing and detail agree with each other',async()=>{
 const t=geographicTransport(p=>p.location.city='Mumbai')
 await assert.rejects(adapter.run({...t,now:at}),/native city.*fullLocation/i)
})
test('state and office prefixes preserve validated native city and original fullLocation geography',async()=>{
 for(const fullLocation of ['Telangana, Hyderabad, India','Prestige Skytech, Hyderabad, Telangana, India','Prestige Skytech, Telangana, Hyderabad, India']){
  const t=geographicTransport(p=>p.location.fullLocation=fullLocation),jobs=await adapter.run({...t,now:at})
  assert.equal(jobs.length,2)
  for(const j of jobs){assert.equal(j.city,'Hyderabad');assert.equal(j.location,fullLocation);assert.equal(j.nativeLocationOriginal.city,'Hyderabad');assert.equal(j.nativeLocationOriginal.fullLocation,fullLocation);assert.equal(j.nativeListingOriginal.location.fullLocation,fullLocation)}
 }
})
test('optional native sections may be absent/null/empty; provided substantive sections and closure guards remain',async()=>{
 for(const section of ['qualifications','additionalInformation'])for(const absent of ['missing','null','empty']){
  const t=transport(r=>{if(r.url===API+'/'+ids[0]){const p=JSON.parse(r.body);if(absent==='missing')delete p.jobAd.sections[section];else p.jobAd.sections[section].text=absent==='null'?null:'';r.body=JSON.stringify(p)}return r})
  const jobs=await adapter.run({...t,now:at});assert.equal(jobs.length,2);assert.equal(jobs[0].sourceDetailComplete,true)
  if(section==='qualifications')assert.equal(jobs[0].minimumQualification,absent==='empty'?'':null)
 }
 const t=transport(),jobs=await adapter.run({...t,now:at})
 const d=JSON.parse(read('native-detail-'+ids[0]+'-001.body'))
 for(const section of ['qualifications','additionalInformation'])assert.ok(jobs[0].sourceDescription.includes(d.jobAd.sections[section].text))
})
test('current corporate native token must be an active exact Careers link',async()=>{
 for(const replace of [s=>s.replaceAll('careers.smartrecruiters.com/Entain','careers.smartrecruiters.com/Other'),s=>'<template>'+s+'</template>']){
  const t=transport(r=>{if(r.url===CORPORATE)r.body=replace(r.body);return r})
  await assert.rejects(adapter.run({...t,now:at}))
 }
})
test('listing country, company, date, public visibility, ID/ref, page and total contradictions fail closed',async()=>{
 const mutations=[p=>p.content[0].location.country='gb',p=>p.content[0].location.country=null,p=>p.content[0].company.identifier='Other',p=>p.content[0].releasedDate='yesterday',p=>p.content[0].releasedDate='2027-01-01T00:00:00.000Z',p=>p.content[0].visibility='INTERNAL',p=>p.content[0].ref=API+'/'+ids[1],p=>p.content[1].id=ids[0],p=>p.offset=100,p=>p.totalFound=3,p=>p.totalFound='2',p=>p.limit=99]
 for(const mutate of mutations){const t=transport(r=>{if(r.url.startsWith(API+'?')&&new URL(r.url).searchParams.get('offset')==='0'){let p=JSON.parse(r.body);mutate(p);r.body=JSON.stringify(p)}return r});await assert.rejects(adapter.run({...t,now:at}))}
})
test('detail mismatch, inactive/private, missing/instruction-only JD and foreign application links fail closed',async()=>{
 const mutations=[d=>d.id=ids[1],d=>d.company.identifier='Other',d=>d.name+=' changed',d=>d.location.country='gb',d=>d.location.city='Mumbai',d=>d.releasedDate='2026-10-20T10:42:34.122Z',d=>d.active=false,d=>d.visibility='INTERNAL',d=>d.postingUrl=d.postingUrl.replace('/Entain/','/Other/'),d=>d.applyUrl=d.applyUrl.replace('/Entain/','/Other/'),d=>d.applyUrl='https://example.com/apply',d=>d.jobAd.sections.jobDescription.text='',d=>d.jobAd.sections.jobDescription.text='<p>'+('Please click apply now to see the full job description. ').repeat(30)+'</p>',d=>d.jobAd.sections.jobDescription.text='<p>This position is closed.</p>'+d.jobAd.sections.jobDescription.text,d=>d.jobAd.sections.additionalInformation.text+='<p>This role is closed.</p>']
 for(const mutate of mutations){const t=transport(r=>{if(r.url===API+'/'+ids[0]){let d=JSON.parse(r.body);mutate(d);r.body=JSON.stringify(d)}return r});await assert.rejects(adapter.run({...t,now:at}))}
})
test('full final listing/detail reconciliation detects late drift and late HTTP failures',async()=>{
 for(const kind of ['listing','detail','status']){const t=transport((r,n)=>{if(n===1&&r.url===(kind==='listing'?API+'?destination=PUBLIC&country=in&offset=0&limit=100':API+'/'+ids[0])){if(kind==='status')r.status=403;else{const p=JSON.parse(r.body);if(kind==='listing')p.content[0].name+=' changed';else p.jobAd.sections.qualifications.text+='<p>Changed</p>';r.body=JSON.stringify(p)}}return r});await assert.rejects(adapter.run({...t,now:at}))}
})
test('bounded transport disallows redirection, malformed content, maxJobs and request errors',async()=>{
 for(const transform of [r=>({...r,status:403}),r=>({...r,url:'https://example.com/'}),r=>({...r,type:'text/plain'})])await assert.rejects(adapter.run({...transport(transform),now:at}))
 await assert.rejects(adapter.run({...transport(),maxJobs:1,now:at}))
 await assert.rejects(adapter.run({fetchImpl:()=>new Promise(()=>{}),timeoutMs:20,now:at}))
})
test('explicit scoped native empty stays a coverage gap and cannot authorize whole-group zero',async()=>{
 const t=transport(r=>{if(r.url.startsWith(API+'?')){const p=JSON.parse(r.body);p.totalFound=0;p.content=[];r.body=JSON.stringify(p)}return r})
 const jobs=await adapter.run({...t,now:at});assert.equal(jobs.length,0)
 const e=readInventoryEvidence(jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.match(e.reason,/tenant-surface-verified-empty/);assert.equal(e.reportedTotal,null)
})
test('native release age remains authoritative under the unchanged calendar-month policy',async()=>{
 const released='2026-08-01T10:42:34.122Z'
 const t=transport(r=>{if(r.url.startsWith(API)){const p=JSON.parse(r.body);if(Array.isArray(p.content))p.content.forEach(x=>x.releasedDate=released);else p.releasedDate=released;r.body=JSON.stringify(p)}return r})
 const jobs=await adapter.run({...t,now:at});assert.equal(jobs.length,2)
 assert.ok(jobs.every(j=>j.postingDate===released&&j.nativeReleasedDate===released&&j.scrapedAt===at))
 const metrics=analyzePublishableJobs(jobs,{now:new Date(at)});assert.equal(metrics.eligibleJobs.length,0);assert.equal(metrics.filterCounts.old,2)
})
test('synthetic offline pagination exhausts 101 unique records across two pages and rejects cross-page duplicates',async()=>{
 // Synthetic IDs exist only in this offline pagination test; they are never
 // evidence, source configuration, a network request, or runtime counts.
 const synthetic=list.content.slice(0,1).flatMap(row=>Array.from({length:101},(_,i)=>({...structuredClone(row),id:String(900000000000000+i),uuid:'synthetic-'+i,refNumber:'SYNTHETIC-'+i,name:'Synthetic pagination role '+i,ref:API+'/'+String(900000000000000+i)})))
 const base=JSON.parse(read('native-detail-'+ids[0]+'-001.body'))
 for(const duplicate of [false,true]){
  let calls=0
  const fetchImpl=async(url,init)=>{
   calls++;assert.equal(init.method,'GET');let body,type='application/json'
   if(url===CORPORATE){body=read('corporate-001.body');type='text/html'}
   else if(url.startsWith(API+'?')){const offset=Number(new URL(url).searchParams.get('offset')),content=structuredClone(synthetic.slice(offset,offset+100));if(duplicate&&offset===100)content[0]=structuredClone(synthetic[0]);body=JSON.stringify({offset,limit:100,totalFound:101,content})}
   else{const row=synthetic.find(r=>r.ref===url);assert.ok(row);const d={...structuredClone(base),...row,jobId:'synthetic-job-'+row.id,postingUrl:'https://jobs.smartrecruiters.com/Entain/'+row.id+'-synthetic',applyUrl:'https://jobs.smartrecruiters.com/Entain/'+row.id+'-synthetic?oga=true'};body=JSON.stringify(d)}
   return {status:200,ok:true,url,headers:{get:()=>type},text:async()=>body}
  }
  if(duplicate)await assert.rejects(adapter.run({fetchImpl,now:at}),/Duplicate native ID across pages/)
  else{const jobs=await adapter.run({fetchImpl,now:at});assert.equal(jobs.length,101);assert.ok(jobs.every(j=>j.sourceObservedNativeIndiaRecords===101));assert.equal(calls,209)}
 }
})

test('source051 replaces exactly Entain sentinel with sparse unqualified metadata',()=>{
 const all=getScraperCatalog(),p=all.find(p=>p.source==='entain')
 assert.equal(all.filter(row=>row.source==='entain').length,1);assert.equal(p.companyName,'Entain');assert.equal(p.companyDomain,'entaingroup.com')
 assert.equal(p.atsPlatform,'smartrecruiters-public-postings');assert.equal(p.jobsBoardUrl,API+'?destination=PUBLIC&country=in')
 assert.match(p.modulePath,/entain.workday[\\/]script.js$/)
 for(const key of ['verifiedOn','verifiedAt','verifiedPublicJobCount','verifiedIndiaJobCount'])assert.equal(p[key],null)
 assert.equal(p.sourceScopeComplete,false);assert.ok(buildScrapers().some(s=>s.name==='entain'))
})
