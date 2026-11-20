import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {qualifyCurrentRole,currentQuery,currentRoleURL,currentApplicationURL,parseCurrentListing,API,CAREERS,SEARCH} from './currentNative20261120.js'
import {readCurrentDocument} from './currentNativeData20261120.js'
import {createCurrentReader} from './currentTransport20261120.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const orderFixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/closing-order-originals-20261120.json.gz',import.meta.url))))
const boundaryFixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/ranking-boundary-originals-20261120.json.gz',import.meta.url))))
const stable=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):Array.isArray(value)?value.map(stable):value
const key=(url,request={method:'GET'})=>JSON.stringify([url,request.method??'GET',request.body?stable(JSON.parse(request.body)):null])
const pages=new Map(fixture.records.map(row=>[key(row.requestedUrl,row.request),row]))
const reply=(url,init)=>{const row=pages.get(key(url,init));assert.ok(row,'Unbound '+key(url,init));const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:url});return response}
const body=url=>Buffer.from(fixture.records.find(row=>row.requestedUrl===url).bodyBase64,'base64').toString()
const listing=parseCurrentListing(Buffer.from(fixture.records.find(row=>row.request.method==='POST').bodyBase64,'base64').toString()).jobs[0]
const original=readCurrentDocument(body(currentRoleURL(listing))),application=readCurrentDocument(body(currentApplicationURL(listing)))
const qualify=mutate=>{const role=structuredClone(original),row=structuredClone(listing),app=structuredClone(application);mutate(role.model.jobDetail.data.job,role.schemas[0],app.model.response.response,row,role,app);return qualifyCurrentRole(role,row,app,fixture.observedAt)}
const options=fetchImpl=>({now:()=>fixture.observedAt,requestIntervalMs:0,fetchImpl})
const replay=(change=()=>{})=>{const calls=new Map();return async(url,init)=>{
 const row=pages.get(key(url,init));assert.ok(row,'Unbound '+key(url,init));const nth=(calls.get(key(url,init))??0)+1;calls.set(key(url,init),nth)
 let value=Buffer.from(row.bodyBase64,'base64').toString();value=change(value,url,nth,init)??value
 const response=new Response(value,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:url});return response
}}
test('Merck current native India query recovers ten exact employer vacancies with own same-role current public application contexts',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NETWORK_TRIPWIRE: use native original fixture')}
 try{
  const jobs=await run({now:()=>fixture.observedAt,requestIntervalMs:0,fetchImpl:async(url,init)=>reply(url,init)})
  assert.equal(jobs.length,10);assert.ok(jobs.every(job=>job.country==='India'&&job.sourceLegalEmployer&&job.applyUrl.includes('/global/en/apply?jobSeqNo=')))
  assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.backendApplicationActivationVerified===false))
  assert.equal(jobs.nativeCollectionEvidence.heldNativeRoles.length,0);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 }finally{globalThis.fetch=saved}
})
test('Merck exact legal employer/title/id/account and country carriers are mandatory',()=>{
 const changes=[j=>{j.jobReqId='1'},j=>{j.title+=' other'},j=>{j.refNum='Other'},(j,s)=>{s.hiringOrganization.name='Merck & Co.'},(j,s)=>{s.identifier.value='1'},j=>{j.standardisedCountry='Canada'},(j,s)=>{s.jobLocation.address.addressCountry='Canada'},j=>{j.multi_location[0].country='Canada'}]
 for(const change of changes)assert.throws(()=>qualify(change),/Merck current publication/)
})
test('Merck current native publication flags and application context reject closed, unpublished and wrong role',()=>{
 const changes=[j=>{j.successFactorsStatus='Closed'},j=>{j.jobStatus='Closed'},j=>{j.displayCareerSite=false},j=>{j.OpenAndNotPosted='true'},j=>{j.confidential.isConfidential=true},j=>{j.externalApply=true},(j,s,a)=>{a.statusCode='JOB_EXPIRED'},(j,s,a)=>{a.jobSeqNo='Other'},(j,s,a)=>{a.jobData.jobCountry='Canada'},(j,s,a)=>{a.atsSpecificData.applyMaintenance='true'},(j,s,a)=>{a.jobData.multi_location[0].location='Toronto, Canada'}]
 for(const change of changes)assert.throws(()=>qualify(change),/Merck current publication/)
})
test('Merck native criteria closure, scoped foreign workplace, employer and past deadline hold affected role',()=>{
 const changes=[j=>{j.description+='<p>This position has been filled.</p>'},(j,s)=>{s.description+='<p>Location: Toronto, Canada</p>'},j=>{j.description+='<p>Employer: Other Company</p>'},j=>{j.description+='<p>Closing Date: 2020-01-01</p>'},j=>{j.validThrough='2020-01-01'},j=>{j.datePosted='2099-01-01'},j=>{j.validThrough='2027-02-30'}]
 for(const change of changes)assert.throws(()=>qualify(change),/Merck current publication/)
})
test('Merck authored job/publication status conflicts hold and employment status does not change vacancy availability',()=>{
 for(const line of ['Job Status: Draft','Publication Status: Closed','Status: Disabled','Availability: Expired'])assert.throws(()=>qualify(j=>{j.description+='<p>'+line+'</p>'}),/status|availability/i)
 assert.equal(qualify(j=>{j.description+='<p>Job Status: Open</p><p>Employment Status: Full Time</p>'}).country,'India')
})
test('Merck retains valid partial criteria and original publication ambiguity without modified/created dates',()=>{
 const job=qualify((j,s)=>{j.description='';j.dateCreated='2000-01-01';j.jobUpdated='2099-01-01';s.datePosted='2026-10-01'})
 assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.postingDate,'2026-10-01');assert.equal(job.sourcePublicationDateConflict,true)
 assert.ok(job.sourceNativePublicationDates.some(r=>r.raw===original.model.jobDetail.data.job.postedDate));assert.ok(!job.sourceNativePublicationDates.some(r=>r.raw==='2000-01-01'||r.raw==='2099-01-01'))
 assert.equal(job.applyUrl,currentApplicationURL(listing));assert.equal(job.backendApplicationActivationVerified,false)
})
test('Merck whole primary tuple, public country, status, deadline and native application stored binding cannot contradict publication',()=>{
 const changes=[j=>{j.location='Bangalore, Canada, India'},j=>{j.countryCode='CA'},j=>{j.status='Closed'},j=>{j.expiresAt='2020-01-01'},j=>{j.externalFooter+='<p>This role has been filled.</p>'},(j,s,a)=>{a.jobData.visibilitySiteType=['internal']},(j,s,a)=>{j.applyUrl='https://example.org/apply';a.jobData.applyUrl=j.applyUrl},(j,s)=>{s.hiringOrganization.url=CAREERS+'/job/'+j.jobId+'/../../job/1/Other'}]
 for(const change of changes)assert.throws(()=>qualify(change),/Merck current publication/)
})
test('Merck literal native program rejects duplicate keys, later nested writes, aliases and inert decoys',()=>{
 const html=body(currentRoleURL(listing))
 assert.throws(()=>readCurrentDocument(html.replace('"jobId":"'+listing.jobId+'"','"jobId":"'+listing.jobId+'","jobId":"1"')),/Duplicate/)
 assert.throws(()=>readCurrentDocument(html+'<script>phApp.ddo.jobDetail.data.job.country="Canada";</script>'),/mutation/)
 assert.throws(()=>readCurrentDocument(html+'<script>const alias=phApp;alias.ddo.jobDetail.data.job.country="Canada";</script>'),/alias|Ambiguous|ambiguous/)
 assert.equal(readCurrentDocument(html+'<template><script>phApp.ddo={};</script></template>').model.jobDetail.data.job.jobId,listing.jobId)
})
test('Merck query comes from current own explicit India facet and rejects duplicate native job identities',()=>{
 const search=readCurrentDocument(body(SEARCH)),query=currentQuery(search)
 assert.deepEqual(stable(query),stable(fixture.query));assert.equal(query.from,0);assert.equal(query.size,10)
 search.context.refNum='Other';assert.throws(()=>currentQuery(search),/publisher/)
 const record=JSON.parse(Buffer.from(fixture.records.find(row=>row.request.method==='POST').bodyBase64,'base64'));record.refineSearch.data.jobs[1]=record.refineSearch.data.jobs[0];assert.throws(()=>parseCurrentListing(JSON.stringify(record)),/Duplicated/)
})
test('Merck closing original role criteria and application business models reconcile fully',async()=>{
 for(const [url,before,after] of [[currentRoleURL(listing),'"jobStatus":"Approved"','"jobStatus":"Closed"'],[currentApplicationURL(listing),'"statusCode":"PAGE_LOADED"','"statusCode":"JOB_EXPIRED"']]){
  await assert.rejects(run(options(replay((html,requested,nth)=>requested===url&&nth===2?html.replace(before,after):html))),/Closing whole original/)
 }
 await assert.rejects(run(options(replay((html,url,nth)=>url===currentApplicationURL(listing)&&nth===2?html.replace('"jobData":{','"jobData":{"nativeUnknownStableField":"changed",'):html))),/Closing whole original/)
})
test('Merck genuine application JSON property-order changes preserve the entire same-role original business model',async()=>{
 const jobs=await run(options(replay((html,url,nth)=>url===currentApplicationURL(listing)?Buffer.from(orderFixture.records[nth-1].bodyBase64,'base64').toString():html)))
 assert.equal(jobs.length,10);assert.notEqual(JSON.stringify(jobs[0].sourceNativeApplicationOriginalModel.response.jobData),JSON.stringify(jobs[0].sourceNativeClosingApplicationOriginalModel.response.jobData))
 assert.deepEqual(stable(jobs[0].sourceNativeApplicationOriginalModel.response.jobData),stable(jobs[0].sourceNativeClosingApplicationOriginalModel.response.jobData))
})
test('Merck closing whole native query carries unknown fields and rejects count/model drift',async()=>{
 await assert.rejects(run(options(replay((value,url,nth)=>{if(url===API&&nth===2){const model=JSON.parse(value);model.refineSearch.data.nativeUnknownStableField='changed';return JSON.stringify(model)}return value}))),/Closing native query/)
})
test('Merck genuine same-date first-page boundary swap retains every independently closing-qualified own role and holds newly discovered rows',async()=>{
 const jobs=await run(options(replay((value,url,nth)=>url===API?Buffer.from(boundaryFixture.records[nth-1].bodyBase64,'base64').toString():value)))
 assert.equal(jobs.length,10);assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingQueryMatch,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingRoleAndApplicationBusinessModelsMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.nativeRankingBoundaryEvidence.closingNewUnenrichedRows.length,1)
 assert.equal(jobs.nativeCollectionEvidence.nativeRankingBoundaryEvidence.independentlyClosedOpeningRowsOutsideClosingPage.length,1)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
})
test('Merck known critical closing index contradictions hold only the affected independently bound role',async()=>{
 for(const change of [row=>{row.country='Canada'},row=>{row.status='Draft'},row=>{row.validThrough='2020-01-01'},row=>{row.descriptionTeaser+='<p>This position has been filled.</p>'},row=>{row.employer='Other Company'}]){
  const jobs=await run(options(replay((value,url,nth)=>{if(url===API&&nth===2){const model=JSON.parse(value);change(model.refineSearch.data.jobs[0]);return JSON.stringify(model)}return value})))
  assert.equal(jobs.length,9);assert.equal(jobs.nativeCollectionEvidence.heldNativeRoles.length,1)
 }
})
test('Merck an earlier actually authored closing index publication date is retained for aging with both original carriers',async()=>{
 const jobs=await run(options(replay((value,url,nth)=>{if(url===API&&nth===2){const model=JSON.parse(value);model.refineSearch.data.jobs[0].datePosted='2020-01-01';return JSON.stringify(model)}return value})))
 assert.equal(jobs.length,10);assert.equal(jobs[0].postingDate,'2020-01-01');assert.ok(jobs[0].sourceNativePublicationDates.some(r=>r.field==='closingListing.datePosted'&&r.raw==='2020-01-01'))
 assert.equal(jobs[0].sourceNativeClosingListingRecord.datePosted,'2020-01-01');assert.equal(jobs[0].sourcePublicationDateConflict,true)
})
test('Merck unreviewed closing listing business-field changes remain explicit affected-role holds',async()=>{
 const jobs=await run(options(replay((value,url,nth)=>{if(url===API&&nth===2){const model=JSON.parse(value);model.refineSearch.data.jobs[0].nativeUnknownStableField='changed';return JSON.stringify(model)}return value})))
 assert.equal(jobs.length,9);assert.equal(jobs.nativeCollectionEvidence.heldNativeRoles.length,1);assert.match(jobs.nativeCollectionEvidence.heldNativeRoles[0].reason,/Unreviewed closing listing/)
})
test('Merck mandatory HTTP failure and opaque cancellation surface without retries',async()=>{
 let count=0;await assert.rejects(run(options(async(url,init)=>{if(url===currentRoleURL(listing)){count++;const response=new Response('Unavailable',{status:503,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}return reply(url,init)})),/503/);assert.equal(count,1)
 const controller=new AbortController(),reason={opaque:'cancelled'};await assert.rejects(run({...options(async()=>{controller.abort(reason);throw Error('late native error')}),signal:controller.signal}),error=>error===reason)
})
test('Merck denied own origin stops further reads and native query/request budgets are finite',async()=>{
 let count=0;const reader=createCurrentReader('merckkgaa',[CAREERS,SEARCH],{requestIntervalMs:0,fetchImpl:async url=>{count++;const response=new Response('Denied',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}})
 try{await assert.rejects(reader.read(CAREERS),/403/);await assert.rejects(reader.read(SEARCH),/403/);assert.equal(count,1);assert.throws(()=>reader.allowQuery(API,{extra:'x'.repeat(1100)}),/bound/)}finally{reader.close()}
})
test('Merck aggregate byte ceiling reserves the next bounded response before making another request',async()=>{
 let count=0;const reader=createCurrentReader('merckkgaa',[CAREERS],{requestIntervalMs:0,fetchImpl:async url=>{count++;const response=new Response(Buffer.alloc(16*1024*1024,32),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}})
 try{for(let n=0;n<4;n++)await reader.read(CAREERS);await assert.rejects(reader.read(CAREERS),/budget|bound/i);assert.equal(count,4)}finally{reader.close()}
})
