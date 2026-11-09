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
test('current in-office labels remain arrangement-only and contradictory native title is explicitly unqualified',async()=>{const jobs=await source.run(options);assert.equal(jobs.length,7);assert.equal(jobs.filter(j=>!j.location).length,6);assert.equal(jobs.filter(j=>j.country==null).length,6);assert.equal(jobs.find(j=>j.jobId==='600').country,'India');const conflict=jobs.find(j=>j.jobId==='602');assert.equal(conflict.jobDescription,null);assert.equal(conflict.rawNativeRoleEvidence.contentJobTitle,'Case Manager');assert.equal(conflict.rawNativeRoleEvidence.identityQualified,false);assert.match(conflict.rawNativeRoleEvidence.contentHtml,/Case Manager/)})
test('registered decorator retains compact truthful native collection evidence',async()=>{const provider=getScraperCatalog().find(p=>p.source==='credresolve'),jobs=await createCatalogScraper(provider).run(options);const evidence=jobs[0]?.nativeCollectionEvidence;assert.ok(evidence);assert.equal(evidence.source,'credresolve');assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})

test('native city-only and arrangement labels never infer country, duplicate fields and repeated pages fail closed',async()=>{
 const feed=JSON.parse(await read(source.buildSearchUrl(1))),row=structuredClone(feed[0]);row.id=999;row.title.rendered='Another Executive';row.content.rendered=row.content.rendered.replaceAll('Back Office Executive','Another Executive').replace('>In-office</p>','>Bangalore</p>');const job=source.extractSearchResults([row])[0];assert.equal(job.location,'Bangalore');assert.equal(job.country,null)
 assert.throws(()=>source.extractSearchResults([{...row,content:{rendered:row.content.rendered+'<h3>Job Location</h3><p>Berlin, Germany</p>'}}]),/duplicate|ambiguous.*location/i)
 await assert.rejects(source.createCredresolveScraper({pageSize:1}).run({...options,fetchJson:async()=>[row]}),/duplicated|cyclic/)
})

test('a role-owned description naming a different native role remains an explicit binding conflict',async()=>{const jobs=await source.run(options),job=jobs.find(j=>j.jobId==='605');assert.equal(job.jobDescription,null);assert.equal(job.rawNativeRoleEvidence.descriptionIntroRole,'Financial Data Analyst');assert.equal(job.rawNativeRoleEvidence.identityQualified,false);assert.match(job.rawNativeRoleEvidence.contentHtml,/Financial Data Analyst/)})

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
