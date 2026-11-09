import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREER_PAGE_URL} from './script.js'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-denied-response.json.gz',import.meta.url))))
test('captured Gojek429 retains truthful unavailable status and unknown source counts',async()=>{
 let calls=0
 await assert.rejects(run({fetchPage:async url=>{calls++;assert.equal(url,CAREER_PAGE_URL);return{status:packet.status,url:packet.finalUrl,text:packet.body}}}),error=>{
  assert.equal(error.status,429);assert.equal(error.requestUrl,CAREER_PAGE_URL)
  assert.equal(error.finalUrl,CAREER_PAGE_URL);assert.equal(error.failureKind,'incomplete_listing')
  assert.equal(error.abortRetries,true);assert.equal(error.inventoryEvidence.status,'coverage-gap')
  assert.equal(error.inventoryEvidence.reportedTotal,null);assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.equal(error.inventoryEvidence.listingComplete,false);return true
 })
 assert.equal(calls,1)
})
test('Gojek200 on an unrelated final page cannot supply native source proof',async()=>{
 await assert.rejects(run({fetchPage:async()=>({status:200,url:'https://unrelated.example/careers',text:packet.body})}),error=>{
  assert.equal(error.finalUrl,'https://unrelated.example/careers');assert.equal(error.inventoryEvidence.listingComplete,false);return true
 })
})
