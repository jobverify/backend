import test from 'node:test'
import assert from 'node:assert/strict'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {fixture,replay,mutateBody,changeOrganization,changeWidget} from './test-data/attackiqNative20261108.js'
const expected=fixture.expected,provider=()=>getScraperCatalog().find(v=>v.source==='attackiq'),run=(r,options={})=>createCatalogScraper(provider()).run({...r.options,...options})
async function observed(r,options={}){let audit=null,records=null,jobs=null,error=null;try{jobs=await run(r,{...options,onAudit:async(v,...args)=>{audit=v;await options.onAudit?.(v,...args)},onRecords:async(v,...args)=>{records=v;await options.onRecords?.(v,...args)}})}catch(e){error=e}return{audit,records,jobs,error}}

test('AttackIQ registered extraction retains all seven complete independent native models',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null);const e=o.jobs.nativeCollectionEvidence;for(const[key,want]of Object.entries({primary:expected.openingPrimary,board:expected.openingBoard,helper:expected.openingHelper,closingHelper:expected.closingHelper,closingBoard:expected.closingBoard,closingPrimary:expected.closingPrimary}))assert.deepEqual(e[key],want);assert.deepEqual(e.details,[expected.detail]);assert.equal(e.rawResponses.length,7);assert.equal(r.requests.length,7);assert.deepEqual(r.uncaptured,[])
})
test('AttackIQ complete authored criteria retain all5240 characters including both agency notices',async()=>{
 const o=await observed(replay());assert.equal(o.error,null);const row=o.records[0];assert.equal(row.jobDescription,expected.detail.fullCriteriaText);assert.equal(row.jobDescription.length,5240);assert.equal(row.jobDescription.match(/Note to all recruitment agencies/g).length,2);assert.equal(row.sourceNativeCriteriaComplete,true);assert.equal(row.sourceNativeOwnDescriptionHTML,expected.detail.nativeDescriptionCarriers[0].nativeHTML)
})
test('AttackIQ Remote remains unknown country despite the USA title and tenant identity',async()=>{
 for(const countryFilter of['India','Global']){const o=await observed(replay(),{countryFilter});assert.equal(o.error,null);assert.equal(o.jobs.length,0);assert.equal(o.records.length,1);assert.equal(o.records[0].country,null);assert.equal(o.records[0].location,'Remote');assert.equal(o.records[0].sourceCountryScopeUnresolved,true);assert.equal(o.records[0].sourceCurrentNativeRoleQualified,false);assert.equal(o.records[0].title,'Client Security Advisor (USA)')}
})
test('AttackIQ opaque native IDs cannot become inferred requisitions or dates',async()=>{
 const o=await observed(replay());assert.equal(o.error,null);const row=o.records[0];assert.equal(row.jobId,'tV5qKlrDFw');assert.equal(row.sourceNativeListingRecord.attrs.id,'resumator-job-job_20260714134440_JQZDBXXYWJUMUGOA');assert.equal(row.requisitionId,null);assert.equal(row.postingDate,null);assert.equal(row.dateOpened,null);assert.equal(row.closingDate,null);assert.equal(row.city,null);assert.equal(row.state,null)
})
test('AttackIQ actual Jazz insertions remain complete data without publisher program execution',async()=>{
 const o=await observed(replay());assert.equal(o.error,null);assert.equal(o.audit.helper.nativeInsertions.length,5);assert.deepEqual(o.audit.helper,expected.openingHelper);assert.equal(o.audit.publisherProgramsExecuted,false);assert.equal(o.audit.applicationActions,0);assert.equal(o.audit.helper.records.length,1)
})
test('AttackIQ awaited detached observers preserve native originals and criteria',async()=>{
 const events=[],o=await observed(replay(),{onAudit:async v=>{await new Promise(r=>setTimeout(r,2));v.details[0].fullCriteriaText='edited';events.push('audit')},onRecords:async v=>{await new Promise(r=>setTimeout(r,2));v[0].jobDescription='edited';events.push('records')}});assert.equal(o.error,null);assert.deepEqual(events,['audit','records']);assert.deepEqual(o.jobs.nativeCollectionEvidence.details,[expected.detail]);assert.equal(o.jobs.nativeCollectionEvidence.observations[0].jobDescription,expected.detail.fullCriteriaText)
})
test('AttackIQ zero and one-job limits follow complete original observation',async()=>{
 for(const maxJobs of[0,1]){const r=replay(),o=await observed(r,{maxJobs});assert.equal(o.error,null);assert.equal(o.jobs.length,0);assert.equal(o.records.length,1);assert.deepEqual(o.audit.details,[expected.detail]);assert.equal(r.requests.length,7)}
})
test('AttackIQ one observed vacancy and unknown India inventory cannot become an authoritative zero',async()=>{
 const o=await observed(replay());assert.equal(o.error,null);assert.deepEqual(readSourceObservationEvidence(o.jobs,'attackiq'),{source:'attackiq',recordKind:'vacancy-rows',observedRecordCount:1,observedVacancyCount:1,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});const v=readInventoryEvidence(o.jobs);assert.equal(v.status,'coverage-gap');assert.equal(v.reportedTotal,null);assert.equal(v.indiaFacetCount,null);assert.equal(v.listingComplete,false)
})
test('AttackIQ registered and direct default selection remains India without losing unknown-country records',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null);const{run:direct}=await import('../scraper/attackiq/script.js'),jobs=await direct({...replay().options});assert.equal(provider().countryFilter,'India');assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,1);assert.equal(o.audit.observations[0].sourceNativeCurrentPublicationQualified,true)
})
test('AttackIQ effective registration clears stale sentinel counts and backfill claims',()=>{
 const p=provider();assert.equal(p.catalogOverride,true);assert.equal(p.parser,'live-parser');assert.equal(p.atsPlatform,'first-party-and-jazz-literal-widget-native-html');assert.equal(p.runtimeValidation,null);assert.equal(p.backfillMode,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false)
})
test('AttackIQ only exact declared original routes are read and no embed forms or share actions are requested',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null);assert.deepEqual(r.requests.map(v=>v.url),fixture.packets.map(v=>v.requestedURL));assert.ok(r.requests.every(v=>!v.url.includes('/embed/')&&!v.url.includes('/app/share/')&&!v.url.includes('google')));assert.equal(o.audit.applicationActions,0)
})
test('AttackIQ own employer title metadata and complete raw schema survive without a fabricated JobPosting record',async()=>{
 const o=await observed(replay());assert.equal(o.error,null);const row=o.records[0];assert.equal(row.company,'AttackIQ');assert.deepEqual(row.sourceNativeDetail,expected.detail);assert.deepEqual(row.sourceNativeEmployerClaim,expected.detail.nativeOrganizationRecords[0]);assert.equal(row.employmentType,'Full Time');assert.equal(row.experience,'Experienced');assert.equal(row.sourceNativeIdentityBound,true);assert.equal(row.sourceNativeCriteriaVisibilityQualified,false)
})
test('AttackIQ unfamiliar nested native organization fields remain whole and prototype safe',async()=>{
 const added=JSON.parse('{"clauses":["Own exact text",{"enabled":false}],"__proto__":{"unqualifiedAttackIQPollution":true}}'),r=replay(p=>{if(p.label==='detail-0')changeOrganization(p,v=>{v.Additional_Native_Terms=added})}),o=await observed(r);assert.equal(o.error,null);assert.deepEqual(o.records[0].sourceNativeEmployerClaim.Additional_Native_Terms,added);assert.equal(Object.hasOwn(o.records[0].sourceNativeEmployerClaim.Additional_Native_Terms,'__proto__'),true);assert.equal({}.unqualifiedAttackIQPollution,undefined);assert.equal(o.records[0].jobDescription,expected.detail.fullCriteriaText)
})
test('AttackIQ a zero request budget fails before original acquisition with inspectable empty native evidence',async()=>{
 const r=replay(),o=await observed(r,{maxRequests:0});assert.equal(o.error?.code,'ATTACKIQ_REQUEST_BUDGET');assert.equal(r.requests.length,0);assert.equal(o.error.nativeEvidence.rawResponses.length,0);assert.equal(o.error.nativeEvidence.observations.length,0)
})

