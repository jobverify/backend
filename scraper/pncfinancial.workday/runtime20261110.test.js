import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {remainingRecruitmentBatchProvider} from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import {RECRUITMENT_OBSERVATIONS} from '../../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import catalog from './catalog.js'
import {run,CAREERS_URL} from './script.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/runtime20261110.json.gz',import.meta.url))))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')

test('PNC registration uses its actual corporate and native career surfaces with unknown totals',()=>{
  const provider=remainingRecruitmentBatchProvider('pncfinancial')
  assert.equal(provider.companyDomain,'pnc.com')
  assert.equal(provider.companyCareerPage,'https://careers.pnc.com/global/en')
  assert.equal(provider.officialHomepageUrl,'https://www.pnc.com/en/about-pnc.html?lnksrc=topnav')
  assert.deepEqual(provider.publisherNames,['PNC'])
  assert.equal(CAREERS_URL,provider.companyCareerPage)
  for(const row of [provider,catalog]){
    assert.equal(row.source,'pncfinancial')
    assert.equal(row.companyName,'PNC Financial')
    assert.equal(row.verifiedPublicJobCount,null)
    assert.equal(row.verifiedIndiaJobCount,null)
    assert.equal(row.sourceScopeComplete,false)
    assert.equal(row.lifecycleCleanupAllowed,false)
    assert.doesNotMatch(JSON.stringify(row),/opennash|workbook-exact-name-sentinel|return-empty-until/)
  }
})

test('current capture preserves original public response hashes and before-edit provenance',()=>{
  assert.equal(fixture.mode,'temporary-config-experiment-no-backend-edits')
  assert.equal(fixture.productionWrites,false)
  assert.equal(fixture.configBefore.companyDomain,'jobs.opennash.com')
  assert.equal(fixture.packets.length,12)
  for(const packet of fixture.packets){
    assert.equal(packet.bodyComplete,true)
    assert.equal(packet.status,200)
    const bytes=Buffer.from(packet.bodyBase64,'base64')
    assert.equal(bytes.length,packet.bodyBytes)
    assert.equal(sha(bytes),packet.bodySHA256)
    assert.ok(Date.parse(packet.completedAt)>=Date.parse(packet.requestedAt))
  }
})

test('registered PNC replay retains native observations without turning Indiana search hits into India',async()=>{
  const queues=new Map(),used=[]
  const key=(url,method,body)=>JSON.stringify([url,method,body??null])
  for(const packet of fixture.packets){
    const k=key(packet.requestedURL,packet.method,packet.requestBody)
    if(!queues.has(k))queues.set(k,[])
    queues.get(k).push(packet)
  }
  const jobs=await run({maxRequests:32,maxPages:6,maxDetails:3,sourceTimeoutMs:60000,now:()=>fixture.startedAt,
    fetchImpl:async(url,init)=>{
      const packet=queues.get(key(url,init.method||'GET',init.body))?.shift()
      assert.ok(packet,'Uncaptured request refused: '+url)
      used.push(packet)
      const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers})
      Object.defineProperty(response,'url',{value:packet.finalURL})
      return response
    }})
  assert.equal(used.length,12)
  assert.equal([...queues.values()].reduce((n,q)=>n+q.length,0),0)
  assert.equal(jobs.length,0)
  const observed=jobs[RECRUITMENT_OBSERVATIONS]
  assert.equal(observed.nativeRecords,fixture.result.observations.nativeRecords)
  assert.equal(observed.nativeRecords,103)
  assert.equal(observed.failures.length,0)
  assert.ok(observed.corporateIdentityEvidence.length>0)
  assert.ok(!observed.unresolved.includes('current-corporate-publisher-identity-unqualified'))
  assert.ok(observed.unresolved.includes('native-additional-location-scope-unresolved'))
  assert.equal(observed.sourceScopeComplete,false)
  assert.equal(observed.lifecycleCleanupAllowed,false)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.listingComplete,false)
  assert.equal(inventory.reportedTotal,null)
})
