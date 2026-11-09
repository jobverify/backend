import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,FIRST_PARTY_ROOT_URL} from './script.js'
import {withRetry} from '../../scraper-support/utils/retry.js'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-denied-response.json.gz',import.meta.url))))
test('captured Jungleworks403 aborts futile outer retries with unknown inventory and cancels the unread denial',async()=>{
 let calls=0,cancelled=0
 await assert.rejects(withRetry(()=>run({fetchImpl:async url=>{calls++;assert.equal(url,FIRST_PARTY_ROOT_URL);return{status:packet.status,url:packet.finalUrl,body:{cancel(){cancelled++}},text(){assert.fail('Denied inventory must not be parsed')}}}}),{attempts:3,baseDelayMs:0,label:'jungleworks-native-denied'}),error=>{
  const cause=error.cause
  assert.equal(cause.status,403);assert.equal(cause.requestUrl,FIRST_PARTY_ROOT_URL)
  assert.equal(cause.code,'access_denied');assert.equal(cause.failureKind,'incomplete_listing');assert.equal(error.abortRetries,true)
  assert.equal(cause.inventoryEvidence.status,'coverage-gap');assert.equal(cause.inventoryEvidence.listingComplete,false)
  assert.equal(cause.inventoryEvidence.reportedTotal,null);assert.equal(cause.inventoryEvidence.indiaFacetCount,null);return true
 })
 assert.equal(calls,1);assert.equal(cancelled,1)
})
