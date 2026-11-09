import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const directory=new URL('./test-data/ats-quality-20261107/',import.meta.url)
const baseline=JSON.parse(fs.readFileSync(new URL('baseline.json',directory)))
const hash=value=>createHash('sha256').update(value).digest('hex')
async function replay(source,extra={}){
 const raw=fs.readFileSync(new URL(source+'.json.gz',directory))
 assert.equal(hash(raw),baseline[source].packetSha256)
 const packets=JSON.parse(gunzipSync(raw)),queues=new Map(),requests=[]
 for(const packet of packets){assert.equal(hash(packet.body),packet.sha256);const queue=queues.get(packet.requestUrl)||[];queue.push(packet);queues.set(packet.requestUrl,queue)}
 const read=url=>{requests.push(url);const packet=queues.get(url)?.shift();assert.ok(packet,'Unexpected native request '+url);return packet.body}
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source===source)).run({now:()=> '2026-11-07T05:55:00.000Z',
  fetchText:async url=>read(url),fetchJson:async url=>JSON.parse(read(url)),...extra})
 return{jobs,requests,packets}
}
for(const[source,qualified]of [['livspace',82],['rocketindia',22]]){
 test('registered '+source+' retains native identities and full criteria while marking every captured unsupported detail incomplete',async()=>{
  const{jobs,requests,packets}=await replay(source),before=baseline[source]
  assert.equal(jobs.length,before.rawJobs,'Retained native observations are distinct from qualified detail output')
  assert.equal(requests.length,packets.length)
  assert.equal(jobs.filter(job=>job.sourceDetailComplete===true).length,qualified)
  assert.equal(new Set(jobs.map(job=>job.jobId)).size,before.rawJobs)
  for(const expected of before.roles){
   const job=jobs.find(job=>job.jobId===expected.jobId);assert.ok(job)
   assert.equal(job.title,expected.title);assert.equal(job.country,expected.country);assert.equal(job.sourceUrl,expected.sourceUrl)
   if(before.heldIds.includes(job.jobId)){
    assert.equal(job.sourceDetailComplete,false,job.jobId)
    assert.equal(job.sourceDescriptionMissing,true,job.jobId)
    assert.equal(job.jobDescription,null,job.jobId)
    assert.equal(job.sourceDetailFailureKind,'missing-content')
   }else assert.equal(hash(job.jobDescription),expected.descriptionSha256,job.jobId)
   assert.equal(job.sourceListingComplete,false)
   assert.equal(job.lifecycleCleanupAllowed,false)
  }
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
  assert.match(evidence.reason,/criteria/)
 })
}

test('a Rocket detail budget with no verified details stays an explicitly unqualified observation set',async()=>{
 const{jobs}=await replay('rocketindia',{detailEnrichmentBudgetMs:0})
 assert.equal(jobs.length,25)
 assert.equal(jobs.filter(job=>job.sourceDetailComplete===true).length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(job=>job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.sourceDetailFailureKind==='budget-exhausted'))
})
