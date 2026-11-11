import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/decimalai-current-programme-20261111.json.gz',import.meta.url))))
const packets=new Map()
for(const row of fixture.responses){
  const bytes=Buffer.from(row.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)
  const rows=packets.get(row.requestedURL)||[];rows.push({...row,body:bytes.toString('utf8')});packets.set(row.requestedURL,rows)
}
const provider=getScraperCatalog().find(row=>row.source==='decimalai')
const registered=()=>buildScrapers().find(row=>row.name==='decimalai')
const replay=(change=(_,body)=>body)=>{
  const counts=new Map(),calls=[]
  return{calls,fetchImpl:async(url,init={})=>{
    assert.equal(init.method||'GET','GET')
    const count=(counts.get(url)||0)+1,row=packets.get(url)?.[count-1]
    assert.ok(row,'Only original current corporate/listing/own-role packets may be replayed: '+url)
    counts.set(url,count);calls.push({url,cache:init.cache})
    const response=new Response(change(url,row.body,count),{status:row.status,headers:{'content-type':row.contentType}})
    Object.defineProperty(response,'url',{value:row.finalURL});return response
  }}
}
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Fixture replay must not make uncontrolled public reads'))

test('registered Decimal AI completes its current three-US-role programme with qualified India-zero and cleanup forbidden',async t=>{
  forbidNetwork(t)
  const r=replay(),jobs=await registered().run({fetchImpl:r.fetchImpl,requestIntervalMs:0})
  assert.equal(jobs.length,0)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.status,'complete-inventory')
  assert.equal(inventory.firstParty,true)
  assert.equal(inventory.listingComplete,true)
  assert.equal(inventory.reportedTotal,3)
  assert.equal(inventory.indiaFacetCount,0)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.equal(readSourceObservationEvidence(jobs,'decimalai').observedRecordCount,3)
  const terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),
    zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
  assert.equal(terminal.success,true)
  assert.equal(terminal.processingComplete,true)
  assert.equal(terminal.jobs,0)
  assert.equal(terminal.rawRecords,3)
  assert.equal(terminal.zeroJobEvidence,'fetched-zero')
  assert.deepEqual(inventoryCleanupOptions(JSON.parse(JSON.stringify(terminal))),{replaceExisting:false})
  assert.equal(r.calls.length,10)
  assert.ok(r.calls.every(row=>row.cache==='no-store'))
})

test('registered Decimal evidence keeps full own requirements separate from introductory schemas and native legal-name self-declarations',async t=>{
  forbidNetwork(t)
  const jobs=await registered().run({fetchImpl:replay().fetchImpl,requestIntervalMs:0})
  const audit=jobs.nativeCollectionEvidence
  assert.equal(audit.currentDeclaredSourceProgramComplete,true)
  assert.equal(audit.companyGlobalScopeQualified,false)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.equal(audit.publisherLegalNameRegistryVerified,false)
  assert.equal(audit.publisherOrganization.legalName,'Decimal AI')
  assert.equal(audit.applicationVisited,false)
  assert.equal(audit.screeningCriteriaAcquired,false)
  assert.equal(audit.roles.length,3)
  for(const role of audit.roles){
    assert.equal(role.country,'United States')
    assert.equal(role.schemaDescriptionIsIntroOnly,true)
    assert.equal(role.schemaFullDescriptionMatch,false)
    assert.ok(role.publishedRequirements.length>0)
    assert.ok(role.fullPublishedRoleText.includes(role.publishedRequirements[0]))
    assert.ok(!role.nativeSchemaDescription.includes(role.publishedRequirements[0]))
    assert.equal(role.originalOwnRoleHTML,packets.get(role.url)[0].body)
    assert.equal(role.nativeDatePosted,'2026-07-28')
    assert.equal(role.firstEverPostedAt,null)
    assert.equal(role.applicationDeadline,null)
    assert.equal(role.remoteStatus,null)
  }
})

test('an actual own role changing its explicit country to India cannot become registered programme-zero evidence',async t=>{
  forbidNetwork(t)
  let changed=false
  const r=replay((url,body)=>{
    if(url!==fixture.expected.roleURLs[0])return body
    const next=body.replace(/("addressCountry"\s*:\s*)"US"/g,'$1"IN"')
    assert.notEqual(next,body,'Change the acquired native own-role country field')
    changed=true;return next
  })
  await assert.rejects(registered().run({fetchImpl:r.fetchImpl,requestIntervalMs:0}),error=>error.softFailure===true&&error.failureKind==='coverage_gap')
  assert.equal(changed,true)
})

test('a pre-aborted registered Decimal source performs no public request',async t=>{
  forbidNetwork(t)
  const r=replay(),controller=new AbortController();controller.abort(new DOMException('Retained fixture abort control','AbortError'))
  await assert.rejects(registered().run({fetchImpl:r.fetchImpl,requestIntervalMs:0,signal:controller.signal}),error=>error.name==='AbortError')
  assert.equal(r.calls.length,0)
})
