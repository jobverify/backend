import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readCdotListing,CURRENT_OPENINGS_URL} from './nativeModels.js'
import {runCdotNative} from './nativeCareers.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const html=gunzipSync(readFileSync(new URL('./test-data/empty-index-20261114.html.gz',import.meta.url))).toString()

test('C-DOT current empty table is an unresolved coverage gap with no company absence or cleanup claim',()=>{
 assert.throws(()=>readCdotListing(html),error=>{
  assert.equal(error.code,'CDOT_EMPTY_INVENTORY_UNPROVEN')
  assert.equal(error.failureKind,'coverage_gap')
  assert.equal(error.softFailure,true)
  assert.equal(error.abortRetries,true)
  assert.equal(error.sourceScopeComplete,false)
  assert.equal(error.sourceListingComplete,false)
  assert.equal(error.lifecycleCleanupAllowed,false)
  return true
 })
})

test('C-DOT empty-table collection retains its exact native response on the failed runner outcome',async()=>{
 await assert.rejects(runCdotNative({minIntervalMs:0,fetchImpl:async url=>{
  assert.equal(url,CURRENT_OPENINGS_URL)
  const response=new Response(html,{status:200,headers:{'content-type':'text/html; charset=UTF-8'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),error=>{
  assert.equal(classifyScraperError(error).failureKind,'coverage_gap')
  assert.equal(classifyScraperError(error).softFailure,true)
  assert.equal(error.recruitmentObservations.sourceScopeComplete,false)
  assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false)
  assert.equal(error.recruitmentObservations.openingIndex.rawHTML,html)
  assert.equal(error.recruitmentObservations.responses.length,1)
  assert.equal(error.inventoryEvidence.status,'coverage-gap')
  assert.equal(error.inventoryEvidence.listingComplete,false)
  return true
 })
})

test('C-DOT publisher identity regressions remain parser failures even on an empty table',()=>{
 assert.throws(()=>readCdotListing(html.replace('name="author" content="Centre for Development of Telematics"','name="author" content="Unrelated employer"')),error=>error.code==='CDOT_NATIVE_CONTRACT'&&error.softFailure!==true)
})
