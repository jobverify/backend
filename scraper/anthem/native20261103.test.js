import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const native=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const replay=()=>({fetchPage:async(url,init)=>{
 const row=native.find(row=>row.url===url&&(row.method||'GET')===(init.method||'GET'));assert.ok(row,url)
 return{status:row.status,url:row.finalUrl,body:row.bodyText}
}})
test('current Anthem corporate5/native0 disagreement stays explicit and cannot become verified empty',async()=>{
 const jobs=await run(replay()),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
 assert.match(evidence.reason,/corporate-advertised:5.*native-reported:0/)
})
test('Anthem settles cancellation inside a report observer which never resolves',async()=>{
 const controller=new AbortController(),reason=Error('stop Anthem observer')
 await assert.rejects(run({...replay(),signal:controller.signal,onReport:()=>{controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason)
})
