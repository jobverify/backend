import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {API,BOARD,HOME,CAREERS,qualifyCurrentRole,currentFacetQuery,parseCurrentListing} from './currentNative20261120.js'
import {createCurrentReader} from './currentTransport20261120.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const orderFixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/closing-order-originals-20261120.json.gz',import.meta.url))))
const stable=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):Array.isArray(value)?value.map(stable):value
const key=(url,request={method:'GET'})=>JSON.stringify([url,request.method??'GET',request.body?stable(JSON.parse(request.body)):null])
const pages=new Map(fixture.records.map(row=>[key(row.requestedUrl,row.request),row]))
const reply=(url,init)=>{const row=pages.get(key(url,init));assert.ok(row,'Unbound '+key(url,init));const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:url});return response}
const global=JSON.parse(Buffer.from(fixture.records.find(r=>r.request?.method==='POST'&&JSON.parse(r.request.body).appliedFacets.locationCountry==null).bodyBase64,'base64'))
const target=JSON.parse(Buffer.from(fixture.records.find(r=>r.request?.method==='POST'&&JSON.parse(r.request.body).appliedFacets.locationCountry).bodyBase64,'base64'))
const native=fixture.records.filter(r=>r.requestedUrl.startsWith(API+'/job/')).map(row=>JSON.parse(Buffer.from(row.bodyBase64,'base64')))
const index=native.findIndex(row=>row.hiringOrganization?.name==='SS&C Fintech Svc India - Hyderabad')
const original=native[index],listing=target.jobPostings[index],country=currentFacetQuery(global).country
const qualify=mutate=>{const model=structuredClone(original);mutate(model);return qualifyCurrentRole(model,listing,country,fixture.observedAt)}
const replay=(change=()=>{})=>{const calls=new Map();return async(url,init)=>{
 const row=pages.get(key(url,init));assert.ok(row,'Unbound '+key(url,init));const nth=(calls.get(key(url,init))??0)+1;calls.set(key(url,init),nth)
 let body=Buffer.from(row.bodyBase64,'base64');if(/application\/json/.test(row.headers['content-type']??'')){const model=JSON.parse(body);change(model,url,nth,init);body=Buffer.from(JSON.stringify(model))}
 const response=new Response(body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:url});return response
}}
const options=fetchImpl=>({now:()=>fixture.observedAt,requestIntervalMs:0,fetchImpl})
const errorResponse=(url,status)=>{const response=new Response('Unavailable',{status,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}
test('SS&C native published Hyderabad facet recovers twelve exact already-approved employer roles and withholds six other employers',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NETWORK_TRIPWIRE: use native original fixture')}
 try{
  const jobs=await run({now:()=>fixture.observedAt,requestIntervalMs:0,fetchImpl:async(url,init)=>reply(url,init)})
  assert.equal(jobs.length,12);assert.ok(jobs.every(job=>job.country==='India'&&job.nativeEmployerDisplayName==='SS&C Fintech Svc India - Hyderabad'))
  assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.sourceLegalEmployer===null&&job.backendApplicationActivationVerified===false))
  assert.equal(jobs.nativeCollectionEvidence.heldNativeRoles.length,6);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 }finally{globalThis.fetch=saved}
})

