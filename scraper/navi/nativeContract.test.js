import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {TURBOHIRE_CURRENT_PUBLIC_CLIENT} from '../../scraper-support/utils/turboHirePublicClient.js'
import {validateNativeInventory,validateNativeDetail,nativeLocationScope} from './nativeContract.js'
import {run,CAREERS_PAGE_URL,NOAUTH_TOKEN_URL,FILTERED_JOBS_URL,hasOfficialBoardSignal,extractTurboHireHandoffUrl} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261020.json',import.meta.url)))
const now='2026-10-20T23:00:00.000Z'
const first=fixture.listing.Result[0]
const sdk=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/turbohire-stage2-public-client.json.gz',import.meta.url))))
const syntheticCurrentBoard=fixture.boardHtml.replace(/\/main\.[a-f0-9]+\.chunk\.js/g,TURBOHIRE_CURRENT_PUBLIC_CLIENT.path)
test('actual full inventory reconciles38 identities and explicit India addresses',()=>assert.equal(validateNativeInventory(fixture.listing,{now}).rows.length,38))
test('native detail supplies full5169-character JD, never500-character listing teaser',()=>{
 const d=validateNativeDetail(fixture.details[first.JobId],first,{now});assert.ok(d.jobDescription.length>4000);assert.equal(d.sourceDetailComplete,true)
})
test('explicit empty attachment field is absent without changing full native content',()=>{const d=structuredClone(fixture.details[first.JobId]);d.JobDescriptionBlobUrl='';assert.equal(validateNativeDetail(d,first,{now}).sourceDetailComplete,true)})
for(const [name,mutate]of[
 ['wrong total',p=>p.Total++],['duplicate ID',p=>{p.Result[1].JobId=p.Result[0].JobId}],
 ['equivalent encoded apply IDs',p=>{p.Result[1].JobIdObfuscated=p.Result[0].JobIdObfuscated.replace(/%2F/g,'%2f')}],
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
test('NA and Attached native detail remain missing, with attachment retained as evidence',()=>{
 for(const d of Object.values(fixture.details).filter(d=>d.JobId!==first.JobId)){const row=fixture.listing.Result.find(r=>r.JobId===d.JobId),job=validateNativeDetail(d,row,{now});assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailComplete,false)}
})
test('inactive markup cannot fill native JD',()=>{
 for(const tag of ['script','template','textarea','iframe','xmp']){const d=structuredClone(fixture.details[first.JobId]);d.JobDescriptionV2=`<${tag}>${'Fake job text '.repeat(60)}</${tag}>`;assert.equal(validateNativeDetail(d,first,{now}).sourceDetailComplete,false)}
})
test('mixed explicit native countries retain India secondary without inventing geography',()=>{
 const s=nativeLocationScope('[{"Address":"London, United Kingdom"},{"Address":"Bengaluru, Karnataka, India"}]');assert.equal(s.indiaLocations.length,1);assert.equal(s.locations.length,2)
})
const callbacks=()=>({now:()=>now,requestIntervalMs:0,fetchPage:async url=>({status:200,url,html:url.endsWith(TURBOHIRE_CURRENT_PUBLIC_CLIENT.path)?sdk.text:url===CAREERS_PAGE_URL?fixture.officialHtml:syntheticCurrentBoard}),fetchJson:async url=>{
 if(url===NOAUTH_TOKEN_URL)return{access_token:'fixture-public-anonymous-token'}
 if(url===FILTERED_JOBS_URL)return{Total:1,Result:[first]}
 return fixture.details[first.JobId]
}})
test('full run verifies detail and final inventory without asserting company completeness',async()=>{const jobs=await run({...callbacks(),requestIntervalMs:0});assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].nativeRoleClosingReconciled,true);assert.equal(readInventoryEvidence(jobs).reportedTotal,1);assert.ok(jobs[0].jobDescription.length>4000)})
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
 const c=callbacks(),base=c.fetchJson
 c.fetchJson=async url=>{const value=structuredClone(await base(url));if(url.includes('/api/publicjobs?'))value.JobDescriptionV2='<p>NA</p>';return value}
 const jobs=await run({...c,requestIntervalMs:0});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(readInventoryEvidence(jobs).reason,/missing-content/)
})
test('changed final native snapshot cannot certify completion',async()=>{
 const c=callbacks(),base=c.fetchJson;let count=0
 c.fetchJson=async url=>{const value=structuredClone(await base(url));if(url===FILTERED_JOBS_URL&&++count===2)value.Result[0].JobTitle='Changed title';return value}
 await assert.rejects(run(c),/changed/)
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
