import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import run from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))

test('Trimble November 19 full paired original inventory preserves seventeen India roles and the native application hold',async()=>{
 const seen=new Map()
 const jobs=await run({now:fixture.capturedAt,fetchImpl:async url=>{
  const index=seen.get(url)||0;seen.set(url,index+1)
  const packet=fixture.responses.filter(r=>r.requestedUrl===url)[index]
  assert.ok(packet,'Uncaptured current native request '+url)
  const body=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'),packet.sha256)
  const response=new Response(body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 const audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,17);assert.equal(audit.nativeRecords.length,186)
 assert.equal(audit.reportedNativeTotal,186);assert.equal(audit.nativeListingPages,19)
 assert.equal(audit.nativePaginationReconciled,true);assert.equal(audit.receipts.length,75)
 assert.equal(audit.heldRecords.length,1)
 assert.equal(audit.heldRecords[0].row.requisitionID,'R58298')
 assert.match(audit.heldRecords[0].reason,/native Workday application account\/ID changed/)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false&&job.jobDescription.length>=200))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessed=assessSoftFailureAcquisition({source:'trimble',companyName:'Trimble'},jobs)
 assert.equal(assessed.cleanupOptions.replaceExisting,false)
 assert.equal(assessed.runnerOutcome.success,true)
})
