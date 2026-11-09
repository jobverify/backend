import test from 'node:test'
import assert from 'node:assert/strict'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {fixture,replay,mutateBody} from './test-data/health2070Native20261108.js'
const run=(r,options={})=>createCatalogScraper(getScraperCatalog().find(v=>v.source==='2070health')).run({...r.options,...options}),failureOf=async promise=>{try{await promise;assert.fail('Expected unresolved native detail failure')}catch(e){if(e?.code==='ERR_ASSERTION')throw e;return e}},primary=fixture.expected.primary,detail=fixture.expected.firstDetail

test('2070Health registered extraction retains all32 full native listing models and the empty full own-detail model before rejection',async()=>{
 const r=replay(),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_NATIVE_CRITERIA_MISSING');assert.deepEqual(e.nativeEvidence.primary,primary);assert.deepEqual(e.nativeEvidence.detailRecords,[detail]);assert.equal(e.nativeEvidence.observations.length,32);assert.equal(e.nativeEvidence.rawResponses.length,3);assert.deepEqual(r.uncaptured,[])
})

test('2070Health output caps do not erase native listing observations or prevent partial failure observers',async()=>{
 const r=replay();let rows;const e=await failureOf(run(r,{maxJobs:0,onRecords:v=>{rows=v}}));assert.equal(e.code,'HEALTH2070_NATIVE_CRITERIA_MISSING');assert.equal(rows.length,32);assert.deepEqual(e.nativeEvidence.primary,primary);assert.equal(r.requests.length,3)
})

test('2070Health keeps relative role dates and WordPress template dates separate from unknown posting dates and formal employer identity',async()=>{
 const r=replay(),e=await failureOf(run(r));assert.equal(e.nativeEvidence.detailRecords[0].nativeRelativePostingText,'Posted 1 year(s) ago');for(const row of e.nativeEvidence.observations){assert.equal(row.jobId,null);assert.equal(row.requisitionId,null);assert.equal(row.postingDate,null);assert.equal(row.closingDate,null);assert.equal(row.company,null);assert.equal(row.country,'India');assert.equal(row.sourceNativeCurrentPublicationQualified,false)}assert.equal(e.nativeEvidence.companyIndiaTotal,null);assert.equal(e.nativeEvidence.sourceScopeComplete,false);assert.equal(e.nativeEvidence.lifecycleCleanupAllowed,false)
})

test('2070Health uses the actual advertised canonical301 as a separate admitted manual anonymous GET and retains every original byte',async()=>{
 const r=replay(),e=await failureOf(run(r));assert.equal(r.requests.length,3);assert.deepEqual(r.requests.map(v=>v.url),fixture.packets.map(v=>v.requestedURL));for(const [i,{response:p}]of e.nativeEvidence.rawResponses.entries()){assert.equal(p.status,fixture.packets[i].status);assert.equal(p.rawBodyBase64,fixture.packets[i].bodyBase64);assert.equal(p.bodyComplete,true)}assert.equal(e.nativeEvidence.requestCount,3);assert.ok(r.requests.every(v=>v.method==='GET'&&v.redirect==='manual'&&v.credentials==='omit'))
})

