import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentBreatheTeamtailor} from '../scraper/breathehr/currentTeamtailor.js'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'
import {isCompleteScraperAttempt} from '../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/breathehr-teamtailor-current-20261111.json.gz',import.meta.url))))
const responses=new Map()
for(const row of fixture.responses){
  const bytes=Buffer.from(row.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)
  const rows=responses.get(row.requestedURL)||[];rows.push({...row,body:bytes.toString('utf8')});responses.set(row.requestedURL,rows)
}
const provider=getScraperCatalog().find(row=>row.source==='breathehr')
const nativeTerminal=async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('Native terminal regression permits only retained publisher packets'))
  const counts=new Map()
  const jobs=await readCurrentBreatheTeamtailor({readPage:async url=>{
    const index=counts.get(url)||0,row=responses.get(url)?.[index]
    assert.ok(row,'Only the acquired native opening/closing packets may be read: '+url)
    counts.set(url,index+1)
    return{url:row.finalURL,status:row.status,html:row.body,headers:{'content-type':row.contentType,...(row.location?{location:row.location}:{})}}
  }})
  assert.equal([...counts.values()].reduce((a,b)=>a+b,0),18)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
  const terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),
    zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
  return JSON.parse(JSON.stringify(terminal))
}

test('actual finite programme cleanup hold survives complete terminal processing and JSON serialization',async t=>{
  const terminal=await nativeTerminal(t)
  assert.equal(terminal.success,true)
  assert.equal(terminal.processingComplete,true)
  assert.equal(terminal.rawRecords,5)
  assert.equal(terminal.zeroJobEvidence,'fetched-zero')
  assert.equal(terminal.inventoryEvidence.lifecycleCleanupAllowed,false)
  assert.equal(terminal.sourceObservations.sourceScopeComplete,false)
  assert.equal(isCompleteScraperAttempt(terminal),true,'A finite programme can complete while global cleanup stays forbidden')
  assert.deepEqual(inventoryCleanupOptions(terminal),{replaceExisting:false})
})

test('an otherwise complete inventory without the optional explicit hold retains its existing cleanup decision',async t=>{
  const terminal=await nativeTerminal(t)
  delete terminal.inventoryEvidence.lifecycleCleanupAllowed
  assert.equal(isCompleteScraperAttempt(terminal),true)
  assert.deepEqual(inventoryCleanupOptions(terminal),{})
})

test('an incomplete or failed attempt cannot gain cleanup authority from an affirmative optional flag',async t=>{
  const terminal=await nativeTerminal(t)
  terminal.inventoryEvidence.lifecycleCleanupAllowed=true
  for(const change of [{partial:true},{detailHealth:{complete:false}},{staleCheckSkipped:true}]){
    assert.deepEqual(inventoryCleanupOptions({...terminal,...change}),{replaceExisting:false})
  }
})
