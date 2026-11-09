import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const id='saginfotech',packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
for(const row of packet.requests)assert.equal(createHash('sha256').update(Buffer.from(row.body,row.bodyEncoding)).digest('hex'),row.bodySHA256)
const native=async(callback,change=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||'');const recorded=packet.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unadvertised/unrecorded request '+method+' '+url+' '+body);const row=change({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
const partial=jobs=>{const evidence=readInventoryEvidence(jobs);assert.ok(evidence);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)}

test('captured native saginfotech fields preserve actual role identity and unknown geography',async()=>native(async calls=>{const jobs=await source.run();assert.equal(jobs.length,5);assert.ok(jobs.every(j=>j.country==null&&j.location==null));assert.match(jobs.find(j=>j.title==='Angular Developer').jobDescription,/Proficiency with JavaScript and HTML5/);assert.ok(jobs.every(j=>j.jobDescription?.length>200));assert.deepEqual(jobs.map(j=>j.requisitionId).sort(),['0017','0019','0021','0022','0023']);partial(jobs)}))

test('registered saginfotech result remains partial with unknown authoritative inventory totals',async()=>native(async()=>{const provider=getScraperCatalog().find(row=>row.source===id),jobs=await createCatalogScraper(provider).run();partial(jobs);if(jobs.length){const audit=jobs[0].nativeCollectionEvidence;assert.equal(audit.source,id);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.reportedTotal,null);assert.equal(audit.indiaFacetCount,null)}}))

test('native transport access denial is unavailable with unknown inventory and no retry',async()=>{const original=globalThis.fetch;let calls=0,cancelled=0;globalThis.fetch=async url=>{calls++;return{ok:false,status:403,url:String(url),body:{cancel:async()=>cancelled++}}};try{await assert.rejects(source.run(),error=>error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null&&error.inventoryEvidence?.indiaFacetCount===null);assert.equal(calls,1);assert.equal(cancelled,1)}finally{globalThis.fetch=original}})
test('pre-cancelled native request retains the exact caller reason without requests',async()=>{const original=globalThis.fetch,controller=new AbortController(),reason=new Error('controlled caller cancellation');let calls=0;controller.abort(reason);globalThis.fetch=async()=>{calls++;throw Error('Unexpected native request')};try{await assert.rejects(source.run({signal:controller.signal}),error=>error===reason);assert.equal(calls,0)}finally{globalThis.fetch=original}})

test('registered typed observations preserve source and distinguish records from actual vacancy rows',async()=>native(async()=>{const provider=getScraperCatalog().find(row=>row.source===id),jobs=await createCatalogScraper(provider).run(),audit=readSourceObservationEvidence(jobs,id);assert.ok(audit);assert.equal(audit.source,id);assert.equal(audit.recordKind,"vacancy-rows");assert.equal(audit.observedRecordCount,5);assert.equal(audit.observedVacancyCount,5);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false)}))
