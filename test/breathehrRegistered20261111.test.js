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

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/breathehr-teamtailor-current-20261111.json.gz',import.meta.url))))
const packets=new Map()
for(const row of fixture.responses){
  const body=Buffer.from(row.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'),row.bodySHA256)
  const rows=packets.get(row.requestedURL)||[];rows.push({...row,body:body.toString('utf8')});packets.set(row.requestedURL,rows)
}
const provider=getScraperCatalog().find(row=>row.source==='breathehr')
const registered=()=>buildScrapers().find(row=>row.name==='breathehr')
const replay=(change=(_,body)=>body)=>{
  const counts=new Map(),calls=[]
  return {calls,fetchImpl:async(url,init={})=>{
    assert.equal(init.method||'GET','GET')
    const count=(counts.get(url)||0)+1,rows=packets.get(url)
    assert.ok(rows&&count<=rows.length,'Only the actual finite current public transaction may be replayed: '+url)
    counts.set(url,count);calls.push({url,cache:init.cache})
    const row=rows[count-1]
    const headers={'content-type':row.contentType,...(row.location?{location:row.location}:{})}
    const response=new Response(change(url,row.body,count),{status:row.status,headers})
    Object.defineProperty(response,'url',{value:row.finalURL});return response
  }}
}

test('actual registered BreatheHR programme produces qualified India-zero with five real foreign observations',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No uncontrolled public requests'))
  const r=replay(),jobs=await registered().run({fetchImpl:r.fetchImpl,requestIntervalMs:0})
  assert.equal(jobs.length,0)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.status,'complete-inventory')
  assert.equal(inventory.firstParty,true)
  assert.equal(inventory.listingComplete,true)
  assert.equal(inventory.reportedTotal,5)
  assert.equal(inventory.indiaFacetCount,0)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.equal(readSourceObservationEvidence(jobs,'breathehr').observedRecordCount,5)
  const result=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),
    zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
  assert.equal(result.success,true)
  assert.equal(result.processingComplete,true)
  assert.equal(result.jobs,0)
  assert.equal(result.rawRecords,5)
  assert.ok(['fetched-zero','verified-zero','verified-empty'].includes(result.zeroJobEvidence))
  assert.deepEqual(inventoryCleanupOptions(result),{replaceExisting:false})
  assert.equal(r.calls.length,18)
  assert.ok(r.calls.every(row=>row.cache==='no-store'))
})

test('registered zero evidence retains the current programme and exact parent employer without global aliasing',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No uncontrolled public requests'))
  const jobs=await registered().run({fetchImpl:replay().fetchImpl,requestIntervalMs:0})
  const audit=jobs.nativeCollectionEvidence
  assert.equal(audit.currentDeclaredSourceProgramComplete,true)
  assert.equal(audit.companyGlobalScopeQualified,false)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.equal(audit.applicationVisited,false)
  assert.equal(audit.screeningCriteriaAcquired,false)
  assert.equal(audit.roles.length,5)
  assert.ok(JSON.stringify(audit.roles).includes('ELMOgroup'))
  assert.ok(JSON.stringify(audit.roles).includes('Breathe HR'))
})

test('an actual registered role changing native country cannot become a programme-zero proof',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No uncontrolled public requests'))
  let changed=false
  const r=replay((url,body)=>{
    if(!url.includes('/8494958-'))return body
    const next=body.replace(/("addressCountry"\s*:\s*)"GB"/g,'$1"IN"')
    assert.notEqual(next,body,'Change the actual acquired native country field')
    changed=true;return next
  })
  await assert.rejects(registered().run({fetchImpl:r.fetchImpl,requestIntervalMs:0}),error=>error.softFailure===true&&error.failureKind==='coverage_gap')
  assert.equal(changed,true)
})

test('a pre-aborted registered BreatheHR run performs no public request',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No uncontrolled public requests'))
  const r=replay(),controller=new AbortController();controller.abort(new DOMException('Offline abort control','AbortError'))
  await assert.rejects(registered().run({fetchImpl:r.fetchImpl,signal:controller.signal,requestIntervalMs:0}),error=>error.name==='AbortError')
  assert.equal(r.calls.length,0)
})
