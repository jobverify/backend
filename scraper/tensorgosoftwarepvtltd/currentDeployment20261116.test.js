import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,CAREERS_PAGE_URL} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261116/current-deployment.json.gz',import.meta.url))))
const responses=new Map(fixture.responses.map(r=>[r.url,r]))
const MAIN='https://tensorgo.com/static/js/main.6656caca.js',API='https://api.humains.one/api/jobs'
const replay=change=>{
 const reads=[]
 const text=async url=>{
  reads.push(url)
  let row=responses.get(url);assert.ok(row,'Only current declared public URLs are read: '+url)
  // The source's text transport follows this captured exact corporate redirect.
  if(url===CAREERS_PAGE_URL){assert.equal(row.status,301);assert.equal(row.headers.location,'https://tensorgo.com/careers');row=responses.get(row.headers.location)}
  assert.equal(row.status,200)
  return change?.(url,Buffer.from(row.bodyBase64,'base64').toString())??Buffer.from(row.bodyBase64,'base64').toString()
 }
 return{reads,options:{now:()=>fixture.capturedAt,fetchText:text,fetchJson:async url=>JSON.parse(await text(url))}}
}

test('TensorGo current finite deployment returns all10 native India roles with the full original detail criteria',async()=>{
 const io=replay(),jobs=await run(io.options)
 assert.equal(jobs.length,10)
 assert.equal(io.reads.filter(url=>url===API).length,2)
 for(const job of jobs){
  const detail=JSON.parse(Buffer.from(responses.get(API+'/'+new URL(job.sourceUrl).pathname.split('/').at(-1)).bodyBase64,'base64'))
  assert.equal(job.jobDescription,detail.description.trim())
  assert.ok(job.jobDescription.length>1000)
  assert.equal(job.country,'India')
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 const main=Buffer.from(responses.get(MAIN).bodyBase64,'base64').toString()
 assert.match(main,/jobLocation:\(t\.locations\|\|\[\]\)\.map\(e=>\(\{"@type":"Place",address:\{"@type":"PostalAddress",addressLocality:e,addressCountry:"IN"/)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,10)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,10)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('TensorGo still refuses changed current client bytes before admitting the public API',async()=>{
 const io=replay((url,body)=>url===MAIN?body+';globalThis.unknownHiringSource="/other";':body)
 await assert.rejects(run(io.options),/handoff program contract changed/)
 assert.ok(!io.reads.some(url=>url.startsWith(API)))
})
