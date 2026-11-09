import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import test from 'node:test'
import * as source from './script.js'
import {capturedSource,currentNativeTransport} from '../../test/helpers/replayCurrentNativeQuality.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const historical=name=>readFileSync(new URL(`../../scraper-support/tests/fixtures/${name}`,import.meta.url),'utf8')
const capture=capturedSource(source.SOURCE),sha=b=>createHash('sha256').update(b).digest('hex')
async function replay(t,mutate,options={}){
 const transport=currentNativeTransport(source.SOURCE,mutate)
 t.mock.method(globalThis,'fetch',(...args)=>transport.fetch(...args))
 return{transport,run:()=>source.run({fetchImpl:(...args)=>transport.fetch(...args),requestIntervalMs:0,...options})}
}
test('Utopus retains the official publisher and exact declared BambooHR client and JSON URLs',()=>{
 assert.equal(source.COMPANY,'Utopus Insights');assert.equal(source.SOURCE,'utopusinsights')
 assert.equal(source.CAREERS_URL,'https://www.utopusinsights.com/careers')
 assert.equal(source.OPEN_POSITIONS_URL,'https://www.utopusinsights.com/open-positions')
 assert.equal(source.BAMBOOHR_SCRIPT_URL,'https://utopusinsights.bamboohr.com/js/embed.js')
 assert.equal(source.BAMBOOHR_EMBED_URL,'https://utopusinsights.bamboohr.com/jobs/embed2.php?version=1.0.0&format=json')
})
test('historical HTML handoff and empty-message samples cannot certify the current JSON inventory',()=>{
 assert.equal(source.hasOfficialCareersSignal(historical('utopusinsights-careers.html')),true)
 assert.equal(source.hasOfficialOpenPositionsSignal(historical('utopusinsights-open-positions.html')),true)
 assert.equal(source.hasBambooHrHandoff(historical('utopusinsights-open-positions.html')),true)
 assert.equal(source.hasEmptyOpeningsSignal(historical('utopusinsights-bamboohr-embed.html')),false)
})
test('current four-response evidence retains exact original hashes, publisher handoffs and reviewed client',()=>{
 assert.equal(capture.requests.length,4)
 assert.deepEqual(capture.requests.map(p=>p.requestedURL),[source.CAREERS_URL,source.OPEN_POSITIONS_URL,source.BAMBOOHR_SCRIPT_URL,source.BAMBOOHR_EMBED_URL])
 for(const p of capture.requests){assert.equal(p.replayed,false);assert.equal(sha(p.text),p.bodySHA256)}
 assert.equal(source.hasOfficialCareersSignal(capture.requests[0].text),true)
 assert.equal(source.hasOfficialOpenPositionsSignal(capture.requests[1].text),true)
 assert.equal(sha(capture.requests[2].text),source.BAMBOOHR_CLIENT_SHA256)
 assert.equal(capture.requests[3].status,200);assert.equal(capture.requests[3].text.trim(),'')
 assert.equal(source.hasEmptyOpeningsSignal(capture.requests[3].text),false)
})
test('current blank HTTP200 JSON response fails after all four declared reads without a fake zero result',async t=>{
 const r=await replay(t)
 await assert.rejects(r.run,e=>e.abortRetries===true&&e.incompleteScope===true&&e.recruitmentObservations.sourceScopeComplete===false&&e.recruitmentObservations.failures[0].failureKind==='empty-native-json-response')
 assert.equal(r.transport.remaining,0);assert.equal(r.transport.consumed,4)
 assert.ok(r.transport.calls.every(c=>c.method==='GET'&&c.body===null))
})
test('changed widget client cannot confer authority on a new response contract',async t=>{
 const r=await replay(t,p=>{if(p.requestedURL===source.BAMBOOHR_SCRIPT_URL)p.text+='/*changed*/'})
 await assert.rejects(r.run,/client changed/i);assert.equal(r.transport.consumed,3)
})
test('initial publisher denial stops before requesting board or widget',async t=>{
 const r=await replay(t,p=>{p.status=403});await assert.rejects(r.run,/403|HTTP/i);assert.equal(r.transport.consumed,1)
})
test('zero-read output cap keeps company totals and cleanup authority unknown',async t=>{
 const r=await replay(t,undefined,{maxJobs:0}),jobs=await r.run(),evidence=readInventoryEvidence(jobs)
 assert.deepEqual(jobs,[]);assert.equal(r.transport.consumed,0);assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})
