import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parseCurrentIndex,parseCurrentRole,runCurrentNative} from './currentNative20261119.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
const pages=new Map(fixture.records.map(r=>[r.requestedUrl,r]))
const body=url=>Buffer.from(pages.get(url).bodyBase64,'base64').toString()
const listing=()=>parseCurrentIndex(body(fixture.indexURL))
const response=(url,html=body(url),status=200,headers=pages.get(url).headers)=>{const r=new Response(html,{status,headers});Object.defineProperty(r,'url',{value:url});return r}
const changed=change=>{const r=structuredClone(listing()[0]);change(r.nativeRecord);return r}
test('Concentrix native country renderer exposes sixty own published India role identities',()=>{
 const rows=listing();assert.equal(rows.length,60)
 for(const row of rows){const fact=parseCurrentRole(body(row.sourceUrl),row,fixture.observedAt);assert.equal(fact.country,'India');assert.equal(fact.nativeEmployerDisplayName,'Concentrix');assert.equal(fact.sourceScopeComplete,false)}
})
test('Concentrix ordinary original GET replay reconciles roles while company coverage remains held',async()=>{
 const jobs=await runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>{const row=pages.get(url);assert.ok(row,'Unbound '+url);const r=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(r,'url',{value:url});return r}})
 assert.equal(jobs.length,60);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
