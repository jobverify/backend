import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const origin='https://careers-asia.forvismazars.com',board=origin+'/wp-json/wp/v2/job-offer?per_page=100&page=1&_envelope=1',role=origin+'/job-offer/ai-developer-assistant-manager/'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz',import.meta.url))))
function mock(mutate=r=>r){const requests=[],index=new Map(),calls=new Map();for(const r of fixture().requests)index.set(r.url,[...(index.get(r.url)||[]),r]);return{requests,transport:async url=>{requests.push(url);const rows=index.get(url);assert.ok(rows,'Unexpected fixture request: '+url);const i=calls.get(url)||0;calls.set(url,i+1);const r=rows[Math.min(i,rows.length-1)];return mutate({...r,body:Buffer.from(r.rawBodyBase64,'base64')},requests)}}}
const text=(r,fn)=>({...r,body:Buffer.from(fn(r.body.toString('utf8')))})
const json=(r,fn)=>text(r,t=>JSON.stringify(fn(JSON.parse(t))))
test('selected Forvis Mazars executable replaces sentinel with44India roles from270native regional ads',async()=>{
 const m=mock(),jobs=await run({transport:m.transport});assert.equal(jobs.length,44)
 const n=jobs[0].nativeCollectionEvidence;assert.equal(n.observedListingCount,270);assert.equal(n.nativeReportedTotal,270);assert.equal(n.pagesFetched,3);assert.equal(n.candidateDetails,44);assert.equal(n.failures.length,38);assert.ok(n.failures.every(f=>f.stage==='native-listing-row'));assert.equal(n.listingPaginationComplete,false);assert.equal(n.closingInventoryMatches,true);assert.equal(m.requests.length,52)
 const first=jobs.find(j=>j.jobId==='18451');assert.ok(first);assert.equal(first.title,'AI Developer (Assistant Manager)');assert.equal(first.city,'Pune');assert.equal(first.country,'India');assert.equal(first.postingDate,'2026-10-21T07:38:43Z');assert.equal(first.nativeWordPressDateGMT,'2026-10-21T07:38:43');assert.equal(first.requisitionId,null);assert.equal(first.applyUrl,role);assert.equal(first.applicationLinkSource,'native-role-inline-application-entry');assert.equal(first.firstEverPublication,null)
 assert.ok(jobs.every(j=>j.source==='forvismazars'&&j.country==='India'&&j.requisitionId===null&&j.sourceDetailComplete&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false));assert.equal(readInventoryEvidence(jobs).reportedTotal,270);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(m.requests.every(u=>!u.includes('/apply')&&!u.includes('job-alert')&&!u.includes('contact-form')&&!u.includes('/login')))
})
test('regional India landing page is never treated as the country-filtered listing',async()=>{
 const m=mock(),jobs=await run({transport:m.transport});assert.equal(jobs.length,44);assert.ok(!jobs.some(j=>j.title==='Admin Assistant, Corporate Secretarial'));assert.ok(jobs.every(j=>j.nativeLocationTerms.every(t=>t.name.endsWith(', India'))))
})
test('later pagination failure retains positive validated India subset and forbids cleanup',async()=>{
 const m=mock(r=>new URL(r.url).searchParams.get('page')==='2'?{...r,status:503}:r);const jobs=await run({transport:m.transport});assert.ok(jobs.length>0&&jobs.length<44);assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('upstream failures and unproven empty arrays cannot establish zero inventory',async()=>{
 for(const kind of['HTTP','body','total']){const m=mock(r=>r.url===board?(kind==='HTTP'?{...r,status:503}:json(r,p=>({...p,body:kind==='body'?[]:p.body,headers:kind==='total'?{...p.headers,'X-WP-Total':0}:p.headers}))):r);await assert.rejects(run({transport:m.transport}),e=>{assert.equal(e.nativeEvidence.verifiedZeroInventory,false);assert.equal(e.nativeEvidence.cleanupAllowed,false);return true},kind)}
})
test('a complete empty native regional collection still leaves whole-company zero inventory unverified',async()=>{
 const m=mock(r=>r.url===board?json(r,p=>({...p,body:[],headers:{Allow:'GET','X-WP-Total':0,'X-WP-TotalPages':0}})):r),jobs=await run({transport:m.transport});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs[Symbol.for('jobverify.native-html-evidence')].verifiedZeroInventory,false)
})
test('a foreign secondary taxonomy location cannot be published under the visible India primary',async()=>{
 const m=mock(r=>r.url.includes('/wp/v2/job-offer?')?json(r,p=>({...p,body:p.body.map(row=>row.id===18451?{...row,location:[143,130]}:row)})):r),jobs=await run({transport:m.transport});assert.equal(jobs.length,43);assert.ok(!jobs.some(j=>j.jobId==='18451'));assert.ok(jobs[0].nativeCollectionEvidence.failures.some(f=>/Mixed-country/.test(f.message)))
})
test('missing descriptions,foreign location,wrong public ID,title,date and apply button stay explicit detail failures',async()=>{
 for(const kind of['description','location','id','title','date','button','HTTP']){const m=mock(r=>r.url!==role?r:kind==='HTTP'?{...r,status:503}:text(r,h=>{
  if(kind==='description')return h.replace(/(<div class="job-offer-content__content pt-lg">)[\s\S]*?(<\/div>)/,'$1$2')
  if(kind==='location')return h.replaceAll('Pune (Delivery Platform), India','Singapore, Singapore')
  if(kind==='id')return h.replaceAll('data-job-id="18451"','data-job-id="99999"')
  if(kind==='title')return h.replace('AI Developer (Assistant Manager)</h1>','Foreign Role</h1>')
  if(kind==='date')return h.replaceAll('2026-10-21T07:38:43+00:00','2099-10-21T07:38:43+00:00')
  return h.replaceAll('data-apply-button','data-disabled-entry')
 }));const jobs=await run({transport:m.transport});assert.equal(jobs.length,43,kind);assert.ok(!jobs.some(j=>j.jobId==='18451'));assert.equal(jobs[0].nativeCollectionEvidence.failures.filter(f=>f.stage==='native-detail').length,1,kind)}
})
test('closing inventory drift and broken official handoff remain visible evidence gaps',async()=>{
 const m=mock((r,calls)=>r.url===board&&calls.filter(x=>x===board).length===2?json(r,p=>({...p,headers:{...p.headers,'X-WP-Total':271}})):r);const jobs=await run({transport:m.transport});assert.equal(jobs.length,44);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)
 const bad=mock(r=>r.url==='https://careers.forvismazars.com/'?text(r,h=>h.replaceAll(origin+'/countries/india/','https://foreign.example.test/india/')):r);await assert.rejects(run({transport:bad.transport}),/incomplete|forbidden/i)
})
