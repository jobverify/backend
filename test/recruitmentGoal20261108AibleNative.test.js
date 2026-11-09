import test from 'node:test'
import assert from 'node:assert/strict'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {fixture,replay,mutateBody} from './test-data/aibleNative20261108.js'
const provider=()=>getScraperCatalog().find(v=>v.source==='aible'),run=(r,options={})=>createCatalogScraper(provider()).run({...r.options,...options}),failureOf=async promise=>{try{await promise;assert.fail('Expected native source failure')}catch(e){if(e?.code==='ERR_ASSERTION')throw e;return e}},opening=fixture.expected.opening,closing=fixture.expected.closing

test('Aible registered extraction retains all three full authored native models and paired originals',async()=>{
 const r=replay(),jobs=await run(r),e=jobs.nativeCollectionEvidence;assert.equal(jobs.length,0);assert.deepEqual(e.primary,opening);assert.deepEqual(e.closingPrimary,closing);assert.equal(e.observations.length,3);assert.deepEqual(r.uncaptured,[])
})

test('Aible zero output caps preserve all full native observations and supported registry audit metadata',async()=>{
 const r=replay();let records;const jobs=await run(r,{maxJobs:0,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records.length,3);assert.deepEqual(jobs.nativeCollectionEvidence.primary,opening);assert.deepEqual(readSourceObservationEvidence(jobs,'aible'),{source:'aible',recordKind:'vacancy-rows',observedRecordCount:3,observedVacancyCount:3,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
})

test('Aible U.S. eligibility and company address are not promoted to workplace countries or legal role employers',async()=>{
 const r=replay(),jobs=await run(r,{countryFilter:'United States'}),rows=jobs.nativeCollectionEvidence.observations;assert.equal(rows.length,3);assert.deepEqual(rows[0].sourceNativeRecord.nativeEligibilityStatements,['Must be authorized to work in the U.S.','Must be authorized to work in the U.S.']);for(const row of rows){assert.equal(row.country,null);assert.equal(row.location,null);assert.equal(row.company,null);assert.equal(row.sourceCountryScopeUnresolved,true);assert.equal(row.sourceNativeCriteriaVisibilityQualified,false);assert.equal(row.sourceNativeCurrentPublicationQualified,false)}assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})

test('Aible preserves full native form configuration and controls without making them posting identifiers or application actions',async()=>{
 const r=replay(),jobs=await run(r);for(const row of jobs.nativeCollectionEvidence.observations){assert.equal(row.jobId,null);assert.equal(row.requisitionId,null);assert.equal(row.postingDate,null);assert.equal(row.closingDate,null);assert.ok(row.sourceNativeRecord.nativeFormMarkup[0].includes('hbspt.forms.create'));assert.equal(row.sourceNativeRecord.nativeFormScripts.length,2);assert.equal(row.sourceNativeRecord.applicationControls[0].attrs.id,'apply-btn');assert.equal(row.applicationVisited,false);assert.equal(row.activeApplyVerified,false)}assert.equal(r.requests.length,2);assert.equal(jobs.nativeCollectionEvidence.publisherProgramsExecuted,false);assert.equal(jobs.nativeCollectionEvidence.applicationActions,0)
})

test('Aible records two admitted anonymous manual GETs with independently captured opening and closing bytes',async()=>{
 const r=replay(),jobs=await run(r),e=jobs.nativeCollectionEvidence;assert.equal(e.rawResponses.length,2);assert.equal(e.requestCount,2);for(const [i,v]of e.rawResponses.entries()){assert.equal(v.response.rawBodyBase64,fixture.packets[[0,3][i]].bodyBase64);assert.equal(v.response.bodyComplete,true);assert.equal(v.response.identityValidated,true);assert.equal(v.response.acquisitionValidated,true)}assert.ok(r.requests.every(v=>v.method==='GET'&&v.redirect==='manual'&&v.credentials==='omit'))
})

test('Aible awaits detached full audit and record sinks before returning its registered result',async()=>{
 const r=replay(),events=[],jobs=await run(r,{onAudit:async e=>{await new Promise(resolve=>setTimeout(resolve,3));e.primary.records[0].title='sink edit';events.push('audit')},onRecords:async rows=>{await new Promise(resolve=>setTimeout(resolve,3));assert.equal(rows.length,3);rows[0].title='second sink edit';events.push('records')}});assert.deepEqual(events,['audit','records']);assert.deepEqual(jobs.nativeCollectionEvidence.primary,opening);assert.equal(jobs.nativeCollectionEvidence.observations[0].title,opening.records[0].title)
})

test('Aible observer errors retain the complete paired native collection and still report records',async()=>{
 const r=replay();let recordCalls=0;const e=await failureOf(run(r,{onAudit:()=>{throw Error('native audit sink failed')},onRecords:rows=>{recordCalls++;assert.equal(rows.length,3)}}));assert.equal(e.message,'native audit sink failed');assert.equal(recordCalls,1);assert.deepEqual(e.nativeEvidence.primary,opening);assert.deepEqual(e.nativeEvidence.closingPrimary,closing);assert.equal(e.nativeEvidence.rawResponses.length,2)
})

test('Aible preserves a changed complete closing model before rejecting unstable native publication evidence',async()=>{
 const r=replay(p=>{if(p.label==='closing-primary')mutateBody(p,html=>html.replace('Business Development Manager','Changed role title'))}),e=await failureOf(run(r));assert.equal(e.code,'AIBLE_NATIVE_CLOSING_CONFLICT');assert.equal(e.nativeEvidence.primary.records[0].title,opening.records[0].title);assert.equal(e.nativeEvidence.closingPrimary.records[0].title,'Changed role title');assert.equal(e.nativeEvidence.observations.length,3);assert.equal(r.requests.length,2)
})

test('Aible retains every carrier before holding an absent authored criteria container without a closing read',async()=>{
 const r=replay(p=>{if(p.label==='primary')mutateBody(p,html=>html.replace(opening.records[0].criteriaContainerHTML,''))}),e=await failureOf(run(r));assert.equal(e.code,'AIBLE_NATIVE_PROOF');assert.equal(e.nativeEvidence.primary.records.length,3);assert.equal(e.nativeEvidence.primary.records[0].nativeDescriptionHTML,null);assert.equal(e.nativeEvidence.primary.records[0].nativeAuthoredCriteriaAvailable,false);assert.equal(r.requests.length,1)
})

test('Aible preserves duplicate native carriers without fabricating role identifiers',async()=>{
 const r=replay(p=>{if(p.label==='primary')mutateBody(p,html=>html.replace(opening.records[0].nativeHTML,opening.records[0].nativeHTML+opening.records[0].nativeHTML))}),e=await failureOf(run(r));assert.equal(e.code,'AIBLE_NATIVE_PROOF');assert.equal(e.nativeEvidence.primary.records.length,4);assert.equal(e.nativeEvidence.observations.length,4);assert.equal(e.nativeEvidence.primary.records[0].nativeHTML,e.nativeEvidence.primary.records[1].nativeHTML);assert.equal(e.nativeEvidence.observations[0].jobId,null);assert.equal(r.requests.length,1)
})

test('Aible retains an unfamiliar native carrier layout before reporting an unreviewed contract',async()=>{
 const r=replay(p=>{if(p.label==='primary')mutateBody(p,html=>html.replace(opening.records[0].nativeHTML,opening.records[0].nativeHTML.replace('class="careers-item"','class="unreviewed-role-layout"')))}),e=await failureOf(run(r));assert.equal(e.code,'AIBLE_NATIVE_PROOF');assert.equal(e.nativeEvidence.primary.records.length,3);assert.equal(e.nativeEvidence.primary.records[0].nativeStructureUnqualified,true);assert.ok(e.nativeEvidence.primary.records[0].nativeHTML.includes('unreviewed-role-layout'));assert.equal(r.requests.length,1)
})

test('Aible request caps retain all opening records and stop before the closing physical read',async()=>{
 const r=replay(),e=await failureOf(run(r,{maxRequests:1}));assert.equal(e.code,'AIBLE_REQUEST_BUDGET');assert.deepEqual(e.nativeEvidence.primary,opening);assert.equal(e.nativeEvidence.closingPrimary,null);assert.equal(e.nativeEvidence.observations.length,3);assert.equal(r.requests.length,1)
})

test('Aible rejects finite page truncation before any native acquisition',async()=>{
 const r=replay(),e=await failureOf(run(r,{maxPages:1}));assert.equal(e.code,'AIBLE_INVALID_OPTIONS');assert.equal(r.requests.length,0)
})

test('Aible registered catalog supersedes stale batch and sentinel metadata without claiming verified inventory',()=>{
 const p=provider();assert.equal(p.countryFilter,'Global');assert.equal(p.parser,'live-parser');assert.equal(p.atsPlatform,'first-party-native-inline-authored-roles');assert.equal(p.catalogOverride,true);assert.equal(p.runtimeValidation,null);assert.equal(p.backfillMode,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false)
})


test('Aible explicit inactive criteria retain authored bytes but cannot qualify a usable native body',async()=>{
 const markup='<div class="careers-body"><p hidden>Invisible fixture criteria only.</p></div>',r=replay(p=>{if(p.label==='primary')mutateBody(p,html=>html.replace(opening.records[0].criteriaContainerHTML,markup))}),e=await failureOf(run(r));assert.equal(e.code,'AIBLE_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.primary.records[0].criteriaContainerHTML,markup);assert.equal(e.nativeEvidence.primary.records[0].nativeAuthoredCriteriaAvailable,false);assert.equal(e.nativeEvidence.observations.length,3);assert.equal(e.softFailure,true);assert.equal(e.failureKind,'coverage_gap')
})

test('Aible retains HTTP denial classification and Retry-After after an opening full native observation',async()=>{
 const r=replay(p=>{if(p.label==='closing-primary'){p.status=429;p.headers['Retry-After']='7'}}),e=await failureOf(run(r));assert.equal(e.status,429);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.softFailure,true);assert.equal(e.retryDelayMs,7000);assert.deepEqual(e.nativeEvidence.primary,opening);assert.equal(e.nativeEvidence.closingPrimary,null);assert.equal(e.nativeEvidence.rawResponses.length,2)
})

test('Aible exact HTML MIME validation retains incompatible subtype originals without parsing',async()=>{
 const r=replay(p=>{if(p.label==='primary')p.headers['content-type']='text/html+xml'}),e=await failureOf(run(r));assert.equal(e.code,'AIBLE_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.primary,null);assert.equal(e.nativeEvidence.rawResponses[0].response.rawBodyBase64,fixture.packets[0].bodyBase64)
})

test('Aible contradicting identity Content-Length remains unqualified despite complete stream EOF',async()=>{
 const r=replay(p=>{if(p.label==='primary'){delete p.headers['content-encoding'];p.headers['content-length']='1'}}),e=await failureOf(run(r));assert.equal(e.code,'AIBLE_BODY_LENGTH_MISMATCH');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.primary,null);const p=e.nativeEvidence.rawResponses[0].response;assert.equal(p.bodyComplete,false);assert.equal(p.streamEOFObserved,true);assert.equal(p.acquisitionValidated,false);assert.equal(p.rawBodyBase64,fixture.packets[0].bodyBase64)
})

test('Aible automatically redirected response identity is rejected before model parsing or later admission',async()=>{
 const r=replay(),base=r.options.fetchImpl,e=await failureOf(run(r,{fetchImpl:async(...args)=>{const response=await base(...args);Object.defineProperty(response,'redirected',{value:true});return response}}));assert.equal(e.code,'AIBLE_RESPONSE_IDENTITY');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.primary,null);assert.equal(e.nativeEvidence.rawResponses[0].response.redirected,true)
})

test('Aible opaque false zero undefined and object producer failures keep their exact cause',async()=>{
 for(const value of [false,0,undefined,{producer:'opaque'}]){let calls=0;const r=replay(),e=await failureOf(run(r,{fetchImpl:async()=>{calls++;throw value}}));assert.equal(e.code,'AIBLE_NATIVE_INCOMPLETE');assert.equal(e.cause,value);assert.equal(calls,1);assert.equal(e.nativeEvidence.rawResponses.length,0);assert.equal(e.nativeEvidence.primary,null)}
})

test('Aible exact false caller cancellation isolates an ignored late producer and terminal evidence',async()=>{
 const r=replay(),base=r.options.fetchImpl,controller=new AbortController();let timer;let caught='not-rejected';try{await run(r,{signal:controller.signal,fetchImpl:async(...args)=>{const p=await base(...args);timer=setTimeout(()=>controller.abort(false),5);await new Promise(resolve=>setTimeout(resolve,60));return p}})}catch(e){caught=e}finally{clearTimeout(timer)}assert.equal(caught,false);const {readAibleFailureEvidence}=await import('../scraper/aible/native20261108.js'),evidence=readAibleFailureEvidence(controller.signal);assert.equal(evidence.rawResponses.length,0);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(readAibleFailureEvidence(controller.signal),evidence)
})

test('Aible read timeout prevents an ignored late original from mutating terminal evidence',async()=>{
 const r=replay(),base=r.options.fetchImpl,e=await failureOf(run(r,{readTimeoutMs:15,fetchImpl:async(...args)=>{const p=await base(...args);await new Promise(resolve=>setTimeout(resolve,60));return p}}));assert.equal(e.code,'AIBLE_READ_TIMEOUT');assert.equal(e.nativeEvidence.rawResponses.length,0);const before=structuredClone(e.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(e.nativeEvidence,before)
})

test('Aible earliest source timeout owns an ignored longer read and remains terminal',async()=>{
 const r=replay(),base=r.options.fetchImpl,e=await failureOf(run(r,{sourceTimeoutMs:15,readTimeoutMs:100,fetchImpl:async(...args)=>{const p=await base(...args);await new Promise(resolve=>setTimeout(resolve,60));return p}}));assert.equal(e.code,'AIBLE_NATIVE_TIMEOUT');assert.equal(e.nativeEvidence.rawResponses.length,0);const before=structuredClone(e.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(e.nativeEvidence,before)
})

test('Aible bounded late audit work cannot change retained complete models after failure',async()=>{
 const r=replay();let recordsCalls=0;const e=await failureOf(run(r,{auditTimeoutMs:15,onAudit:async v=>{await new Promise(resolve=>setTimeout(resolve,60));v.primary.records[0].title='late sink edit'},onRecords:()=>{recordsCalls++}}));assert.equal(e.code,'AIBLE_AUDIT_TIMEOUT');assert.equal(recordsCalls,0);assert.deepEqual(e.nativeEvidence.primary,opening);assert.equal(e.nativeEvidence.rawResponses.length,2);const before=structuredClone(e.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(e.nativeEvidence,before)
})

test('Aible an India authorization statement stays eligibility without creating an Indian worksite or accepted role',async()=>{
 const r=replay(p=>mutateBody(p,html=>html.replaceAll('Must be authorized to work in the U.S.','Must be authorized to work in India.'))),jobs=await run(r),rows=jobs.nativeCollectionEvidence.observations;assert.equal(jobs.length,0);assert.deepEqual(rows[0].sourceNativeRecord.nativeEligibilityStatements,['Must be authorized to work in India.','Must be authorized to work in India.']);assert.equal(rows[0].country,null);assert.equal(rows[0].sourceNativeCurrentPublicationQualified,false);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})

test('Aible preserves an additional authored native section without truncating known criteria',async()=>{
 const extra='<div class="new-native-term" data-policy="publisher claim"><h3>New native term</h3><p>Additional authored fixture criteria.</p></div>',r=replay(p=>mutateBody(p,html=>html.replace(opening.records[0].criteriaContainerHTML,opening.records[0].criteriaContainerHTML.replace(/<\/div>$/,extra+'</div>')))),jobs=await run(r),model=jobs.nativeCollectionEvidence.primary.records[0];assert.equal(model.sections.length,6);assert.equal(model.sections[5].attrs['data-policy'],'publisher claim');assert.equal(model.sections[5].nativeHTML,extra);assert.ok(model.fullCriteriaText.endsWith('New native term Additional authored fixture criteria.'));assert.ok(model.fullCriteriaText.startsWith(opening.records[0].fullCriteriaText));assert.equal(jobs.length,0)
})


test('Aible secondary noncloneable diagnostics cannot erase the original request failure or native models',async()=>{
 const r=replay();let records;const e=await failureOf(run(r,{maxRequests:1,onAudit:()=>{throw {message:()=> 'x'}},onRecords:v=>{records=v}}));assert.equal(e.code,'AIBLE_REQUEST_BUDGET');assert.equal(e.nativeEvidence.observations.length,3);assert.deepEqual(e.nativeEvidence.primary,opening);assert.equal(records.length,3);assert.deepEqual(e.nativeEvidence.auditSinkFailures,[{sink:'audit',name:null,code:null,message:null}]);assert.equal(r.requests.length,1)
})

test('Aible noncloneable secondary diagnostics preserve a complete closing conflict',async()=>{
 const r=replay(p=>{if(p.label==='closing-primary')mutateBody(p,html=>html.replace('Business Development Manager','Changed role title'))}),e=await failureOf(run(r,{onAudit:()=>{throw {name:Symbol('opaque'),code:()=> 'x',message:()=> 'x'}}}));assert.equal(e.code,'AIBLE_NATIVE_CLOSING_CONFLICT');assert.equal(e.nativeEvidence.primary.records.length,3);assert.equal(e.nativeEvidence.closingPrimary.records[0].title,'Changed role title');assert.equal(e.nativeEvidence.rawResponses.length,2);assert.deepEqual(e.nativeEvidence.auditSinkFailures,[{sink:'audit',name:null,code:null,message:null}])
})

test('Aible secondary opaque diagnostics cannot replace exact false caller cancellation or its terminal evidence',async()=>{
 const r=replay(),controller=new AbortController(),e=await failureOf(run(r,{maxRequests:1,signal:controller.signal,onAudit:()=>{throw {message:()=> 'x'}},onRecords:()=>controller.abort(false)}));assert.equal(e,false);const {readAibleFailureEvidence}=await import('../scraper/aible/native20261108.js'),proof=readAibleFailureEvidence(controller.signal);assert.deepEqual(proof.primary,opening);assert.equal(proof.observations.length,3);assert.equal(proof.auditSinkFailures.length,1)
})

test('Aible decodes named and numeric HTML references once in full authored text and attributes',async()=>{
 const extra='<p data-native="&copy; &eacute; &#38;amp;">Entity test: &copy; &eacute; &#38;amp;.</p>',r=replay(p=>mutateBody(p,html=>html.replace(opening.records[0].criteriaContainerHTML,opening.records[0].criteriaContainerHTML.replace(/<\/div>$/,extra+'</div>')))),jobs=await run(r),model=jobs.nativeCollectionEvidence.primary.records[0];assert.ok(model.fullCriteriaText.endsWith('Entity test: \u00a9 \u00e9 &amp;.'));assert.equal(model.sections.at(-1).attrs['data-native'],'\u00a9 \u00e9 &amp;');assert.equal(model.sections.at(-1).nativeHTML,extra);assert.deepEqual(jobs.nativeCollectionEvidence.primary,jobs.nativeCollectionEvidence.closingPrimary);assert.equal(jobs.length,0)
})

test('Aible invalid numeric text references use replacement characters and retain every authored model and raw slice',async()=>{
 const extra='<p>Entity test: &#x110000; &#0; &#xD800;.</p>',r=replay(p=>mutateBody(p,html=>html.replace(opening.records[0].criteriaContainerHTML,opening.records[0].criteriaContainerHTML.replace(/<\/div>$/,extra+'</div>')))),jobs=await run(r),e=jobs.nativeCollectionEvidence;assert.equal(e.primary.records.length,3);assert.ok(e.primary.records[0].fullCriteriaText.endsWith('Entity test: \ufffd \ufffd \ufffd.'));assert.equal(e.primary.records[0].sections.at(-1).nativeHTML,extra);assert.equal(e.rawResponses.length,2);assert.equal(e.observations.length,3);assert.equal(jobs.length,0)
})

test('Aible invalid numeric attribute references cannot abort all models before retention',async()=>{
 const extra='<p data-native="&#x110000; &#0; &#xD800;">Additional authored criteria.</p>',r=replay(p=>mutateBody(p,html=>html.replace(opening.records[0].criteriaContainerHTML,opening.records[0].criteriaContainerHTML.replace(/<\/div>$/,extra+'</div>')))),jobs=await run(r),e=jobs.nativeCollectionEvidence;assert.equal(e.primary.records.length,3);assert.equal(e.primary.records[0].sections.at(-1).attrs['data-native'],'\ufffd \ufffd \ufffd');assert.equal(e.primary.records[0].sections.at(-1).nativeHTML,extra);assert.equal(e.rawResponses.length,2);assert.equal(e.observations.length,3);assert.equal(jobs.length,0)
})

for(const inactive of ['hidden','inert'])test('Aible retains but holds a title supplied entirely by an '+inactive+' descendant',async()=>{
 const original=opening.records[0].titleControl.nativeHTML,replacement=original.replace('Business Development Manager','<span '+inactive+'>Business Development Manager</span>'),r=replay(p=>mutateBody(p,html=>html.replace(original,replacement))),e=await failureOf(run(r));assert.equal(e.code,'AIBLE_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.primary.records.length,3);assert.equal(e.nativeEvidence.primary.records[0].title,'Business Development Manager');assert.equal(e.nativeEvidence.primary.records[0].titleControl.nativeHTML,replacement);assert.equal(e.nativeEvidence.primary.records[0].nativeIdentityVisibilityUnqualified,true);assert.equal(e.nativeEvidence.observations.length,3);assert.equal(e.softFailure,true);assert.equal(e.failureKind,'coverage_gap')
})
