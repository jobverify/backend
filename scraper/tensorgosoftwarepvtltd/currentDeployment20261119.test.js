import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261119/current-deployment.json.gz',import.meta.url))))
const MAIN='https://tensorgo.com/static/js/main.91ac0e8a.js',API='https://api.humains.one/api/jobs'
const replay=(mutate=()=>{})=>{
 const calls=[],seen=new Map(),packets=structuredClone(fixture.responses)
 const read=async url=>{
  calls.push(url);const index=seen.get(url)||0;seen.set(url,index+1)
  const row=packets.filter(r=>r.requestedUrl===url)[index]
  assert.ok(row,'Uncaptured current native request '+url);assert.equal(row.status,200)
  const data={url,body:Buffer.from(row.bodyBase64,'base64').toString()};mutate(data);return data.body
 }
 return{calls,options:{fetchText:read,fetchJson:async url=>JSON.parse(await read(url)),now:()=>fixture.capturedAt}}
}

test('TensorGo November 19 reviewed main and unchanged careers chunks retain all ten full native India roles',async()=>{
 const io=replay(),jobs=await run(io.options)
 assert.equal(jobs.length,10);assert.equal(io.calls.length,20)
 for(const job of jobs){
  const detail=JSON.parse(Buffer.from(fixture.responses.find(r=>r.requestedUrl===API+'/'+new URL(job.sourceUrl).pathname.split('/').at(-1)).bodyBase64,'base64'))
  assert.equal(job.jobDescription,detail.description.trim())
  assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,10)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('TensorGo November 19 cannot inherit the client proof after a changed whole main or careers dependency',async()=>{
 for(const target of [MAIN,'https://tensorgo.com/static/js/803.76777e33.chunk.js']){
  const io=replay(row=>{if(row.url===target)row.body+=';globalThis.unreviewed=true'})
  await assert.rejects(run(io.options),/handoff program contract changed/)
  assert.equal(io.calls.some(url=>url.startsWith(API)),false)
 }
})

test('TensorGo November 19 refuses a changed declared employer, role country or incomplete detail',async()=>{
 for(const mode of ['employer','country','detail']){
  const io=replay(row=>{
   if(row.url===MAIN&&mode==='employer')row.body=row.body.replace('legalName:"TensorGo Software Private Limited"','legalName:"Other Employer"')
   if(row.url===MAIN&&mode==='country')row.body=row.body.replace('addressCountry:"IN"','addressCountry:"US"')
   if(row.url===API+'/ai-engineer'&&mode==='detail'){const data=JSON.parse(row.body);data.description=data.short;row.body=JSON.stringify(data)}
  })
  await assert.rejects(run(io.options),/handoff|criteria|mismatched/)
 }
})

// A complete configured API does not establish company-wide retirement scope.
test('TensorGo November 19 standard assessor preserves the company-scope cleanup hold',async()=>{
 const io=replay(),jobs=await run(io.options)
 const assessed=assessSoftFailureAcquisition({source:'tensorgosoftwarepvtltd',companyName:'TensorGo Software Pvt Ltd'},jobs)
 assert.equal(assessed.cleanupOptions.replaceExisting,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
