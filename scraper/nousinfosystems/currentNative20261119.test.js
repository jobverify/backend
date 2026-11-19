import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {runCurrentNous} from './nativeCurrent.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261119/deployment.json.gz',import.meta.url))))

test('Nous November 19 original full paired native readings retain fourteen unknown-country vacancies without a false India zero',async()=>{
 const calls=new Map()
 const jobs=await runCurrentNous({now:capture.capturedAt,fetchImpl:async url=>{
  const index=calls.get(url)||0;calls.set(url,index+1)
  const packet=capture.responses.filter(r=>r.requestedUrl===url)[index]
  assert.ok(packet,'Uncaptured paired native request '+url)
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  const response=new Response(bytes,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }})
 const audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.observedRecordCount,14)
 assert.equal(audit.unknownCountryVacancies,14)
 assert.equal(audit.wholeObservedNativeBoardClosingReconciled,true)
 assert.equal(audit.companyIndiaZeroProven,false)
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyScopeComplete,false)
 assert.equal(audit.applicationInteractions,0);assert.equal(audit.originalResponses.length,44)
 assert.ok(audit.observations.every(row=>row.country===null&&row.legalHiringOrganization===null&&row.ownOpeningModel.overviewText.length>300&&row.ownOpeningModel.overviewText===row.ownClosingModel.overviewText))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessed=assessSoftFailureAcquisition({source:'nousinfosystems',companyName:'Nous Infosystems'},jobs)
 assert.equal(assessed.zeroJobEvidence,'coverage-gap')
 assert.equal(assessed.runnerOutcome.success,false)
 assert.equal(assessed.cleanupOptions.replaceExisting,false)
})
