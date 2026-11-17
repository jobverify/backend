import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readSorocoDetail,readSorocoListing,runCurrentSoroco} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261116.json.gz',import.meta.url))))
const body=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const listing=readSorocoListing(body(capture.responses.find(row=>row.url.includes('/Job_Openings?'))))
const row=listing.data.find(row=>row.id==='836634000001765193')
const html=body(capture.responses.find(packet=>packet.url===row.$url))
const sha=value=>createHash('sha256').update(value).digest('hex')

test('Soroco Nov16 literal CDN deployment preserves the original India General Counsel criteria',()=>{
 const detail=readSorocoDetail(html,row)
 assert.equal(detail.record.id,'836634000001765193')
 assert.equal(detail.record.Country,'India')
 assert.equal(sha(detail.record.Job_Description),'6e8c599f7868e00c5ffa93aaa906f357a20def548d96ce4004a61982535e6800')
 assert.equal(detail.criteria.sourceDetailComplete,true)
})

test('Soroco Nov16 current original24-response run reconciles both complete India roles and preserves cleanup holds',async()=>{
 let next=0
 const jobs=await runCurrentSoroco({now:()=>capture.capturedAt,fetchImpl:async(url,init)=>{
  const packet=capture.responses[next++]
  assert.equal(url,packet.url)
  assert.equal(init.method??'GET','GET')
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(sha(bytes),packet.sha256)
  const response=new Response(bytes,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
 }})
 assert.equal(next,24)
 assert.deepEqual(jobs.map(row=>row.jobId),['836634000001765193','836634000001482002'])
 assert.ok(jobs.every(row=>row.sourceDetailComplete&&row.sourceClosingReconciled&&row.country==='India'&&row.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.openingClosingListingMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Soroco Nov16 CDN deployment continues to reject unknown maps and changed program declarations',()=>{
 for(const changed of [
  html.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unreviewed.js":"unreviewed.js",'),
  html.replace('career-website-common.e098b32b8e59c3522a0599bd2176f5cc.js','career-website-common.00000000000000000000000000000000.js'),
  html.replace('career-website-common.3585e391d3ade73bdb6823525d5b153a.css','career-website-common.ec3ad56936780e537bc552ba0ffff3a1.css'),
 ]){
  assert.notEqual(changed,html)
  assert.throws(()=>readSorocoDetail(changed,row),/program|script|stylesheet/)
 }
})
