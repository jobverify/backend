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
test('current advertised role controls and literal descriptions recover all sixteen openings',async()=>{const jobs=await source.run(options);assert.equal(jobs.length,16);assert.equal(jobs.filter(j=>j.location).length,13);assert.ok(jobs.every(j=>j.jobDescription?.length>120));assert.equal(jobs.filter(j=>!j.location).length,3);assert.equal(jobs.find(j=>j.title==='Robotics Team Lead Engineer').location,'Bangalore');assert.equal(jobs.filter(j=>j.country==='India').length,1);assert.equal(jobs.filter(j=>j.country==null).length,15)})
test('registered decorator retains compact truthful native collection evidence',async()=>{const provider=getScraperCatalog().find(p=>p.source==='m2nxt'),jobs=await createCatalogScraper(provider).run(options);const evidence=jobs[0]?.nativeCollectionEvidence;assert.ok(evidence);assert.equal(evidence.source,'m2nxt');assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})

import {advertisedRoleClient,readLiteralRoles,readRoleControls} from './native.js'
test('native literal decoder accepts another role and rejects dynamic, duplicate, hidden and foreign bindings',async()=>{
 const html=await read(source.CAREERS_URL),url=advertisedRoleClient(html),client=await read(url),titles=readRoleControls(html),rows=readLiteralRoles(client,titles)
 assert.equal(rows[1].title,'Robotics Team Lead Engineer');assert.match(rows[1].description,/commissioning/)
 assert.throws(()=>readLiteralRoles(client.replace('Location:"Bangalore"','Location:globalThis.__nativeExecuted=true'),titles),/dynamic/)
 assert.throws(()=>readLiteralRoles(client.replace('title:"Robotics Team Lead Engineer"','title:"Different Role"'),titles),/disagree/)
 await assert.rejects(source.run({...options,fetchText:async u=>u===source.CAREERS_URL?html.replace('We are seeking a skilled Mechanical Design engineer','Contradictory overview from another role'):read(u)}),/description.*contradict/i)
 assert.throws(()=>advertisedRoleClient(html.replace('src="/_next/static/chunks/app/careers/','src="https://other.example/_next/static/chunks/app/careers/')),/foreign|unbound/i)
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
