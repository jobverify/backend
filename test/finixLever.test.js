import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { run } from '../scraper/finix/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/finix/native-inventory.json', import.meta.url)))
const native = (overrides = {}) => ({ ...structuredClone(fixture[0]), ...overrides })
const india = (overrides={}) => native({ id:'00000000-0000-4000-8000-000000000001',hostedUrl:'https://jobs.lever.co/finix/00000000-0000-4000-8000-000000000001',applyUrl:'https://jobs.lever.co/finix/00000000-0000-4000-8000-000000000001/apply',country:'IN', categories:{commitment:'Full-time',department:'Engineering',location:'Bengaluru, India',team:'Platform',allLocations:['Bengaluru, India']}, descriptionPlain:'Build payment systems.', descriptionBodyPlain:'Build payment systems and operate reliable services.', openingPlain:'Join our engineering team.', lists:[{text:'Responsibilities',content:'<li>Build and maintain payment systems.</li>'}], additionalPlain:'Collaborate with the team.', ...overrides })
const replay = payload => run({ fetchJson:async url=>{assert.equal(url,'https://api.lever.co/v0/postings/finix?mode=json');return structuredClone(payload)} })

test('Finix caller cancellation prevents transport and wins over a returned malformed envelope',async()=>{
 for(const beforeFetch of [true,false]){
  const controller=new AbortController(),reason=Error('Stop Finix native source')
  let calls=0
  if(beforeFetch)controller.abort(reason)
  await assert.rejects(run({signal:controller.signal,fetchJson:async()=>{
   calls++;controller.abort(reason);return{error:'unavailable'}
  }}),error=>error===reason)
  assert.equal(calls,beforeFetch?0:1)
 }
})

test('Finix live wrapper preserves24 board rows as partial evidence when4 secondary Remote scopes remain unresolved',async()=>{
 const jobs=await replay(fixture)
 assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.ok(evidence,'sentinel empty is not checked-board evidence')
 assert.equal(evidence.reportedTotal,24)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.indiaFacetCount,null)
 assert.match(evidence.reason,/secondary.*remote|remote.*scope/i)
})
test('future explicit India retains full native sections and exact application identity without invented dates',async()=>{
 const row=india()
 const jobs=await replay([row])
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].source,'finix')
 assert.equal(jobs[0].company,'Finix')
 assert.equal(jobs[0].applyUrl,row.applyUrl)
 assert.equal(jobs[0].sourceUrl,row.hostedUrl)
 for(const section of ['Join our engineering team.','Build payment systems and operate reliable services.','Responsibilities','Build and maintain payment systems.','Collaborate with the team.']) assert.ok(jobs[0].jobDescription.includes(section),section)
 assert.equal(jobs[0].postingDate,null)
 assert.equal(jobs[0].nativeCreatedAt,row.createdAt)
 assert.equal(jobs[0].legalEmployer??null,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('typed secondary India selection does not disappear behind a foreign primary label',async()=>{
 const row=india({country:'US',categories:{location:'San Francisco',allLocations:['San Francisco','Bengaluru, India'],commitment:'Full-time'}})
 const jobs=await replay([row])
 assert.equal(jobs.length,1)
 assert.match(jobs[0].location,/Bengaluru/)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(jobs[0].nativeRecord.country,'US')
 assert.deepEqual(jobs[0].nativeRecord.categories,row.categories)
})
test('generic Remote does not become India eligibility and partial scope marks retained India jobs incomplete',async()=>{
 const jobs=await replay([india(),native()])
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
test('documented terminal empty response differs from an unverified sentinel or ambiguous nonempty inventory',async()=>{
 const jobs=await replay([])
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs)?.status,'verified-empty')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,0)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('missing selected native JD retains partial inventory rather than certifying a complete listing',async()=>{
 const jobs=await replay([india({descriptionPlain:null,description:null,descriptionBodyPlain:null,descriptionBody:null,opening:null,openingPlain:null,additionalPlain:null,additional:null,lists:[]})])
 assert.equal(readInventoryEvidence(jobs)?.listingComplete,false)
 assert.ok(jobs.length===0||jobs.every(j=>j.sourceListingComplete===false))
})
test('upstream error, pagination activation and duplicate or foreign application identities cannot establish zero',async()=>{
 for(const payload of [{error:'unavailable'}, {hasMore:true,jobs:[]}, [india(),india()], [india({applyUrl:'https://jobs.lever.co/unrelated/native-id/apply'})]]) await assert.rejects(replay(payload),/inventory|pagination|identity|application/i)
 await assert.rejects(run({fetchJson:async()=>{throw new Error('upstream unavailable')}}),/upstream unavailable/)
})


test('native India country selects a primary Remote role while secondary Remote scope stays incomplete',async()=>{
 const jobs=await replay([india({country:'IN',categories:{location:'Remote',allLocations:['Remote'],commitment:'Full-time'}})])
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].location,'Remote, India')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].sourceListingComplete,false)
})