test('Concentrix enriches only the first native ten-result page and keeps other independently current index records explicit partials',async()=>{
 const calls=[]
 const jobs=await runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>{calls.push(url);return response(url)}})
 assert.equal(jobs.length,60);assert.equal(calls.length,26)
 assert.equal(new Set(calls.filter(url=>url.includes('/job/?id='))).size,10)
 const partial=jobs.find(job=>job.requisitionId===listing()[15].nativeRecord.ats_external_id)
 assert.equal(partial.sourceDetailComplete,false);assert.equal(partial.sourceNativeRoleDetailObserved,false)
 assert.equal(partial.sourceNativePublicationDateUnavailable,true);assert.equal(partial.postingDate,null)
 assert.equal(partial.jobDescription,null);assert.ok(partial.sourceNativeRecord.long_description)
 assert.ok(partial.sourceMissingCriteria.some(row=>row.reason==='native-role-detail-outside-first-result-page-enrichment'))
 assert.equal(partial.sourceClosingReconciled,true)
})
test('Concentrix an actually observed role closure cannot be overridden by a published index model',async()=>{
 const target=listing()[0],jobs=await runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>response(url,url===target.sourceUrl?body(url).replace('<h1 class="jdq-job-title"','This job is closed<h1 class="jdq-job-title"'):body(url))})
 assert.equal(jobs.length,59);assert.equal(jobs.some(job=>job.requisitionId===target.nativeRecord.ats_external_id),false)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRoles.length,1)
})
test('Concentrix a new closing role conflict holds the affected vacancy instead of returning its index partial',async()=>{
 const target=listing()[0];let n=0
 const jobs=await runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>response(url,
  url===target.sourceUrl&&++n===2?body(url).replace('<h1 class="jdq-job-title"','This job is closed<h1 class="jdq-job-title"'):body(url))})
 assert.equal(jobs.length,59);assert.equal(jobs.some(job=>job.requisitionId===target.nativeRecord.ats_external_id),false)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRoles.length,1)
})
test('Concentrix closing whole index models remain mandatory for index-only partial records',async()=>{
 let n=0
 await assert.rejects(runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>{
  if(url!==fixture.indexURL||++n===1)return response(url)
  const old=listing()[15].nativeRecord.ats_external_id
  return response(url,body(url).replaceAll(old,'R000001'))
 }}),/Closing native published country cohort/)
})
test('Concentrix stops queued and subsequent origin reads after a current access restriction',async()=>{
 const {createNativeReader}=await import('./currentTransport20261119.js')
 const urls=['https://jobs.concentrix.com/','https://jobs.concentrix.com/job-search/?country=India'],calls=[]
 const reader=createNativeReader('concentrix',urls,{requestIntervalMs:500,fetchImpl:async url=>{calls.push(url);return response(url,'Restricted',429)}})
 try{const pending=await Promise.allSettled(urls.map(url=>reader.read(url)));assert.ok(pending.every(row=>row.status==='rejected'&&/HTTP 429/.test(row.reason.message)))
  await assert.rejects(reader.read(urls[1]),/HTTP 429/);assert.equal(calls.length,1)}finally{reader.close()}
})
test('Concentrix original publication, country, employer, expiry and application contradictions are held',()=>{
 for(const change of [r=>{r.publish_on_job_listing='0'},r=>{r.allow_applications='0'},r=>{r.country='Canada'},
  r=>{r.workday_job_requisition_data.location.country.iso2='CA'},r=>{r.workday_job_requisition_data.company={descriptor:'Another employer'}},
  r=>{r.workday_job_requisition_data.status.descriptor='Closed'},r=>{r.validThrough='2020-01-01'},r=>{r.validThrough='2026-02-30'},
  r=>{r.datePosted='2027-01-01'},r=>{r.apply_url=r.apply_url.replace('_R1783513','_R000001')},r=>{r.workday_job_requisition_data.workday_job_type='Internal'}]){
  const row=changed(change);assert.throws(()=>parseCurrentRole(body(row.sourceUrl),row,fixture.observedAt))
 }
})
test('Concentrix different canonical, disabled application and hidden own title are held',()=>{
 const row=listing()[0],html=body(row.sourceUrl)
 for(const candidate of [html.replace('rel="canonical" href="'+row.sourceUrl,'rel="canonical" href="https://example.net/foreign'),
  html.replaceAll('data-jdq-apply-url=','aria-disabled="true" data-jdq-apply-url='),html.replace('<h1 class="jdq-job-title"','<h1 hidden class="jdq-job-title"')])assert.throws(()=>parseCurrentRole(candidate,row,fixture.observedAt))
})
test('Concentrix valid published records with missing criteria remain explicit partials',()=>{
 const row=changed(r=>{r.long_description='';r.short_description=''})
 const fact=parseCurrentRole(body(row.sourceUrl),row,fixture.observedAt)
 assert.equal(fact.sourceDetailComplete,false);assert.ok(fact.sourceDescription.length>300);assert.equal(fact.country,'India');assert.equal(fact.lifecycleCleanupAllowed,false)
 assert.ok(fact.sourceMissingCriteria.length>0)
})
test('Concentrix valid partials retain independently visible own criteria rather than discarding their known text',()=>{
 const rows=listing(),fact=rows.map(row=>parseCurrentRole(body(row.sourceUrl),row,fixture.observedAt)).find(r=>!r.sourceDetailComplete&&r.sourceNativeVisibleCriteriaText.length>300)
 assert.ok(fact);assert.ok(fact.jobDescription.length>300);assert.equal(fact.sourceDescription,fact.sourceNativeVisibleCriteriaText);assert.ok(fact.sourceMissingCriteria.length>0)
})
test('Concentrix an additional native JobPosting cannot silently contradict country or publication',()=>{
 const row=listing()[0],extra='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:row.title,hiringOrganization:{name:'Another employer'},validThrough:'2020-01-01',jobLocation:{address:{addressCountry:'CA'}}})+'</script>'
 assert.throws(()=>parseCurrentRole(body(row.sourceUrl).replace('</head>',extra+'</head>'),row,fixture.observedAt))
})
test('Concentrix closing criteria changes and closing HTTP errors cannot establish stable current records',async()=>{
 for(const status of [200,503]){const counts=new Map();await assert.rejects(runCurrentNative({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>{
  const n=(counts.get(url)??0)+1;counts.set(url,n);return url===listing()[0].sourceUrl&&n===2?response(url,body(url).replaceAll('Key Responsibilities','Changed Responsibilities'),status):response(url)
 }}))}
})
test('Concentrix ordinary production uses native fetch and preserves opaque caller cancellation',async()=>{
 const saved=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(url);return response(url,'Unavailable',503)}
 try{await assert.rejects(runCurrentNative(),/HTTP 503/);assert.equal(calls.length,1)}finally{globalThis.fetch=saved}
 const reason={source:'concentrix'},c=new AbortController(),task=runCurrentNative({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});setTimeout(()=>c.abort(reason),10);await assert.rejects(task,e=>e===reason)
})
