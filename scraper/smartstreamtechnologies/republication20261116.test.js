import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runCurrentSmartStream} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {fixture as historicalFixture,replay as historicalReplay,LISTING,changeJSON} from './test-data/replay20261114.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/republication-20261116.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const replay=edit=>{
 let next=0
 return runCurrentSmartStream({now:()=>capture.capturedAt,fetchImpl:async(url,init)=>{
  const row=capture.responses[next]
  assert.ok(row,'Uncaptured native request '+url)
  assert.equal(url,row.url);assert.equal(init.method,row.method)
  let bytes=Buffer.from(row.bodyBase64,'base64')
  assert.equal(sha(bytes),row.sha256)
  if(edit&&row.headers['content-type'].startsWith('application/json')){
   const value=JSON.parse(bytes)
   edit(value,next)
   bytes=Buffer.from(JSON.stringify(value))
  }
  next++
  const response=new Response(bytes,{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.finalUrl})
  return response
 }})
}

test('SmartStream retains a completely pinned republished role while three reviewed candidates leave the first page',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,1)
 const job=jobs[0]
 assert.equal(job.jobId,'6069877')
 assert.equal(job.title,'SMSTR77 - Senior Software Engineer')
 assert.equal(job.postingDate,'2026-11-16T00:00:00.000Z')
 assert.equal(job.sourceUrl,'https://apply.workable.com/smartstream/j/87B3E6ED0F/')
 assert.equal(sha(job.sourceNativeRequirements),'d8c99c80025954ab118ae2a07e5ff17cd80ac53ab0be79d68f68a4374bea9435')
 assert.equal(job.sourceClosingReconciled,true)
 assert.equal(job.sourceDetailComplete,true)
 assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(job.sourceScopeComplete,false)
 assert.equal(job.applyUrl,null)
 assert.ok(['salary_from','salary_to','salary_currency_iso_code','salary_frequency'].every(key=>!Object.hasOwn(job.sourceNativeDetailRecord,key)&&!Object.hasOwn(job.sourceNativeClosingDetailRecord,key)&&!Object.hasOwn(job,key)))
 assert.deepEqual(jobs.nativeCollectionEvidence.unobservedReviewedCandidateIds,[6249195,6015485,6175554])
 assert.equal(jobs.nativeCollectionEvidence.unhydratedRecordCount,9)
 assert.equal(jobs.nativeCollectionEvidence.reader.requests,8)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const[label,edit,error]of[
 ['listing and detail publication disagreement',(value,index)=>{if(index===3)value.published='2026-11-15T00:00:00.000Z'},/published mismatch/],
 ['closing publication disagreement',(value,index)=>{if(index===6)value.results.find(row=>row.id===6069877).published='2026-11-15T00:00:00.000Z'},/inventory changed at closing/],
 ['changed country',(value,index)=>{if(index===3)value.location.country='United States'},/location mismatch/],
 ['changed complete criteria',(value,index)=>{if(index===3)value.requirements+='<p>Unreviewed condition</p>'},/requirements criteria changed/],
 ['a partial salary field',(value,index)=>{if(index===3)value.salary_to=999999},/role schema changed/],
 ['an unreviewed complete salary',(value,index)=>{if(index===3)Object.assign(value,{salary_from:0,salary_to:999999,salary_currency_iso_code:'INR',salary_frequency:'year'})},/salary criteria changed/],
 ['future publication',(value,index)=>{if([2,6].includes(index))value.results.find(row=>row.id===6069877).published='2099-01-01T00:00:00.000Z';if([3,7].includes(index))value.published='2099-01-01T00:00:00.000Z'},/published date is in the future/],
 ['no observed reviewed candidate',(value,index)=>{if([2,6].includes(index)){const row=value.results.find(row=>row.id===6069877);row.id=100000001;row.shortcode='ABCDEF1234'}},/No reviewed full role/],
])test('SmartStream republished subset rejects '+label,async()=>{
 await assert.rejects(replay(edit),error)
})

test('SmartStream subsets bind their own landing URL and do not inherit another candidate historical HEAD proof',async()=>{
 const selected=historicalFixture.roles[1].original
 const known=new Set(historicalFixture.roles.map(role=>role.original.id))
 const transport=historicalReplay(({url,bytes})=>url===LISTING?{bytes:changeJSON(bytes,page=>{
  page.results.forEach((row,index)=>{if(known.has(row.id)&&row.id!==selected.id){row.id+=100000000;row.shortcode='F00000000'+index}})
 })}:{})
 const jobs=await runCurrentSmartStream(transport.options)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,String(selected.id))
 assert.equal(jobs[0].sourceUrl,'https://apply.workable.com/smartstream/j/'+selected.shortcode+'/')
 assert.equal(jobs[0].nativePriorHeadObservation,null)
 assert.equal(jobs.nativeCollectionEvidence.unobservedReviewedCandidateIds.length,3)
})
