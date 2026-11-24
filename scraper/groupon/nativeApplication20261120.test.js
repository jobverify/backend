import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261119/current-native.json.gz',import.meta.url))))
test('Groupon paired qualified role criteria do not require a browser or submitted application to be complete',async t=>{
 let calls=0
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  const packet=capture.responses[calls++]
  assert.ok(packet,'Only retained public requests');assert.equal(String(url),packet.requestedURL)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 })
 const jobs=await run(),qualified=jobs.filter(job=>job.nativeRoleCriteriaReconciled)
 assert.equal(calls,72);assert.equal(jobs.length,28);assert.equal(qualified.length,1)
 assert.ok(qualified.every(job=>job.sourceDetailComplete===true&&job.nativePublicApplicationEntryDeclared===true))
 assert.ok(jobs.every(job=>job.activeApplyVerified===false&&job.applicationFormSubmitted===false))
 const assessed=assessSoftFailureAcquisition({source:'groupon',companyName:'Groupon'},jobs)
 assert.equal(assessed.indiaJobs,0)
 assert.equal(assessed.runnerOutcome.success,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
