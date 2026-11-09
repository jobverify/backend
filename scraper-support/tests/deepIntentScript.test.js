import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import * as source from '../../scraper/deepintent/script.js'
import { getScraperCatalog,createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/deepintent/test-data/current-public-20261031.json.gz',import.meta.url))))
for(const packet of packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.bodySha256)
const api=packets.find(packet=>packet.url.startsWith('https://boards-api.greenhouse.io/'))
const payload=JSON.parse(api.body)
const indiaIds=['5472780004','5764065004','5636891004','5688687004','6204899004','5987259004']
const provider=()=>getScraperCatalog().find(item=>item.source==='deepintent')

test('DeepIntent resolves the registered Greenhouse implementation and exact board identity',()=>{
  assert.equal(source.SOURCE,'deepintent')
  assert.equal(source.COMPANY,'DeepIntent')
  assert.equal(source.CAREERS_URL,'https://deepintent.com/careers')
  assert.equal(source.PROVIDER_METADATA.atsPlatform,'greenhouse')
  assert.equal(source.PROVIDER_METADATA.boardToken,'deepintent')
  assert.equal(provider().atsPlatform,'greenhouse')
  assert.equal(provider().companyDomain,'deepintent.com')
  assert.ok(provider().bindingEvidence.matchedLinks.includes('https://boards.greenhouse.io/embed/job_board/js?for=deepintent'))
})

test('the actual default registered transport retains six native India roles and exact employer descriptions',async t=>{
  const reads=[]
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(String(url),api.url)
    assert.ok(init.signal)
    reads.push(String(url))
    return new Response(api.body,{status:api.status,headers:{'content-type':api.contentType}})
  })
  const jobs=await createCatalogScraper(provider()).run({signal:new AbortController().signal})
  assert.deepEqual(reads,[api.url])
  assert.equal(payload.jobs.length,14)
  assert.deepEqual(jobs.map(job=>String(job.jobId)).sort(),[...indiaIds].sort())
  for(const job of jobs){
    const native=payload.jobs.find(row=>String(row.id)===String(job.jobId))
    assert.equal(job.jobId,native.id)
    assert.equal(job.source,'deepintent')
    assert.equal(job.company,'DeepIntent')
    assert.equal(job.country,'India')
    assert.equal(job.applyUrl,native.absolute_url)
    assert.equal(job.nativeDescriptionRaw,native.content)
    assert.equal(job.nativeSourceRecord.id,native.id)
    assert.ok(job.jobDescription.length>100)
  }
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.surface,api.url)
  assert.equal(evidence.reportedTotal,14)
  // Native API evidence describes this checked board, not every employer channel.
  assert.equal(Object.hasOwn(evidence,'companyGlobalTotal'),false)
})

test('native Greenhouse account and posting identity contradictions fail closed',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw Error('No unmocked HTTP allowed')})
  for(const url of [
    'https://job-boards.greenhouse.io/othercompany/jobs/5472780004',
    'https://job-boards.greenhouse.io/deepintent/jobs/1',
  ]){
    const changed=structuredClone(payload)
    changed.jobs.find(row=>row.id===5472780004).absolute_url=url
    await assert.rejects(source.run({fetchJson:async requested=>{assert.equal(requested,api.url);return changed}}),/foreign native posting account|native posting identity mismatch/)
  }
})

test('failed, malformed, incomplete and repeated native inventories never become empty success',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw Error('No unmocked HTTP allowed')})
  for(const changed of [
    {error:'controlled upstream error',jobs:[]},
    {jobs:null},
    {...structuredClone(payload),hasMore:true},
    {jobs:[payload.jobs[0],payload.jobs[0]],meta:{total:2}},
  ]) await assert.rejects(source.run({fetchJson:async requested=>{assert.equal(requested,api.url);return changed}}),/Failed greenhouse inventory|Invalid greenhouse inventory|Incomplete greenhouse inventory/)
})

test('pre-aborted and native-boundary caller cancellation preserve the exact reason',async t=>{
  const first=new AbortController(), reason=Object.freeze(Error('DeepIntent caller cancellation'))
  let reads=0
  t.mock.method(globalThis,'fetch',async()=>{reads++;throw Error('No pre-aborted read allowed')})
  first.abort(reason)
  await assert.rejects(createCatalogScraper(provider()).run({signal:first.signal}),error=>error===reason)
  assert.equal(reads,0)
  const second=new AbortController()
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    reads++
    assert.equal(String(url),api.url)
    second.abort(reason)
    assert.equal(init.signal.aborted,true)
    return new Response(api.body,{status:api.status,headers:{'content-type':api.contentType}})
  })
  await assert.rejects(createCatalogScraper(provider()).run({signal:second.signal}),error=>error===reason)
  assert.equal(reads,1)
})
