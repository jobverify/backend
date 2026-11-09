import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {currentFixture,fixturePacket} from './currentFixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
const LIST='https://gateway.app.hrone.cloud/api/external/public/referral/CareerPosition/Details',DETAIL='/api/external/public/referral/JobOpening/Request/Details/'
const options=f=>({...f,minRequestIntervalMs:0,now:'2026-11-03T05:00:00.000Z'})
globalThis.fetch=async()=>{throw Error('Annapurna source tests prohibit live requests')}
test('published native handoff replaces missing-route sentinel and returns the one retained full role in an explicitly reduced fixture',async()=>{
 const f=currentFixture(),reports=[],jobs=await run({...options(f),onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'1947');assert.equal(jobs[0].requisitionId,'JOB1947');assert.equal(jobs[0].country,null);assert.equal(jobs[0].postingDate,null)
 assert.equal(jobs[0].sourceDetailComplete,true);assert.match(jobs[0].jobDescription,/Risk/);assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(reports.at(-1).observedNativePositions,1);assert.equal(reports.at(-1).ownDetailPasses,2);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(f.calls.filter(c=>c.url.includes(DETAIL)).length,2);assert.ok(f.calls.findLastIndex(c=>c.url===LIST)>f.calls.findLastIndex(c=>c.url.includes(DETAIL)))
 const search=JSON.parse(f.calls.find(c=>c.url===LIST).body);assert.equal(search.jobPosted,'0');assert.equal(search.departmentCode,'');assert.equal(search.nationality,'');assert.equal(search.pagination.pageSize,15);assert.equal(f.calls.find(c=>c.url===LIST).method,'POST')
})
test('all original30 pages retain444native positions when caller requests only one hydrated role',async()=>{
 const f=currentFixture({fullOriginalPagination:true}),reports=[],jobs=await run({...options(f),maxJobs:1,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,1);assert.equal(reports.at(-1).observedNativePositions,444);assert.equal(reports.at(-1).observations.length,444);assert.equal(reports.at(-1).nativePagination.pages,30);assert.equal(reports.at(-1).callerCapApplied,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('public custom criteria use actual portal labels while non-job employee/application data is excluded',async()=>{
 const f=currentFixture({transform:({url,body,response})=>url.includes(DETAIL)?{...response,text:async()=>JSON.stringify({...JSON.parse(body),requestOwnerDetails:{personalEmail:'TEST_ONLY_PRIVATE_ADDRESS'},replacedEmployee:{employeeId:'TEST_ONLY_EMPLOYEE'},canAddCandidate:false,canGenerateOfferLetter:true})}:undefined})
 const reports=[],jobs=await run({...options(f),onAudit:r=>reports.push(r)}),serialized=JSON.stringify({jobs,reports})
 assert.doesNotMatch(serialized,/TEST_ONLY_PRIVATE_ADDRESS|TEST_ONLY_EMPLOYEE|requestOwnerDetails|canGenerateOfferLetter|apiKey|TEST_ONLY_PUBLIC_APPID|TEST_ONLY_PUBLIC_COMPANY/)
 assert.equal(jobs[0].sourceDetailComplete,true);assert.ok(jobs[0].nativePublicJobCriteria);assert.ok(jobs[0].publicCriteriaFields.length>0)
})
for(const [name,change]of [
 ['empty JD',d=>{d.jobDescriptionBody='';d.jobDescriptionBodyWithHtml='<div><br></div>'}],
 ['clipped JD',d=>{d.jobDescriptionBodyWithHtml='<div style="height:1px;overflow:hidden">'+d.jobDescriptionBodyWithHtml+'</div>'}],
 ['image-only criteria supplement',d=>{d.jobDescriptionBodyWithHtml+='<img src="https://example.invalid/mandatory.png" alt="Mandatory criteria">'}],
 ['separate attachment',d=>{d.documentFileName='TEST_ONLY_UNQUALIFIED_TERMS.pdf'}]
])test(name+' stays an explicit full-criteria gap',async()=>{
 const f=currentFixture({transform:({url,body,response})=>{if(url.includes(DETAIL)){const d=JSON.parse(body);change(d);return{...response,text:async()=>JSON.stringify(d)}}}}),jobs=await run(options(f))
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.ok(jobs[0].nativePublicJobCriteria)
})
test('native role identity mismatch never becomes the requested job',async()=>{
 const f=currentFixture({transform:({url,body,response})=>url.includes(DETAIL)?{...response,text:async()=>JSON.stringify({...JSON.parse(body),requestId:999999})}:undefined})
 await assert.rejects(run(options(f)),/identity|request ID/i)
})
test('failure envelopes never become a verified empty source',async()=>{
 const f=currentFixture({transform:({url,response})=>url===LIST?{...response,text:async()=>JSON.stringify({error:'TEST_ONLY_SERVER_FAILURE',data:[]})}:undefined})
 const e=await run(options(f)).then(()=>null,e=>e);assert.ok(e);assert.equal(e.abortRetries,true);assert.doesNotMatch(e.message,/official homepage/i)
})
test('a closing native criteria change is detected before final inventory completeness',async()=>{
 let reads=0;const f=currentFixture({transform:({url,body,response})=>{if(url.includes(DETAIL)&&++reads===2){const d=JSON.parse(body);d.experienceFrom=99;return{...response,text:async()=>JSON.stringify(d)}}}})
 await assert.rejects(run(options(f)),/closing.*(?:criteria|role)|criteria.*changed/i)
})
test('a repeated native page or missing terminal boundary is not a complete inventory',async()=>{
 const f=currentFixture({fullOriginalPagination:true,transform:({url,request,response})=>{if(url===LIST&&JSON.parse(request.body).pagination.pageNumber===2)return{...response,text:async()=>fixturePacket('list-page-1').body}}})
 await assert.rejects(run({...options(f),maxJobs:1}),/duplicate|repeated|pagination/i)
})
test('403 stops at one request without retry or pipeline infrastructure flags',async()=>{
 let calls=0;const reader=async url=>{calls++;return{status:403,url}},e=await run({fetchPage:reader,minRequestIntervalMs:0}).then(()=>null,e=>e)
 assert.equal(calls,1);assert.equal(e.status,403);assert.equal(e.abortRetries,true);assert.equal(e.pipelineInfrastructureFailure,undefined);assert.equal(e.fatalSourceFailure,undefined)
})
test('pre-aborted caller reason is preserved exactly without any request',async()=>{
 const caller=new AbortController(),reason={testStop:'preaborted'};caller.abort(reason);let reads=0
 assert.equal(await run({signal:caller.signal,fetchPage:async()=>{reads++;throw Error('should not read')}}).then(()=>null,e=>e),reason);assert.equal(reads,0)
})
test('supplied transport receives the composed collection deadline and caller remains un-aborted',async()=>{
 const caller=new AbortController();let transportSignal
 const e=await run({signal:caller.signal,collectionBudgetMs:20,requestTimeoutMs:100,fetchPage:async(_u,r)=>{transportSignal=r.signal;return new Promise(()=>{})},minRequestIntervalMs:0}).then(()=>null,e=>e)
 assert.ok(e);assert.equal(transportSignal.aborted,true);assert.equal(caller.signal.aborted,false)
})
test('denied closing query retains observations and never probes another route',async()=>{
 let queries=0;const reports=[],f=currentFixture({transform:({url,response})=>url===LIST&&++queries===2?{...response,status:429}:undefined})
 const e=await run({...options(f),onAudit:r=>reports.push(r)}).then(()=>null,e=>e)
 assert.equal(e.status,429);assert.equal(reports.at(-1).observedNativePositions,1);assert.equal(reports.at(-1).observations[0].jobId,'1947');assert.equal(f.calls.at(-1).url,LIST)
})
test('the failure audit settles before the collector rejects a closing denial',async()=>{
 let queries=0,failureAuditSettled=false
 const f=currentFixture({transform:({url,response})=>url===LIST&&++queries===2?{...response,status:429}:undefined})
 const e=await run({...options(f),onAudit:async r=>{if(r.publicReadReceipts.at(-1)?.status===429){await new Promise(resolve=>setTimeout(resolve,25));failureAuditSettled=true}}}).then(()=>null,e=>e)
 assert.equal(e.status,429);assert.equal(failureAuditSettled,true)
})
test('malformed native JSON has a typed sanitized failure without response data in errors',async()=>{
 const f=currentFixture({transform:({url,response})=>url===LIST?{...response,text:async()=>'{TEST_ONLY_RESPONSE_VALUE'}:undefined})
 const e=await run(options(f)).then(()=>null,e=>e)
 assert.equal(e.abortRetries,true);assert.doesNotMatch(e.message,/TEST_ONLY_RESPONSE_VALUE/)
})
test('shared normalization and publication metrics cannot infer India from a country-unqualified native city',async()=>{
 const jobs=await run(options(currentFixture())),analysis=analyzePublishableJobs(jobs),normalized=jobs.map(j=>normalizeScrapedJob(j,{source:'annapurnafinance',countryFilter:'India'}))
 assert.equal(analysis.indiaJobs.length,0);assert.equal(analysis.eligibleJobs.length,0);assert.equal(analyzePublishableJobs(normalized).eligibleJobs.length,0)
 assert.equal(jobs[0].nativeWorkplaceAlternatives[0].text,'Bhubaneswar')
})
test('a visible brief cannot hide the full native rich-text description',async()=>{
 const f=currentFixture({transform:({url,body,response})=>{if(url.includes(DETAIL)){const d=JSON.parse(body);d.jobDescriptionBodyWithHtml='<p>Short visible brief.</p><div style="display:none">'+d.jobDescriptionBodyWithHtml+'</div>';return{...response,text:async()=>JSON.stringify(d)}}}}),jobs=await run(options(f))
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription,null)
})
test('nested public list fields are projected to rendered values and object-valued custom criteria stay held',async()=>{
 const f=currentFixture({transform:({url,body,response})=>{if(url.includes(DETAIL)){const d=JSON.parse(body);d.preferredLocationList[0].privateDummy='TEST_ONLY_NESTED_PERSONAL';d.qualificationList[0].privateDummy='TEST_ONLY_NESTED_PERSONAL';d.jobFieldOne={privateDummy:'TEST_ONLY_CUSTOM_PERSONAL'};return{...response,text:async()=>JSON.stringify(d)}}}}),reports=[],jobs=await run({...options(f),onAudit:r=>reports.push(r)})
 assert.doesNotMatch(JSON.stringify({jobs,reports}),/TEST_ONLY_NESTED_PERSONAL|TEST_ONLY_CUSTOM_PERSONAL|privateDummy/)
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].nativeWorkplaceAlternatives[0].text,'Bhubaneswar')
})
test('an unpublished storage ID alone is not a public attachment or vacancy prerequisite',async()=>{
 const f=currentFixture({transform:({url,body,response})=>url.includes(DETAIL)?{...response,text:async()=>JSON.stringify({...JSON.parse(body),documentFileName:null,uploadedFileName:'TEST_ONLY_UNPUBLISHED_STORAGE_ID'})}:undefined}),jobs=await run(options(f))
 assert.equal(jobs[0].sourceDetailComplete,true);assert.doesNotMatch(JSON.stringify(jobs),/TEST_ONLY_UNPUBLISHED_STORAGE_ID/)
})
test('custom controls hidden by the public organisation parent do not gate the remaining public description',async()=>{
 const org=new Set(['FK_DEPT_CODE','FK_DESIG_CODE','FK_BRANCH_CODE'])
 const f=currentFixture({transform:({url,body,response})=>url.endsWith('/referral/LabelSetting')?{...response,text:async()=>JSON.stringify(JSON.parse(body).map(l=>org.has(l.fieldName)?{...l,isCarrierPortal:false}:l))}:undefined}),jobs=await run(options(f))
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].publicCriteriaFields.some(f=>f.fieldName.includes('JOBOPENINGFIELD')),false)
})
for(const style of ['position:absolute;left:-99999px;top:-99999px','text-indent:-99999px;overflow:hidden;white-space:nowrap'])test('offscreen own-role criterion stays unqualified: '+style,async()=>{
 const f=currentFixture({transform:({url,body,response})=>{if(url.includes(DETAIL)){const d=JSON.parse(body);d.jobDescriptionBodyWithHtml+='<p style="'+style+'">TEST_ONLY_OFFSCREEN_MANDATORY_CRITERION</p>';return{...response,text:async()=>JSON.stringify(d)}}}}),jobs=await run(options(f))
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription,null);assert.match(jobs[0].nativePublicJobCriteria.jobDescriptionBodyWithHtml,/TEST_ONLY_OFFSCREEN/)
})
test('malformed public label controls cannot copy nested configuration into an audit',async()=>{
 const reports=[],f=currentFixture({transform:({url,body,response})=>{if(url.endsWith('/referral/LabelSetting')){const labels=JSON.parse(body);labels.find(l=>l.fieldName==='JOBOPENINGFIELD1').controlKey={apiKey:'TEST_ONLY_NESTED_LABEL_CONFIG'};return{...response,text:async()=>JSON.stringify(labels)}}}})
 const error=await run({...options(f),onAudit:r=>reports.push(r)}).then(()=>null,e=>e)
 assert.ok(error);assert.equal(error.abortRetries,true);assert.doesNotMatch(JSON.stringify(reports),/TEST_ONLY_NESTED_LABEL_CONFIG|apiKey/)
})
