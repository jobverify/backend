import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
for(const row of packet.requests)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.bodySHA256)
const read=async url=>{const row=packet.requests.find(x=>x.url===String(url));assert.ok(row,'Unadvertised/unrecorded URL '+url);return row.body}
const options={fetchText:read,fetchJson:async url=>JSON.parse(await read(url)),now:()=> '2026-10-31T09:00:00.000Z'}
test('current exact advertised Fingent role pages recover eight native workplaces and complete JDs',async()=>{const jobs=await source.run(options);assert.equal(jobs.length,8);assert.ok(jobs.every(j=>j.location&&j.jobDescription?.length>500));assert.ok(jobs.every(j=>j.country==null));const j=jobs.find(j=>j.sourceUrl.endsWith('/backend-data-infrastructure-engineer/'));assert.equal(j.location,'Kochi');assert.equal(j.requisitionId,'79361');assert.equal(j.postingDate,null);assert.deepEqual(j.rawNativeRoleEvidence.inactiveAlternateJobDates,['2026-10-28T05:43:08+00:00']);assert.match(j.jobDescription,/About the Role/);assert.ok(j.rawNativeRoleEvidence.applicationJobId)})
test('registered decorator retains compact truthful native collection evidence',async()=>{const provider=getScraperCatalog().find(p=>p.source==='fingent'),jobs=await createCatalogScraper(provider).run(options);const evidence=jobs[0]?.nativeCollectionEvidence;assert.ok(evidence);assert.equal(evidence.source,'fingent');assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})

import {readFingentDetail} from './native.js'
test('literal hero fields need advertised author display proof and exact role/form identity',async()=>{
 const listing=source.extractOpenings(await read(source.CAREERS_URL))[0],html=await read(listing.sourceUrl),stylesheetUrl=packet.requests.find(r=>r.file==='fingent-author-2.css').url,authorCSS=await read(stylesheetUrl)
 assert.equal(readFingentDetail(html,listing).location,null);assert.equal(readFingentDetail(html,listing).rawNativeRoleEvidence.declaredHeroFields.Location,'Kochi')
 assert.equal(readFingentDetail(html,listing,{authorCSS,stylesheetUrl}).location,'Kochi')
 assert.throws(()=>readFingentDetail(html.replace('class="career-list"','class="unrendered-role-list"'),listing,{authorCSS,stylesheetUrl}),/field list/)
 assert.equal(readFingentDetail(html.replace('</head>','<style>ul.career-list li title{display:none}</style></head>'),listing,{authorCSS,stylesheetUrl}).location,null)
 assert.throws(()=>readFingentDetail(html.replace('<em>Kochi</em>','<em>Berlin</em>'),listing,{authorCSS,stylesheetUrl}),/workplace.*contradict/i)
 assert.throws(()=>readFingentDetail(html.replace('name="job_id" value="79361"','name="job_id" value=""'),listing,{authorCSS,stylesheetUrl}),/application identity/)
 assert.throws(()=>readFingentDetail(html.replace('<h1>Backend','<h1>Another Backend'),listing,{authorCSS,stylesheetUrl}),/title contradiction/)
})

test('default public transport rejects access denial and off-origin redirects, cancels unread bodies, and honors pre-cancellation',async()=>{
 const publicFetch=globalThis.fetch;let calls=0,cancelled=0
 try{
  globalThis.fetch=async()=>{calls++;return {ok:false,status:403,url:'https://denied.example/',body:{cancel:async()=>{cancelled++}}}}
  await assert.rejects(source.run(),error=>error.status===403&&error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null&&error.inventoryEvidence?.indiaFacetCount===null)
  assert.equal(calls,1);assert.equal(cancelled,1)
  globalThis.fetch=async()=>{calls++;return {ok:true,status:200,url:'https://other.example/careers',body:{cancel:async()=>{cancelled++}}}}
  await assert.rejects(source.run(),/unexpected native redirect/);assert.equal(calls,2);assert.equal(cancelled,2)
  const controller=new AbortController(),reason=new Error('cancelled before native request');controller.abort(reason)
  await assert.rejects(source.run({signal:controller.signal}),error=>error===reason);assert.equal(calls,2)
 }finally{globalThis.fetch=publicFetch}
})

test('HTTP200 access denial is unavailable with unknown inventory rather than a successful empty result or retryable parser drift',async()=>{const publicFetch=globalThis.fetch;let calls=0;try{globalThis.fetch=async url=>{calls++;return {ok:true,status:200,url:String(url),text:async()=>'<html><title>Access Denied</title><body>Access to this resource is denied.</body></html>'}};await assert.rejects(source.run(),error=>error.code==='access_denied'&&error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null);assert.equal(calls,1)}finally{globalThis.fetch=publicFetch}})
