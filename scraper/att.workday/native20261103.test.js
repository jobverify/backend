import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const replay=change=>({fetch:async url=>{
 const row=packets.find(row=>row.url===url);assert.ok(row,url)
 const body=change?change(url,row.body):row.body
 return{status:row.status,url:row.finalUrl,text:async()=>body}
}})
test('the full current declared AT&T India board is complete while global scope and malformed expiry remain unknown',async()=>{
 const jobs=await run(replay()),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,13);assert.equal(evidence.listingComplete,true)
 assert.equal(evidence.status,'complete-inventory');assert.equal(evidence.reportedTotal,13)
 assert.equal(extractionDetailHealth(jobs).complete,true)
 assert.ok(jobs.every(job=>job.sourceDeclaredBoardScopeComplete===true&&job.sourceScopeComplete===false))
 assert.ok(jobs.every(job=>job.closingDate===null&&job.sourceLifecycleComplete===false&&job.nativeValidThrough))
  assert.ok(jobs.every(job=>job.lifecycleCleanupAllowed===false))
 assert.match(evidence.reason,/declared.*India.*closing/)
})
test('one unavailable native full detail still vetoes complete India inventory and retains its candidate count',async()=>{
 let changed=false
 const jobs=await run(replay((url,body)=>{
  if(!changed&&url.includes('/job/')){changed=true;return body.replaceAll('ats-description','unpublished-description')}
  return body
 })),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,12);assert.equal(evidence.listingComplete,false)
 assert.equal(jobs[0].nativeCollectionEvidence.candidateDetails,13)
 assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1)
})