test('AttackIQ conflicting own recruitment CTA destinations stay visible before any board admission',async()=>{
 const c=expected.openingPrimary.nativeHandoffs[0],r=replay(p=>{if(['current-primary','closing-primary'].includes(p.label))mutateBody(p,h=>h.replace(c.nativeHTML,c.nativeHTML.replace('href="https://www.attackiq.com/who-we-are/careers/openings/"','href="https://unqualified.example/jobs"')))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.primary.nativeHandoffs.length,2);assert.equal(o.error.nativeEvidence.primary.nativeHandoffs[0].url,'https://unqualified.example/jobs');assert.equal(r.requests.length,1)
})
test('AttackIQ inactive exact first-party recruitment handoffs preserve originals before authority hold',async()=>{
 const c=expected.openingPrimary.nativeHandoffs[0],r=replay(p=>{if(p.label==='current-primary')mutateBody(p,h=>h.replace(c.nativeHTML,c.nativeHTML.replace('<a ','<a inert ')))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.primary.nativeHandoffs[0].inactive,true);assert.equal(r.requests.length,1)
})
test('AttackIQ an inert Jazz script declaration cannot grant helper acquisition authority',async()=>{
 const c=expected.openingBoard.nativeRecruitmentScripts[0],r=replay(p=>{if(p.label==='declared-openings-board')mutateBody(p,h=>h.replace(c.nativeHTML,'<template>'+c.nativeHTML+'</template>'))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.deepEqual(o.error.nativeEvidence.board.nativeRecruitmentScripts[0],c);assert.equal(r.requests.length,2)
})
test('AttackIQ comment-only widget markup remains an original script without vacancy authority',async()=>{
 const c=expected.openingHelper.nativeInsertions.find(v=>v.nativeHTMLLiteral.includes('id="resumator-widget"')),r=replay(p=>{if(p.label==='declared-jazz-helper')mutateBody(p,h=>h.replace(c.nativeJavaScript,'/* '+c.nativeJavaScript+' */'))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.helper.records.length,0);assert.equal(o.error.nativeEvidence.rawResponses.length,3);assert.equal(r.requests.length,3)
})
test('AttackIQ competing actual widget insertions retain both native rows before admission stops',async()=>{
 const c=expected.openingHelper.nativeInsertions.find(v=>v.nativeHTMLLiteral.includes('id="resumator-widget"')),r=replay(p=>{if(p.label==='declared-jazz-helper')mutateBody(p,h=>h.replace(c.nativeJavaScript,c.nativeJavaScript+';'+c.nativeJavaScript))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.helper.nativeWidgetCarriers.length,2);assert.equal(o.error.nativeEvidence.helper.records.length,2);assert.equal(r.requests.length,3)
})
test('AttackIQ widget markup bound to a different DOM target stays evidence without declaration authority',async()=>{
 const r=replay(p=>{if(p.label==='declared-jazz-helper')mutateBody(p,h=>h.replace('document.getElementById("resumator-wrapper")','document.getElementById("different-target")'))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.helper.records.length,1);assert.equal(r.requests.length,3)
})
test('AttackIQ a foreign native View details URL survives without any foreign request',async()=>{
 const r=replay(p=>{if(p.label==='declared-jazz-helper')changeWidget(p,h=>h.replace('https://attackiq.applytojob.com/apply/','https://unqualified.example/apply/'))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.ok(o.error.nativeEvidence.helper.records[0].links[0].url.startsWith('https://unqualified.example/'));assert.equal(r.requests.length,3)
})
test('AttackIQ a hidden native widget row cannot authorize a posting read',async()=>{
 const r=replay(p=>{if(p.label==='declared-jazz-helper')changeWidget(p,h=>h.replace('class="resumator-job resumator-jobs-text"','hidden class="resumator-job resumator-jobs-text"'))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.ok(o.error.nativeEvidence.helper.records[0].nativeHTML.includes('hidden'));assert.equal(r.requests.length,3)
})
test('AttackIQ contradictory native canonical claims retain full own criteria before identity holds',async()=>{
 const old=expected.detail.head.canonicals[0],r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace('href="'+old+'"','href="https://attackiq.applytojob.com/apply/DIFFERENT/Foreign"'))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].fullCriteriaText,expected.detail.fullCriteriaText);assert.equal(o.error.nativeEvidence.observations[0].sourceNativeIdentityBound,false);assert.equal(r.requests.length,4)
})
test('AttackIQ hidden meaningful title descendants preserve original text without identity qualification',async()=>{
 const c=expected.detail.nativeTitleCarriers[0],r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace(c.nativeHTML,c.nativeHTML.replace(c.authoredText,'<span hidden>'+c.authoredText+'</span>')))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].nativeTitleCarriers[0].authoredText,c.authoredText);assert.equal(r.requests.length,4)
})
test('AttackIQ inactive complete authored criteria remain whole before publication holds',async()=>{
 const c=expected.detail.nativeDescriptionCarriers[0],r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace(c.nativeHTML,c.nativeHTML.replace('<div ','<div hidden ')))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].fullCriteriaText,expected.detail.fullCriteriaText);assert.equal(o.error.nativeEvidence.observations[0].sourceNativeCurrentPublicationQualified,false);assert.equal(r.requests.length,4)
})
test('AttackIQ an explicit own India metadata claim conflicting with its USA title stays unresolved',async()=>{
 const c=expected.detail.nativeMetadataCarriers[0],r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace(c.nativeHTML,c.nativeHTML.replace(/<\/div>\s*$/,'<div title="Country">India</div></div>')))}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error,null);assert.equal(o.jobs.length,0);assert.equal(o.records[0].country,null);assert.equal(o.records[0].sourceNativeCountryClaimConflict,true);assert.ok(o.records[0].sourceNativeDetail.nativeMetadataCarriers[0].authoredText.includes('India'));assert.equal(r.requests.length,7)
})
test('AttackIQ changed closing widget retains opening detail and the new row before publication holds',async()=>{
 const r=replay(p=>{if(p.label==='closing-jazz-helper')changeWidget(p,h=>h.replace('Client Security Advisor (USA)','Changed own title'))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_CLOSING_CONFLICT');assert.equal(o.error.nativeEvidence.closingHelper.records[0].nativeTitleCarriers[0].authoredText,'Changed own title');assert.deepEqual(o.error.nativeEvidence.details,[expected.detail]);assert.equal(o.error.nativeEvidence.observations[0].sourceNativeCurrentPublicationQualified,false);assert.equal(r.requests.length,5)
})
test('AttackIQ detail budget exhaustion preserves the complete one-vacancy widget before any detail',async()=>{
 const r=replay(),o=await observed(r,{maxRequests:3});assert.equal(o.error?.code,'ATTACKIQ_REQUEST_BUDGET');assert.equal(o.records.length,1);assert.equal(o.error.nativeEvidence.helper.records.length,1);assert.equal(o.error.nativeEvidence.details.length,0);assert.equal(r.requests.length,3)
})
test('AttackIQ original HTTP denial outranks a failing Jazz stream and stops before any detail',async()=>{
 const r=replay(p=>{if(p.label==='declared-jazz-helper')p.status=403}),base=r.options.fetchImpl,o=await observed(r,{fetchImpl:async(...args)=>{const original=await base(...args);if(String(args[0])!=='https://app.jazz.co/widgets/basic/create/AttackIQ')return original;await original.body.cancel();let pulls=0;const response=new Response(new ReadableStream({pull(c){if(pulls++===0)c.enqueue(new TextEncoder().encode('partial native denial'));else c.error(Error('original denied stream failed'))}}),{status:403,headers:original.headers});Object.defineProperty(response,'url',{value:original.url});return response}});assert.equal(o.error.status,403);assert.equal(o.error.failureKind,'blocked_or_access_denied');const receipt=o.error.nativeEvidence.rawResponses[2].response;assert.equal(receipt.bodyComplete,false);assert.equal(receipt.bodyBytes,21);assert.equal(receipt.acquisitionFailure.message,'original denied stream failed');assert.equal(r.requests.length,3)
})
test('AttackIQ a non-JavaScript helper MIME remains a complete original without widget parsing',async()=>{
 const r=replay(p=>{if(p.label==='declared-jazz-helper')p.headers['content-type']='text/html'}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.helper,null);assert.equal(o.error.nativeEvidence.rawResponses[2].response.bodyComplete,true);assert.equal(r.requests.length,3)
})
test('AttackIQ exact false cancellation owns ignored late acquisition with immutable failure evidence',async()=>{
 const r=replay(),base=r.options.fetchImpl,controller=new AbortController();let timer;const o=await observed(r,{signal:controller.signal,fetchImpl:async(...args)=>{const response=await base(...args);timer=setTimeout(()=>controller.abort(false),5);await new Promise(resolve=>setTimeout(resolve,60));return response}});clearTimeout(timer);assert.equal(o.error,false);const{readAttackIQFailureEvidence}=await import('../scraper/attackiq/native20261108.js'),proof=readAttackIQFailureEvidence(controller.signal);assert.equal(proof.rawResponses.length,0);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(readAttackIQFailureEvidence(controller.signal),proof)
})
test('AttackIQ source lifetime outranks ignored longer acquisition without late snapshot mutation',async()=>{
 const r=replay(),base=r.options.fetchImpl,o=await observed(r,{sourceTimeoutMs:15,readTimeoutMs:100,fetchImpl:async(...args)=>{const response=await base(...args);await new Promise(resolve=>setTimeout(resolve,60));return response}});assert.equal(o.error?.code,'ATTACKIQ_NATIVE_TIMEOUT');assert.equal(o.error.nativeEvidence.rawResponses.length,0);const proof=structuredClone(o.error.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(o.error.nativeEvidence,proof)
})
test('AttackIQ noncloneable secondary observer diagnostics cannot erase the earlier request cause or row',async()=>{
 const r=replay();let received;const o=await observed(r,{maxRequests:3,onAudit:()=>{throw{code:Symbol('opaque'),message:()=> 'opaque'}},onRecords:v=>{received=v}});assert.equal(o.error?.code,'ATTACKIQ_REQUEST_BUDGET');assert.equal(received.length,1);assert.deepEqual(o.error.nativeEvidence.auditSinkFailures,[{sink:'audit',name:null,code:null,message:null}]);assert.equal(o.error.nativeEvidence.rawResponses.length,3)
})
test('AttackIQ finite pagination truncation is rejected before original acquisition',async()=>{
 const r=replay(),o=await observed(r,{maxPages:1});assert.equal(o.error?.code,'ATTACKIQ_INVALID_OPTIONS');assert.equal(r.requests.length,0)
})
test('AttackIQ a foreign own organization claim preserves the complete schema and criteria',async()=>{
 const r=replay(p=>{if(p.label==='detail-0')changeOrganization(p,v=>{v.name='Foreign Company'})}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].nativeOrganizationRecords[0].name,'Foreign Company');assert.equal(o.error.nativeEvidence.details[0].fullCriteriaText,expected.detail.fullCriteriaText);assert.equal(o.error.nativeEvidence.observations[0].company,null);assert.equal(r.requests.length,4)
})
test('AttackIQ duplicate own employer properties retain raw ambiguity and full authored criteria',async()=>{
 const c=expected.detail.nativeSchemaCarriers[0],changed=c.rawJSON.replace('"name": "AttackIQ"','"name": "AttackIQ", "name": "Foreign"');assert.notEqual(changed,c.rawJSON);const r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace(c.rawJSON,changed))}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].nativeSchemaCarriers[0].rawJSON,changed);assert.equal(o.error.nativeEvidence.details[0].nativeOrganizationRecords.length,0);assert.equal(o.error.nativeEvidence.details[0].fullCriteriaText,expected.detail.fullCriteriaText);assert.equal(r.requests.length,4)
})

