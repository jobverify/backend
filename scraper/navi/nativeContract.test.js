import test from 'node:test'
import assert from 'node:assert/strict'
import {validateNativeInventory,validateNativeDetail,nativeLocationScope} from './nativeContract.js'
import {run,FILTERED_JOBS_URL,hasOfficialBoardSignal,extractTurboHireHandoffUrl} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {fixture as capture,listing,details,board,corporate,textOf,fixtureReplay} from './test-data/currentResponseFixture.js'
// The historical native-20261020.json is absent in the supplied tree (pre-edit
// ENOENT retained in repair evidence). Replay genuine current originals rather
// than inventing the missing historical roles or HTTP metadata.
const fixture={listing,details,boardHtml:textOf(board),officialHtml:textOf(corporate)}
const now=capture.now
const first=listing.Result[1]
test('actual full inventory reconciles44 identities and explicit India addresses',()=>assert.equal(validateNativeInventory(fixture.listing,{now}).rows.length,44))
test('native detail supplies full3602-character criteria from13716-character HTML, never500-character listing teaser',()=>{
 const d=validateNativeDetail(fixture.details[first.JobId],first,{now});assert.equal(d.jobDescription.length,3602);assert.equal(fixture.details[first.JobId].JobDescriptionV2.length,13716);assert.equal(d.sourceDetailComplete,true)
})
test('explicit empty attachment field is absent without changing full native content',()=>{const d=structuredClone(fixture.details[first.JobId]);d.JobDescriptionBlobUrl='';assert.equal(validateNativeDetail(d,first,{now}).sourceDetailComplete,true)})
for(const [name,mutate]of[
 ['wrong total',p=>p.Total++],['duplicate ID',p=>{p.Result[1].JobId=p.Result[0].JobId}],
 ['equivalent encoded apply IDs',p=>{p.Result[0].JobIdObfuscated=p.Result[1].JobIdObfuscated.replace(/%2F/g,'%2f')}],
 ['wrong employer',p=>{p.Result[0].OrgDetails.OrgID='other'}],['array identity',p=>{p.Result[0].JobId=[p.Result[0].JobId]}],
 ['unknown remote',p=>{p.Result[0].Location=JSON.stringify([{Address:'Remote'}])}],
 ['foreign typed country',p=>{p.Result[0].Location=JSON.stringify([{Address:'Bengaluru, Karnataka, India',Country:'United States'}])}],
 ['city conflict',p=>{p.Result[0].Location=JSON.stringify([{Address:'Bengaluru, Karnataka, India',City:'Seattle'}])}],
 ['country array',p=>{p.Result[0].Location=JSON.stringify([{Address:'Bengaluru, Karnataka, India',Country:['India']}])}],
 ['bad secondary',p=>{p.Result[0].Location=JSON.stringify([{Address:'Bengaluru, Karnataka, India'},{Address:'Global Remote'}])}],
 ['impossible date',p=>{p.Result[0].PublishedDate='2026-02-30T12:00:00Z'}],['future date',p=>{p.Result[0].PublishedDate='2099-01-01T00:00:00Z'}],
 ['HTTP200 error',p=>{p.Error='Server error'}],
 ['HTTP200 lowercase failure',p=>{p.success=false}],['HTTP200 statusCode failure',p=>{p.statusCode=500}],['array total',p=>{p.Total=[38]}],
])test(`rejects ${name}`,()=>{const p=structuredClone(fixture.listing);mutate(p);assert.throws(()=>validateNativeInventory(p,{now}))})
for(const [name,mutate]of[
 ['wrong title',d=>{d.JobTitle='Other'}],['wrong public ID',d=>{d.JobIdObfuscated='x'.repeat(64)}],['private role',d=>{d.IsPublic=false}],['draft',d=>{d.IsDraft=true}],['not on careerpage',d=>{d.PublishedJobBoards=['REFERRALJOBSPAGE']}],['wrong location',d=>{d.Location='[{"Address":"Delhi, India"}]'}],
])test(`detail rejects ${name}`,()=>{const d=structuredClone(fixture.details[first.JobId]);mutate(d);assert.throws(()=>validateNativeDetail(d,first,{now}))})
test('NA and Attached mutations of actual PDF-linked detail remain missing with unread attachment retained',()=>{
 const row=fixture.listing.Result[0]
 for(const value of ['<p>NA</p>','<p>Attached</p>']){const d=structuredClone(fixture.details[row.JobId]);d.JobDescriptionV2=value;const job=validateNativeDetail(d,row,{now});assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDescriptionAttachment,d.JobDescriptionBlobUrl)}
})
test('inactive markup cannot fill native JD',()=>{
 for(const tag of ['script','template','textarea','iframe','xmp']){const d=structuredClone(fixture.details[first.JobId]);d.JobDescriptionV2=`<${tag}>${'Fake job text '.repeat(60)}</${tag}>`;assert.equal(validateNativeDetail(d,first,{now}).sourceDetailComplete,false)}
})
test('mixed explicit native countries retain India secondary without inventing geography',()=>{
 const s=nativeLocationScope('[{"Address":"London, United Kingdom"},{"Address":"Bengaluru, Karnataka, India"}]');assert.equal(s.indiaLocations.length,1);assert.equal(s.locations.length,2)
})
const callbacks=()=>fixtureReplay().options
test('full run verifies selected genuine details and final44-row inventory without asserting company completeness',async()=>{const jobs=await run(callbacks());assert.equal(jobs.length,2);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].nativeRoleClosingReconciled,true);assert.equal(readInventoryEvidence(jobs).reportedTotal,44);assert.equal(jobs[0].jobDescription.length,3602)})
test('zero cap cannot authorize cleanup',async()=>{const jobs=await run({...callbacks(),maxJobs:0});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('caller abort settles injected hanging transport',async()=>{const c=new AbortController(),p=run({...callbacks(),signal:c.signal,fetchPage:()=>new Promise(()=>{})});c.abort();await assert.rejects(p)})
test('inactive board branding and corporate handoffs cannot establish identity',()=>{
 assert.equal(hasOfficialBoardSignal(`<template>${fixture.boardHtml}</template>`),false)
 assert.equal(hasOfficialBoardSignal(`<!--${fixture.boardHtml}-->`),false)
 assert.equal(extractTurboHireHandoffUrl(`<template>${fixture.officialHtml}</template>`),null)
})
test('native calendar-only closing date never becomes an exact invented UTC expiry',()=>{
 const d=structuredClone(fixture.details[first.JobId]);d.ExpiryDates.CAREERPAGE='2026-10-31T00:00:00'
 const job=validateNativeDetail(d,first,{now});assert.equal(job.closingDate,'2026-10-31');assert.equal(job.sourceClosingDateIsExact,false);assert.equal(job.sourceNativeClosingDate,'2026-10-31T00:00:00')
})
test('missing full native description remains unresolved with explicit diagnostics',async()=>{
 const replay=fixtureReplay((packet,body)=>{if(!packet.url.includes('/api/publicjobs/'))return body;const value=JSON.parse(body);value.JobDescriptionV2='<p>NA</p>';return Buffer.from(JSON.stringify(value))})
 const jobs=await run(replay.options);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(readInventoryEvidence(jobs).reason,/missing-content/)
})
test('changed final native snapshot cannot certify completion',async()=>{
 const replay=fixtureReplay((packet,body,sequence)=>{if(packet.url!==FILTERED_JOBS_URL||sequence!==2)return body;const value=JSON.parse(body);value.Result[0].JobTitle='Changed title';return Buffer.from(JSON.stringify(value))})
 await assert.rejects(run(replay.options),/changed/)
})
for(const address of ['New York, United States, India','Paris, FR, India','Bengaluru, India, United States'])test(`contradictory country segments reject: ${address}`,()=>{
 assert.throws(()=>nativeLocationScope(JSON.stringify([{Address:address}])),/country/i)
})
for(const content of ['<div hidden>Build and maintain our production software systems.</div>','<div style="display:none">Build and maintain our production software systems.</div>','<div style="DISPLAY: none !important"><p>Build and maintain systems.</p></div>','<div aria-hidden="true">Build and maintain systems.</div>','<p>See attachment</p>','<p>JD attached</p>','<p>Job Description</p>'])test(`hidden or placeholder-only native content is incomplete: ${content}`,()=>{
 const d=structuredClone(fixture.details[first.JobId]);d.JobDescriptionV2=content;d.RolesAndResponsibilitiesV2=null;d.EligibilityV2=null
 const result=validateNativeDetail(d,first,{now});assert.equal(result.jobDescription,null);assert.equal(result.sourceDetailComplete,false)
})
test('visible full role text survives a hidden sibling and a description heading',()=>{
 const d=structuredClone(fixture.details[first.JobId]);d.JobDescriptionV2='<div hidden>Hidden non-role text</div><h2>Job Description</h2><p>Build and maintain production systems.</p>'
 assert.equal(validateNativeDetail(d,first,{now}).jobDescription,'Job Description Build and maintain production systems.')
})
