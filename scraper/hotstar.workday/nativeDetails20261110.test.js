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
const bytes=fs.readFileSync(new URL('./test-data/native-20261110.json.gz',import.meta.url)),fixtures=JSON.parse(gunzipSync(bytes))
const manifest=JSON.parse(fs.readFileSync(new URL('./test-data/manifest.json',import.meta.url)))
const sha=b=>createHash('sha256').update(b).digest('hex')
const DETAIL='https://jiostar.wd102.myworkdayjobs.com/wday/cxs/jiostar/JioStar/job/Bengaluru/Staff-UXR_JR10255'
const replay=(mutate=()=>{})=>{
 const responses=structuredClone(fixtures);mutate(responses)
 const pages=responses.filter(r=>r.method!=='POST'&&!r.requestedURL.includes('/wday/cxs/'))
 const lists=responses.filter(r=>r.requestedURL.endsWith('/jobs'));let listingRead=0
 const details=new Map(responses.filter(r=>r.requestedURL.includes('/wday/cxs/')&&!r.requestedURL.endsWith('/jobs')).map(r=>[r.requestedURL,r]))
 return {now:()=>fixtures[0].at,fetchPage:async url=>{
  const r=pages.find(r=>r.requestedURL===url);assert.ok(r,'unbound page '+url)
  return {status:r.status,url:r.finalURL,html:r.body}
 },fetchJson:async(url,body)=>{const r=lists[listingRead++];assert.ok(r,'extra listing read');assert.equal(url,r.requestedURL);assert.deepEqual(JSON.parse(body),JSON.parse(r.requestBody));return JSON.parse(r.body)},
 fetchDetailJson:async url=>{const r=details.get(url);assert.ok(r,'unbound detail '+url);return JSON.parse(r.body)}}
}
const mutateDetail=(rows,change)=>{const r=rows.find(r=>r.requestedURL===DETAIL);const p=JSON.parse(r.body);change(p);r.body=JSON.stringify(p)}
test('current public Hotstar fixtures preserve complete dated payload bytes and SHA',()=>{
 assert.equal(sha(bytes),manifest.sha256)
 assert.equal(fixtures.length,120)
 for(const r of fixtures)assert.equal(sha(r.body),r.sha256||r.bodySHA256)
})
test('recovers all104 full own-role descriptions and criteria while retaining source coverage holds',async()=>{
 const jobs=await run(replay())
 assert.equal(jobs.length,104)
 assert.equal(extractionDetailHealth(jobs).missingDescriptions,0)
 assert.ok(jobs.every(j=>j.sourceDetailComplete===true&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(j=>j.sourceNativeLegalEmployer==='7018 Jiostar India Private Limited'&&j.country==='India'))
 assert.match(jobs.find(j=>j.jobId==='JR10255').jobDescription,/partner closely with designers/)
 assert.equal(jobs.find(j=>j.jobId==='JR10255').postingDate,'2026-08-18')
 assert.ok(jobs.find(j=>j.jobId==='JR12415').location.includes('Bengaluru'))
 assert.equal(readSourceObservationEvidence(jobs,'hotstar').observedVacancyCount,104)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 const collection=extractionDetailHealth(jobs).nativeCollections[0]
 assert.equal(collection.candidateDetails,104);assert.equal(collection.parsedDetails,104)
 assert.equal(collection.unextractedDetailFailures,0);assert.equal(collection.closingInventoryMatches,true)
})
for(const[name,change]of[
 ['different legal employer',p=>{p.hiringOrganization.name='Different Employer'}],
 ['unrelated JioStar brand',p=>{p.jobPostingInfo.jobDescription=p.jobPostingInfo.jobDescription.replaceAll('JioHotstar','Star Sports')}],
 ['brand only in company boilerplate',p=>{p.jobPostingInfo.jobDescription=p.jobPostingInfo.jobDescription.replaceAll('JioHotstar','Star Sports')+'<h3>About Us</h3><p>JioStar operates JioHotstar along with its other portfolio brands.</p>'}],
 ['missing native description',p=>{p.jobPostingInfo.jobDescription='<p>Apply now</p>'}],
 ['foreign country contradiction',p=>{p.jobPostingInfo.country={descriptor:'Canada',alpha2Code:'CA'}}],
 ['unknown native country',p=>{delete p.jobPostingInfo.country;delete p.jobPostingInfo.jobRequisitionLocation.country}],
 ['malformed supplied native country',p=>{p.jobPostingInfo.country=['India']}],
 ['foreign country in native worksite',p=>{p.jobPostingInfo.location='Bengaluru, Canada'}],
 ['different requisition',p=>{p.jobPostingInfo.jobReqId='JR00000'}],
 ['different current title',p=>{p.jobPostingInfo.title='Different Vacancy'}],
 ['foreign canonical role URL',p=>{p.jobPostingInfo.externalUrl='https://foreign.test/jobs/role'}],
 ['malformed native date',p=>{p.jobPostingInfo.startDate='2026-02-30'}],
 ['closing before native posting',p=>{p.jobPostingInfo.endDate='2026-08-01'}],
])test(`retains a visible native failure instead of qualifying ${name}`,async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,change)))
 assert.equal(jobs.length,103)
 assert.ok(!jobs.some(j=>j.jobId==='JR10255'))
 assert.equal(extractionDetailHealth(jobs).nativeCollections[0].unextractedDetailFailures,1)
 assert.equal(readSourceObservationEvidence(jobs,'hotstar').observedVacancyCount,104)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('does not replace a changed closing native listing with a complete inventory claim',async()=>{
 await assert.rejects(run(replay(rows=>{const r=rows.filter(r=>r.requestedURL.endsWith('/jobs')).at(-1);const p=JSON.parse(r.body);p.jobPostings[0].title='Changed closing title';r.body=JSON.stringify(p)})))
})
for(const [name,from,to]of[
 ['inactive portfolio brand','alt="Jio Hotstar Logo"','hidden alt="Jio Hotstar Logo"'],
 ['foreign portfolio Careers delegation','href="https://jiostar.wd102.myworkdayjobs.com/JioStar"','href="https://foreign.test/careers"'],
 ['missing portfolio context','id="main-content"','id="different-content"'],
])test(`holds ${name}`,async()=>{
 await assert.rejects(run(replay(rows=>{const r=rows.find(r=>r.requestedURL==='https://www.jiostar.com/portfolio/');assert.ok(r.body.includes(from));r.body=r.body.replaceAll(from,to)})))
})
test('honors caller cancellation and bounds transport callbacks that ignore AbortSignal',async()=>{
 const controller=new AbortController(),reason=new Error('cancel Hotstar native audit');controller.abort(reason)
 await assert.rejects(run({...replay(),signal:controller.signal}),e=>e===reason)
 await assert.rejects(run({...replay(),sourceTimeoutMs:30,fetchDetailJson:()=>new Promise(()=>{})}))
})
test('does not take an inactive homepage title as current Hotstar identity',async()=>{
 await assert.rejects(run(replay(rows=>{const r=rows.find(r=>r.requestedURL==='https://www.hotstar.com/');r.body=r.body.replace('<title>','<template><title>').replace('</title>','</title></template>')})))
})
test('rejects a contradictory later positive native total',async()=>{
 await assert.rejects(run(replay(rows=>{const r=rows.filter(r=>r.requestedURL.endsWith('/jobs'))[1];const p=JSON.parse(r.body);p.total=105;r.body=JSON.stringify(p)})))
})
test('uses monotonic request deadlines when the event loop cannot run abort timers',async t=>{
 let elapsed=0;t.mock.method(performance,'now',()=>elapsed)
 const opts=replay(),original=opts.fetchDetailJson
 opts.fetchDetailJson=(url,init)=>{if(url===DETAIL)elapsed=20001;return original(url,init)}
 const jobs=await run(opts)
 // Four concurrent requests started before the monotonic clock advanced, so
 // each has genuinely exceeded its individual deadline in this controlled run.
 assert.equal(jobs.length,100);assert.ok(!jobs.some(j=>j.jobId==='JR10255'))
 assert.equal(extractionDetailHealth(jobs).nativeCollections[0].unextractedDetailFailures,4)
})
test('cancels and releases an oversized undeclared response stream',async()=>{
 let cancelled=false,released=false
 await assert.rejects(run({sourceTimeoutMs:5000,fetchImpl:async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:async()=>({done:false,value:new Uint8Array(4000001)}),cancel:()=>{cancelled=true},releaseLock:()=>{released=true}})}})}))
 assert.equal(cancelled,true);assert.equal(released,true)
})
for(const location of ['Toronto (Canada)','Toronto - Canada','Toronto – Canada','Toronto — Canada','Toronto / Canada','Toronto (France)'])
test(`holds a complete written-country conflict: ${location}`,async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,p=>{p.jobPostingInfo.location=location})))
 assert.equal(jobs.length,103);assert.ok(!jobs.some(j=>j.jobId==='JR10255'))
 assert.equal(extractionDetailHealth(jobs).nativeCollections[0].unextractedDetailFailures,1)
})
for(const prefix of [
 '<p>This is a Star Sports role, not a JioHotstar role.</p>',
 '<p>This is a Star Sports role. It collaborates with JioHotstar.</p>',
 '<p>This position is a Star Sports role. It collaborates with JioHotstar.</p>',
 '<p>This role is for Star Sports. It collaborates with JioHotstar.</p>',
 '<p>this is a star sports role. It collaborates with JioHotstar.</p>',
 '<p>This position is for Star Sports. It partners with JioHotstar.</p>',
 '<p>This vacancy is for Star Sports. It works with JioHotstar.</p>',
 '<p>It collaborates with JioHotstar.</p>',
 '<p>It partners with JioHotstar.</p>',
 '<p>It works with JioHotstar.</p>',
 '<p>This role is not for JioHotstar.</p>',
])test(`holds an explicit unrelated role declaration: ${prefix}`,async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,p=>{p.jobPostingInfo.jobDescription=prefix+p.jobPostingInfo.jobDescription.replaceAll('JioHotstar','Star Sports')})))
 assert.equal(jobs.length,103);assert.ok(!jobs.some(j=>j.jobId==='JR10255'))
})
test('an explicit brand denial overrides other affirmative mentions in the same native description',async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,p=>{p.jobPostingInfo.jobDescription='<p>This is not a JioHotstar role.</p>'+p.jobPostingInfo.jobDescription})))
 assert.equal(jobs.length,103)
})

test('an explicit foreign role assignment overrides affirmative Hotstar wording elsewhere',async()=>{
 const jobs=await run(replay(rows=>mutateDetail(rows,p=>{p.jobPostingInfo.jobDescription='<p>This role is for Star Sports.</p>'+p.jobPostingInfo.jobDescription})))
 assert.equal(jobs.length,103)
})
test('fails closed with all native candidate failures retained when every detail is denied',async()=>{
 await assert.rejects(run({...replay(),fetchDetailJson:async()=>{throw new Error('HTTP403 native detail denied')}}),error=>{
  assert.equal(error.nativeCollectionEvidence.candidateDetails,104)
  assert.equal(error.nativeCollectionEvidence.failures.length,104)
  assert.equal(error.nativeCollectionEvidence.extractedDetailJobs,0)
  assert.equal(error.recruitmentObservations.nativeRecords,104)
  assert.equal(error.recruitmentObservations.failures.length,104)
  return true
 })
})
