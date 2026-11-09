import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {inspectNativeInventory,sha256} from './nativeContract.js'
import {run} from './script.js'

const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz',import.meta.url))))
for(const packet of packets) assert.equal(sha256(packet.body),packet.sha256)
const now='2026-11-02T16:53:00.000Z'

test('current typed OccupationalExperienceRequirements bind all six native roles to their visible years',async()=>{
  let index=0
  const jobs=await run({now,requestIntervalMs:0,fetchPage:async()=>{
    const packet=packets[index++]
    return {status:packet.status,url:packet.finalUrl,text:async()=>packet.body}
  }})
  assert.equal(jobs.length,4)
  assert.equal(jobs.nativeInventoryEvidence.records.length,6)
  assert.equal(jobs.nativeInventoryEvidence.closingReconciled,true)
  assert.deepEqual(jobs.map(job=>job.experienceRequired),['6+ Years','3+ Years','4+ Years','3+ Years'])
  assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.sourceListingComplete===false))
  assert.equal(jobs[0].nativeStructuredRecord.experienceRequirements.monthsOfExperience,72)
})

for(const [label,replacement] of [
  ['contradictory months','"monthsOfExperience":84'],
  ['unrecognized type','"monthsOfExperience":72,"@type":"Thing"'],
  ['non-numeric months','"monthsOfExperience":"72"'],
]) test('current experience model rejects '+label,()=>{
  const html=packets[0].body.replace('"monthsOfExperience":72',replacement)
  assert.notEqual(html,packets[0].body)
  assert.throws(()=>inspectNativeInventory(html,{now}),/matching structured record/)
})
