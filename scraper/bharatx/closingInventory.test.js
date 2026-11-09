import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createBharatXScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const retained=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/retained-http-20261026.json.gz',import.meta.url))))
const careers='https://bharatx.tech/careers/'
const account='https://apply.workable.com/api/v1/accounts/bharatx'
const listing='https://apply.workable.com/api/v3/accounts/bharatx/jobs'
const load=async url=>{
 const receipt=retained.receipts.find(item=>item.url===url)
 assert.ok(receipt,'only actual retained endpoints are replayed')
 const bytes=Buffer.from(receipt.bodyBase64,'base64')
 assert.equal(createHash('sha256').update(bytes).digest('hex'),receipt.sha256)
 return {receipt,body:await new Response(bytes).text()}
}
const fixtureTransport=(mutate=()=>{})=>{
 const calls=[]
 return {calls,async fetchPage(url){
  const {receipt,body}=await load(url);assert.equal(url,careers);calls.push({url,method:'GET'})
  return {status:receipt.status,url:receipt.finalUrl,html:body}
 },async fetchJson(url,init={}){
  const {receipt,body}=await load(url)
  assert.equal(init.method||'GET',receipt.method)
  if(url===listing)assert.deepEqual(JSON.parse(init.body),JSON.parse(receipt.requestBody),'global unfiltered request stays intact')
  calls.push({url,method:init.method||'GET'});const payload=JSON.parse(body)
  mutate(payload,url,calls.filter(call=>call.url===url).length)
  return payload
 }}
}
const scraper=()=>createBharatXScraper({now:()=>new Date('2026-10-26T13:02:00.000Z')})

test('BharatX reconciles opening and closing native reads while preserving the actual extra-channel gap',async()=>{
 assert.equal(retained.provenance.currentHTTPProof,false)
 const transport=fixtureTransport(),jobs=await scraper().run(transport)
 assert.deepEqual(jobs,[])
 for(const url of [careers,account,listing])assert.equal(transport.calls.filter(call=>call.url===url).length,2)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.indiaFacetCount,null)
 assert.match(evidence.reason,/additional-employer-recruiting-scope-unresolved/)
})

test('a counterfactual contradictory closing total is rejected instead of returning the opening result',async()=>{
 // This deliberate mutation is not a claim that the captured board had a job.
 const transport=fixtureTransport((payload,url,read)=>{
  if(url===listing&&read===2){assert.equal(payload.total,0);assert.deepEqual(payload.results,[]);payload.total=1}
 })
 await assert.rejects(scraper().run(transport),/terminal page leaves an incomplete inventory count/)
})
