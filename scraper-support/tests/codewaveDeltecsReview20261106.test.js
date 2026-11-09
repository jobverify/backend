import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as codewave from '../../scraper/codewavetechnologies/script.js'
import * as deltecs from '../../scraper/deltecs/script.js'
import {generateFingerprint} from '../utils/applicationIdentity.js'

// Mutations below are local synthetic controls of genuine retained bodies.
// They do not make a new source observation, activate an application, or read
// any persistence/runner module. Pure fingerprints do not prove database state.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/codewaveDeltecs20261106/capture.json.gz',import.meta.url))))
const careers='https://codewave.com/careers'
const role='https://www.dronahq.com/career/legal-executive/'
const code=fixture.documents[careers].body
const detail=fixture.documents[role].body
const listing=deltecs.extractListings(fixture.documents[deltecs.CAREERS_URL].body)[0]

test('review: an unreviewed base in retained object fallback cannot qualify the relative Codewave application entry',()=>{
 assert.equal(codewave.extractOpeningCards(code).length,14)
 const changed=code.replace(/<body\b[^>]*>/i,opening=>opening+'<object><base href="https://unrelated.invalid/"></object>')
 assert.notEqual(changed,code)
 assert.throws(()=>codewave.extractOpeningCards(changed),/native.*(?:base|identity|document)/i)
})

test('review: Drona cannot mark full criteria complete when a required skills section has only its visible heading',()=>{
 const criterion='Basic knowledge of contract law, IT law, and intellectual property.'
 const originalJob=deltecs.extractJobDetail(detail,listing)
 assert.ok(originalJob.jobDescription.includes(criterion),'The original native skills criterion must be present')
 const heading=detail.indexOf('Must-Have Skills')
 const start=detail.indexOf('<div class="job-section-description">',heading)
 assert.ok(heading>0&&start>heading,'The mutation must target the actual native skills section body')
 const changed=detail.slice(0,start)+detail.slice(start).replace('<div class="job-section-description">','<div class="job-section-description" hidden>')
 assert.notEqual(changed,detail)
 let job
 try{job=deltecs.extractJobDetail(changed,listing)}catch(error){assert.match(error.message,/native.*(?:criteria|section|content|detail)/i);return}
 assert.ok(!job.jobDescription.includes(criterion),'The intended mutation must remove actual visible criteria from the returned model')
 assert.notEqual(job.sourceDetailComplete,true,'A surviving heading cannot establish complete content for the missing required section')
})

test('review: Drona role-specific URL fingerprint survives the native post-ID correction without claiming stored migration',()=>{
 const job=deltecs.extractJobDetail(detail,listing)
 assert.equal(job.jobId,'35166')
 assert.equal(job.requisitionId,null)
 assert.equal(job.applyUrl,role)
 assert.equal(generateFingerprint(job),generateFingerprint({...job,jobId:'legal-executive'}))
 const other='https://www.dronahq.com/career/legal-executive-copy/'
 assert.notEqual(generateFingerprint(job),generateFingerprint({...job,sourceUrl:other,applyUrl:other}))
})

test('review: a base confined to ordinary HTML template contents cannot change the document application base',()=>{
 const changed=code.replace('</head>','<template><base href="https://unrelated.invalid/"></template></head>')
 assert.notEqual(changed,code)
 assert.equal(codewave.extractOpeningCards(changed).length,14)
})
for(const markup of ['<svg><template><base href="https://unrelated.invalid/"></template></svg>',
 '<math><template><base href="https://unrelated.invalid/"></template></math>']){
 test('review: a foreign template cannot conceal an unreviewed document base: '+markup,()=>{
  const changed=code.replace(/<body\b[^>]*>/i,opening=>opening+markup)
  assert.notEqual(changed,code)
  assert.throws(()=>codewave.extractOpeningCards(changed),/native.*(?:base|identity|document)/i)
 })
}
test('review: hiding one native Drona criterion cannot silently return a complete section',()=>{
 const criterion='Basic knowledge of contract law, IT law, and intellectual property.'
 assert.ok(deltecs.extractJobDetail(detail,listing).jobDescription.includes(criterion))
 assert.equal(detail.split(criterion).length,2,'The mutation targets exactly one genuine criterion')
 const changed=detail.replace(criterion,'<span hidden>'+criterion+'</span>')
 assert.throws(()=>deltecs.extractJobDetail(changed,listing),/native.*(?:criteria|section|content|detail)/i)
})

import {createFirstPartyDocumentReader} from '../native-sources/boundedFirstPartyDocuments.js'

// Synthetic response streams, no source pages or network. The request pattern
// is the Codewave reader pattern: declared301, canonical opening, canonical closing.
const slash='https://codewave.com/careers/',canonical='https://codewave.com/careers'
const entity=new Uint8Array(16*1024*1024).fill(32)
test('review: an actually acquired301 body counts toward the32MiB aggregate and retains truthful entity receipts',async()=>{
 let calls=0,delivered=0
 const requested=[]
 const reader=createFirstPartyDocumentReader({sourceTimeoutMs:10000,fetchImpl:url=>{
  requested.push(url)
  const index=calls++,chunk=index<2?entity:entity.subarray(0,1)
  let first=true
  return {status:index===0?301:200,url,headers:new Headers({'content-type':'text/html',...(index===0?{location:'/careers'}:{})}),
   body:{getReader:()=>({read(){if(first){first=false;delivered+=chunk.byteLength;return Promise.resolve({done:false,value:chunk})}return Promise.resolve({done:true})},cancel(){return Promise.resolve()},releaseLock(){}})}}
 }},{source:'redirect-budget-control',urls:[slash,canonical],redirects:{[slash]:canonical}})
 try{
  await reader.read(slash)
  await reader.read(canonical)
  let failure
  try{await reader.read(canonical)}catch(error){failure=error}
  const stats=reader.stats()
  console.log(JSON.stringify({observation:'synthetic-redirect-aggregate',calls,deliveredBytes:delivered,sourceDecodedBytes:stats.decodedBytes,
   redirectReceipt:stats.receipts[0],failure:failure?.message??null}))
  assert.deepEqual(requested,[slash,canonical,canonical])
  assert.equal(delivered,32*1024*1024+1)
  assert.match(failure?.message??'',/Aggregate native HTML byte budget exceeded/,'The one overflowing byte must trigger aggregate rejection even after a301 entity')
  assert.equal(stats.receipts[0].bytes,16*1024*1024)
  assert.equal(stats.receipts[0].bodyComplete,true)
  assert.equal(stats.receipts[0].bodyUnavailable,false)
 }finally{reader.close()}
})
