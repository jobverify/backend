import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setTimeout as delay} from 'node:timers/promises'
import * as codewave from '../../scraper/codewavetechnologies/script.js'
import * as deltecs from '../../scraper/deltecs/script.js'
import {createFirstPartyDocumentReader} from '../native-sources/boundedFirstPartyDocuments.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/codewaveDeltecs20261106/capture.json.gz',import.meta.url))))
const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/codewaveDeltecs20261106/description-expectations.json',import.meta.url),'utf8'))
const career='https://codewave.com/careers',role='https://www.dronahq.com/career/legal-executive/'
const read=url=>{assert.ok(fixture.documents[url],'Uncaptured URL '+url);return fixture.documents[url].body}
const page=url=>{const row=fixture.documents[url];assert.ok(row);return {status:row.status,url:row.finalUrl,headers:row.headers,body:row.body,bodyUnavailable:row.bodyUnavailable}}
const options=()=>({fetchPage:async url=>page(url),now:()=> '2026-11-06T10:30:00.000Z'})
const block=ms=>{const started=performance.now();while(performance.now()-started<ms){}}
const policy={source:'native-boundary-control',urls:[career]}

test('Codewave retains complete authored criteria for every native country cohort, including supplemental tooltip metadata',()=>{
 const rows=codewave.extractOpeningCards(read(career));assert.equal(rows.length,14)
 for(const row of rows){assert.equal(row.jobDescription.replace(/\s/g,''),expected.codewave[row.jobId].completeDescriptionWithoutWhitespace);assert.equal(row.sourceScopeComplete,false)}
})
test('Codewave does not derive India from an Indian city when the native workplace names a different country',()=>{
 const original=read(career),changed=original.replace('Bangalore / India','Bangalore / United States').replace('data-apply-location="Bangalore, India"','data-apply-location="Bangalore, United States"')
 assert.notEqual(changed,original)
 const rows=codewave.extractOpeningCards(changed)
 assert.equal(rows[0].city,'Bangalore');assert.equal(rows[0].country,'United States')
 assert.equal(rows.filter(row=>row.country==='India').length,11)
})
test('Codewave requires actual native description presence and matching application post data',()=>{
 const original=read(career)
 for(const changed of [original.replace('class="job-description"','hidden class="job-description"'),original.replace('data-apply-job="36817"','data-apply-job="999"')]){
  assert.notEqual(changed,original);assert.throws(()=>codewave.extractOpeningCards(changed),/native|criteria|application/i)
 }
})
test('Both collectors retain hidden conflicting canonical authority instead of choosing a healthy visible sibling',()=>{
 const code=read(career).replace('<link rel="canonical"','<link hidden rel="canonical" href="https://unrelated.invalid/"/><link rel="canonical"')
 assert.notEqual(code,read(career));assert.equal(codewave.hasOfficialCareersSignal(code),false)
 const detail=read(role).replace('<link rel="canonical"','<link hidden rel="canonical" href="https://unrelated.invalid/"/><link rel="canonical"')
 assert.notEqual(detail,read(role));const listing=deltecs.extractListings(read(deltecs.CAREERS_URL))[0]
 assert.throws(()=>deltecs.extractJobDetail(detail,listing),/canonical/i)
})
test('Codewave rejects repeated publisher post IDs across separate native role rows',()=>{
 const changed=read(career).replace('data-job-id="36817"','data-job-id="36709"')
 assert.notEqual(changed,read(career));assert.throws(()=>codewave.extractOpeningCards(changed),/repeated native post ID|ambiguous original native role record/)
})
test('Codewave detects full native criteria drift during closing reconciliation',async()=>{
 let reads=0
 await assert.rejects(codewave.run({...options(),fetchPage:async url=>{
  const result=page(url)
  if(url===career&&++reads===2){result.body=result.body.replace('Ship quality that customers never have to think about.','Changed authored criterion.');assert.notEqual(result.body,read(career))}
  return result
 }}),/Closing native careers cohort changed/)
 assert.equal(reads,2)
})
test('DronaHQ can observe an explicit foreign native workplace without asserting a company-wide India zero',async()=>{
 const jobs=await deltecs.run({...options(),fetchPage:async url=>{
  const result=page(url)
  if([role,deltecs.CAREERS_URL].includes(url)){result.body=result.body.replaceAll('Mumbai, Maharashtra, India','Mumbai, Maharashtra, Switzerland');assert.notEqual(result.body,read(url))}
  return result
 }})
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'deltecs').observedVacancyCount,1)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaCountryMatches,0)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
test('DronaHQ rejects an earlier hidden conflicting body even when a later visible role body is healthy',()=>{
 const original=read(role),changed=original.replace(/<body\b[^>]*>/i,opening=>'<body hidden class="post-99"></body>'+opening)
 assert.notEqual(changed,original)
 const listing=deltecs.extractListings(read(deltecs.CAREERS_URL))[0]
 assert.throws(()=>deltecs.extractJobDetail(changed,listing),/body/i)
})
test('DronaHQ cannot borrow native country from a listing when the role detail workplace differs',()=>{
 const listing=deltecs.extractListings(read(deltecs.CAREERS_URL))[0]
 const changed=read(role).replaceAll('Mumbai, Maharashtra, India','Mumbai, Maharashtra, Switzerland')
 assert.notEqual(changed,read(role));assert.throws(()=>deltecs.extractJobDetail(changed,listing),/workplace conflict/)
})
test('DronaHQ detects a role criterion changing after the opening detail read',async()=>{
 const original=read(role),changed=original.replace('proactive','changed')
 assert.ok(changed!==original,'The intended native HTML mutation must take effect')
 const listing=deltecs.extractListings(read(deltecs.CAREERS_URL))[0]
 assert.notEqual(deltecs.extractJobDetail(changed,listing).jobDescription,deltecs.extractJobDetail(original,listing).jobDescription,'The mutation must change actual qualified native role criteria')
 let reads=0
 await assert.rejects(deltecs.run({...options(),fetchPage:async url=>{
  const result=page(url)
  if(url===role&&++reads===2)result.body=changed
  return result
 }}),/Closing native role criteria or identity changed/)
 assert.equal(reads,2)
})
test('DronaHQ rejects one native published post ID reused by two different listed role URLs',async()=>{
 // Explicit synthetic second card/detail, never a historical capture claim.
 const copy='https://www.dronahq.com/career/legal-executive-copy/'
 const card='<div class="job-card"><div class="job-info"><h3><a href="'+copy+'">Legal Executive Copy</a></h3><div class="job-other-info"><span>Mumbai, Maharashtra, India</span><span>Hybrid</span><span>2 - 3 years</span></div></div><a href="'+copy+'" class="apply-btn">Apply now</a></div>'
 const careers=read(deltecs.CAREERS_URL).replace('<div class="job-card">',card+'<div class="job-card">')
 assert.notEqual(careers,read(deltecs.CAREERS_URL))
 const detail=read(role).replaceAll('Legal Executive','Legal Executive Copy').replaceAll(role,copy)
 await assert.rejects(deltecs.run({...options(),maxJobs:2,fetchPage:async url=>url===copy
  ?{status:200,url,headers:{'content-type':'text/html'},body:detail}:url===deltecs.CAREERS_URL?{...page(url),body:careers}:page(url)}),/native post identity reused|Duplicate native.*post/i)
})
test('The bounded document reader preserves a pre-start opaque caller cancellation without a read',async()=>{
 const controller=new AbortController();controller.abort(0);let calls=0
 assert.throws(()=>createFirstPartyDocumentReader({signal:controller.signal,fetchImpl:()=>{calls++}},policy),error=>error===0)
 assert.equal(calls,0)
})
test('The requested20ms deadline rejects60ms header work after one callback entry and cancels the late body',async()=>{
 let entered=0,canceled=0
 const response={status:200,url:career,headers:new Headers({'content-type':'text/html'}),body:{cancel(){canceled++;return Promise.resolve()}}}
 const reader=createFirstPartyDocumentReader({requestTimeoutMs:20,sourceTimeoutMs:1000,fetchImpl:()=>{entered++;block(60);return response}},policy)
 try{await assert.rejects(reader.read(career),error=>error?.name==='TimeoutError');assert.equal(entered,1);assert.equal(canceled,1)}finally{reader.close()}
})
test('The requested20ms deadline rejects60ms body work after one read without another read',async()=>{
 let entered=0,canceled=0,released=0
 const bytes=new TextEncoder().encode('<p>Native test body.</p>')
 const response={status:200,url:career,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({
  read(){entered++;block(60);return Promise.resolve({done:false,value:bytes})},cancel(){canceled++;return Promise.resolve()},releaseLock(){released++},
 })}}
 const reader=createFirstPartyDocumentReader({requestTimeoutMs:20,sourceTimeoutMs:1000,fetchImpl:()=>response},policy)
 try{await assert.rejects(reader.read(career),error=>error?.name==='TimeoutError');assert.equal(entered,1);assert.equal(canceled,1);assert.equal(released,1)}finally{reader.close()}
})
test('The bounded document reader rejects an uncooperative unresolved header callback by deadline',async()=>{
 const reader=createFirstPartyDocumentReader({requestTimeoutMs:20,sourceTimeoutMs:1000,fetchImpl:()=>new Promise(()=>{})},policy)
 try{await assert.rejects(reader.read(career),error=>error?.name==='TimeoutError')}finally{reader.close()}
})
test('A late response after opaque caller reason0 is canceled with the same reason and cannot become a result',async()=>{
 const controller=new AbortController(),canceled=[]
 let entered=0
 const response={status:200,url:career,headers:new Headers({'content-type':'text/html'}),body:{cancel:reason=>{canceled.push(reason);return Promise.resolve()}}}
 const reader=createFirstPartyDocumentReader({signal:controller.signal,sourceTimeoutMs:1000,fetchImpl:()=>{entered++;return new Promise(resolve=>setTimeout(()=>resolve(response),25))}},policy)
 const timer=setTimeout(()=>controller.abort(0),5)
 try{await assert.rejects(reader.read(career),error=>error===0);await delay(40);assert.equal(entered,1);assert.deepEqual(canceled,[0])}finally{clearTimeout(timer);reader.close()}
})
test('An oversized original response chunk is rejected and canceled before native parsing',async()=>{
 let reads=0,canceled=0
 const chunk=new Uint8Array(16*1024*1024+1)
 const response={status:200,url:career,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({
  read(){reads++;return Promise.resolve({done:false,value:chunk})},cancel(){canceled++;return Promise.resolve()},releaseLock(){},
 })}}
 const reader=createFirstPartyDocumentReader({fetchImpl:()=>response},policy)
 try{await assert.rejects(reader.read(career),/byte budget exceeded/);assert.equal(reads,1);assert.equal(canceled,1)}finally{reader.close()}
})
