import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-context-20261119.json.gz',import.meta.url))))
const assets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261119.json.gz',import.meta.url))))
const replay=change=>{
 let index=0
 return {requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const packet=structuredClone(fixture.responses[index++])
  assert.ok(packet,'only actual current public acquisition resources')
  assert.equal(url,packet.requestedUrl);assert.equal(init.method,packet.method)
  if(packet.publicRequestBody)assert.deepEqual(JSON.parse(init.body),packet.publicRequestBody)
  packet.text??=assets.responses.find(row=>row.url===url)?.text
  assert.equal(typeof packet.text,'string')
  change?.(packet)
  return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
 }}
}

test('Ola Electric current native opening and closing zero remain unknown company inventory at the standard assessment',async()=>{
 const jobs=await run(replay()),audit=jobs.nativeInventoryEvidence,evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeBoardEmpty,true)
 assert.equal(audit.nativeBoardComplete,true)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.retainedResponses.filter(row=>row.method==='POST').length,2)
 assert.equal(evidence.listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='olaelectric'),jobs)
 assert.equal(assessment.runnerOutcome.success,false)
})

test('Ola Electric current profile rejects a foreign organization and a changed closing native client',async()=>{
 await assert.rejects(run(replay(packet=>{
  if(packet.requestedUrl.includes('/api/publicorganizations?')){
   const organization=JSON.parse(packet.text);organization.OrgID='11111111-1111-4111-8111-111111111111';packet.text=JSON.stringify(organization)
  }
 })),/tenant identity changed/)
 let boards=0
 await assert.rejects(run(replay(packet=>{
  if(packet.requestedUrl.endsWith('/dashboardv2')&&++boards===2)packet.text=packet.text.replace('main.0fbeb7233f472c0db0a8.chunk.js','main.foreign.chunk.js')
 })),/executable client/)
})
