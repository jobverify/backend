import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-drift-20261120.json.gz',import.meta.url))))
test('current actual Fireflies employer-bound Gem declaration reaches its exact declared module without a frozen deployment filename',async()=>{
 const stop=Object.freeze({retainedBoundary:'current Gem module not in the original failed capture'}),calls=[]
 await assert.rejects(run({fetchImpl:async(url,init)=>{
  calls.push(url);assert.equal(init.method,'GET')
  if(url==='https://static.gem.com/scripts/jobBoards.DRtIpT6K.v2.min.js')throw stop
  const packet=fixture.responses.find(p=>p.requestedURL===url);assert.ok(packet)
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }}),error=>error===stop)
 assert.equal(calls.length,3)
})
for(const control of ['foreign-module','foreign-base','extra-base'])test('current Fireflies declaration rejects '+control+' before reading a client',async()=>{
 let calls=0
 await assert.rejects(run({fetchImpl:async(url)=>{
  calls++;const packet=fixture.responses.find(p=>p.requestedURL===url);assert.ok(packet)
  let body=Buffer.from(packet.bodyBase64,'base64').toString()
  if(url==='https://jobs.gem.com/fireflies')body=control==='foreign-module'?body.replace('https://static.gem.com/scripts/jobBoards.','https://other.example/scripts/jobBoards.'):control==='foreign-base'?body.replace('<base href="/"','<base href="https://other.example/"'):body.replace('</head>','<base href="/"></head>')
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }}),error=>/declaration|effective base/.test(error.message))
 assert.equal(calls,2)
})
test('fresh Fireflies native role originals qualify two explicit India publications and preserve zero eligible after date/title filters',async t=>{
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-default-20261120.json.gz',import.meta.url)))),seen=new Map();let clock=0,calls=0
 t.mock.method(performance,'now',()=>clock)
 const jobs=await run({now:()=>current.completedAt,fetchImpl:async(url,init)=>{
  const key=JSON.stringify([init.method,url,init.body??null]),count=seen.get(key)??0;seen.set(key,count+1)
  const p=current.responses.filter(row=>JSON.stringify([row.method,row.requestedURL,row.requestBody??null])===key)[count]
  assert.ok(p);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');calls++;clock+=500
  if(init.method==='POST'){assert.equal(url,'https://jobs.gem.com/api/public/graphql');assert.ok(!/\bmutation\b/.test(JSON.parse(init.body).query))}
  return Object.defineProperty(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),'url',{value:p.finalURL})
 }})
 assert.equal(calls,20);assert.equal(jobs.length,2)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceNativeWorksites.some(location=>location.isoCountry==='IND')))
 assert.ok(jobs.every(job=>job.activationVerified===false&&job.sourceRenderedCriteriaComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeModelsClosingReconciled,true)
 const assessment=assessSoftFailureAcquisition({source:'firefliesai'},jobs)
 assert.equal(assessment.indiaJobs,2);assert.equal(assessment.eligibleJobs,0)
 assert.equal(assessment.filterCounts.old,1);assert.equal(assessment.filterCounts.excludedTitle,1)
 assert.equal(assessment.runnerOutcome.success,true);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
