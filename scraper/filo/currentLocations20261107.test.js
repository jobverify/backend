import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_URL,extractPublicRoles,extractCurrentRoleDetails} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const corporate=capture.packets.find(row=>row.requestUrl===CAREERS_URL).body
const listings=extractPublicRoles(corporate)
const page=url=>capture.packets.find(row=>row.requestUrl===url).body
test('Filo retains current proven India roles while withholding unqualified worksite labels with an explicit gap',async()=>{
 const jobs=await run({fetchText:async url=>page(url)})
 assert.equal(jobs.length,19)
 for(const [id,location] of [['58','Punjab/Haryana'],['57','Kerala'],['55','Bihar']]){
  const job=jobs.find(job=>job.jobId===id);assert.ok(job)
  assert.equal(job.country,'India');assert.equal(job.location,location);assert.equal(job.city,null)
 }
 assert.ok(!jobs.some(job=>['63','60','59','56','52'].includes(job.jobId)))
 assert.ok(jobs.every(job=>job.jobDescription.length>500))
 const proof=readInventoryEvidence(jobs)
 assert.equal(proof.listingComplete,false)
 assert.equal(proof.status,'coverage-gap')
 assert.match(proof.reason,/63,60,59,56,52/)
})
test('Filo still rejects a mismatched native role and never infers India from Remote or Hybrid',()=>{
 for(const id of [59,56]){
  const listing=listings.find(row=>row.id===id)
  assert.throws(()=>extractCurrentRoleDetails(page(listing.detailUrl),listing),/unverified India location/)
 }
 const listing=listings.find(row=>row.id===58)
 assert.throws(()=>extractCurrentRoleDetails(page(listing.detailUrl),{...listing,id:9999}),/detail changed/)
})