test('SS&C employer scope rejects foreign, acquired, disabled and missing native labels without parent aliasing',()=>{
 for(const name of ['Eze Software India Private Limited','SS&C Technologies','(Do Not Use) SS&C FinTech Services India Private Limited','Other Company',null])assert.throws(()=>qualify(m=>{m.hiringOrganization.name=name}),/employer/)
})
test('SS&C current identity and native application entry require same requisition, title, publisher, posted and canApply',()=>{
 const changes=[m=>{m.jobPostingInfo.canApply=false},m=>{m.jobPostingInfo.posted=false},m=>{m.jobPostingInfo.jobReqId='R1'},m=>{m.jobPostingInfo.title+=' other'},m=>{m.jobPostingInfo.jobPostingSiteId='Other'},m=>{m.jobPostingInfo.externalUrl='https://example.org/apply'},m=>{m.jobPostingInfo.externalUrl=BOARD+'/job/Other_R1'},m=>{m.userAuthenticated=true}]
 for(const change of changes)assert.throws(()=>qualify(change),/SS&C current publication/)
})
test('SS&C typed country and complete primary tuple reject conflicting foreign workplaces',()=>{
 const changes=[m=>{m.jobPostingInfo.country.descriptor='Canada'},m=>{m.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='CA'},m=>{m.jobPostingInfo.location='Toronto, Canada'},m=>{m.jobPostingInfo.location='Hyderabad, Canada, India'},m=>{m.jobPostingInfo.location='Hyderabad, India / Toronto, Canada'},m=>{m.jobPostingInfo.jobRequisitionLocation.descriptor='Toronto Canada'},m=>{m.jobPostingInfo.countryCode='CA'}]
 for(const change of changes)assert.throws(()=>qualify(change),/SS&C current publication/)
})
test('SS&C known closure, deadlines and authored scoped contradictions hold even when model is posted',()=>{
 const changes=[m=>{m.jobPostingInfo.closed=true},m=>{m.jobPostingInfo.jobStatus='Closed'},m=>{m.jobPostingInfo.closingDate='2020-01-01'},m=>{m.jobPostingInfo.datePosted='2099-01-01'},m=>{m.jobPostingInfo.validThrough='2027-02-30'},m=>{m.jobPostingInfo.jobDescription+='<p>This position has been filled.</p>'},m=>{m.jobPostingInfo.jobDescription+='<p>Closing Date: 2020-01-01</p>'},m=>{m.jobPostingInfo.jobDescription+='<p>Location: Toronto, Canada</p>'},m=>{m.jobPostingInfo.jobDescription+='<p>Employer: Other Company</p>'}]
 for(const change of changes)assert.throws(()=>qualify(change),/SS&C current publication/)
})
test('SS&C authored job/publication availability status is current while employment status remains separate',()=>{
 for(const line of ['Job Status: Draft','Publication Status: Closed','Status: Disabled','Availability: Expired'])assert.throws(()=>qualify(m=>{m.jobPostingInfo.jobDescription+='<p>'+line+'</p>'}),/status|availability/i)
 assert.equal(qualify(m=>{m.jobPostingInfo.jobDescription+='<p>Job Status: Open</p><p>Employment Status: Full Time</p>'}).country,'India')
})
test('SS&C missing criteria remains explicit partial and dates remain original rather than relative labels',()=>{
 const job=qualify(m=>{m.jobPostingInfo.jobDescription='';m.jobPostingInfo.datePosted='2026-11-01';m.jobPostingInfo.startDate='2026-10-18';m.jobPostingInfo.postedOn='Posted Today'})
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.jobDescription,null);assert.equal(job.postingDate,'2026-10-18');assert.equal(job.sourceNativeRelativePostedOn,'Posted Today')
 assert.equal(job.sourceNativePublicationDates.length,2);assert.equal(job.applyUrl,original.jobPostingInfo.externalUrl)
 assert.equal(job.sourceNativeApplicationEvidence.canApply,true);assert.equal(job.backendApplicationActivationVerified,false)
})
test('SS&C true future deadline and conditional filling language do not close a current vacancy',()=>{
 const job=qualify(m=>{m.jobPostingInfo.jobDescription+='<p>Applications will be accepted until the position is filled.</p><p>Closing Date: January 15, 2027</p><p>Our offices include Toronto, Canada.</p>'})
 assert.equal(job.country,'India');assert.equal(job.sourceNativeExpiryDates.at(-1).normalizedCalendar,'2027-01-15')
})
test('SS&C source selects current dynamic facet IDs and rejects duplicated/missing facets or duplicate identities',()=>{
 const model=structuredClone(global),old=currentFacetQuery(model),walk=value=>{if(value&&typeof value==='object'){if(value.descriptor==='India'&&value.id===old.country.id)value.id='a'.repeat(32);if(value.descriptor==='Hyderabad, India'&&value.id===old.location.id)value.id='b'.repeat(32);for(const child of Object.values(value))walk(child)}};walk(model)
 assert.equal(currentFacetQuery(model).body.appliedFacets.locationCountry[0],'a'.repeat(32));assert.equal(currentFacetQuery(model).body.appliedFacets.locations[0],'b'.repeat(32))
 const duplicate=structuredClone(target);duplicate.jobPostings.push(duplicate.jobPostings[0]);assert.throws(()=>parseCurrentListing(JSON.stringify(duplicate)),/identit/)
 assert.throws(()=>currentFacetQuery({...model,facets:[]}),/facet|locationCountry/)
})
test('SS&C reconciles entire original closing detail models including unknown native fields',async()=>{
 const url=API+listing.externalPath
 await assert.rejects(run(options(replay((model,requested,nth)=>{if(requested===url&&nth===2)model.nativeUnknownStableField='changed'}))),/Closing original native detail models changed/)
})
test('SS&C reconciles whole original closing native facet listing',async()=>{
 await assert.rejects(run(options(replay((model,url,nth,init)=>{if(url===API+'/jobs'&&JSON.parse(init.body).appliedFacets.locationCountry&&nth===2)model.nativeUnknownStableField='changed'}))),/Closing current native listings/)
})
test('SS&C genuine closing facet value permutation preserves every original native field and all twelve valid own roles',async()=>{
 const jobs=await run(options(replay((model,url,nth,init)=>{if(url===API+'/jobs'&&JSON.parse(init.body).appliedFacets.locationCountry){const original=JSON.parse(Buffer.from(orderFixture.records[nth-1].bodyBase64,'base64'));for(const key of Object.keys(model))delete model[key];Object.assign(model,original)}})))
 assert.equal(jobs.length,12);assert.notDeepEqual(jobs.nativeCollectionEvidence.originalNativeListing,jobs.nativeCollectionEvidence.closingNativeListing)
})
test('SS&C facet multiset comparison still rejects changed IDs, descriptors, counts and unknown authored fields',async()=>{
 for(const change of [row=>{row.id='f'.repeat(32)},row=>{row.descriptor+=' changed'},row=>{row.count++},row=>{row.nativeUnknownStableField='changed'}])await assert.rejects(run(options(replay((model,url,nth,init)=>{if(url===API+'/jobs'&&JSON.parse(init.body).appliedFacets.locationCountry&&nth===2)change(model.facets[0].values[0])}))),/Closing current native listings/)
})
test('SS&C mandatory native HTTP failure is surfaced without retry or invented records',async()=>{
 let count=0;await assert.rejects(run(options(async(url,init)=>{if(url===API+listing.externalPath){count++;return errorResponse(url,503)}return reply(url,init)})),/503/);assert.equal(count,1)
})
test('SS&C denied origin latches before response body and blocks later requests',async()=>{
 let count=0;const reader=createCurrentReader('ssandctechnologies',[HOME,CAREERS],{requestIntervalMs:0,fetchImpl:async url=>{count++;return errorResponse(url,429)}})
 try{await assert.rejects(reader.read(HOME),/429/);await assert.rejects(reader.read(CAREERS),/429/);assert.equal(count,1);assert.equal(reader.stats().deniedOrigins.length,1)}finally{reader.close()}
})
test('SS&C opaque caller cancellation survives source processing unchanged',async()=>{
 const controller=new AbortController(),reason={opaque:'cancelled'};let count=0
 await assert.rejects(run({...options(async()=>{count++;controller.abort(reason);throw Error('late native error')}),signal:controller.signal}),error=>error===reason);assert.equal(count,1)
})
test('SS&C reader production defaults use native fetch and enforce request, duration and query bounds',async()=>{
 const saved=globalThis.fetch;let count=0;globalThis.fetch=async(url,init)=>{count++;assert.equal(init.credentials,'omit');return reply(url,init)}
 const reader=createCurrentReader('ssandctechnologies',[HOME])
 try{await reader.read(HOME);assert.equal(count,1);await assert.rejects(reader.read('https://example.org/'),/Unbound/);assert.throws(()=>reader.allowQuery(API+'/jobs',{extra:'x'.repeat(1100)}),/bound/)}finally{reader.close();globalThis.fetch=saved}
 assert.throws(()=>createCurrentReader('ssandctechnologies',[HOME],{sourceTimeoutMs:180001}),/deadline/)
})
test('SS&C aggregate byte ceiling reserves the next bounded response before another request',async()=>{
 let count=0;const reader=createCurrentReader('ssandctechnologies',[HOME],{requestIntervalMs:0,fetchImpl:async url=>{count++;const response=new Response(Buffer.alloc(16*1024*1024,32),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}})
 try{for(let n=0;n<4;n++)await reader.read(HOME);await assert.rejects(reader.read(HOME),/budget|bound/i);assert.equal(count,4)}finally{reader.close()}
})