import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const withOwnCountry=(p,country='United States')=>mutateBody(p,h=>{const c=expected.detail.nativeMetadataCarriers[0];return h.replace(c.nativeHTML,c.nativeHTML.replace(/<\/div>\s*$/,'<div title="Country">'+country+'</div></div>'))})
const hideIdentityHead=html=>html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi,v=>'<template>'+v+'</template>').replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi,v=>'<template>'+v+'</template>').replace(/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/gi,v=>'<template>'+v+'</template>')
test('AttackIQ reviewed dormant helper activation cannot authorize any own posting acquisition',async()=>{
 const r=replay(p=>{if(['declared-jazz-helper','closing-jazz-helper'].includes(p.label))mutateBody(p,h=>h.replaceAll('insertResumatorWrapper();','/* dormant activation */'));if(p.label==='detail-0')withOwnCountry(p)}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.helper.records.length,1);assert.equal(o.error.nativeEvidence.observations[0].sourceNativeCurrentPublicationQualified,false);assert.equal(r.requests.length,3)
})
test('AttackIQ reviewed whole helper under an inactive program branch retains evidence without authority',async()=>{
 const r=replay(p=>{if(['declared-jazz-helper','closing-jazz-helper'].includes(p.label))mutateBody(p,h=>'if(false){\n'+h+'\n}');if(p.label==='detail-0')withOwnCountry(p)}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.helper.records.length,1);assert.equal(o.error.nativeEvidence.rawResponses.length,3);assert.equal(r.requests.length,3)
})
test('AttackIQ reviewed a dormant foreign insertion cannot lend its row to an empty authorized widget',async()=>{
 const row=expected.openingHelper.records[0].nativeHTML,r=replay(p=>{if(['declared-jazz-helper','closing-jazz-helper'].includes(p.label)){changeWidget(p,()=>'<div id="resumator-widget"></div>');mutateBody(p,h=>h+'\nfunction neverCalled(){other.insertAdjacentHTML("beforeend",'+JSON.stringify(row)+')}')}if(p.label==='detail-0')withOwnCountry(p)}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.helper.records.length,1);assert.ok(o.error.nativeEvidence.helper.nativeInsertions.some(v=>v.receiver==='other'));assert.equal(o.error.nativeEvidence.observations[0].sourceNativeCurrentPublicationQualified,false);assert.equal(r.requests.length,3)
})
test('AttackIQ reviewed competing foreign native detail CTA claims hold before any detail read',async()=>{
 const r=replay(p=>{if(['declared-jazz-helper','closing-jazz-helper'].includes(p.label))changeWidget(p,h=>h.replace('</a>','</a><a class="resumator-job-link" href="https://foreign.example/apply/OTHER/Foreign">+ View details</a>'));if(p.label==='detail-0')withOwnCountry(p)}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.helper.records[0].links.length,2);assert.equal(r.requests.length,3)
})
test('AttackIQ reviewed unrelated informational foreign links do not become recruitment CTA conflicts',async()=>{
 const r=replay(p=>{if(['declared-jazz-helper','closing-jazz-helper'].includes(p.label))changeWidget(p,h=>h.replace('</a>','</a><a href="https://information.example/benefits">Benefits information</a>'));if(p.label==='detail-0')withOwnCountry(p)}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error,null);assert.equal(o.jobs.length,1);assert.equal(o.jobs[0].country,'United States');assert.equal(o.audit.helper.records[0].links.length,2);assert.equal(r.requests.length,7)
})
test('AttackIQ reviewed inactive company head claims retain native values without recruitment authority',async()=>{
 const r=replay(p=>{if(['current-primary','closing-primary'].includes(p.label))mutateBody(p,hideIdentityHead);if(p.label==='detail-0')withOwnCountry(p)}),o=await observed(r);assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.deepEqual(o.error.nativeEvidence.primary.head.titles,expected.openingPrimary.head.titles);assert.deepEqual(o.error.nativeEvidence.primary.head.canonicals,expected.openingPrimary.head.canonicals);assert.equal(r.requests.length,1)
})
test('AttackIQ reviewed inactive own head claims cannot bind a fully preserved description',async()=>{
 const r=replay(p=>{if(p.label==='detail-0'){withOwnCountry(p);mutateBody(p,hideIdentityHead)}}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].fullCriteriaText,expected.detail.fullCriteriaText);assert.equal(o.error.nativeEvidence.observations[0].sourceNativeIdentityBound,false);assert.equal(r.requests.length,4)
})
test('AttackIQ reviewed all native body posting IDs must agree with the admitted route',async()=>{
 const old=expected.detail.nativeBodyClaims[0].attrs.class,r=replay(p=>{if(p.label==='detail-0'){withOwnCountry(p);mutateBody(p,h=>h.replace(old,old+' job-FOREIGN'))}}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error?.code,'ATTACKIQ_NATIVE_PROOF');assert.ok(o.error.nativeEvidence.details[0].nativeBodyClaims[0].attrs.class.includes('job-FOREIGN'));assert.equal(o.error.nativeEvidence.details[0].fullCriteriaText,expected.detail.fullCriteriaText);assert.equal(r.requests.length,4)
})
test('AttackIQ reviewed explicit own location country contradictions cannot qualify a different own country',async()=>{
 const c=expected.detail.nativeAttributeRecords.find(v=>v.attrs.title==='Location'),r=replay(p=>{if(p.label==='detail-0'){withOwnCountry(p);mutateBody(p,h=>h.replace(c.nativeHTML,c.nativeHTML.replace('Remote','India')))}}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error,null);assert.equal(o.jobs.length,0);assert.equal(o.records[0].country,null);assert.equal(o.records[0].sourceNativeCountryClaimConflict,true);assert.ok(o.records[0].sourceNativeDetail.nativeMetadataCarriers[0].authoredText.includes('India'));assert.equal(r.requests.length,7)
})
test('AttackIQ reviewed unknown and non-country region labels stay unknown without a title conflict fallback',async()=>{
 for(const country of['Unknown Region','European Union','United Nations','Outlying Oceania','Pseudo-Accents','Pseudo-Bidi','Remote','Worldwide','ZZ']){const r=replay(p=>{if(['declared-jazz-helper','closing-jazz-helper'].includes(p.label))changeWidget(p,h=>h.replaceAll('Client Security Advisor (USA)','Client Security Advisor'));if(p.label==='detail-0'){withOwnCountry(p,country);mutateBody(p,h=>h.replaceAll('Client Security Advisor (USA)','Client Security Advisor'))}}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error,null);assert.equal(o.jobs.length,0,country);assert.equal(o.records[0].country,null,country);assert.deepEqual(o.records[0].sourceNativeCountryClaims,[country]);assert.equal(o.records[0].sourceCurrentNativeRoleQualified,false);assert.equal(r.requests.length,7)}
})
test('AttackIQ reviewed omission of optional OG URL metadata retains the exact canonical and own identity',async()=>{
 const r=replay(p=>{if(p.label==='detail-0'){withOwnCountry(p);mutateBody(p,h=>h.replace(/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/gi,''))}}),o=await observed(r,{countryFilter:'Global'});assert.equal(o.error,null);assert.equal(o.jobs.length,1);assert.equal(o.jobs[0].sourceNativeIdentityBound,true);assert.deepEqual(o.audit.details[0].head.canonicals,expected.detail.head.canonicals);assert.equal(r.requests.length,7)
})
const oracleRoot=fileURLToPath(new URL('../../reports/scraper-goal-remaining-2998-2026-11-04/attackiq-native-publication-20261108/',import.meta.url))
const oracleCase=body=>{const code=`from pathlib import Path
import sys,runpy,json,re
r=Path(sys.argv[1]);ns=runpy.run_path(str(r/'independent-native-models.py'))
s=(r/'declared-jazz-helper-original.js').read_bytes().decode('utf-8')
original=ns['helper'](s);assert original==json.loads((r/'declared-jazz-helper-independent-full-model.json').read_bytes())
def rejects(reader,*args):
 try:reader(*args)
 except (AssertionError,ValueError):return True
 return False
${body}
`;const result=spawnSync('python',['-X','utf8','-',oracleRoot],{input:code,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr||result.stdout)}
test('AttackIQ reviewed independent oracle rejects dormant helper activation instead of asserting publication from identical models',()=>{
 oracleCase(`assert rejects(ns['helper'],s.replace('insertResumatorWrapper();','/* dormant */'))
assert rejects(ns['helper'],'if(false){\\n'+s+'\\n}')`)
})
test('AttackIQ reviewed independent oracle requires every native row to belong to its authorized widget',()=>{
 oracleCase(`old=next(v for v in original['nativeInsertions']if 'id="resumator-widget"'in v['nativeHTMLLiteral'])
replacement='resumatorWrapper.insertAdjacentHTML("beforeend",'+json.dumps('<div id="resumator-widget"></div>')+')'
changed=s.replace(old['nativeJavaScript'],replacement)+'\\nfunction neverCalled(){other.insertAdjacentHTML("beforeend",'+json.dumps(original['records'][0]['nativeHTML'])+')}'
assert rejects(ns['helper'],changed)`)
})
test('AttackIQ reviewed independent oracle checks active primary head authority over original markup',()=>{
 oracleCase(`html=(r/'current-primary-original.html').read_bytes().decode('utf-8')
assert ns['primary'](html)
changed=re.sub(r'<title\\b[^>]*>[\\s\\S]*?</title>',lambda m:'<template>'+m[0]+'</template>',html,flags=re.I)
assert changed!=html
assert rejects(ns['primary'],changed)`)
})
test('AttackIQ reviewed independent oracle rejects contradictory own body identities over original markup',()=>{
 oracleCase(`html=(r/'detail-0-original.html').read_bytes().decode('utf-8');url=json.loads((r/'detail-0-capture.json').read_bytes())['requestedURL']
model=ns['detail'](html,url);old=model['nativeBodyClaims'][0]['attrs']['class'];changed=html.replace(old,old+' job-FOREIGN')
assert changed!=html
assert rejects(ns['detail'],changed,url)`)
})