test('combined native fallback and optional salary description remain complete when split body is absent',async()=>{
 const jobs=await replay([india({descriptionBodyPlain:null,descriptionBody:null,descriptionPlain:'Complete combined opening and role responsibilities.',openingPlain:'Opening only.',salaryDescriptionPlain:'Native salary explanation.'})])
 assert.equal(jobs.length,1)
 assert.ok(jobs[0].jobDescription.includes('Complete combined opening and role responsibilities.'))
 assert.ok(jobs[0].jobDescription.includes('Native salary explanation.'))
})

test('contradictory primary country and location cannot publish an India role',async()=>{
 await assert.rejects(replay([india({country:'US'})]),/country|location|contradict/i)
 await assert.rejects(replay([india({categories:{location:'San Francisco',allLocations:['San Francisco']}})]),/country|location|contradict/i)
})
test('missing secondary inventory preserves an explicit India role with incomplete evidence',async()=>{
 const jobs=await replay([india({categories:{location:'Bengaluru, India'}})])
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

// Independent review055 regression probes: synthetic offline variants only.
test('explicit native datePosted survives mapping and keeps a known-old role ineligible',async()=>{
 const jobs=await replay([india({datePosted:'2020-01-01T00:00:00Z'})])
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].postingDate,'2020-01-01T00:00:00.000Z')
 const {analyzePublishableJobs}=await import('../scraper-support/utils/publishableJobMetrics.js')
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T20:00:00Z')}).eligibleJobs.length,0)
 assert.equal(jobs[0].nativeCreatedAt,fixture[0].createdAt)
})
test('invalid or unsupported explicit publication evidence fails closed',async()=>{
 for(const overrides of [{datePosted:'not-a-date'},{datePosted:'2026-02-30'},{datePosted:0},{datePosted:''},{publishedAt:'2020-01-01T00:00:00Z'}]) await assert.rejects(replay([india(overrides)]),/publication|date|contract/i)
})
test('whitespace-normalized generic Remote is never invented as India',async()=>{
 for(const location of [' Remote ','\tRemote\n','REMOTE','  Worldwide  ']){
  const jobs=await replay([india({country:null,categories:{location,allLocations:[location]}})])
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 }
})
test('explicit foreign geography rejects contradictory primary and secondary India labels',async()=>{
 for(const label of ['Bengaluru, United States','Bengaluru, India, United States','Bengaluru, Canada','Pune, Singapore']){
  await assert.rejects(replay([india({categories:{location:label,allLocations:[label]}})]),/country|location|geograph|contradict/i)
  await assert.rejects(replay([india({categories:{location:'Bengaluru, India',allLocations:['Bengaluru, India',label]}})]),/country|location|geograph|contradict/i)
 }
})
test('boilerplate or inert markup alone does not publish a role or complete inventory',async()=>{
 for(const overrides of [
  {openingPlain:'Finix is an equal opportunity employer.'},
  {descriptionPlain:'Finix is an equal opportunity employer. We value diversity and do not discriminate on protected characteristics.'},
  {descriptionBody:'<script>Build payment systems and maintain reliable payment services.</script>'},
 ]){
  const row=india({descriptionBodyPlain:null,descriptionBody:null,descriptionPlain:null,description:null,openingPlain:null,opening:null,additionalPlain:null,additional:null,lists:[],...overrides})
  const jobs=await replay([row])
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})
test('explicit closed or unsupported lifecycle status cannot become a published role',async()=>{
 for(const overrides of [{status:'closed'},{status:'unknown'},{status:null},{state:'draft'},{publicationStatus:'unpublished'},{isListed:false},{isPublished:false},{isActive:false},{closed:true}]) await assert.rejects(replay([india(overrides)]),/status|lifecycle|published|contract/i)
})
