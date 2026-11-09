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
test('current unspecified DRA workplaces remain unknown and Head Office never adopts a corporate city or country',async()=>{const jobs=await source.run(options);assert.equal(jobs.length,15);assert.equal(jobs.filter(j=>!j.location).length,8);assert.ok(jobs.every(j=>j.country==null));assert.equal(jobs.find(j=>j.location==='Head Office').city,null);assert.equal(jobs.filter(j=>!j.jobDescription).length,3)})
test('registered decorator retains compact truthful native collection evidence',async()=>{const provider=getScraperCatalog().find(p=>p.source==='dineshchandraragrawalinfracon'),jobs=await createCatalogScraper(provider).run(options);const evidence=jobs[0]?.nativeCollectionEvidence;assert.ok(evidence);assert.equal(evidence.source,'dineshchandraragrawalinfracon');assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})

test('inactive native position labels cannot borrow descriptions or satisfy form inventory binding',async()=>{
 const html=await read(source.CAREERS_URL);assert.throws(()=>source.extractPublicListings(html.replace('<p><strong>Position:</strong> Project Manager','<p hidden><strong>Position:</strong> Project Manager')),/verified|inactive|binding/i)
 assert.throws(()=>source.extractPublicListings(html.replace('<select','<select hidden')),/verified|inactive|binding/i)
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

test('duplicated native titles and matching duplicate form options do not invent separate requisitions',async()=>{const html=await read(source.CAREERS_URL);assert.throws(()=>source.extractPublicListings(html.replaceAll('Purchase Executive','Project Manager')),/duplicate|identity/)})

test('observed native titles and URL slugs do not manufacture employer requisition identifiers',async()=>{const jobs=await source.run(options);assert.ok(jobs.every(j=>j.requisitionId==null))})

test('HTTP200 access denial is unavailable with unknown inventory rather than a successful empty result or retryable parser drift',async()=>{const publicFetch=globalThis.fetch;let calls=0;try{globalThis.fetch=async url=>{calls++;return {ok:true,status:200,url:String(url),text:async()=>'<html><title>Access Denied</title><body>Access to this resource is denied.</body></html>'}};await assert.rejects(source.run(),error=>error.code==='access_denied'&&error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null);assert.equal(calls,1)}finally{globalThis.fetch=publicFetch}})

test('native project qualifiers stay as workplace evidence without becoming a state',async()=>{const jobs=await source.run(options),job=jobs.find(j=>j.title==='Interface / MEP Manager');assert.equal(job.location,'Ahmedabad - Metro Project');assert.equal(job.city,'Ahmedabad');assert.equal(job.state,null);assert.equal(job.rawNativeRoleEvidence.locationField,'Ahmedabad - Metro Project')})
