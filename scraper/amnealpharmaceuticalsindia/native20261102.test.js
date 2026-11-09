import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import * as source from './script.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz',import.meta.url))))
for(const packet of packets)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const response=url=>{const packet=packets.find(row=>row.url===url);assert.ok(packet,'Only captured employer and Oracle surfaces');return packet.body}

test('Amneal recovers every qualified native role while retaining four missing full descriptions as detail failures',async()=>{
  const jobs=await source.run({fetchText:async url=>response(url),fetchJson:async url=>JSON.parse(response(url)),now:()=> '2026-11-02T17:00:00.000Z'})
  assert.equal(jobs.length,92)
  assert.ok(jobs.every(job=>job.jobDescription.length>=150))
  assert.ok(!jobs.some(job=>['5502','7502','7504','8735'].includes(job.jobId)))
  const native=jobs[0].nativeCollectionEvidence
  assert.equal(native.candidateDetails,96)
  assert.equal(native.extractedDetailJobs,92)
  assert.deepEqual(native.failures.map(row=>row.nativeJobId).sort(),['5502','7502','7504','8735'])
  const health=extractionDetailHealth(jobs)
  assert.equal(health.complete,false)
  assert.equal(health.nativeCollections[0].countsReconciled,true)
  assert.equal(health.nativeCollections[0].unextractedDetailFailures,4)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.listingComplete,true)
  assert.equal(inventory.reportedTotal,96)
  assert.equal(native.closingInventoryMatches,true)
})

test('Amneal only isolates a missing native description after validating its exact listed identity',async()=>{
  const first=source.extractSearchResults(JSON.parse(response(source.buildSearchUrl())))[0]
  const raw=JSON.parse(response(source.buildJobDetailApiUrl(first.jobId)))
  raw.items[0].Id='another-role'
  await assert.rejects(source.run({maxJobs:1,fetchText:async url=>response(url),fetchJson:async url=>url===source.buildJobDetailApiUrl(first.jobId)?raw:JSON.parse(response(url))}),/identity or primary workplace/)
})
