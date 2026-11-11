import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {run} from './script.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const bytes=fs.readFileSync(new URL('./test-data/native-20261110.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(bytes)),manifest=JSON.parse(fs.readFileSync(new URL('./test-data/manifest.json',import.meta.url)))
const sha=b=>createHash('sha256').update(b).digest('hex')
const detail=fixture.find(r=>r.requestedURL.includes('/cp/job/'))
const replay=(mutate=()=>{})=>{
 const rows=structuredClone(fixture);mutate(rows);let listing=0
 const options={now:()=>fixture.at(-1).at,fetchImpl:async(url,init)=>{
  const matches=rows.filter(r=>r.requestedURL===url),r=url.includes('/jobs/v1?')?matches[listing++]:matches[0]
  assert.ok(r,'Undeclared read '+url);assert.equal(init.method,r.method||'GET');assert.equal(init.body,r.requestBody??undefined)
  if(init.method==='POST')assert.equal(init.headers['Content-Type'],'application/json')
  const response=new Response(r.body,{status:r.status,headers:{'Content-Type':r.contentType}});Object.defineProperty(response,'url',{value:r.finalURL});return response
 }}
 // Legacy entry point is also replayed while proving the initial missing-JD bug.
 options.fetchPage=async url=>{const r=rows.find(r=>r.requestedURL===url);assert.ok(r);return {status:r.status,url:r.finalURL,html:r.body}}
 options.fetchText=async url=>{const r=rows.find(r=>r.requestedURL===url);assert.ok(r);return r.body}
 options.fetchJson=async url=>{const r=rows.find(r=>r.requestedURL===url);assert.ok(r);return JSON.parse(r.body)}
 return options
}
const mutateDetail=(rows,change)=>{const r=rows.find(r=>r.requestedURL===detail.requestedURL),p=JSON.parse(r.body);change(p.response);r.body=JSON.stringify(p)}
test('current full public response fixtures retain dated bytes and SHA',()=>{
 assert.equal(sha(bytes),manifest.sha256);assert.equal(fixture.length,19)
 for(const r of fixture){assert.equal(sha(r.body),r.sha256);assert.ok(Date.parse(r.at))}
})
test('recovers all five native visible criteria and preserves source scope holds',async()=>{
 const jobs=await run(replay());assert.equal(jobs.length,5);assert.equal(extractionDetailHealth(jobs).missingDescriptions,0)
 assert.ok(jobs.every(j=>j.sourceDetailComplete===true&&j.sourceListingComplete===false&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.match(jobs.find(j=>j.jobId==='RAY/A-MC/1913575').minimumQualification,/Bachelor of Engineering/)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceNativeAccount.realm===743&&j.nativeSourceRecord.entityID==='408'))
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readSourceObservationEvidence(jobs,'raymond').observedVacancyCount,5)
 assert.equal(extractionDetailHealth(jobs).nativeCollections[0].parsedDetails,5)
})
for(const[name,change]of[
 ['changed title',p=>{p.jobTitle='Different role'}],['changed requisition',p=>{p.requisitionCode='RAY/OTHER/1'}],
 ['foreign entity',p=>{p.entityID='999'}],['different native employer hierarchy',p=>{const parts=p.organizationUnitComplete.split('>');parts[3]='Different Employer';p.organizationUnitComplete=parts.join('>')}],
 ['foreign country',p=>{p.locationHierarchyComplete='Canada>Ontario>Toronto'}],['unknown country',p=>{p.locationHierarchyComplete='Maharashtra>Mumbai'}],
 ['contradictory joining location',p=>{p.joiningLocation='Toronto (Canada)'}],
 ['contradictory experience criteria',p=>{p.minimumExp='0'}],
 ['closed role',p=>{p.requisitionStatus='CLOSED'}],['missing visible criteria',p=>{p.jobDescription=null}],
 ['hidden-only description',p=>{p.jobDescription='<template>'+p.jobDescription+'</template>'}],
 ['invalid closing date',p=>{p.CandidatePortalEndDate='2026-02-30 00:00:00.0'}],
 ['changed closing date',p=>{p.CandidatePortalEndDate='2026-11-20 00:00:00.0'}],
])test('holds '+name+' while retaining raw observations',async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,change)));assert.equal(jobs.length,4)
 assert.ok(!jobs.some(j=>j.jobId==='RAY/A-H/1864844'));assert.equal(readSourceObservationEvidence(jobs,'raymond').observedVacancyCount,5)
 assert.equal(extractionDetailHealth(jobs).nativeCollections[0].unextractedDetailFailures,1)
})
for(const flag of ['jobDescriptionRendered','jobdescriptionSectionRendered','skillSectionRendered'])test('fails closed when native visible section changes: '+flag,async()=>{
 await assert.rejects(run(replay(rows=>{for(const r of rows.filter(r=>r.requestedURL.includes('/security/job/'))){const p=JSON.parse(r.body);p.response[flag]=false;r.body=JSON.stringify(p)}})))
})
test('does not expose internal-only native criteria',async()=>{
 await assert.rejects(run(replay(rows=>{for(const r of rows.filter(r=>r.requestedURL.includes('/security/job/'))){const p=JSON.parse(r.body);p.response.internalJobDescriptionRendered=true;r.body=JSON.stringify(p)}})))
})
test('rejects changed closing listing and employer account',async()=>{
 await assert.rejects(run(replay(rows=>{const r=rows.filter(r=>r.requestedURL.includes('/jobs/v1?')).at(-1),p=JSON.parse(r.body);p.response[0].jobTitle='Changed';r.body=JSON.stringify(p)})))
 await assert.rejects(run(replay(rows=>{const r=rows.find(r=>r.requestedURL.endsWith('/urlinfo')),p=JSON.parse(r.body);p.response.realm=999;r.body=JSON.stringify(p)})))
})
test('retains source failure and native observations when every detail is denied',async()=>{
 const options=replay(),read=options.fetchImpl;options.fetchImpl=(url,init)=>url.includes('/cp/job/')?Promise.reject(Error('HTTP403 native detail denied')):read(url,init)
 await assert.rejects(run(options),error=>error.nativeCollectionEvidence.candidateDetails===5&&error.nativeCollectionEvidence.failures.length===5)
})
test('honors caller cancellation and bounds injected callbacks ignoring AbortSignal',async()=>{
 const controller=new AbortController(),reason=Error('Raymond caller cancel');controller.abort(reason)
 await assert.rejects(run({...replay(),signal:controller.signal}),e=>e===reason)
 await assert.rejects(run({...replay(),sourceTimeoutMs:20,fetchImpl:()=>new Promise(()=>{})}))
})
test('checks elapsed source and request budgets even when callbacks block timer delivery',async t=>{
 let elapsed=0;t.mock.method(performance,'now',()=>elapsed)
 const options=replay(),fetchImpl=options.fetchImpl
 options.fetchImpl=(url,init)=>{elapsed+=20;return fetchImpl(url,init)}
 await assert.rejects(run({...options,sourceTimeoutMs:1}),/deadline/)
 elapsed=0;options.fetchImpl=(url,init)=>{elapsed+=15001;return fetchImpl(url,init)}
 await assert.rejects(run(options),e=>e.name==='TimeoutError')
})
test('rejects changed transport status MIME and final authority',async()=>{
 for(const change of [{status:403},{contentType:'text/plain'},{finalURL:'https://foreign.test/careers'}])await assert.rejects(run(replay(rows=>Object.assign(rows[0],change))))
})
test('keeps unknown listing countries as observations without inventing native India detail',async()=>{
 const jobs=await run(replay(rows=>{for(const r of rows.filter(r=>r.requestedURL.includes('/jobs/v1?'))){const p=JSON.parse(r.body);p.response[0].locationHierarchyComplete='Maharashtra>Mumbai';r.body=JSON.stringify(p)}}))
 assert.equal(jobs.length,4);assert.equal(readSourceObservationEvidence(jobs,'raymond').observedVacancyCount,5)
 assert.equal(extractionDetailHealth(jobs).nativeCollections[0].unextractedDetailFailures,1)
})
test('holds unhandled applicant nationality restrictions',async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,p=>{p.targetNationality='Canada'})))
 assert.equal(jobs.length,4)
})
for(const[name,wrap]of[
 ['template',html=>'<template>'+html+'</template>'],
 ['hidden',html=>'<div hidden>'+html+'</div>'],
 ['noscript',html=>'<noscript>'+html+'</noscript>'],
 ['comment',html=>'<!--'+html.replaceAll('-->','')+'-->'],
])test('does not bind through an inactive corporate careers shell: '+name,async()=>{
 await assert.rejects(run(replay(rows=>{rows[0].body=wrap(rows[0].body)})))
})
test('requires the active advertised corporate bundle to be executable JavaScript',async()=>{
 await assert.rejects(run(replay(rows=>{rows[0].body=rows[0].body.replace('<script defer="defer"','<script type="application/json" defer="defer"')})))
})
test('ignores a stale commented corporate handoff after active delegation changes',async()=>{
 await assert.rejects(run(replay(rows=>{rows[1].body=rows[1].body.replaceAll('https://raymondcareers.peoplestrong.com/','https://foreign.example/careers/')+'/*cta:"https://raymondcareers.peoplestrong.com/",ctaName:"Apply Now"*/'})))
})
for(const html of ['<p>Employer: Different Employer Limited</p>','<p>Employer:</p><p>Different Employer Limited</p>','<p>You will be employed by Different Employer Limited.</p>',
 'Employer: Different Employer Limited','<aside>Employer: Different Employer Limited</aside>','<main>Employer: Different Employer Limited</main>',
 '<address>Employer: Different Employer Limited</address>'])
test('holds conflicting active own-role employer criteria: '+html,async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,p=>{p.jobDescription=html+p.jobDescription})));assert.equal(jobs.length,4)
})
test('inactive employer labels cannot override current native employer identity',async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,p=>{p.jobDescription='<template><p>Employer: Different Employer Limited</p></template>'+p.jobDescription})));assert.equal(jobs.length,5)
})
for(const [name,expression]of[
 ['detail API','"job/"+t+"/v2?part="+r+"&isReqId="+o'],
 ['render policy','getJobSecuritywithEntity(t){return this.makeSecuredGetReq("security/job/"+t)}'],
])test('rejects stale commented native executable contract: '+name,async()=>{
 await assert.rejects(run(replay(rows=>{const r=rows.find(r=>r.requestedURL.endsWith('chunk-IFMVPRQ7.js'));assert.ok(r.body.includes(expression));r.body=r.body.replaceAll(expression,expression.replace('job/','different/'))+'/*'+expression+'*/'})))
})
