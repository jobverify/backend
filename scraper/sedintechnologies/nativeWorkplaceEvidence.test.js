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
// This retained 2026-10-31 capture exercises the historical Astro reader.
// The production default now follows the current corporate Zoho handoff;
// currentZoho20261107.test.js verifies that registered path independently.
const legacyRun=options=>source.createSedinTechnologiesScraper().run(options)
test('retained historical active Astro records bind native geography, complete description, status and date to the exact rendered role',async()=>{const jobs=await legacyRun(options);assert.equal(jobs.length,9);assert.ok(jobs.every(j=>j.location&&j.postingDate&&j.jobDescription?.length>250));assert.ok(jobs.every(j=>j.rawNativeJob?.id));const j=jobs.find(j=>j.title==='Inside Sales');assert.equal(j.location,'Chennai City Corporation, India');assert.equal(j.country,'India');assert.equal(j.postingDate,'2026-09-22');assert.match(j.jobDescription,/Participation in hackathons/);assert.equal(j.requisitionId,'ZR_281_JOB')})
test('retained historical reader keeps compact truthful native collection evidence',async()=>{const jobs=await legacyRun(options);const evidence=jobs[0]?.nativeCollectionEvidence;assert.ok(evidence);assert.equal(evidence.source,'sedintechnologies');assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})

test('Astro roles retain all native location scopes and reject hidden, conflicting country, closed, duplicate and mismatched records',async()=>{
 const html=await read(source.CAREERS_URL),mutate=changed=>({...options,fetchText:async()=>changed})
 const jobs=await legacyRun(options);assert.equal(jobs.find(j=>j.title==='Business Analyst').rawNativeLocationEvidence.locationScopes[0],'India - Chennai');assert.equal(jobs.filter(j=>j.nativeActiveStateQualified===false).length,2)
 await assert.rejects(legacyRun(mutate(html.replace('<astro-island uid="2kN4kS"','<astro-island hidden uid="2kN4kS"'))),/inactive|hidden|island/i)
 await assert.rejects(legacyRun(mutate(html.replace('&quot;country&quot;:[0,&quot;India&quot;]','&quot;country&quot;:[0,&quot;Canada&quot;]'))),/country.*contradict/i)
 await assert.rejects(legacyRun(mutate(html.replace('&quot;status&quot;:[0,&quot;In-progress&quot;]','&quot;status&quot;:[0,&quot;Filled&quot;]'))),/closed/)
 await assert.rejects(legacyRun(mutate(html.replace('&quot;id&quot;:[0,&quot;202020000001648140&quot;]','&quot;id&quot;:[0,&quot;202020000001648029&quot;]'))),/duplicate/)
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

test('the legacy card reader cannot revive hidden role carriers or supply title-only descriptions',async()=>{const html=await read(source.CAREERS_URL),hidden=html.replace(/<body\b/i,'<body hidden');assert.notEqual(hidden,html);assert.equal(source.extractJobCards(hidden).length,0)})
