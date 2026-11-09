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
test('current DIV descriptions and role-owned workplace headings are retained without country inference',async()=>{const jobs=await source.run(options);assert.equal(jobs.length,9);assert.ok(jobs.every(j=>j.location==='Bengaluru'));assert.ok(jobs.every(j=>j.country==null));assert.ok(jobs.every(j=>j.jobDescription?.length>300));assert.match(jobs.find(j=>j.sourceUrl.endsWith('/backend-developer.php')).jobDescription,/Lead all aspects of development/)})
test('registered decorator retains compact truthful native collection evidence',async()=>{const provider=getScraperCatalog().find(p=>p.source==='buyhatke'),jobs=await createCatalogScraper(provider).run(options);const evidence=jobs[0]?.nativeCollectionEvidence;assert.ok(evidence);assert.equal(evidence.source,'buyhatke');assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})

test('another current role binds its own header and refuses hidden/mismatched workplace containers and foreign forms',async()=>{
 const listing=source.extractListings(await read(source.CAREERS_URL)).find(j=>j.sourceUrl.endsWith('/seo.php')),html=await read(listing.sourceUrl),job=source.extractJobDetail(html,listing)
 assert.equal(job.title,'SEO Specialist');assert.equal(job.location,'Bengaluru');assert.ok(job.jobDescription.length>300)
 assert.throws(()=>source.extractJobDetail(html.replace(/SEO Specialist\s+<span>/,'Wrong Role <span>'),listing),/identity contradiction/)
 assert.throws(()=>source.extractJobDetail(html.replace('class="job-intro-section','hidden class="job-intro-section'),listing),/heading|container/)
 assert.throws(()=>source.extractJobDetail(html.replace('https://docs.google.com/forms/','https://docs.google.com.other.example/forms/'),listing),/foreign/)
 const android=source.extractListings(await read(source.CAREERS_URL)).find(j=>j.sourceUrl.endsWith('/android-developer.php')),split=source.extractJobDetail(await read(android.sourceUrl),android)
 assert.equal(split.rawNativeRoleEvidence.applicationFrames.length,2);assert.equal(split.rawNativeRoleEvidence.applicationRouteQualified,false);assert.equal(split.applyUrl,android.sourceUrl)
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

test('observed native titles and URL slugs do not manufacture employer requisition identifiers',async()=>{const jobs=await source.run(options);assert.ok(jobs.every(j=>j.requisitionId==null))})

test('HTTP200 access denial is unavailable with unknown inventory rather than a successful empty result or retryable parser drift',async()=>{const publicFetch=globalThis.fetch;let calls=0;try{globalThis.fetch=async url=>{calls++;return {ok:true,status:200,url:String(url),text:async()=>'<html><title>Access Denied</title><body>Access to this resource is denied.</body></html>'}};await assert.rejects(source.run(),error=>error.code==='access_denied'&&error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null);assert.equal(calls,1)}finally{globalThis.fetch=publicFetch}})

test('hidden listing links cannot establish an active native role handoff',async()=>{const html=await read(source.CAREERS_URL),hidden=html.replace(/<body\b/i,'<body hidden');assert.notEqual(hidden,html);assert.throws(()=>source.extractListings(hidden),/opportunities|active/)})
