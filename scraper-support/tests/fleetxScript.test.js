import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as fleetx from '../../scraper/fleetx/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/fleetx-native-quality.json.gz',import.meta.url))))
const timeout=url=>({ok:false,url,errorName:'TimeoutError',errorMessage:'The operation was aborted due to timeout'})
test('Fleetx preserves historical route diagnostics alongside the current native surface',()=>{
 assert.equal(fleetx.SOURCE,'fleetx');assert.equal(fleetx.COMPANY,'Fleetx')
 assert.equal(fleetx.CAREERS_URL,'https://fleetx.io/careers');assert.equal(fleetx.CURRENT_CAREERS_URL,'https://www.fleetx.ai/careers')
 assert.equal(fleetx.isVerifiedTimeoutResult(timeout(fleetx.HOMEPAGE_URL),fleetx.HOMEPAGE_URL),true)
 assert.equal(fleetx.isVerifiedTimeoutResult({ok:true,url:fleetx.HOMEPAGE_URL},fleetx.HOMEPAGE_URL),false)
 assert.equal(fleetx.hasOfficialCareersSignal(fixture.packets[0].bodyText),true)
})
test('Fleetx legacy injected timeout stops once and never returns an empty success',async()=>{
 const calls=[]
 await assert.rejects(fleetx.run({fetchPage:async url=>{calls.push(url);return timeout(url)},minIntervalMs:0}),/timeout/i)
 assert.deepEqual(calls,[fleetx.CURRENT_CAREERS_URL])
})
test('Fleetx legacy body injection retains native partial evidence for every current opening',async()=>{
 const calls=[],jobs=await fleetx.run({fetchPage:async url=>{calls.push(url);const q=fixture.packets.find(q=>q.requestedURL===url);assert.ok(q);return {ok:true,url,status:q.status,html:q.bodyText}},minIntervalMs:0})
 assert.equal(jobs.length,19);assert.equal(calls.length,6);assert.ok(jobs.every(j=>j.country===null&&j.sourceDetailComplete===false))
 assert.ok(jobs[0].sourceNativeCollectionAudit.responses.every(q=>q.httpMetadataVerified===false))
})
test('Fleetx does not probe older routes after an unexpected current page',async()=>{
 const calls=[]
 await assert.rejects(fleetx.run({fetchPage:async url=>{calls.push(url);return {ok:true,url,status:200,html:'<title>Fleetx</title><h1>Unexpected page</h1>'}},minIntervalMs:0}),/active careers identity/i)
 assert.deepEqual(calls,[fleetx.CURRENT_CAREERS_URL])
})
