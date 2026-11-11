import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractIndiaJobsFromCurrentOpeningsPayload,run,hasOfficialCareersSignal} from './script.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {enrichJobsWithPublicExperience} from '../../scraper-support/utils/publicExperienceEnrichment.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/fields-20261111.json.gz',import.meta.url))))
// Explicitly synthetic field models: these are not observed native API rows.
const model=(extra={})=>({id:'synthetic-record-1',job_title:'Synthetic Software Engineer',department:'Synthetic Department',location:'Mumbai',job_status:true,apply_now_link:'https://rebithr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/synthetic123',job_experience:null,created_on:'30 October 2026',job_desc:null,...extra})
const map=record=>extractIndiaJobsFromCurrentOpeningsPayload([record],{scrapedAt:'2026-11-11T00:00:00.000Z'})[0]
for(const location of ['Mumbai','Delhi','Navi Mumbai','Pune','Remote','IN','CA','constructor','Unknown Office','Mumbai / Delhi',null])test('synthetic unknown/city location remains raw and unresolved through real country consumers: '+location,()=>{
 const row=map(model({location}));assert.equal(row.location,location);assert.equal(row.city,null);assert.equal(row.state,null);assert.equal(row.country,null);assert.equal(row.sourceCountryScopeUnresolved,true)
 const normalized=normalizeScrapedJob(row,{country:'India',locationCountry:'India'});assert.equal(normalized.country,null);assert.equal(analyzePublishableJobs([normalized]).indiaJobs.length,0)
})
for(const location of ['Country: US, India','Mumbai, Country code: CA, India','Country: ZZ, India','Mumbai, India, Country: US','Mumbai, India (Country: ZZ)','Mumbai, India / Toronto, Canada','Mumbai, India / Remote'])test('synthetic explicit typed/foreign/partial own-country conflicts cannot be overridden by India: '+location,()=>{
 const row=map(model({location}));assert.equal(row.country,null);assert.equal(row.sourceCountryScopeUnresolved,true);assert.equal(row.location,location);assert.equal(normalizeScrapedJob(row).country,null);assert.equal(analyzePublishableJobs([row]).indiaJobs.length,0)
})
for(const location of ['Mumbai, India','Mumbai (India)','Mumbai - India','Country: India','Country code: IN','Mumbai, Country code: IN, India','Mumbai, India / Pune, Country: IN'])test('synthetic explicit consistent own written/typed country grammar can preserve India: '+location,()=>{const row=map(model({location}));assert.equal(row.location,location);assert.equal(row.country,'India');assert.equal(row.sourceCountryScopeUnresolved,false);assert.equal(row.jobDescription,null)})
for(const country of ['US','CA','ZZ'])test('synthetic separate explicit own-country field contradicts written India without city guessing: '+country,()=>{const row=map(model({location:'Mumbai, India',country}));assert.equal(row.country,null);assert.equal(row.sourceCountryScopeUnresolved,true);assert.equal(normalizeScrapedJob(row).country,null)})
test('synthetic unknown-country observation does not discard neighboring candidate rows',()=>{const rows=[model(),model({id:'synthetic-2',location:'Remote'}),model({id:'synthetic-3',location:'Toronto, Canada'})],jobs=extractIndiaJobsFromCurrentOpeningsPayload(rows);assert.equal(jobs.length,3);assert.deepEqual(jobs.map(j=>j.jobId),rows.map(j=>j.id));assert.equal(jobs[2].country,'Canada')})
test('synthetic API internal record identity never becomes a formal requisition and all raw fields remain separate',()=>{
 const original=model({extra_unreviewed:{flag:true},job_desc:'Synthetic unqualified native description'}),row=map(original)
 assert.equal(row.jobId,original.id);assert.equal(row.requisitionId,null);assert.equal(row.nativeJobId,null);assert.equal(row.nativeRequisitionId,null);assert.deepEqual(row.sourceNativeAPIRecord,original);assert.equal(row.sourceRecordKind,'api-role-observation');assert.equal(row.nativeLegalEmployer,null)
})
for(const [created,expected] of [['30 October 2026','2026-10-30'],['29 February 2024','2024-02-29'],['29 February 2025',null],['31 November 2026',null],['0 October 2026',null],['32 January 2026',null],['99 Unknown 2026',null]])test('synthetic API creation date is a strict calendar observation, never an employer publication: '+created,()=>{
 const row=map(model({created_on:created}));assert.equal(row.postingDate,null);assert.equal(row.sourceNativeCreatedOn,created);assert.equal(row.sourceNativeCreatedDate,expected);assert.equal(row.sourceNativeCreatedDateKind,'api-record-creation-not-employer-publication')
})
test('synthetic explicit alternate date/mode fields remain raw until their native meaning is proven',()=>{const row=map(model({publication_date:'2026-11-01',remote_status:'On-site',work_mode:'Remote'}));assert.equal(row.postingDate,null);assert.equal(row.remoteStatus,null);assert.equal(row.sourceNativeAPIRecord.work_mode,'Remote')})
test('synthetic unqualified API descriptions/summary cannot become complete own criteria',()=>{
 const raw='Synthetic role. Responsibilities: Design robust systems. Qualifications: Engineering experience. '.repeat(10),row=map(model({job_desc:raw}));assert.equal(row.jobDescription,null);assert.equal(row.sourceDescription,null);assert.equal(row.sourceDetailComplete,false);assert.equal(row.sourceNativeAPIRecord.job_desc,raw);assert.equal(row.skipPublicExperienceEnrichment,true);assert.equal(extractionDetailHealth([row]).complete,false)
})
test('synthetic missing experience in an intern observation remains unknown through actual normalization',()=>{
 const row=map(model({job_title:'Synthetic Engineering Intern'}));assert.equal(row.sourceExperienceScopeUnresolved,true);assert.equal(row.publicExperienceChecked,false);assert.equal(normalizeScrapedJob(row).experienceRequired,null)
})
test('synthetic explicitly supplied API experience is preserved without claiming public detail completion',()=>{const row=map(model({job_experience:'2 - 5 years'}));assert.equal(row.experienceRequired,'2 - 5 Years');assert.equal(row.sourceNativeAPIRecord.job_experience,'2 - 5 years');assert.equal(row.publicExperienceChecked,false);assert.equal(row.sourceDetailComplete,false)})
test('synthetic unbound role observations opt out of all generic detail/browser promotion',async()=>{const rows=extractIndiaJobsFromCurrentOpeningsPayload([model()]);let reads=0;const result=await enrichJobsWithPublicExperience(rows,{fetchText:async()=>{reads++;return 'Synthetic borrowed criteria'},fetchBrowserText:async()=>{reads++;return 'Synthetic borrowed browser criteria'}});assert.equal(reads,0);assert.equal(result[0].jobDescription,null)})
test('genuine current careers HTML fails unchanged trust guard before any client/post/API request',async()=>{
 const html=Buffer.from(fixture.packet.bodyBase64,'base64').toString('utf8');assert.equal(hasOfficialCareersSignal(html),false);let gets=0,posts=0,apis=0
 await assert.rejects(run({fetchText:async url=>{gets++;assert.equal(url,fixture.packet.requestedURL);return html},postJson:async()=>{posts++;throw Error('No login authorized')},fetchJson:async()=>{apis++;throw Error('No API authorized')}}),/trusted first-party SPA contract/)
 assert.equal(gets,1);assert.equal(posts,0);assert.equal(apis,0);assert.equal(fixture.nativeAPIPayloads.length,0)
})
for(const value of ['N/A','Unknown','Not specified',null,''])test('synthetic unqualified experience placeholder remains raw while actual intern consumer stays unknown: '+value,()=>{
 const row=map(model({job_title:'Synthetic Engineering Intern',job_experience:value}));assert.equal(row.sourceNativeAPIRecord.job_experience,value);assert.equal(row.experienceRequired,null);assert.equal(row.sourceExperienceScopeUnresolved,true);assert.equal(normalizeScrapedJob(row).experienceRequired,null)
})
test('synthetic raw API records including inactive rows stay observable without complete inventory or company totals',()=>{
 const records=[model(),model({id:'synthetic-inactive',job_status:false})],jobs=extractIndiaJobsFromCurrentOpeningsPayload(records),inventory=readInventoryEvidence(jobs)
 assert.equal(jobs.length,1);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.firstParty,false);assert.equal(inventory.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(inventory.reportedTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.candidateListingRecords.length,2);assert.deepEqual(jobs.nativeCollectionEvidence.candidateListingRecords,records);assert.equal(jobs.nativeCollectionEvidence.extractedDetailJobs,0);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(readSourceObservationEvidence(jobs,'reservebankinformationtechnology').observedRecordCount,2)
})
test('synthetic empty payload carries unverified scope/cleanup holds and cannot become verified empty',()=>{const jobs=extractIndiaJobsFromCurrentOpeningsPayload([]);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)})
for(const change of [{job_title:{unreviewed:true}},{job_title:'<template>Synthetic Engineer</template>'},{job_title:'&lt;template&gt;Synthetic Engineer&lt;/template&gt;'},{id:['synthetic1']},{id:{native:'opaque'}},{id:'<span>synthetic1</span>'}])test('synthetic malformed/coerced/HTML identity remains a raw held observation: '+JSON.stringify(change),()=>{
 const original=model(change),rows=extractIndiaJobsFromCurrentOpeningsPayload([original]);assert.equal(rows.length,0);assert.deepEqual(rows.nativeCollectionEvidence.candidateListingRecords,[original]);assert.equal(rows.nativeCollectionEvidence.failures.length,1);assert.equal(readInventoryEvidence(rows).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(rows),true)
})
for(const experience of ['<template>2 years</template>','<span hidden>5 years</span>','&lt;template&gt;2 years&lt;/template&gt;','&#50; years','2&nbsp;years',['2 years'],{unreviewed:'2 years'}])test('synthetic nonliteral/inert experience stays raw and unusable: '+JSON.stringify(experience),()=>{
 const row=map(model({job_title:'Synthetic Engineering Intern',job_experience:experience}));assert.deepEqual(row.sourceNativeAPIRecord.job_experience,experience);assert.equal(row.experienceRequired,null);assert.equal(row.sourceExperienceScopeUnresolved,true);assert.equal(normalizeScrapedJob(row).experienceRequired,null)
})
