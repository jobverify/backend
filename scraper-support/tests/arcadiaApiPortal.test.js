import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {buildScrapers} from '../providers/index.js'
import {readInventoryEvidence, sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../utils/extractionDetailHealth.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/arcadia-current-controller-20261112.json.gz',import.meta.url))))
const run=async(t, mutate)=>{
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Only retained public Arcadia responses may be used')})
  const source=buildScrapers().find(scraper=>scraper.name==='arcadia')
  assert.equal(source?.provider.adapter,'script','The registered Arcadia route must recover native role descriptions')
  const counts=new Map()
  return source.run({transport:async url=>{
    const index=counts.get(url)||0
    counts.set(url,index+1)
    const candidates=fixture.responses.filter(row=>row.url===url)
    assert.ok(candidates.length,'Uncaptured Arcadia public resource: '+url)
    const row=candidates[Math.min(index,candidates.length-1)]
    const response={url,status:row.status,headers:{'content-type':row.contentType},bodyComplete:true,
      body:Buffer.from(row.body),requestedAt:row.startedAt,completedAt:row.completedAt}
    mutate?.(response,url)
    return response
  }})
}

test('registered Arcadia returns all13 India native descriptions and reconciles22 publisher rows',async t=>{
  const jobs=await run(t)
  assert.equal(jobs.length,13)
  assert.equal(new Set(jobs.map(job=>job.jobId)).size,13)
  assert.ok(jobs.every(job=>job.source==='arcadia'&&job.country==='India'&&job.jobDescription?.length>800))
  assert.equal(readInventoryEvidence(jobs).reportedTotal,22)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,13)
  assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
  assert.equal(extractionDetailHealth(jobs).complete,true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),false)
})

test('registered Arcadia preserves partial scope when a foreign native worksite loses country proof',async t=>{
  const jobs=await run(t,(response,url)=>{
    if(url!=='https://www.arcadia.com/api/rippling-jobs')return
    const payload=JSON.parse(response.body)
    payload.items.find(row=>row.locations.every(location=>location.countryCode!=='IN')).locations[0].countryCode='ZZ'
    response.body=Buffer.from(JSON.stringify(payload))
  })
  assert.equal(jobs.length,13)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
