import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import * as source from './script.js'
import {readBoard} from './parser.js'
import {readNativePDF} from './pdf.js'

const fixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz',import.meta.url))))
const BOARD='https://www.gailonline.com/Vacancies.html',PDF='https://www.gailonline.com/careers/currentOpnning/Advertisement-English-14-10-2026.pdf'
const now=()=> '2026-10-23T15:00:00.000Z'
const board=Buffer.from(fixture.inputs.find(r=>r.kind==='board').bodyBase64,'base64').toString('utf8')
const denied=()=>{throw Error('No public HTTP allowed in fixture tests')}
globalThis.fetch=denied
function replay({editBoard=(html)=>html,statusFor=()=>200,extraPDF=false}={}){
 const reads=[];let boards=0
 const fetchImpl=async(url,options)=>{
  reads.push({url,method:options.method,accept:options.headers.Accept})
  const packet=fixture.inputs.find(r=>r.url===url)??(extraPDF&&url.endsWith('/unknown-role.pdf')?fixture.inputs.find(r=>r.kind==='pdf'):null)
  assert.ok(packet,'Unexpected fixture read:'+url)
  const body=url===BOARD?Buffer.from(editBoard(board,++boards)):Buffer.from(packet.bodyBase64,'base64')
  const response=new Response(body,{status:statusFor(url),headers:{'content-type':packet.headers['content-type'],'content-length':String(body.length)}})
  Object.defineProperty(response,'url',{value:url})
  return response
 }
 return{reads,fetchImpl}
}

test('GAIL extracts full native PDF role and original board posting day;notice-card counts are separate',async()=>{
 const r=replay(),jobs=await source.run({fetchImpl:r.fetchImpl,now})
 assert.equal(jobs.length,1)
 const job=jobs[0]
 assert.equal(job.jobId,'GAIL/KOLKATA/HR/MEDICAL_CONSULTANT/2026/1')
 assert.equal(job.title,'Part Time Medical Consultant');assert.equal(job.company,'GAIL India');assert.equal(job.city,'Kolkata');assert.equal(job.country,'India')
 assert.equal(job.postingDate,'2026-10-14T00:00:00.000Z');assert.equal(job.nativeFacts.nativePostedDate.precision,'day');assert.equal(job.nativeFacts.firstEverPublication,null)
 assert.equal(job.closingDate,'2026-10-28T07:30:00.000Z')
 assert.equal(job.nativeFacts.nativeReportingWindow,'11:00 Hrs. to 13:00 Hrs.')
 assert.equal(job.nativeFacts.reportingTimezoneDerivedFromVenue,'Asia/Kolkata')
 assert.match(job.jobDescription,/Number of\s+Vacancies/);assert.match(job.jobDescription,/28\.10\.2026/);assert.match(job.jobDescription,/one-year\s+post\s+internship/)
 assert.equal(job.jobDescription,job.nativeFacts.nativePDFPages.map(p=>p.text).join('\n'))
 assert.equal(job.nativeFacts.nativeApplicationURL,null);assert.equal(job.sourceUrl,PDF)
 const batch=job.nativeCollectionEvidence
 assert.equal(batch.nativeNoticeInventory.observedNoticeCards,123);assert.equal(batch.nativeNoticeInventory.ageExcludedNoticeCards,118)
 assert.equal(batch.nativeNoticeInventory.nonVacancyNoticeCards,4)
 assert.equal(batch.observedListingCount,1);assert.equal(batch.nativeReportedTotal,null);assert.equal(batch.candidateDetails,1);assert.equal(batch.jobs.length,1)
 assert.equal(batch.closingInventoryMatches,true);assert.equal(batch.sourceScopeComplete,false);assert.equal(batch.cleanupAllowed,false)
 assert.deepEqual(r.reads.map(x=>[x.url,x.method,x.accept]),[[BOARD,'GET','text/html'],[PDF,'GET','application/pdf'],[BOARD,'GET','text/html']])
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(isVerifiedEmptyEvidence(evidence),false)
 const analysis=analyzePublishableJobs(jobs,{now:new Date(now())});assert.equal(analysis.indiaJobs.length,1);assert.equal(analysis.eligibleJobs.length,1)
})

test('GAIL never refreshes the native posting date to an observation clock',async()=>{
 const r=replay(),jobs=await source.run({fetchImpl:r.fetchImpl,now:()=> '2026-10-24T12:00:00.000Z'})
 assert.equal(jobs[0]?.postingDate,'2026-10-14T00:00:00.000Z')
})

test('GAIL rejects the notice after its explicit walk-in reporting window without asserting verified zero',async()=>{
 const r=replay()
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now:()=> '2026-10-28T07:30:00.001Z'}),error=>{
  assert.equal(error.nativeEvidence?.sourceScopeComplete,false)
  assert.equal(error.nativeEvidence?.exclusions[0]?.kind,'walk-in-reporting-ended')
  assert.equal(error.nativeEvidence?.verifiedZeroInventory,false);return true
 })
})

