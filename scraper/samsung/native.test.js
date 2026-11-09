import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {freshFetch,freshResponses} from './freshReplay.js'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const official=freshResponses.find(r=>r.url==='https://www.samsung.com/in/about-us/careers/'),researchOfficial=freshResponses.find(r=>r.url==='https://research.samsung.com/careers')
const replay=({change=record=>record,...options}={})=>run({now:()=>new Date('2026-10-23T06:00:00Z'),fetchImpl:freshFetch(change),...options})

test('the official board enumerates every India page and retains employer identity evidence',async()=>{
 const jobs=await replay()
 const evidence=jobs[Symbol.for('jobverify.samsung-native-evidence')]
 assert.equal(evidence.globalReportedTotal,653)
 assert.equal(evidence.indiaReportedTotal,30)
 assert.equal(evidence.indiaRows.length,30)
 assert.equal(evidence.details.length,40)
 assert.equal(jobs.length,29)
 assert.equal(jobs.some(j=>['R119924','R114583'].includes(j.id)),false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(evidence.cleanupAllowed,false)
})

const detailChange=change=>record=>{
 if(record.url.includes('/job/')&&record.url.endsWith('Senior-Staff-Engineer_R120924')){
  const payload=JSON.parse(record.body);change(payload);record.body=JSON.stringify(payload)
 }
 return record
}
test('publication, deadline, employer and SSIR division come from native detail fields',async()=>{
 const jobs=await replay(),job=jobs.find(j=>j.id==='R119756')
 assert.equal(job.postedAt,'2026-08-20')
 assert.equal(job.closingDate,'2026-12-31')
 assert.equal(job.legalEmployer,'Samsung R&D India - Bangalore Pvt. Ltd')
 assert.equal(job.nativeBusinessUnit,'Samsung Semiconductor India Research (SSIR)')
 assert.equal(job.firstEverPublication,null)
 assert.match(job.sourceDescription,/Design highly competitive circuits/)
})
for(const [label,html] of [
 ['hidden','<div hidden>Responsibilities include designing complex systems and testing every subsystem through multiple release cycles.</div>'],
 ['content visibility','<div style="content-visibility:hidden">Responsibilities include designing complex systems and testing every subsystem through multiple release cycles.</div>'],
 ['inert','<div inert>Responsibilities include designing complex systems and testing every subsystem through multiple release cycles.</div>'],
 ['template','<template>Responsibilities include designing complex systems and testing every subsystem through multiple release cycles.</template>'],
 ['heading only','<h1>Responsibilities include designing complex systems and testing every subsystem through multiple release cycles.</h1>'],
 ['strong only','<strong>Responsibilities include designing complex systems and testing every subsystem through multiple release cycles.</strong>'],
 ['title only','<title>Responsibilities include designing complex systems and testing every subsystem through multiple release cycles.</title>'],
 ['missing',null],
])test(label+' description retains the otherwise eligible candidate as partial',async()=>{
 const jobs=await replay({change:detailChange(p=>p.jobPostingInfo.jobDescription=html)}),job=jobs.find(j=>j.id==='R120924')
 assert.ok(job);assert.equal(job.sourceDescription,null);assert.equal(job.sourceDetailComplete,false)
})
test('missing publication stays unknown instead of using creation or crawl time',async()=>{
 const jobs=await replay({change:detailChange(p=>{delete p.jobPostingInfo.startDate;p.jobPostingInfo.dateCreated='2020-01-01'})})
 assert.equal(jobs.find(j=>j.id==='R120924').postedAt,null)
})
for(const deadline of ['2026-10-23T01:00:00Z','2026-10-23T06:00:00Z'])test('exact native deadline '+deadline+' is closed at or after its instant',async()=>{
 const jobs=await replay({change:detailChange(p=>p.jobPostingInfo.endDate=deadline)})
 assert.equal(jobs.some(j=>j.id==='R120924'),false)
})
for(const deadline of ['2026-10-23','2026-10-23T06:00:01Z'])test('current-day or future native deadline '+deadline+' remains open',async()=>{
 const jobs=await replay({change:detailChange(p=>p.jobPostingInfo.endDate=deadline)})
 const job=jobs.find(j=>j.id==='R120924')
 assert.ok(job)
 assert.equal(job.closingDate,deadline)
 assert.equal(job.sourceClosingDateIsExact,deadline.includes('T'))
})
test('a verified India role preserves typed foreign secondary locations without projecting them as India',async()=>{
 const jobs=await replay({change:detailChange(p=>p.jobPostingInfo.additionalLocations=[{descriptor:'London, United Kingdom',country:{descriptor:'United Kingdom',alpha2Code:'GB'}}])})
 const job=jobs.find(j=>j.id==='R120924')
 assert.ok(job)
 assert.deepEqual(job.locations,['SSIR, Angkor West, Bangalore, India'])
 assert.deepEqual(job.nativeFacts.secondary,[{label:'London, United Kingdom',country:'United Kingdom'}])
})
for(const [label,change] of [
 ['expired',p=>p.jobPostingInfo.endDate='2026-10-01'],
 ['not posted',p=>p.jobPostingInfo.posted=false],
 ['cannot apply',p=>p.jobPostingInfo.canApply=false],
 ['invalid publication',p=>p.jobPostingInfo.startDate='2026-02-30'],
 ['future publication',p=>p.jobPostingInfo.startDate='2027-01-01'],
 ['primary country conflict',p=>p.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US'],
 ['foreign state conflict',p=>{p.jobPostingInfo.location='Bangalore, TX, India';p.jobPostingInfo.jobRequisitionLocation.descriptor='Bangalore, TX, India'}],
 ['unknown secondary city',p=>p.jobPostingInfo.additionalLocations=['Bangalore']],
])test(label+' cannot produce an eligible Samsung role',async()=>{
 const jobs=await replay({change:detailChange(change)})
 assert.equal(jobs.some(j=>j.id==='R120924'),false)
})
test('short pagination never becomes an empty or complete inventory',async()=>{
 await assert.rejects(replay({change:record=>{
  if(record.requestBody?.offset===20){const p=JSON.parse(record.body);p.jobPostings.pop();record.body=JSON.stringify(p)}return record
 }}),/short\/oversized native page/)
})
test('duplicate pagination rejects the batch',async()=>{
 await assert.rejects(replay({change:record=>{
  if(record.requestBody?.offset===20){const p=JSON.parse(record.body);p.jobPostings[0]=JSON.parse(freshResponses.find(r=>r.requestBody?.offset===0&&Object.keys(r.requestBody.appliedFacets).length===0).body).jobPostings[0];record.body=JSON.stringify(p)}return record
 }}),/duplicate native page/)
})
test('an inert corporate handoff cannot establish first party delegation',async()=>{
 await assert.rejects(replay({change:record=>{if(record.url===official.url)record.body='<template>'+record.body+'</template>';return record}}),/handoff missing/)
})
test('a stale Research delegation cannot silently remove Samsung candidates',async()=>{
 await assert.rejects(replay({change:record=>{if(record.url===researchOfficial.url)record.body='<template>'+record.body+'</template>';return record}}),/Research delegation/)
})
test('captured fixtures retain reproducible file and response body provenance',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/manifest.json',import.meta.url),'utf8'))
 const sha=b=>createHash('sha256').update(b).digest('hex')
 for(const file of manifest.files){
  const compressed=readFileSync(new URL('./fixtures/'+file.file,import.meta.url)),raw=gunzipSync(compressed),values=JSON.parse(raw)
  assert.equal(sha(compressed),file.fileSHA256);assert.equal(sha(raw),file.decodedFileSHA256)
  const records=Array.isArray(values)?values:[values]
  for(let i=0;i<records.length;i++){assert.equal(sha(records[i].body),file.responses[i].bodySHA256);assert.equal(records[i].status,200);assert.ok(Date.parse(records[i].capturedAt))}
 }
})
test('importing the scraper with an unrelated dry-run flag has no network or persistence side effects',()=>{
 const moduleUrl=new URL('./script.js',import.meta.url).href
 const result=spawnSync(process.execPath,['--input-type=module','-e',`process.argv=['node','unrelated.js','--dry-run'];globalThis.fetch=()=>{throw Error('unexpected import network')};await import(${JSON.stringify(moduleUrl)});`],{encoding:'utf8',timeout:5000})
 assert.equal(result.status,0,result.stderr)
})

test('an upstream failure is never represented as a verified empty Samsung inventory',async()=>{
 await assert.rejects(run({fetchImpl:async()=>{throw new Error('offline')}}),/offline/)
})

test('caller cancellation preserves its exact reason even when transport ignores it',async()=>{
 const controller=new AbortController(), reason=new Error('caller cancelled Samsung')
 const pending=run({signal:controller.signal,fetchImpl:()=>new Promise(()=>{})})
 controller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
})

test('a stalled response body cannot outlive the request deadline',async()=>{
 await assert.rejects(run({requestTimeoutMs:15,fetchImpl:async()=>({status:200,headers:new Headers({'content-type':'text/html'}),text:()=>new Promise(()=>{})})}),/timeout/)
})

test('overall cancellation stops an uncooperative transport',async()=>{
 await assert.rejects(run({overallTimeoutMs:15,fetchImpl:()=>new Promise(()=>{})}),/overall timeout/)
})
