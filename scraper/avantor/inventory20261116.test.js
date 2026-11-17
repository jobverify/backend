import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/inventory-20261116.json.gz',import.meta.url))))

test('Avantor November16 original complete India listing and39own native details retain their inventory proof',async()=>{
 const pending=new Map()
 for(const packet of capture.responses){
  assert.equal(packet.status,200)
  assert.equal(packet.requestedURL,packet.finalURL)
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  const queue=pending.get(packet.requestedURL)||[]
  queue.push(bytes.toString('utf8'))
  pending.set(packet.requestedURL,queue)
 }
 let reads=0
 const jobs=await run({fetchText:async url=>{
  const queue=pending.get(url)
  assert.ok(queue?.length,'Only original employer-declared requests: '+url)
  reads+=1
  return queue.shift()
 }})
 assert.equal(reads,47)
 assert.ok([...pending.values()].every(queue=>queue.length===0))
 assert.equal(jobs.length,39)
 assert.equal(new Set(jobs.map(job=>job.jobId)).size,39)
 assert.ok(jobs.every(job=>job.country==='India'&&job.company==='Avantor'&&job.jobDescription.length>200))
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'complete-inventory')
 assert.equal(evidence.listingComplete,true)
 assert.equal(evidence.reportedTotal,39)
 assert.equal(evidence.indiaFacetCount,39)
 assert.equal(evidence.pagesFetched,8)
})
