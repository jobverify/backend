import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import * as source from './script.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'

const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz',import.meta.url))))
for(const packet of packets)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const listings=source.extractIndiaListings(packets[0].body)
const role=index=>({listing:listings[index],html:packets.find(row=>row.url===listings[index].sourceUrl).body})

test('Amicorp binds the full native title when its head formats the requisition as JD 1510',()=>{
  const job=source.extractJobDetail(role(11))
  assert.equal(job.requisitionId,'JD1510')
  assert.equal(job.sourceDetailComplete,true)
  assert.match(job.jobDescription,/Qualifications, Skills, and Experience/)
})

test('Amicorp ignores the native zero-width-space formatting in a matching role title',()=>{
  const job=source.extractJobDetail(role(17))
  assert.equal(job.requisitionId,'JD1436')
  assert.equal(job.sourceDetailComplete,true)
})

test('Amicorp returns only identity-qualified native India roles and retains all three semantic or date failures',async()=>{
  const jobs=await source.run({fetchText:async url=>{
    const packet=packets.find(row=>row.url===url);assert.ok(packet,'Only captured first-party careers URLs');return packet.body
  }})
  assert.equal(jobs.length,15)
  assert.equal(new Set(jobs.map(job=>job.sourceUrl)).size,jobs.length)
  assert.ok(jobs.every(job=>job.sourceDetailComplete===true))
  assert.ok(jobs.some(job=>job.sourceUrl==='https://amicorp.com/ami-news/careers/client-messaging-whatsapp-lead-mumbai-jd/'))
  assert.ok(jobs.some(job=>job.sourceUrl==='https://amicorp.com/ami-news/careers/client-messaging-whatsapp-lead-bangalore-jd/'))
  assert.ok(!jobs.some(job=>job.requisitionId==='JD1345'))
  const native=jobs[0].nativeCollectionEvidence
  assert.equal(native.candidateDetails,18)
  assert.equal(native.failures.length,3)
  assert.equal(native.failures.filter(row=>row.failureKind==='identity-mismatch').length,2)
  assert.equal(native.failures.find(row=>row.nativeJobId==='JD1345').failureKind,'native-publication-date-conflict')
  const health=extractionDetailHealth(jobs)
  assert.equal(health.nativeCollections[0].unextractedDetailFailures,3)
  assert.equal(health.nativeCollections[0].countsReconciled,true)
})

test('Amicorp still rejects a changed role title beyond native formatting variants',()=>{
  const input=role(11)
  input.html=input.html.replace('<title>Central Fund Accountant - BL, CT, MU, CL JD 1510 - Amicorp</title>',
    '<title>Senior Central Fund Accountant - BL, CT, MU, CL JD 1510 - Amicorp</title>')
  assert.throws(()=>source.extractJobDetail(input),/title contradiction/)
})