test('2070Health rejects a foreign canonical redirect after retaining all32 listing carriers and the intermediate original',async()=>{
 const r=replay(p=>{if(p.label==='role-01')p.headers.location='https://example.com/foreign'}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_REDIRECT_PROOF');assert.equal(r.requests.length,2);assert.equal(e.nativeEvidence.primary.records.length,32);assert.equal(e.nativeEvidence.rawResponses[1].response.headers.location,'https://example.com/foreign');assert.equal(e.nativeEvidence.detailRecords.length,0)
})

test('2070Health cannot change the publisher shortcode across the canonical redirect',async()=>{
 const r=replay(p=>{if(p.label==='role-01')p.headers.location='https://2070health.com/careers/career-detail/?id=AAAAAAAAAA'}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_REDIRECT_PROOF');assert.equal(r.requests.length,2);assert.equal(e.nativeEvidence.primary.records.length,32);assert.equal(e.nativeEvidence.rawResponses.length,2)
})

test('2070Health retains a complete changed own-title model before rejecting the listing/detail conflict',async()=>{
 const r=replay(p=>{if(p.label==='role-01-canonical')mutateBody(p,html=>html.replace('<p class="txt-sec-white fw500 mb-2 pb-1">Program Manager-Special Projects</p>','<p class="txt-sec-white fw500 mb-2 pb-1">Changed native own title</p>'))}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_NATIVE_IDENTITY_CONFLICT');assert.equal(e.nativeEvidence.detailRecords[0].title,'Changed native own title');assert.equal(e.nativeEvidence.primary.records[0].title,primary.records[0].title);assert.equal(e.nativeEvidence.observations.length,32)
})

test('2070Health preserves duplicate native carriers before holding ambiguous detail identities',async()=>{
 const r=replay(p=>{if(p.label==='primary')mutateBody(p,html=>html.replace(primary.records[0].nativeHTML,primary.records[0].nativeHTML+primary.records[0].nativeHTML))}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_NATIVE_LISTING_PROOF');assert.equal(e.nativeEvidence.primary.records.length,33);assert.equal(e.nativeEvidence.observations.length,33);assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.primary.records[0].nativeHTML,e.nativeEvidence.primary.records[1].nativeHTML)
})

test('2070Health country selection does not discard other published native listing models before a detail failure',async()=>{
 const r=replay(),e=await failureOf(run(r,{countryFilter:'United States'}));assert.equal(e.nativeEvidence.primary.records.length,32);assert.equal(e.nativeEvidence.observations.length,32);assert.equal(r.requests.length,3);assert.equal(e.code,'HEALTH2070_NATIVE_CRITERIA_MISSING')
})

test('2070Health rejects unsupported finite page truncation before any physical read',async()=>{
 const r=replay(),e=await failureOf(run(r,{maxPages:1}));assert.equal(e.code,'HEALTH2070_INVALID_OPTIONS');assert.equal(r.requests.length,0)
})

test('2070Health physical request limits include the intermediate redirect and stop before the canonical GET',async()=>{
 const r=replay(),e=await failureOf(run(r,{maxRequests:2}));assert.equal(e.code,'HEALTH2070_REQUEST_BUDGET');assert.equal(r.requests.length,2);assert.equal(e.nativeEvidence.rawResponses.length,2);assert.equal(e.nativeEvidence.primary.records.length,32)
})

test('2070Health stops at a native HTTP denial with the original response and prior32 models retained',async()=>{
 const r=replay(p=>{if(p.label==='role-01-canonical')p.status=403}),e=await failureOf(run(r));assert.equal(e.status,403);assert.equal(r.requests.length,3);assert.equal(e.nativeEvidence.primary.records.length,32);assert.equal(e.nativeEvidence.rawResponses[2].response.status,403);assert.equal(e.nativeEvidence.detailRecords.length,0)
})

test('2070Health partial observers are awaited and detached from the terminal full native evidence',async()=>{
 const events=[],r=replay(),e=await failureOf(run(r,{onAudit:async a=>{await new Promise(resolve=>setTimeout(resolve,3));events.push('audit');a.primary.records[0].title='sink edit'},onRecords:async rows=>{await new Promise(resolve=>setTimeout(resolve,3));events.push('records');assert.equal(rows.length,32);rows[0].title='second sink edit'}}));assert.deepEqual(events,['audit','records']);assert.deepEqual(e.nativeEvidence.primary,primary);assert.equal(e.nativeEvidence.observations[0].title,primary.records[0].title)
})

test('2070Health audit sink failures cannot replace the first empty-criteria failure or erase observed rows',async()=>{
 let recordsCalls=0;const r=replay(),e=await failureOf(run(r,{onAudit:()=>{throw Error('sink failed')},onRecords:rows=>{recordsCalls++;assert.equal(rows.length,32)}}));assert.equal(e.code,'HEALTH2070_NATIVE_CRITERIA_MISSING');assert.equal(recordsCalls,1);assert.equal(e.nativeEvidence.auditSinkFailures[0].message,'sink failed');assert.equal(e.nativeEvidence.primary.records.length,32)
})

test('2070Health preserves the actual denial classification and Retry-After through its partial source annotation',async()=>{
 const r=replay(p=>{if(p.label==='role-01-canonical'){p.status=429;p.headers['Retry-After']='5'}}),e=await failureOf(run(r));assert.equal(e.status,429);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.softFailure,true);assert.equal(e.retryDelayMs,5000);assert.equal(e.nativeEvidence.rawResponses.length,3);assert.equal(e.nativeEvidence.primary.records.length,32)
})

test('2070Health accepts only the exact HTML MIME essence and keeps a distinct subtype original unqualified',async()=>{
 const r=replay(p=>{if(p.label==='role-01-canonical')p.headers['content-type']='text/html+xml'}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_NATIVE_PROOF');assert.equal(e.nativeEvidence.rawResponses[2].response.contentType,'text/html+xml');assert.equal(e.nativeEvidence.rawResponses[2].response.rawBodyBase64,fixture.packets[2].bodyBase64);assert.equal(e.nativeEvidence.detailRecords.length,0);assert.equal(r.requests.length,3)
})

test('2070Health retains conflicting native country claims without projecting a confident country',async()=>{
 const r=replay(p=>{if(p.label==='role-01-canonical')mutateBody(p,html=>html.replace('>Bengaluru, Karnataka, India</p>','>Boston, Massachusetts, United States</p>'))}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_NATIVE_IDENTITY_CONFLICT');assert.equal(e.nativeEvidence.primary.records[0].explicitCountryClaim,'India');assert.equal(e.nativeEvidence.detailRecords[0].explicitCountryClaim,'United States');assert.equal(e.nativeEvidence.observations[0].country,null);assert.equal(e.nativeEvidence.observations[0].sourceNativeCountryConflict,true)
})

test('2070Health keeps an exact false caller cancellation and terminal evidence despite a late ignored producer',async()=>{
 const r=replay(),controller=new AbortController(),base=r.options.fetchImpl;let late,timer;const fetchImpl=async(...args)=>{const p=await base(...args);timer=setTimeout(()=>controller.abort(false),5);await new Promise(resolve=>{late=setTimeout(resolve,45)});return p};let caught='not-rejected';try{await run(r,{fetchImpl,signal:controller.signal})}catch(e){caught=e}finally{clearTimeout(timer)}assert.equal(caught,false);const {readHealth2070FailureEvidence}=await import('../scraper/2070health/native20261108.js'),evidence=readHealth2070FailureEvidence(controller.signal);assert.equal(evidence.rawResponses.length,0);await new Promise(resolve=>setTimeout(resolve,75));assert.deepEqual(readHealth2070FailureEvidence(controller.signal),evidence);clearTimeout(late)
})

test('2070Health opaque producer failures are annotated with their exact cause instead of being mistaken for collection success',async()=>{
 for(const value of [false,0,undefined,{producer:'opaque failure'}]){let calls=0;const r=replay(),e=await failureOf(run(r,{fetchImpl:async()=>{calls++;throw value}}));assert.equal(e.code,'HEALTH2070_NATIVE_INCOMPLETE');assert.equal(e.cause,value);assert.equal(calls,1);assert.equal(e.nativeEvidence.rawResponses.length,0);assert.equal(e.nativeEvidence.primary,null)}
})

test('2070Health read deadlines stop ignored late originals before they can append terminal evidence',async()=>{
 const r=replay(),base=r.options.fetchImpl,e=await failureOf(run(r,{readTimeoutMs:15,fetchImpl:async(...args)=>{const p=await base(...args);await new Promise(resolve=>setTimeout(resolve,60));return p}}));assert.equal(e.code,'HEALTH2070_READ_TIMEOUT');assert.equal(e.nativeEvidence.rawResponses.length,0);const before=structuredClone(e.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(e.nativeEvidence,before)
})

test('2070Health source deadlines retain earliest ownership over a longer ignored read',async()=>{
 const r=replay(),base=r.options.fetchImpl,e=await failureOf(run(r,{sourceTimeoutMs:15,readTimeoutMs:100,fetchImpl:async(...args)=>{const p=await base(...args);await new Promise(resolve=>setTimeout(resolve,60));return p}}));assert.equal(e.code,'HEALTH2070_NATIVE_TIMEOUT');assert.equal(e.nativeEvidence.rawResponses.length,0);const before=structuredClone(e.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(e.nativeEvidence,before)
})

test('2070Health bounded late audit sinks cannot replace the first empty-criteria failure or mutate the native originals',async()=>{
 const r=replay();let recordsCalls=0;const e=await failureOf(run(r,{auditTimeoutMs:15,onAudit:async value=>{await new Promise(resolve=>setTimeout(resolve,60));value.primary.records[0].title='late sink edit'},onRecords:()=>{recordsCalls++}}));assert.equal(e.code,'HEALTH2070_NATIVE_CRITERIA_MISSING');assert.equal(e.nativeEvidence.auditSinkFailures[0].code,'HEALTH2070_AUDIT_TIMEOUT');assert.equal(recordsCalls,0);const before=structuredClone(e.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(e.nativeEvidence,before)
})
import {classifyScraperError} from '../scraper-support/utils/failureClassification.js'
test('2070Health missing publisher criteria remains a coverage gap instead of becoming a new hard source failure',async()=>{
 const r=replay(),e=await failureOf(run(r)),classification=classifyScraperError(e);assert.equal(e.code,'HEALTH2070_NATIVE_CRITERIA_MISSING');assert.equal(classification.softFailure,true);assert.equal(classification.upstreamOutage,false);assert.equal(classification.failureKind,'coverage_gap');assert.equal(e.nativeEvidence.primary.records.length,32)
})

test('2070Health preserves an unreviewed role carrier class instead of silently dropping its published reference',async()=>{
 const r=replay(p=>{if(p.label==='primary')mutateBody(p,html=>html.replace(primary.records[0].nativeHTML,primary.records[0].nativeHTML.replace('class="career_card"','class="unreviewed_card_layout"')))}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_NATIVE_LISTING_PROOF');assert.equal(e.nativeEvidence.primary.records.length,32);assert.ok(e.nativeEvidence.primary.records.some(v=>v.nativePublicReference.value===primary.records[0].nativePublicReference.value&&v.nativeStructureUnqualified===true&&v.nativeHTML.includes('unreviewed_card_layout')));assert.equal(e.nativeEvidence.observations.length,32);assert.equal(r.requests.length,1)
})


test('2070Health state abbreviations remain unqualified location claims instead of becoming countries',async()=>{
 for(const label of ['Indianapolis, IN','San Francisco, CA']){const r=replay(p=>{if(p.label==='primary')mutateBody(p,html=>html.replace(primary.records[0].locationRaw,label))}),e=await failureOf(run(r,{maxRequests:1}));assert.equal(e.code,'HEALTH2070_REQUEST_BUDGET');assert.equal(e.nativeEvidence.primary.records[0].locationRaw,label);assert.equal(e.nativeEvidence.primary.records[0].explicitCountryClaim,null);assert.equal(e.nativeEvidence.observations[0].country,null);assert.equal(e.nativeEvidence.observations[0].sourceCountryScopeUnresolved,true);assert.equal(r.requests.length,1)}
})

test('2070Health hidden or inert criteria remain raw evidence and cannot advance collection',async()=>{
 for(const attribute of ['hidden','inert','aria-hidden="true"','style="display:none"']){const markup='<div class="carrer_details_content"><p '+attribute+'>Invisible fixture criteria</p></div>',r=replay(p=>{if(p.label==='role-01-canonical')mutateBody(p,html=>html.replace(detail.criteriaContainerHTML,markup))}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_NATIVE_CRITERIA_MISSING');assert.equal(r.requests.length,3);assert.equal(e.nativeEvidence.detailRecords[0].criteriaContainerHTML,markup);assert.equal(e.nativeEvidence.detailRecords[0].criteriaAvailable,false);assert.equal(e.nativeEvidence.observations[0].sourceNativeCriteriaComplete,false);assert.deepEqual(r.uncaptured,[])}
})

test('2070Health inactive native identity headings are retained before an identity hold',async()=>{
 const r=replay(p=>{if(p.label==='role-01-canonical')mutateBody(p,html=>html.replace('<p class="txt-sec-white fw500 mb-2 pb-1">','<p hidden class="txt-sec-white fw500 mb-2 pb-1">'))}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_NATIVE_IDENTITY_CONFLICT');assert.ok(e.nativeEvidence.detailRecords[0].headerHTML.includes('<p hidden class='));assert.equal(e.nativeEvidence.detailRecords[0].nativeIdentityVisibilityUnqualified,true);assert.equal(r.requests.length,3)
})

test('2070Health canonical recovery cannot suppress a redirected response identity error',async()=>{
 const r=replay(),base=r.options.fetchImpl;const fetchImpl=async(...args)=>{const p=await base(...args);if(p.status===301)Object.defineProperty(p,'redirected',{value:true});return p},e=await failureOf(run(r,{fetchImpl}));assert.equal(e.code,'HEALTH2070_RESPONSE_IDENTITY');assert.equal(r.requests.length,2);assert.equal(e.nativeEvidence.rawResponses[1].response.redirected,true);assert.equal(e.nativeEvidence.detailRecords.length,0);assert.equal(e.nativeEvidence.primary.records.length,32)
})

test('2070Health an invalid redirect entity length cannot admit a canonical GET',async()=>{
 const r=replay(p=>{if(p.label==='role-01')p.headers['content-length']='bogus'}),e=await failureOf(run(r));assert.equal(e.status,301);assert.equal(r.requests.length,2);const p=e.nativeEvidence.rawResponses[1].response;assert.equal(p.headers['content-length'],'bogus');assert.equal(p.bodyComplete,false);assert.equal(p.acquisitionValidated,false);assert.equal(p.streamEOFObserved,true);assert.equal(p.rawBodyBase64,'');assert.equal(e.nativeEvidence.detailRecords.length,0)
})

test('2070Health identity entity length contradictions retain bytes without parsing or later admission',async()=>{
 for(const declared of ['1','1000000']){const r=replay(p=>{if(p.label==='primary'){delete p.headers['content-encoding'];p.headers['content-length']=declared}}),e=await failureOf(run(r));assert.equal(e.code,'HEALTH2070_BODY_LENGTH_MISMATCH');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.primary,null);const p=e.nativeEvidence.rawResponses[0].response;assert.equal(p.bodyComplete,false);assert.equal(p.streamEOFObserved,true);assert.equal(p.acquisitionValidated,false);assert.equal(p.bodyBytes,fixture.packets[0].bodyBytes);assert.equal(p.rawBodyBase64,fixture.packets[0].bodyBase64)}
})

test('2070Health denial status retains priority while contradictory entity bytes stay unqualified',async()=>{
 const r=replay(p=>{if(p.label==='primary'){p.status=403;delete p.headers['content-encoding'];p.headers['content-length']='1'}}),e=await failureOf(run(r));assert.equal(e.status,403);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.rawResponses[0].response.bodyComplete,false);assert.equal(e.nativeEvidence.rawResponses[0].response.rawBodyBase64,fixture.packets[0].bodyBase64);assert.equal(e.nativeEvidence.primary,null)
})

import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
test('2070Health registered closing success preserves full audit receipts and normalized observations without acceptance credit',async()=>{
 const r=replay(p=>{if(p.label==='primary')mutateBody(p,html=>primary.records.slice(1).reduce((s,row)=>s.replace(row.nativeHTML,''),html));if(p.label==='role-01-canonical')mutateBody(p,html=>html.replace(detail.criteriaContainerHTML,'<div class="carrer_details_content"><p>Visible synthetic fixture criteria for boundary verification only.</p></div>'))});let records,audit;const jobs=await run(r,{onAudit:v=>{audit=v},onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(r.requests.length,6);assert.equal(records.length,1);assert.equal(audit.sourceScopeComplete,false);const retained=jobs.nativeCollectionEvidence;assert.ok(retained?.primary,'Registered decoration must retain the full native audit');assert.deepEqual(retained,audit);assert.equal(retained.rawResponses.length,6);assert.equal(retained.observations.length,1);assert.equal(retained.detailRecords.length,1);assert.equal(retained.closingDetailRecords.length,1);assert.equal(retained.recordKind,'vacancy-rows');assert.equal(retained.observedRecordCount,1);assert.equal(retained.observedVacancyCount,1);assert.deepEqual(readSourceObservationEvidence(jobs,'2070health'),{source:'2070health',recordKind:'vacancy-rows',observedRecordCount:1,observedVacancyCount:1,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});assert.equal(retained.currentNativePublicationQualified,undefined);assert.equal(retained.observations[0].company,null);assert.equal(retained.observations[0].sourceNativeCurrentPublicationQualified,false);assert.equal(retained.companyIndiaTotal,null)
})


test('2070Health registered catalog keeps source-owned native metadata above stale batch overrides',()=>{
 const provider=getScraperCatalog().find(v=>v.source==='2070health');assert.equal(provider.countryFilter,'Global');assert.equal(provider.parser,'live-parser');assert.equal(provider.atsPlatform,'first-party-native-listing-and-canonical-detail-pages');assert.equal(provider.catalogOverride,true);assert.equal(provider.backfillMode,null);assert.equal(provider.runtimeValidation,null);assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false);assert.equal(provider.zeroResultPolicy,'evidence-required')
})
