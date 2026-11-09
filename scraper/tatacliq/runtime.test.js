import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const read=name=>{const url=new URL('./fixtures/'+name+'.json',import.meta.url);return JSON.parse(fs.existsSync(url)?fs.readFileSync(url):gunzipSync(fs.readFileSync(new URL(url.href+'.gz'))))}
const captures=[read('official-response'),read('official-client-response'),read('official-cms-bound-response'),...read('native-config-responses'),...read('listing-responses'),...read('detail-responses')]
const exercise=async (change=()=>{},options={})=>{
 const copies=structuredClone(captures);change(copies)
 const calls=[]
 const fetchImpl=async(url,init)=>{calls.push({url,init});const row=copies.find(row=>row.url===url&&(!row.requestBody||row.requestBody===init.body));assert.ok(row,'Unexpected native request '+url+' '+init.body);if(row.requestHeaders)for(const [key,value]of Object.entries(row.requestHeaders))assert.equal(init.headers[key],value);return {status:row.status,url:row.finalUrl,text:async()=>row.body}}
 return {jobs:await run({fetchImpl,now:'2026-10-23T00:00:00.000Z',...options}),calls}
}
test('fresh official client and active CMS bind exact Unistore native API all three pages and25 details',async()=>{
 const {jobs,calls}=await exercise();assert.equal(jobs.length,25);assert.equal(new Set(jobs.map(job=>job.jobId)).size,25)
 assert.ok(jobs.every(job=>job.country==='India'&&job.company==='Tata CLiQ'&&job.originalPublicationDate===null&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.jobDescription&&job.sourceDetailComplete));assert.equal(calls.filter(call=>/\/job\/a[0-9]/.test(call.url)).length,25)
 assert.equal(jobs[0].closingDate,'2026-11-22T18:29:59.000Z')
 const e=readInventoryEvidence(jobs);assert.equal(e.reportedTotal,25);assert.equal(e.indiaFacetCount,25);assert.equal(e.listingComplete,true);assert.equal(e.status,'complete-inventory')
})

test('changed missing or inactive CMS handoff and public client contract fail closed before native enumeration',async()=>{
 for(const mutate of [r=>r.body=r.body.replace('cliqonnect.darwinbox.in','other.darwinbox.in'),r=>r.body=r.body.replace('<a href=', '<a inert href='),r=>r.status=400])await assert.rejects(exercise(rows=>mutate(rows.find(r=>r.url.includes('/custom/careers')))),error=>error.code==='TATACLIQ_COVERAGE_GAP')
 await assert.rejects(exercise(rows=>{const r=rows.find(r=>r.url.includes('/client.'));r.body=r.body.replaceAll('beaute','other')}),error=>error.code==='TATACLIQ_COVERAGE_GAP')
})
test('changed tenant identity count duplicate page or selected detail identity never returns a successful inventory',async()=>{
 for(const change of [rows=>{const r=rows.find(r=>r.url.includes('getCompanyConfig'));r.body=r.body.replace('Tata Unistore Limited','Tata Digital')},rows=>{const r=rows.find(r=>r.requestBody?.includes('"page":2'));r.body=r.body.replace('"job_counts":25','"job_counts":26')},rows=>{const first=rows.find(r=>r.requestBody?.includes('"page":1'));rows.find(r=>r.requestBody?.includes('"page":2')).body=first.body},rows=>{const r=rows.find(r=>/\/job\/a[0-9]/.test(r.url));r.body=r.body.replace('Category Intern - Lifestyle','Other title')}])await assert.rejects(exercise(change),error=>error.code==='TATACLIQ_COVERAGE_GAP')
})
test('missing selected native detail JD preserves otherwise eligible role and partial evidence',async()=>{
 const {jobs}=await exercise(rows=>{const r=rows.find(r=>/\/job\/a[0-9]/.test(r.url));const b=JSON.parse(r.body);b.message.job[0].jd='';r.body=JSON.stringify(b)})
 assert.equal(jobs.length,25);assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('new listing or detail secondary geography downgrades complete inventory and never publishes the conflicted role',async()=>{
 for(const onListing of [true,false]){
 const {jobs}=await exercise(rows=>{const r=rows.find(r=>onListing?r.requestBody?.includes('"page":1'):/\/job\/a[0-9]/.test(r.url));const b=JSON.parse(r.body);const role=onListing?b.data[0]:b.message.job[0];role.secondaryCountry='Canada';r.body=JSON.stringify(b)})
 assert.equal(jobs.length,24);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 }
})

test('response size bound rejects oversized official body before DOM or JSON work',async()=>{
 await assert.rejects(exercise(rows=>{rows[0].body+=' '.repeat(20*1024*1024)}),error=>error.code==='TATACLIQ_COVERAGE_GAP'&&/size|bound|large/i.test(error.message))
})

test('future or expired selected native windows never enter returned jobs while raw total stays25',async()=>{
 for(const from of [1792800000,1792607400]){
 const {jobs}=await exercise(rows=>{const r=rows.find(r=>/\/job\/a[0-9]/.test(r.url));const b=JSON.parse(r.body);b.message.job[0].job_posting.careers={from,to:from===1792800000?1795372199:1792713600};r.body=JSON.stringify(b)})
 assert.equal(jobs.length,24);assert.equal(readInventoryEvidence(jobs).reportedTotal,25)
 }
})