test('GAIL refuses a newly interpolated remote listing literal without executing it',async()=>{
 const r=replay({editBoard:html=>html.replace('current: `','current: `${globalThis.GAIL_REMOTE_EXECUTED=true}')})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}))
 assert.equal(globalThis.GAIL_REMOTE_EXECUTED,undefined)
 assert.equal(r.reads.length,1)
})

test('GAIL retains unknown posting-day evidence instead of substituting fresh dates',async()=>{
 const r=replay({editBoard:html=>html.replace('Post Date:</strong> 14.10.2026','Post Date:</strong> Unknown')})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}),error=>{
  assert.equal(error.nativeEvidence?.nativeNoticeInventory.unknownPostingDateNoticeCards,1)
  assert.equal(error.nativeEvidence?.verifiedZeroInventory,false);return true
 })
 assert.equal(r.reads.some(x=>x.url===PDF),false)
})

test('GAIL retains a changed closing notice inventory as incomplete',async()=>{
 const r=replay({editBoard:(html,n)=>n===1?html:html.replace('Post Date:</strong> 14.10.2026','Post Date:</strong> 15.10.2026')})
 const jobs=await source.run({fetchImpl:r.fetchImpl,now})
 assert.equal(jobs.length,1);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)
 assert.equal(jobs[0].sourceListingComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('GAIL stops all further reads after an upstream403',async()=>{
 const r=replay({statusFor:()=>403})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}),error=>{
  assert.equal(error.nativeEvidence?.retainedResponses[0]?.status,403);return true
 })
 assert.equal(r.reads.length,1)
})

test('GAIL retains a failed PDF response and emits no teaser or made-up description',async()=>{
 const r=replay({statusFor:url=>url===PDF?503:200})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}),error=>{
  assert.equal(error.nativeEvidence?.failures.some(f=>f.stage==='native-detail'),true)
  assert.equal(error.nativeEvidence?.retainedResponses.some(p=>p.status===503),true);return true
 })
})

test('GAIL rejects PDF employer/requisition conflicts even with otherwise complete text',async()=>{
 const r=replay()
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now,parsePdf:async()=>({pages:[{page:1,text:'A different employer medical consultant in Kolkata, India'}]})}))
})

test('GAIL rejects unsupported partial maxJobs before reading public pages',async()=>{
 const r=replay();await assert.rejects(source.run({fetchImpl:r.fetchImpl,now,maxJobs:1}));assert.equal(r.reads.length,0)
})

test('GAIL does not turn old notices into a verified empty current employer inventory',async()=>{
 const r=replay()
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now:()=> '2026-12-23T15:00:00.000Z'}),error=>{
  assert.equal(error.nativeEvidence?.nativeNoticeInventory.ageExcludedNoticeCards,119)
  assert.equal(error.nativeEvidence?.nativeNoticeInventory.nonVacancyNoticeCards,4)
  assert.equal(error.nativeEvidence?.verifiedZeroInventory,false);return true
 })
 assert.equal(r.reads.some(x=>x.url===PDF),false)
})

test('GAIL classifies dated exam/mock-test/admit-card/syllabus controls separately from vacancies',()=>{
 const listing=readBoard(board,now())
 assert.equal(listing.nativeNoticeInventory.nonVacancyNoticeCards,4)
 assert.equal(listing.nativeNoticeInventory.unknownPostingDateNoticeCards,0)
 assert.equal(listing.rows.filter(r=>r.nonVacancy).length,4)
 assert.ok(listing.rows.filter(r=>r.nonVacancy).every(r=>r.postedDate===null))
})

test('GAIL refuses unqualified new pagination controls rather than truncating the notice inventory',async()=>{
 const r=replay({editBoard:html=>html.replace('current: `','current: `<nav class="pagination"><a rel="next" href="/next">Next</a></nav>')})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}))
 assert.equal(r.reads.length,1)
})

test('GAIL rejects a conflicting job workplace even when the employer header and interview venue still say Kolkata',async()=>{
 const r=replay()
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now,parsePdf:async(bytes,options)=>{
  const parsed=await readNativePDF(bytes,options)
  return{pages:parsed.pages.map(page=>({...page,text:page.text.replace(/Place of Services to be rendered[\s\S]*?Candidates for the Post/,
   'Place of Services to be rendered : Dubai, United Arab Emirates. Candidates for the Post')}))}
 }}))
})

test('GAIL rejects incomplete PDF descriptions instead of publishing an employer introduction',async()=>{
 const r=replay()
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now,parsePdf:async()=>({pages:[{page:1,text:'GAIL (India) Limited Kolkata Zonal Office'},{page:2,text:'Part Time Medical Consultant'}]})}))
})
