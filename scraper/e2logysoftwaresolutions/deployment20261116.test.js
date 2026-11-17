import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createE2logySoftwareSolutionsScraper} from './script.js'
import {extractCurrentDetail,extractCurrentListings} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261116.json.gz',import.meta.url))))
const listings=extractCurrentListings(fixture.responses[0].body),native=fixture.responses[1].body
const sha=value=>createHash('sha256').update(value).digest('hex')

test('E2logy Nov16 CDN deployment keeps both original Drupal criteria and employer scope holds',async()=>{
 const counts=new Map()
 const result=await createE2logySoftwareSolutionsScraper().run({fetchPage:async url=>{
  const candidates=fixture.responses.filter(row=>row.url===url),index=counts.get(url)||0
  assert.ok(candidates[index],'Unexpected native read '+url)
  counts.set(url,index+1)
  const row=candidates[index]
  assert.equal(sha(row.body),row.sha256)
  return row
 }})
 const jobs=[...result].sort((left,right)=>left.jobId.localeCompare(right.jobId))
 assert.deepEqual(jobs.map(row=>row.jobId),['424443000011711102','424443000011711171'])
 assert.deepEqual(jobs.map(row=>row.city),['Noida','Ahmedabad'])
 assert.deepEqual(jobs.map(row=>sha(row.sourceDescriptionHTML)),['a5edd3dbaf6c436029758fad7113e7e5ec32b8ef1a1b1041e444eb5d68955c53','863e8dd465ecd35e92afce870c4ae81d58111958ab8ce8d06624fe8b4cd5c43c'])
 assert.ok(jobs.every(row=>row.country==='India'&&row.sourceDetailComplete&&row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false))
 assert.equal(result.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch,true)
 assert.equal(readInventoryEvidence(result).listingComplete,false)
})

test('E2logy Nov16 CDN map remains bound to exact reviewed declarations and bytes',()=>{
 for(const changed of [
  native.replace('career-website-common.e098b32b8e59c3522a0599bd2176f5cc.js','career-website-common.00000000000000000000000000000000.js'),
  native.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unreviewed.js":"unreviewed.js",'),
 ]){
  assert.notEqual(changed,native)
  assert.throws(()=>extractCurrentDetail(changed,listings[0]),/program|declaration/)
 }
})
