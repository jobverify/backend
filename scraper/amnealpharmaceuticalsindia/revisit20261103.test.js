import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz',import.meta.url))))
const fresh=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/revisit-20261103.json.gz',import.meta.url))))
const replay=(drift=false)=>{const counts=new Map();return{fetchText:async url=>packets.find(row=>row.url===url).body,fetchJson:async url=>{
 const row=packets.find(row=>row.url===url);assert.ok(row,url);const payload=JSON.parse(row.body),count=counts.get(url)||0;counts.set(url,count+1)
 if(drift&&count&&url===source.buildSearchUrl())payload.items[0].requisitionList[0].Title+=' changed'
 return payload
}}}
test('Amneal opening and closing full India listing models reconcile independently of four genuinely missing JDs',async()=>{
 const jobs=await source.run(replay()),native=jobs[0].nativeCollectionEvidence
 assert.equal(jobs.length,92);assert.equal(native.closingInventoryMatches,true)
 assert.equal(native.failures.filter(row=>row.stage==='native-detail').length,4)
 assert.equal(extractionDetailHealth(jobs).complete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,96)
})
test('Amneal closing criteria drift stays explicit and cannot certify inventory',async()=>{
 const jobs=await source.run(replay(true)),native=jobs[0].nativeCollectionEvidence
 assert.equal(native.closingInventoryMatches,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(native.failures.some(row=>row.stage==='native-inventory'))
})
test('all four freshly checked public Oracle records still lack full public criteria; the job pages only expose a shell',()=>{
 for(const id of ['5502','7502','7504','8735']){
  const payload=JSON.parse(fresh.find(row=>row.key==='detail-'+id).body),detail=payload.items[0]
  const listing=source.extractSearchResults({items:[{requisitionList:[detail]}]})[0]
  assert.throws(()=>source.extractJobDetail(payload,listing),error=>error.code==='AMNEAL_NATIVE_DESCRIPTION_UNAVAILABLE')
  const html=fresh.find(row=>row.key==='public-'+id).body
  assert.doesNotMatch(html,/"@type"\s*:\s*"JobPosting"/)
 }
})
test('Amneal caller cancellation settles an injected read which ignores its signal',async()=>{
 const controller=new AbortController(),reason=Error('stop Amneal')
 await assert.rejects(source.run({signal:controller.signal,fetchText:()=>{controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason)
})
