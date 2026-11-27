import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,readBostonScientificDiagnostics} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261117.json.gz',import.meta.url))))
const body=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
function replay(change=(_u,p)=>p,{actualClosing=false}={}){
 const reads=[],counts=new Map()
 const fetchText=async url=>{const index=counts.get(url)??0;counts.set(url,index+1);reads.push(url);const opening=fixture.responses.filter(p=>p.requestedURL===url),p=actualClosing&&index>0?fixture.closingResponses.find(p=>p.requestedURL===url):opening[Math.min(index,opening.length-1)];assert.ok(p,'Uncaptured native query '+url);assert.equal(p.status,200);assert.equal(p.finalURL,url);return body(p)}
 return{reads,now:()=> '2026-11-16T21:25:00.000Z',fetchText,fetchJson:async url=>change(url,JSON.parse(await fetchText(url)))}
}
test('current source originals retain every complete native HTTP entity and exact issued query',()=>{
 assert.equal(fixture.responses.length,57)
 assert.equal(fixture.closingResponses.length,54)
 for(const p of [...fixture.responses,...fixture.closingResponses]){assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.bodySHA256);assert.equal(p.method,'GET');assert.equal(p.requestBody,null)}
})
test('current510row native acquisition keeps contradictory India geography quarantined and cannot report empty inventory',async()=>{
 const io=replay(),jobs=await run(io),diagnostics=readBostonScientificDiagnostics(jobs),evidence=readInventoryEvidence(jobs)
 assert.equal(io.reads.length,108);assert.equal(diagnostics.uniqueGlobalIdentities,510);assert.equal(diagnostics.reportedGlobalTotal,510)
 assert.equal(jobs.length,0);assert.equal(diagnostics.quarantinedFacetRoles.length,1)
 const held=diagnostics.quarantinedFacetRoles[0]
 assert.equal(held.id,563602813924834);assert.deepEqual(held.nativeRecord.locations,['Ahmedabad, India | India-Maharashtra, Pune']);assert.deepEqual(held.nativeRecord.standardizedLocations,['Pune, MH, IN'])
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.indiaFacetCount,1);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const provider=getScraperCatalog().find(p=>p.source==='bostonscientific'),assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(assessment.runnerOutcome.rawRecords,510);assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})
test('actual native total drift still stops acquisition instead of accepting an invented or stale total',async()=>{
 const io=replay((url,p)=>{if(new URL(url).searchParams.get('start')==='10')p.data.count--;return p})
 await assert.rejects(run(io),/Native total drift/);assert.equal(io.reads.length,8)
})
test('real paired original middle-page worksite-model drift cannot pass by retaining the same total and all IDs',async()=>{
 const url='https://bostonscientific.eightfold.ai/api/pcsx/search?domain=bostonscientific.com&query=&location=&start=120&limit=10'
 const opening=JSON.parse(body(fixture.responses.find(p=>p.requestedURL===url))).data,closing=JSON.parse(body(fixture.closingResponses.find(p=>p.requestedURL===url))).data
 assert.equal(opening.count,closing.count);assert.deepEqual(opening.positions.map(p=>p.id),closing.positions.map(p=>p.id))
 assert.equal(opening.positions[3].workLocationOption,'onsite');assert.equal(closing.positions[3].workLocationOption,'hybrid')
 const io=replay(undefined,{actualClosing:true});await assert.rejects(run(io),/Closing complete native page\/model drift/)
 assert.ok(io.reads.filter(u=>u===url).length===2)
})
test('opaque caller cancellation during complete global closing wins without further reads',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'stop-during-global-closing'})
 const io=replay((url,p)=>{if(new URL(url).searchParams.get('start')==='120'&&io.reads.filter(u=>u===url).length===2)controller.abort(reason);return p})
 await assert.rejects(run({...io,signal:controller.signal}),error=>error===reason)
 assert.equal(io.reads.length,69)
})
