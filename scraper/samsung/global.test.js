import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {freshFetch} from './freshReplay.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const replay=change=>run({fetchImpl:freshFetch(change),now:()=>new Date('2026-10-23T17:30:00Z')})
test('global pagination recovers typed India requisitions omitted from the posting-country facet',async()=>{
 const jobs=await replay(),evidence=jobs[Symbol.for('jobverify.samsung-native-evidence')]
 assert.equal(evidence.globalEnumerated,true)
 assert.equal(evidence.globalRows.length,653)
 assert.equal(evidence.indiaRows.length,30)
 assert.equal(evidence.unlocatedGlobalRows.length,10)
 assert.equal(evidence.details.length,40)
 assert.equal(jobs.length,29)
 const recovered=jobs.find(job=>job.id==='R109851')
 assert.ok(recovered)
 assert.equal(recovered.location,'SSIR, Goldstone, Bangalore, India')
 assert.equal(recovered.nativeFacts.countryEvidenceField,'jobPostingInfo.jobRequisitionLocation.country')
 assert.equal(recovered.postedAt,'2026-02-17')
 assert.equal(jobs.some(job=>job.id==='R121197'),false)
 assert.equal(evidence.failures.length,9)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(evidence.cleanupAllowed,false)
})
for(const [label,change] of [
 ['employer name cannot replace typed country',info=>delete info.jobRequisitionLocation.country],
 ['posting country contradicts typed requisition',info=>info.country={descriptor:'United Kingdom',alpha2Code:'GB'}],
 ['listing and posting locations cannot be silently replaced',info=>info.location='London, United Kingdom'],
 ['malformed numeric posting location is not absence',info=>info.location=0],
 ['typed country conflicts with India country ID',info=>info.jobRequisitionLocation.country.alpha2Code='US'],
 ['foreign location contradicts typed India country',info=>info.jobRequisitionLocation.descriptor='London, United Kingdom'],
 ['embedded Canada conflicts with terminal India',info=>info.jobRequisitionLocation.descriptor='Bangalore, Canada, India'],
 ['Florida conflicts with terminal India',info=>info.jobRequisitionLocation.descriptor='Bangalore, Florida, India'],
 ['Arizona conflicts with terminal India',info=>info.jobRequisitionLocation.descriptor='Bangalore, Arizona, India'],
])test(label,async()=>{
 const jobs=await replay(record=>{
  if(record.url.endsWith('/RTL-Design-Lead-Engineer_R109851')){const payload=JSON.parse(record.body);change(payload.jobPostingInfo);record.body=JSON.stringify(payload)}
  return record
 })
 assert.equal(jobs.some(job=>job.id==='R109851'),false)
})
test('global inventory changes during detail collection reject the batch',async()=>{
 let globalPageZero=0
 await assert.rejects(replay(record=>{
  if(record.requestBody?.offset===0&&Object.keys(record.requestBody.appliedFacets).length===0&&++globalPageZero===2){const payload=JSON.parse(record.body);payload.total++;record.body=JSON.stringify(payload)}
  return record
 }),/global inventory changed/)
})
