import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createSnowplowScraper} from './script.js'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-corporate-response.json.gz',import.meta.url))))
test('changed current Snowplow program retains its native packet and unknown inventory without repeated attempts',async()=>{
 let calls=0
 await assert.rejects(createSnowplowScraper({fetchPage:async url=>{calls++;assert.equal(url,packet.url);return{status:packet.status,url:packet.finalUrl,contentType:packet.contentType,body:packet.body}}}).run(),error=>{
  assert.equal(error.code,'SNOWPLOW_NATIVE_INCOMPLETE');assert.equal(error.cause.code,'SNOWPLOW_NATIVE_UNREVIEWED');assert.equal(error.abortRetries,true)
  assert.equal(error.failureKind,'incomplete_listing');assert.equal(error.inventoryEvidence.status,'coverage-gap')
  assert.equal(error.inventoryEvidence.reportedTotal,null);assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.equal(error.inventoryEvidence.listingComplete,false);assert.equal(error.retainedNativeResponses.length,1)
  assert.equal(error.retainedNativeResponses[0].response.body,packet.body);return true
 })
 assert.equal(calls,1)
})
