import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCurrentSnowplowScraper} from './currentNative.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-corporate-response.json.gz',import.meta.url))))

test('Snowplow readable unreviewed public HTML reports an incomplete upstream listing with its original evidence',async()=>{
 let calls=0
 await assert.rejects(createCurrentSnowplowScraper().run({fetchPage:async url=>{
  calls++;assert.equal(url,packet.url)
  return{status:200,url:packet.finalUrl,contentType:packet.contentType,body:packet.body}
 }}),error=>{
  assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:false,failureKind:'incomplete_listing'})
  assert.equal(error.code,'SNOWPLOW_NATIVE_INCOMPLETE')
  assert.equal(error.cause.code,'SNOWPLOW_NATIVE_UNREVIEWED')
  assert.equal(error.abortRetries,true)
  assert.equal(error.retainedNativeResponses.length,1)
  assert.equal(error.retainedNativeResponses[0].response.body,packet.body)
  assert.equal(error.inventoryEvidence.status,'coverage-gap')
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.equal(error.sourceScopeComplete,false)
  return true
 })
 assert.equal(calls,1)
})

test('Snowplow invalid HTML MIME remains a hard contract failure',async()=>{
 let calls=0
 await assert.rejects(createCurrentSnowplowScraper().run({fetchPage:async url=>{
  calls++;return{status:200,url,contentType:'application/json',body:packet.body}
 }}),error=>{
  assert.equal(classifyScraperError(error).softFailure,false)
  assert.equal(error.softFailure,undefined)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  return true
 })
 assert.equal(calls,1)
})

const retained=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261106-evening.json.gz',import.meta.url))))
const home='https://snowplow.io/careers',board='https://snowplow.careers.hibob.com/',feed=board+'api/job-ad'
for(const [label,change] of [
 ['unknown native country',body=>{const data=JSON.parse(body);data.jobAdDetails[0].country='Unresolved country';return JSON.stringify(data)}],
 ['malformed native JSON',()=>'{"jobAdDetails":'],
])test('Snowplow '+label+' keeps its hard contract classification',async()=>{
 const calls=[]
 await assert.rejects(createCurrentSnowplowScraper().run({fetchPage:async url=>{
  calls.push(url)
  const p=retained.packets.find(p=>p.requestUrl===url)
  assert.ok(p,'Retained native endpoint required')
  return{status:p.status,url:p.url,contentType:p.contentType,body:url===feed?change(p.body):p.body}
 }}),error=>{
  assert.equal(classifyScraperError(error).softFailure,false)
  assert.equal(error.softFailure,undefined)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.deepEqual(calls,[home,board,board+'api/career-site',feed])
  return true
 })
})
