import test from 'node:test'
import assert from 'node:assert/strict'
import {createIamneoScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {transport} from './native.fixture.js'
const root='https://iamneo.keka.com/careers/'

test('iamneo SSR board recovers all five November 6 explicit India roles with exact full active native criteria',async()=>{const jobs=await createIamneoScraper().run({fetchImpl:transport()});assert.deepEqual(jobs.map(j=>j.jobId),['168836','168590','168513','168214','164804']);assert.equal(readInventoryEvidence(jobs)?.reportedTotal,5);assert.equal(readInventoryEvidence(jobs)?.listingComplete,true);for(const j of jobs){assert.equal(j.sourceDetailComplete,true);assert.equal(j.country,'India');assert.equal(String(j.sourceNativePayload.id),j.jobId)}})
test('iamneo rejects template-only official handoff',async()=>{await assert.rejects(createIamneoScraper().run({fetchImpl:transport((url,body)=>url==='https://iamneo.ai/careers/'?`<template>${body}</template>`:body)}),/active|handoff/i)})
test('iamneo rejects country conflicts without guessing from company headquarters',async()=>{await assert.rejects(createIamneoScraper().run({fetchImpl:transport((url,body)=>url.includes('/active')?body.replace('"countryCode":"IN"','"countryCode":"US"'):body)}),/country|geography/i)})
test('iamneo rejects incomplete criteria hidden in public native details',async()=>{await assert.rejects(createIamneoScraper().run({fetchImpl:transport((url,body)=>url.endsWith('/jobdetails/168836')?body.replace('job-description-container','job-description-container" hidden="hidden'):body)}),/detail|description/i)})
test('iamneo rejects a board replaced during detail traversal',async()=>{await assert.rejects(createIamneoScraper().run({fetchImpl:transport((url,body,n)=>url===`${root}api/jobs/default/active`&&n===2?'[]':body)}),/changed|disagree/i)})
test('iamneo retains four proven roles but loses completeness when secondary geography is unhandled',async()=>{const jobs=await createIamneoScraper().run({fetchImpl:transport((url,body)=>{if(!url.includes('/active'))return body;const raw=JSON.parse(body);raw[0].secondaryLocations=raw[0].jobLocations;raw[0].jobLocations=[{id:999,name:'New York',city:'New York',state:'NY',countryCode:'US',countryName:'United States'}];return JSON.stringify(raw)})});assert.equal(jobs.length,4);assert.equal(readInventoryEvidence(jobs)?.listingComplete,false);assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount,null);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(jobs[0].sourceNativeUnresolvedPayloads[0].id,168836)})
test('iamneo cannot claim source completeness after an additional ATS appears under neutral link text',async()=>{const jobs=await createIamneoScraper().run({fetchImpl:transport((url,body)=>url==='https://iamneo.ai/careers/'?body+'<a href="https://jobs.ashbyhq.com/iamneo">Opportunities</a>':body)});assert.equal(jobs.length,5);assert.equal(readInventoryEvidence(jobs)?.listingComplete,false);assert.equal(readInventoryEvidence(jobs)?.reportedTotal,null)})
test('iamneo preserves known roles but loses completeness after fetched legacy renderer content changes',async()=>{const jobs=await createIamneoScraper().run({fetchImpl:transport((url,body)=>url==='https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js'?body+`;document.body.insertAdjacentHTML('beforeend','<a href="https://jobs.ashbyhq.com/iamneo">More roles</a>');`:body)});assert.equal(jobs.length,5);assert.equal(readInventoryEvidence(jobs)?.listingComplete,false);assert.equal(readInventoryEvidence(jobs)?.reportedTotal,null);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.match(readInventoryEvidence(jobs)?.reason,/renderer/)})


test('iamneo November 6 profile rejects any unreviewed corporate script version',async()=>{
 const jobs=await createIamneoScraper().run({fetchImpl:transport((url,body)=>url==='https://iamneo.ai/careers/'?body.replaceAll('ver=4.3.6','ver=4.3.7'):body)})
 assert.equal(jobs.length,5)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.match(readInventoryEvidence(jobs).reason,/changed-active-(?:scripts|activeElementAttributesSha256)/)
 assert.ok(jobs.every(job=>job.lifecycleCleanupAllowed===false))
})
test('iamneo November 6 profile preserves known roles but rejects an added recruiting script',async()=>{
 const jobs=await createIamneoScraper().run({fetchImpl:transport((url,body)=>url==='https://iamneo.ai/careers/'?body+'<script src="https://iamneo.ai/other-recruiting.js"></script>':body)})
 assert.equal(jobs.length,5)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(job=>job.lifecycleCleanupAllowed===false))
})
test('iamneo November 6 native transport honors exact caller cancellation before any request',async()=>{
 const reason=new Error('caller cancelled native capture'),controller=new AbortController();controller.abort(reason)
 let calls=0
 await assert.rejects(createIamneoScraper().run({signal:controller.signal,fetchImpl:async()=>{calls++;throw Error('unexpected request')}}),error=>error===reason)
 assert.equal(calls,0)
})
