import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const origin='https://jobs.arcadis.com',search=origin+'/api/pcsx/search?domain=arcadis.com&query=&location=&start=0&num=10'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz',import.meta.url))))
function mock(mutate=r=>r){const requests=[],index=new Map(),calls=new Map();for(const r of fixture().requests)index.set(r.url,[...(index.get(r.url)||[]),r]);return{requests,transport:async url=>{requests.push(url);const rows=index.get(url);assert.ok(rows,'Unexpected fixture request: '+url);const i=calls.get(url)||0;calls.set(url,i+1);const r=rows[Math.min(i,rows.length-1)];return mutate({...r,body:Buffer.from(r.rawBodyBase64,'base64')},requests)}}}
const alter=(r,fn)=>{const p=JSON.parse(r.body);fn(p);return{...r,body:Buffer.from(JSON.stringify(p))}}
test('Arcadis selected executable replaces sentinel with complete1301global rows and validated India details',async()=>{
 const m=mock(),jobs=await run({transport:m.transport});assert.equal(jobs.length,70)
 const n=jobs[0].nativeCollectionEvidence;assert.equal(n.observedListingCount,1301);assert.equal(n.nativeReportedTotal,1301);assert.equal(n.pagesFetched,131);assert.equal(n.candidateDetails,70);assert.equal(n.failures.length,0);assert.equal(n.listingPaginationComplete,true);assert.equal(n.closingInventoryMatches,true);assert.equal(m.requests.length,204)
 assert.ok(m.requests.every(u=>!u.startsWith('https://ebcs.')&&!u.includes('/login')&&!u.includes('/careers/join')&&!u.includes('/applications')))
 for(const j of jobs){assert.equal(j.source,'arcadis');assert.equal(j.company,'Arcadis');assert.equal(j.country,'India');assert.equal(j.sourceDescription,j.nativeFacts.nativeDetail.jobDescription);assert.equal(j.sourceUrl,origin+'/careers/job/'+j.jobId);assert.equal(new URL(j.applyUrl).hostname,'ebcs.fa.em2.oraclecloud.com');assert.equal(new URL(j.applyUrl).pathname,'/hcmUI/CandidateExperience/en/sites/CX_1/job/'+j.requisitionId);assert.equal(j.postingDate,new Date(j.nativePostedTs*1000).toISOString());assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.firstEverPublication,null)}
 assert.equal(readInventoryEvidence(jobs).reportedTotal,1301);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('later page failure preserves positive India subset and explicit incomplete pagination',async()=>{
 const m=mock(r=>new URL(r.url).searchParams.get('start')==='10'?{...r,status:503}:r),jobs=await run({transport:m.transport});assert.ok(jobs.length>0&&jobs.length<70);assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('upstream errors,filtered or truncated first pages cannot establish zero inventory',async()=>{
 for(const kind of['HTTP','error','filtered','truncated','duplicate']){const m=mock(r=>r.url===search?(kind==='HTTP'?{...r,status:503}:alter(r,p=>{if(kind==='error')p.error.message='Unavailable';if(kind==='filtered')p.data.appliedFilters={country:['US']};if(kind==='truncated')p.data.positions.pop();if(kind==='duplicate')p.data.positions[1]=p.data.positions[0]})):r);await assert.rejects(run({transport:m.transport}),e=>{assert.equal(e.nativeEvidence.verifiedZeroInventory,false);assert.equal(e.nativeEvidence.cleanupAllowed,false);return true},kind)}
})
test('missing descriptions,wrong countries,requisitions,applications and future dates remain detail failures',async()=>{
 const packet=fixture().requests.find(r=>r.url.includes('/position_details?')),id=new URL(packet.url).searchParams.get('position_id')
 for(const kind of['description','country','requisition','application','date','external-date','HTTP']){const m=mock(r=>r.url===packet.url?(kind==='HTTP'?{...r,status:503}:alter(r,p=>{if(kind==='description')p.data.jobDescription='';if(kind==='country')p.data.standardizedLocations=p.data.locations.map(()=> 'US');if(kind==='requisition')p.data.displayJobId='999999';if(kind==='application')p.data.positionUserActions.applyAction={status:'closed'};if(kind==='date')p.data.postedTs=9999999999;if(kind==='external-date')p.data.efcustomTextExternallyPostedDate=['2026-02-31']})):r),jobs=await run({transport:m.transport});assert.equal(jobs.length,69,kind);assert.ok(!jobs.some(j=>j.jobId===id));assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1,kind)}
})
test('country-only India labels retain unknown city and exact source location evidence',async()=>{
 const m=mock(),jobs=await run({transport:m.transport}),rows=jobs.filter(j=>j.locations.length===1&&j.locations[0]==='India');assert.ok(rows.length>0);assert.ok(rows.every(j=>j.city===null&&j.location==='India'));assert.ok(rows.every(j=>j.nativeStandardizedLocations.includes('IN')));const regionOnly=jobs.filter(j=>j.locations.includes('Karnataka, India'));assert.equal(regionOnly.length,1);assert.ok(regionOnly.every(j=>j.city===null));assert.equal(regionOnly[0].nativeFacts.indiaLocations.find(l=>l.location==='Karnataka, India').city,null)
})
test('foreign native alphanumeric requisitions remain valid global records without blocking later India pages',async()=>{
 const m=mock(),jobs=await run({transport:m.transport}),rows=jobs[0].nativeCollectionEvidence.listingRecords;assert.equal(rows.find(r=>r.id==='563671532883870').rawNative.displayJobId,'REF15562C');assert.equal(rows.find(r=>r.id==='563671532255945').rawNative.displayJobId,'REF15561S');assert.equal(jobs.length,70);assert.ok(!jobs.some(j=>['563671532883870','563671532255945'].includes(j.jobId)))
})
test('closing inventory drift and foreign corporate handoff remain explicit gaps',async()=>{
 const m=mock((r,requests)=>r.url===search&&requests.filter(u=>u===search).length===2?alter(r,p=>{p.data.count++}):r),jobs=await run({transport:m.transport});assert.equal(jobs.length,70);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)
 const bad=mock(r=>r.url==='https://careers.arcadis.com/locations/in/'?{...r,body:Buffer.from('<html>Unavailable</html>')}:r);await assert.rejects(run({transport:bad.transport}),/incomplete|forbidden/i)
})
test('native complete empty global inventory remains an unverified whole-employer zero',async()=>{
 const m=mock(r=>r.url===search?alter(r,p=>{p.data.count=0;p.data.positions=[]}):r),jobs=await run({transport:m.transport});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs[Symbol.for('jobverify.native-html-evidence')].verifiedZeroInventory,false)
})
