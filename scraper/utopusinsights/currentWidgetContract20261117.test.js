import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run,hasEmptyOpeningsSignal,BAMBOOHR_SCRIPT_URL,BAMBOOHR_EMBED_URL,BAMBOOHR_CLIENT_SHA256} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),first=capture.originals.slice(0,4)
const body=p=>Buffer.from(p.bodyBase64,'base64'),client=body(first.find(p=>p.requestedURL===BAMBOOHR_SCRIPT_URL)).toString('utf8')
test('Utopus current reviewed original client explicitly declares positions arrays and the exact JSON GET',()=>{
 assert.equal(createHash('sha256').update(client).digest('hex'),BAMBOOHR_CLIENT_SHA256)
 assert.ok(client.includes('department.positions.forEach'))
 assert.ok(client.includes("'/jobs/embed2.php?version=' + encodeURIComponent(version) + '&format=json'"))
 const native=first.find(p=>p.requestedURL===BAMBOOHR_EMBED_URL)
 assert.equal(native.status,200);assert.equal(body(native).length,0);assert.equal(hasEmptyOpeningsSignal(''),false)
})
test('Utopus native empty observation predicate follows positions from the actual client without accepting a competing jobs model',()=>{
 // Deliberate contract-shape counterexamples, never asserted current jobs.
 assert.equal(hasEmptyOpeningsSignal(JSON.stringify({departments:[{positions:[]}],labels:{}})),true)
 assert.equal(hasEmptyOpeningsSignal(JSON.stringify({departments:[{jobs:[]}],labels:{}})),false)
 assert.equal(hasEmptyOpeningsSignal(JSON.stringify({departments:[{positions:[{name:'synthetic contract counterexample'}],jobs:[]}],labels:{}})),false)
})
test('Utopus registered current four original reads preserve blank widget hold without a fake zero inventory',async t=>{
 const calls=[],fetchImpl=async(url,init)=>{const p=first.find(p=>p.requestedURL===String(url));assert.ok(p);calls.push(String(url));assert.equal(init.method,'GET');return Object.defineProperty(new Response(body(p),{status:p.status,headers:p.headers}),'url',{value:p.finalURL})}
 t.mock.method(globalThis,'fetch',()=>assert.fail('No uncaptured Utopus network'))
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source==='utopusinsights')).run({fetchImpl,requestIntervalMs:0}),error=>{
  assert.equal(error.abortRetries,true);assert.equal(error.recruitmentObservations.failures[0].failureKind,'empty-native-json-response');assert.equal(error.sourceScopeComplete,false);assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.softFailure,true);assert.equal(error.failureKind,'source_inventory_unavailable')
  const receipt=error.recruitmentObservations.nativeInventoryReads[0]
  assert.equal(receipt.httpStatus,200);assert.equal(receipt.bodyBytes,0);assert.equal(receipt.bodySHA256,createHash('sha256').update('').digest('hex'));return true
 })
 assert.deepEqual(calls,first.map(p=>p.requestedURL))
})
test('Utopus zero-read cap retains explicit cleanup prohibition and unknown inventory totals',async()=>{
 const jobs=await run({maxJobs:0}),evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
