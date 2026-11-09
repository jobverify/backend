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
test('the current fully described group role stays Mangal and never becomes an Energy and Mobility vacancy',async()=>{
 let observations
 const jobs=await run({...replay(),onRecords:rows=>{observations=rows}}),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
 assert.ok(observations);assert.equal(observations.length,1)
 assert.equal(observations[0].company,'Mangal Industries Limited')
 assert.equal(observations[0].country,'India');assert.equal(observations[0].targetEmployer,false)
 assert.ok(observations[0].jobDescription.length>500)
 assert.match(evidence.reason,/group-native-reported:1.*target-employer-observed:0/)
})
test('Amara caller cancellation settles a record observer which ignores its signal',async()=>{
 const controller=new AbortController(),reason=Error('stop Amara records')
 await assert.rejects(run({...replay(),signal:controller.signal,onRecords:()=>{controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason)
})
