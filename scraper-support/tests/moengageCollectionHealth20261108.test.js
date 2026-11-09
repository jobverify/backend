import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runCurrentMoEngage} from '../../scraper/moengage/currentKula.js'
import {readInventoryEvidence,isCompleteScraperAttempt} from '../utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../utils/extractionDetailHealth.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/moengage-public-kula-20261103.json.gz',import.meta.url))))
const replay=async(options={})=>runCurrentMoEngage({...options,fetchPage:async url=>{
  const original=capture.responses.find(row=>row.url===url)
  assert.ok(original,'Every requested URL must be captured')
  const page=structuredClone(original)
  if(options.unknownCountry)page.html=page.html.replaceAll('United Arab Emirates','Unknown country')
  return page
}})

test('complete MoEngage native models produce source-bound reconciled detail health',async()=>{
  const jobs=await replay(),health=extractionDetailHealth(jobs)
  assert.equal(jobs.length,22)
  assert.equal(health.complete,true)
  assert.equal(health.inspectedJobs,22)
  assert.equal(health.nativeCollections.length,1)
  const collection=health.nativeCollections[0]
  assert.equal(collection.sourceMatches,true)
  assert.equal(collection.observedListingRows,37)
  assert.equal(collection.candidateDetails,37)
  assert.equal(collection.parsedDetails,37)
  assert.equal(collection.excludedDetails,0)
  assert.equal(collection.unextractedDetailFailures,0)
  assert.equal(collection.countsReconciled,true)
  assert.deepEqual(collection.nativeListingCountryCounts,{observedIndiaRows:22,excludedNonIndiaRows:15,reconciled:true})
  assert.equal(isCompleteScraperAttempt({success:true,inventoryEvidence:readInventoryEvidence(jobs),detailHealth:health}),true)
})

test('unresolved native country details remain visible even when every returned India role is complete',async()=>{
  const jobs=await replay({unknownCountry:true}),health=extractionDetailHealth(jobs)
  assert.equal(jobs.length,22)
  assert.equal(health.incompleteJobs,22)
  assert.equal(health.complete,false)
  const collection=health.nativeCollections[0]
  assert.equal(collection.sourceMatches,true)
  assert.equal(collection.candidateDetails,37)
  assert.equal(collection.parsedDetails,33)
  assert.equal(collection.unextractedDetailFailures,4)
  assert.equal(collection.countsReconciled,true)
  assert.equal(collection.complete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('a result cap keeps MoEngage extraction incomplete after full native collection',async()=>{
  const jobs=await replay({maxJobs:1}),health=extractionDetailHealth(jobs)
  assert.equal(jobs.length,1)
  assert.equal(health.complete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
