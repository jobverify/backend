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
test('current active PPS accordions have no workplaces: commented Pune and footer India never qualify native country',async()=>{const jobs=await source.run(options);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.location==null&&j.city==null&&j.country==null));assert.ok(jobs.every(j=>!j.jobDescription.includes('Legacy hidden')&&!j.jobDescription.includes('Job location: Pune')))})
test('registered decorator retains compact truthful native collection evidence',async()=>{const provider=getScraperCatalog().find(p=>p.source==='precisionprecastsolutions'),jobs=await createCatalogScraper(provider).run(options);const evidence=jobs[0]?.nativeCollectionEvidence;assert.ok(evidence);assert.equal(evidence.source,'precisionprecastsolutions');assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})

test('commented and hidden accordion copies and foreign shared application routes never become active roles',async()=>{
 const html=await read(source.CAREERS_URL),start=html.indexOf('<div class="card">'),end=html.indexOf('<div class="card">',start+1),card=html.slice(start,end)
 assert.equal(source.extractPublicJobs(html+'<!--'+card+'-->').length,6)
 assert.equal(source.extractPublicJobs(html.replace('<div class="card">','<div hidden class="card">')).length,5)
 assert.throws(()=>source.extractPublicJobs(html.replaceAll('href="resume.php"','href="https://other.example/resume.php"')),/application|first-party/i)
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

test('active native description preserves qualifications and specific skills as well as responsibilities',async()=>{const jobs=await source.run(options),job=jobs.find(j=>j.title==='Tekla Precast Modeller / Detailer');assert.match(job.jobDescription,/Qualification/);assert.match(job.jobDescription,/Job Specific Skills/);assert.match(job.rawNativeRoleEvidence.descriptionHtml,/Tekla/);assert.equal(job.rawNativeRoleEvidence.nativeRequisitionId,null)})

test('HTTP200 access denial is unavailable with unknown inventory rather than a successful empty result or retryable parser drift',async()=>{const publicFetch=globalThis.fetch;let calls=0;try{globalThis.fetch=async url=>{calls++;return {ok:true,status:200,url:String(url),text:async()=>'<html><title>Access Denied</title><body>Access to this resource is denied.</body></html>'}};await assert.rejects(source.run(),error=>error.code==='access_denied'&&error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null);assert.equal(calls,1)}finally{globalThis.fetch=publicFetch}})
