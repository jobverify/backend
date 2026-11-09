import test from 'node:test'
import assert from 'node:assert/strict'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {fixture,replay,mutateBody,changeSchema,changeNuxt} from './test-data/asusNative20261108.js'
const expected=fixture.expected,provider=()=>getScraperCatalog().find(v=>v.source==='asus'),run=(r,options={})=>createCatalogScraper(provider()).run({...r.options,countryFilter:'Global',...options})
async function observed(r,options={}){let audit=null,records=null,jobs=null,error=null;try{jobs=await run(r,{...options,onAudit:async(v,...args)=>{audit=v;await options.onAudit?.(v,...args)},onRecords:async(v,...args)=>{records=v;await options.onRecords?.(v,...args)}})}catch(e){error=e}return{audit,records,jobs,error}}

test('ASUS registered extraction preserves14 regional routes four families and all28 own full posting models',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null);const e=o.jobs.nativeCollectionEvidence;assert.deepEqual(e.primary,expected.openingPrimary);assert.deepEqual(e.board,expected.openingBoard);assert.deepEqual(e.details,expected.details);assert.deepEqual(e.closingBoard,expected.closingBoard);assert.deepEqual(e.closingPrimary,expected.closingPrimary);assert.equal(e.primary.nativeRegionalRoutes.length,14);assert.equal(e.primary.nativeRoleFamilies.length,4);assert.equal(e.observations.length,28);assert.equal(e.recordKind,'vacancy-rows');assert.equal(e.rawResponses.length,32);assert.deepEqual(r.uncaptured,[])
})
test('ASUS returns28 own-country US postings with complete main and supplemental hiring criteria',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null);assert.equal(o.jobs.length,28);for(const [i,row]of o.jobs.entries()){assert.equal(row.country,'United States');assert.equal(row.company,'ASUS Computer International');assert.equal(row.jobDescription,expected.details[i].fullCriteriaText);assert.ok(row.jobDescription.includes('Applicants must be authorized to work for ANY employer in the U.S.'));assert.deepEqual(row.sourceNativeRecord,expected.details[i].nativeJobRecords[0]);assert.equal(row.sourceCurrentNativeRoleQualified,true);assert.equal(row.sourceScopeComplete,false);assert.equal(row.lifecycleCleanupAllowed,false)}assert.equal(o.jobs.reduce((n,v)=>n+v.jobDescription.length,0),154783)
})
test('ASUS empty India selection retains every US model and cannot become an authoritative company India zero',async()=>{
 const r=replay(),o=await observed(r,{countryFilter:'India'});assert.equal(o.error,null);assert.equal(o.jobs.length,0);assert.deepEqual(o.audit.details,expected.details);assert.equal(o.records.length,28);const inventory=readInventoryEvidence(o.jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(r.requests.length,32)
})
test('ASUS zero and one-job limits apply after every full original and supplemental criterion is retained',async()=>{
 for(const maxJobs of[0,1]){const r=replay(),o=await observed(r,{maxJobs});assert.equal(o.error,null);assert.equal(o.jobs.length,maxJobs);assert.deepEqual(o.audit.details,expected.details);assert.equal(o.records.length,28);assert.equal(o.audit.rawResponses.length,32);assert.equal(r.requests.length,32)}
})
test('ASUS native posting IDs dates and regional employer do not become inferred requisitions or global legal-entity claims',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null);for(const[i,row]of o.records.entries()){const native=expected.details[i].nativeJobRecords[0];assert.equal(row.jobId,native.identifier);assert.equal(row.requisitionId,null);assert.equal(row.postingDate,native.datePosted);assert.equal(row.closingDate,null);assert.equal(row.company,native.hiringOrganization);assert.equal(row.activeApplyVerified,false);assert.equal(row.applicationVisited,false)}assert.equal(o.records[0].postingDate,'2026-10-16');assert.equal(o.records[0].jobId,'onsYAfw7')
})
test('ASUS awaited detached observers cannot alter retained complete data or typed vacancy evidence',async()=>{
 const r=replay(),events=[],o=await observed(r,{onAudit:async v=>{await new Promise(resolve=>setTimeout(resolve,2));v.details[0].fullCriteriaText='sink edit';events.push('audit')},onRecords:async rows=>{await new Promise(resolve=>setTimeout(resolve,2));rows[0].title='sink edit';events.push('records')}});assert.equal(o.error,null);assert.deepEqual(events,['audit','records']);assert.deepEqual(o.jobs.nativeCollectionEvidence.details,expected.details);assert.deepEqual(readSourceObservationEvidence(o.jobs,'asus'),{source:'asus',recordKind:'vacancy-rows',observedRecordCount:28,observedVacancyCount:28,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
})
test('ASUS a request-budget failure preserves the whole28-row board and original first cause before detail admission',async()=>{
 const r=replay(),o=await observed(r,{maxRequests:2});assert.equal(o.error?.code,'ASUS_REQUEST_BUDGET');assert.equal(o.error.nativeEvidence.board.records.length,28);assert.equal(o.error.nativeEvidence.details.length,0);assert.equal(o.error.nativeEvidence.observations.length,28);assert.equal(o.error.nativeEvidence.rawResponses.length,2);assert.equal(o.records.length,28);assert.equal(r.requests.length,2)
})
test('ASUS a mismatched own posting ID retains every native claim before identity hold and further admission stops',async()=>{
 const r=replay(p=>{if(p.label==='detail-0')changeSchema(p,v=>{v.identifier='other-native-id'})}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].nativeJobRecords[0].identifier,'other-native-id');assert.equal(o.error.nativeEvidence.details[0].nativeTitleCarriers[0].authoredText,'Senior Staff Accountant');assert.equal(o.error.nativeEvidence.observations.length,28);assert.equal(r.requests.length,3)
})
test('ASUS a missing own country remains unknown despite the US regional directory and native city labels',async()=>{
 const r=replay(p=>{if(p.label==='detail-0')changeSchema(p,v=>{delete v.jobLocation[0].address.addressCountry})}),o=await observed(r);assert.equal(o.error,null);assert.equal(o.jobs.length,27);assert.equal(o.records[0].country,null);assert.equal(o.records[0].sourceCountryScopeUnresolved,true);assert.equal(o.records[0].sourceCurrentNativeRoleQualified,false);assert.equal(o.audit.primary.nativeRegionalRoutes.find(v=>v.code==='usa').name,'United States');assert.equal(o.audit.details.length,28);assert.equal(r.requests.length,32)
})
test('ASUS hidden own criteria retain the full JSON-LD and visible markup before publication proof is held',async()=>{
 const old=expected.details[0].nativeDescriptionCarriers[0].nativeHTML,r=replay(p=>{if(p.label==='detail-0')mutateBody(p,html=>html.replace(old,old.replace('<div ','<div hidden ')))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.deepEqual(o.error.nativeEvidence.details[0].nativeJobRecords,expected.details[0].nativeJobRecords);assert.ok(o.error.nativeEvidence.details[0].nativeDescriptionCarriers[0].nativeHTML.includes('hidden'));assert.equal(o.error.nativeEvidence.observations[0].sourceCurrentNativeRoleQualified,false);assert.equal(r.requests.length,3)
})
test('ASUS contradictory visible and structured own descriptions survive without silently selecting one',async()=>{
 const old=expected.details[0].nativeDescriptionCarriers[0].nativeHTML,changed=old.replace(/<\/div>\s*$/,'<p>Extra native condition retained.</p></div>'),r=replay(p=>{if(p.label==='detail-0')mutateBody(p,html=>html.replace(old,changed))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.ok(o.error.nativeEvidence.details[0].fullCriteriaText.includes('Extra native condition retained.'));assert.equal(o.error.nativeEvidence.details[0].nativeJobRecords[0].description,expected.details[0].nativeJobRecords[0].description);assert.equal(r.requests.length,3)
})
test('ASUS a changed closing board preserves the complete new listing and every acquired own detail',async()=>{
 const old=expected.openingBoard.records[0].links[0].nativeHTML,r=replay(p=>{if(p.label==='closing-us-careers-board')mutateBody(p,html=>html.replace(old,old.replace('Senior Staff Accountant','Changed native title')))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_CLOSING_CONFLICT');assert.equal(o.error.nativeEvidence.closingBoard.records[0].links[0].text,'Changed native title');assert.deepEqual(o.error.nativeEvidence.details,expected.details);assert.equal(r.requests.length,31)
})
test('ASUS nonce-only closing primary changes remain preserved without fabricating a recruitment contract change',async()=>{
 const nonce=expected.closingPrimary.nativeSSRCarriers[0].attrs.nonce,r=replay(p=>{if(p.label==='closing-primary')mutateBody(p,html=>html.replaceAll(nonce,'different-source-nonce'))}),o=await observed(r);assert.equal(o.error,null);assert.equal(o.jobs.length,28);assert.equal(o.audit.closingPrimary.nativeSSRCarriers[0].attrs.nonce,'different-source-nonce');assert.deepEqual(o.audit.closingPrimary.nativeRegionalRoutes,expected.closingPrimary.nativeRegionalRoutes);assert.equal(r.requests.length,32)
})
test('ASUS effective registration clears stale sentinel counts and selects actual native extraction without cleanup authority',()=>{
 const p=provider();assert.equal(p.catalogOverride,true);assert.equal(p.parser,'live-parser');assert.equal(p.atsPlatform,'first-party-nuxt-regional-directory-and-jobvite-native-html');assert.equal(p.backfillMode,null);assert.equal(p.runtimeValidation,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false)
})


test('ASUS invalid and cyclic native reference graphs retain flat originals without admitting any board request',async()=>{
 for(const cycle of[false,true]){const r=replay(p=>{if(p.label==='current-primary')changeNuxt(p,pool=>{pool[0]=['ShallowReactive',cycle?0:pool.length+5]})}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.ok(o.error.nativeEvidence.primary.nativeSSRCarriers[0].flatNativeGraph.length);assert.ok(o.error.nativeEvidence.primary.parseFailures.length);assert.equal(o.error.nativeEvidence.rawResponses.length,1);assert.equal(r.requests.length,1)}
})
test('ASUS competing SSR carriers remain complete evidence and grant no regional route authority',async()=>{
 const original=expected.openingPrimary.nativeSSRCarriers[0].nativeHTML,r=replay(p=>{if(p.label==='current-primary')mutateBody(p,html=>html.replace(original,original+original))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.primary.nativeSSRCarriers.length,2);assert.deepEqual(o.error.nativeEvidence.primary.nativeSSRCarriers[1].decodedNativeGraph,expected.openingPrimary.nativeSSRCarriers[0].decodedNativeGraph);assert.equal(r.requests.length,1)
})
test('ASUS inactive native SSR data retain all14 regional records before a current-authority hold',async()=>{
 const original=expected.openingPrimary.nativeSSRCarriers[0].nativeHTML,r=replay(p=>{if(p.label==='current-primary')mutateBody(p,html=>html.replace(original,'<template>'+original+'</template>'))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.primary.nativeRegionalRoutes.length,14);assert.deepEqual(o.error.nativeEvidence.primary.nativeSSRCarriers[0].flatNativeGraph,expected.openingPrimary.nativeSSRCarriers[0].flatNativeGraph);assert.equal(r.requests.length,1)
})
test('ASUS duplicate native routing properties stay raw without silently choosing a last value',async()=>{
 const original=expected.openingPrimary.nativeSSRCarriers[0].rawJSON,bad=original.replace(/"code":(\d+)/,'"code":$1,"code":$1');assert.notEqual(bad,original);const r=replay(p=>{if(p.label==='current-primary')mutateBody(p,html=>html.replace(original,bad))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.primary.nativeSSRCarriers[0].rawJSON,bad);assert.ok(o.error.nativeEvidence.primary.parseFailures.length);assert.equal(r.requests.length,1)
})
test('ASUS inactive native posting tables retain all28 row models before detail admission stops',async()=>{
 const original=expected.openingBoard.nativeTables[0].nativeHTML,r=replay(p=>{if(p.label==='declared-us-careers-board')mutateBody(p,html=>html.replace(original,original.replace('<table ','<table hidden ')))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.board.records.length,28);assert.equal(o.error.nativeEvidence.observations.length,28);assert.equal(o.error.nativeEvidence.details.length,0);assert.equal(r.requests.length,2)
})
test('ASUS an unrelated hidden job-like URL cannot substitute for a foreign native title-cell handoff',async()=>{
 const original=expected.openingBoard.records[0].nativeHTML,link=expected.openingBoard.records[0].links[0].nativeHTML,changed=original.replace(link,link.replace('/asus/job/onsYAfw7','https://unqualified.example/job/foreign')).replace('</tr>','<td hidden>'+link+'</td></tr>'),r=replay(p=>{if(['declared-us-careers-board','closing-us-careers-board'].includes(p.label))mutateBody(p,html=>html.replace(original,changed))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.board.records.length,28);assert.equal(o.error.nativeEvidence.board.records[0].links.length,2);assert.ok(o.error.nativeEvidence.board.records[0].nativeHTML.includes('unqualified.example'));assert.equal(r.requests.length,2)
})
test('ASUS a foreign native hiring employer retains its exact claim without global-brand substitution',async()=>{
 const r=replay(p=>{if(p.label==='detail-0')changeSchema(p,v=>{v.hiringOrganization='Unqualified employer'})}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].nativeJobRecords[0].hiringOrganization,'Unqualified employer');assert.equal(o.error.nativeEvidence.observations[0].company,null);assert.equal(o.error.nativeEvidence.observations[0].sourceNativeIdentityBound,false);assert.equal(r.requests.length,3)
})
test('ASUS contradictory own country and declared US branch retain both claims and exclude the role',async()=>{
 const r=replay(p=>{if(p.label==='detail-0')changeSchema(p,v=>{v.jobLocation[0].address.addressCountry='India'})}),o=await observed(r);assert.equal(o.error,null);assert.equal(o.jobs.length,27);assert.equal(o.records[0].country,'India');assert.equal(o.records[0].sourceNativeCountryClaimConflict,true);assert.equal(o.records[0].sourceCurrentNativeRoleQualified,false);assert.equal(o.audit.primary.nativeRegionalRoutes.find(v=>v.code==='usa').name,'United States');assert.equal(o.audit.details.length,28)
})
test('ASUS unfamiliar native nested terms and prototype-named fields survive without mutation or truncation',async()=>{
 const addition=JSON.parse('{"terms":["Original additional condition",{"name":"Unicode ?","enabled":false}],"__proto__":{"unqualifiedNativePollution":true}}'),r=replay(p=>{if(p.label==='detail-0')changeSchema(p,v=>{v.Publisher_Additional_Terms=addition})}),o=await observed(r);assert.equal(o.error,null);assert.deepEqual(o.records[0].sourceNativeRecord.Publisher_Additional_Terms,addition);assert.equal(Object.hasOwn(o.records[0].sourceNativeRecord.Publisher_Additional_Terms,'__proto__'),true);assert.equal({}.unqualifiedNativePollution,undefined);assert.equal(o.jobs.length,28)
})
test('ASUS inactive and text-plain structured posting carriers retain all data without publication authority',async()=>{
 for(const inactive of[false,true]){const original=expected.details[0].nativeSchemaCarriers[0].nativeHTML,replacement=inactive?'<template>'+original+'</template>':original.replace('application/ld+json','text/plain'),r=replay(p=>{if(p.label==='detail-0')mutateBody(p,html=>html.replace(original,replacement))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.deepEqual(o.error.nativeEvidence.details[0].nativeJobRecords,expected.details[0].nativeJobRecords);assert.ok(o.error.nativeEvidence.details[0].parseFailures.length);assert.equal(r.requests.length,3)}
})
test('ASUS duplicate country properties retain contradictory raw structured data and complete main criteria',async()=>{
 const original=expected.details[0].nativeSchemaCarriers[0].rawJSON,bad=original.replace('"addressCountry": "United States"','"addressCountry":"United States","addressCountry":"India"');assert.notEqual(bad,original);const r=replay(p=>{if(p.label==='detail-0')mutateBody(p,html=>html.replace(original,bad))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].nativeSchemaCarriers[0].rawJSON,bad);assert.equal(o.error.nativeEvidence.details[0].fullCriteriaText,expected.details[0].fullCriteriaText);assert.equal(o.error.nativeEvidence.details[0].nativeJobRecords.length,0);assert.equal(r.requests.length,3)
})
test('ASUS malformed null primitive and array locations stay observed as unknown country without terminal projection loss',async()=>{
 const malformed=[null,42,false,[]],r=replay(p=>{if(p.label==='detail-0')changeSchema(p,v=>{v.jobLocation=malformed})}),o=await observed(r);assert.equal(o.error,null);assert.equal(o.jobs.length,27);assert.deepEqual(o.records[0].sourceNativeRecord.jobLocation,malformed);assert.equal(o.records[0].country,null);assert.equal(o.records.length,28);assert.equal(o.audit.rawResponses.length,32)
})
test('ASUS combined native description markup adds only whitespace between unchanged authored fragments',async()=>{
 const r=replay(),o=await observed(r);assert.equal(o.error,null);for(const[i,row]of o.records.entries()){const first=expected.details[i].nativeDescriptionCarriers[0].nativeHTML,last=expected.details[i].nativeSupplementalCriteriaCarriers[0].nativeHTML,html=row.sourceNativeOwnDescriptionHTML;assert.ok(html.startsWith(first));assert.ok(html.endsWith(last));assert.equal(html.slice(first.length,html.length-last.length).trim(),'')}
})
test('ASUS an original HTTP denial outranks its failing stream and preserves the partial receipt',async()=>{
 const r=replay(p=>{if(p.label==='current-primary')p.status=403}),base=r.options.fetchImpl,o=await observed(r,{fetchImpl:async(...args)=>{const original=await base(...args);await original.body.cancel();let pulls=0;const response=new Response(new ReadableStream({pull(c){if(pulls++===0)c.enqueue(new TextEncoder().encode('partial native denial'));else c.error(Error('original denied stream failed'))}}),{status:403,headers:original.headers});Object.defineProperty(response,'url',{value:original.url});return response}});assert.equal(o.error.status,403);assert.equal(o.error.failureKind,'blocked_or_access_denied');const receipt=o.error.nativeEvidence.rawResponses[0].response;assert.equal(receipt.bodyComplete,false);assert.equal(receipt.bodyBytes,21);assert.equal(receipt.acquisitionFailure.message,'original denied stream failed');assert.equal(r.requests.length,1)
})
test('ASUS non-HTML response MIME remains a complete receipt without native primary parsing',async()=>{
 const r=replay(p=>{if(p.label==='current-primary')p.headers['content-type']='application/json'}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.primary,null);assert.equal(o.error.nativeEvidence.rawResponses[0].response.bodyComplete,true);assert.equal(r.requests.length,1)
})
test('ASUS redirect and wrong response identity controls stop automatic route substitution',async()=>{
 for(const redirect of[false,true]){const r=replay(),base=r.options.fetchImpl,o=await observed(r,{fetchImpl:async(...args)=>{const original=await base(...args),response=redirect?original:new Response(original.body,{status:original.status,headers:original.headers});Object.defineProperty(response,redirect?'redirected':'url',{value:redirect?true:'https://unqualified.example/foreign'});return response}});assert.equal(o.error?.code,'ASUS_RESPONSE_IDENTITY');assert.equal(o.error.nativeEvidence.primary,null);assert.equal(o.error.nativeEvidence.rawResponses[0].response.identityValidated,false);assert.equal(r.requests.length,1)}
})
test('ASUS exact false cancellation owns ignored late acquisition and immutable failure evidence',async()=>{
 const r=replay(),base=r.options.fetchImpl,controller=new AbortController();let timer;const o=await observed(r,{signal:controller.signal,fetchImpl:async(...args)=>{const response=await base(...args);timer=setTimeout(()=>controller.abort(false),5);await new Promise(resolve=>setTimeout(resolve,60));return response}});clearTimeout(timer);assert.equal(o.error,false);const{readAsusFailureEvidence}=await import('../scraper/asus.workday/native20261108.js'),proof=readAsusFailureEvidence(controller.signal);assert.equal(proof.rawResponses.length,0);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(readAsusFailureEvidence(controller.signal),proof)
})
test('ASUS earliest source lifetime bounds ignored longer acquisition without late evidence mutation',async()=>{
 const r=replay(),base=r.options.fetchImpl,o=await observed(r,{sourceTimeoutMs:15,readTimeoutMs:100,fetchImpl:async(...args)=>{const response=await base(...args);await new Promise(resolve=>setTimeout(resolve,60));return response}});assert.equal(o.error?.code,'ASUS_NATIVE_TIMEOUT');assert.equal(o.error.nativeEvidence.rawResponses.length,0);const proof=structuredClone(o.error.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(o.error.nativeEvidence,proof)
})
test('ASUS secondary noncloneable observer diagnostics cannot mask an earlier budget failure or28 records',async()=>{
 const r=replay();let received;const o=await observed(r,{maxRequests:2,onAudit:()=>{throw{code:Symbol('opaque'),message:()=> 'opaque'}},onRecords:v=>{received=v}});assert.equal(o.error?.code,'ASUS_REQUEST_BUDGET');assert.equal(received.length,28);assert.deepEqual(o.error.nativeEvidence.auditSinkFailures,[{sink:'audit',name:null,code:null,message:null}]);assert.equal(o.error.nativeEvidence.rawResponses.length,2)
})
test('ASUS bounded late record observers cannot mutate retained complete native criteria',async()=>{
 const r=replay();let started=false;const o=await observed(r,{auditTimeoutMs:500,onRecords:async rows=>{started=true;await new Promise(resolve=>setTimeout(resolve,750));rows[0].sourceNativeDetail.fullCriteriaText='late sink edit'}});assert.equal(o.error?.code,'ASUS_AUDIT_TIMEOUT');assert.equal(started,true);assert.deepEqual(o.error.nativeEvidence.details,expected.details);const proof=structuredClone(o.error.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,800));assert.deepEqual(o.error.nativeEvidence,proof)
})
test('ASUS unsupported finite pagination truncation is rejected before original acquisition',async()=>{
 const r=replay(),o=await observed(r,{maxPages:1});assert.equal(o.error?.code,'ASUS_INVALID_OPTIONS');assert.equal(r.requests.length,0)
})
test('ASUS closing regional routing changes retain both full native claims before source output is held',async()=>{
 const old='https://deine.karriere-asus.de/',changed='https://new-native-claim.example/roles',r=replay(p=>{if(p.label==='closing-primary')changeNuxt(p,pool=>{const at=pool.indexOf(old);assert.ok(at>=0);pool[at]=changed})}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_CLOSING_CONFLICT');assert.equal(o.error.nativeEvidence.primary.nativeRegionalRoutes.find(v=>v.code==='germany').link,old);assert.equal(o.error.nativeEvidence.closingPrimary.nativeRegionalRoutes.find(v=>v.code==='germany').link,changed);assert.equal(o.error.nativeEvidence.details.length,28);assert.ok(o.error.nativeEvidence.observations.every(v=>!v.sourceCurrentNativeRoleQualified));assert.equal(r.requests.length,32)
})


test('ASUS registered and direct India defaults retain US observations without returning US-only roles',async()=>{
 const r=replay(),jobs=await createCatalogScraper(provider()).run({...r.options}),other=replay(),{run:directRun}=await import('../scraper/asus.workday/script.js'),direct=await directRun({...other.options});assert.deepEqual([jobs.length,direct.length],[0,0]);for(const value of[jobs,direct]){assert.equal(value.nativeCollectionEvidence.observations.length,28);assert.deepEqual(value.nativeCollectionEvidence.details,expected.details);assert.equal(readInventoryEvidence(value).reportedTotal,null)}
})


test('ASUS reviewed contradictory schema posting URL claims preserve evidence and stop further admission',async()=>{
 for(const key of['url','@id']){const foreign='https://jobs.jobvite.com/asus/job/DIFFERENT',r=replay(p=>{if(p.label==='detail-0')changeSchema(p,v=>{v[key]=foreign})}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].nativeJobRecords[0][key],foreign);assert.equal(o.error.nativeEvidence.observations[0].sourceNativeIdentityBound,false);assert.equal(r.requests.length,3)}
})

test('ASUS reviewed contradictory canonical posting identity is retained before admission stops',async()=>{
 const foreign='https://jobs.jobvite.com/asus/job/DIFFERENT',r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace('</head>','<link rel="canonical" href="'+foreign+'"></head>'))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.deepEqual(o.error.nativeEvidence.details[0].head.canonicals,[foreign]);assert.equal(o.error.nativeEvidence.observations[0].sourceCurrentNativeRoleQualified,false);assert.equal(r.requests.length,3)
})

test('ASUS reviewed canonical relation tokens are case insensitive when detecting identity contradictions',async()=>{
 const foreign='https://jobs.jobvite.com/asus/job/DIFFERENT',r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace('</head>','<link rel="CANONICAL" href="'+foreign+'"></head>'))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.deepEqual(o.error.nativeEvidence.details[0].head.canonicals,[foreign]);assert.equal(r.requests.length,3)
})

test('ASUS reviewed an inactive sole visible title cannot prove native posting identity',async()=>{
 const old=expected.details[0].nativeTitleCarriers[0].nativeHTML,r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace(old,old.replace('<h2 ','<h2 hidden ')))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.equal(o.error.nativeEvidence.details[0].nativeTitleCarriers[0].inactive,true);assert.deepEqual(o.error.nativeEvidence.details[0].nativeJobRecords,expected.details[0].nativeJobRecords);assert.equal(o.error.nativeEvidence.observations[0].sourceNativeIdentityBound,false);assert.equal(r.requests.length,3)
})

test('ASUS reviewed hidden meaningful title descendants cannot borrow an active heading identity',async()=>{
 const c=expected.details[0].nativeTitleCarriers[0],changed=c.nativeHTML.replace(c.authoredText,'<span inert>'+c.authoredText+'</span>'),r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace(c.nativeHTML,changed))}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');assert.ok(o.error.nativeEvidence.details[0].nativeTitleCarriers[0].nativeHTML.includes('<span inert>'));assert.equal(o.error.nativeEvidence.observations[0].sourceCurrentNativeRoleQualified,false);assert.equal(r.requests.length,3)
})

test('ASUS reviewed an explicit India claim in visible own metadata excludes the contradictory US role',async()=>{
 const c=expected.details[0].nativeMetadataCarriers[0],changed=c.nativeHTML.replace('California','California, India'),r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace(c.nativeHTML,changed))}),o=await observed(r);assert.equal(o.error,null);assert.equal(o.jobs.length,27);assert.equal(o.records[0].country,null);assert.equal(o.records[0].sourceNativeCountryClaimConflict,true);assert.equal(o.records[0].sourceCurrentNativeRoleQualified,false);assert.equal(o.records[0].sourceNativeRecord.jobLocation[0].address.addressCountry,'United States');assert.ok(o.records[0].sourceNativeDetail.nativeMetadataCarriers[0].authoredText.includes('California, India'));assert.equal(r.requests.length,32)
})

test('ASUS reviewed multiple explicit countries in own visible metadata remain contradictory evidence',async()=>{
 const c=expected.details[0].nativeMetadataCarriers[0],changed=c.nativeHTML.replace('California','California, United States / Canada'),r=replay(p=>{if(p.label==='detail-0')mutateBody(p,h=>h.replace(c.nativeHTML,changed))}),o=await observed(r);assert.equal(o.error,null);assert.equal(o.jobs.length,27);assert.equal(o.records[0].country,null);assert.equal(o.records[0].sourceNativeCountryClaimConflict,true);assert.equal(o.records[0].sourceCurrentNativeRoleQualified,false);assert.ok(o.records[0].sourceNativeDetail.nativeMetadataCarriers[0].authoredText.includes('Canada'));assert.equal(r.requests.length,32)
})

test('ASUS reviewed aliased SSR expansion is bounded before cloning comparison serialization or board admission',async()=>{
 let retained;const r=replay(p=>{if(['current-primary','closing-primary'].includes(p.label))changeNuxt(p,pool=>{let at=pool.push('review expansion leaf')-1;for(let n=0;n<18;n++)at=pool.push({a:at,b:at})-1;assert.equal(typeof pool[4],'object');pool[4].reviewExtra=at;retained=structuredClone(pool)})}),o=await observed(r);assert.equal(o.error?.code,'ASUS_NATIVE_PROOF');const c=o.error.nativeEvidence.primary.nativeSSRCarriers[0];assert.deepEqual(c.flatNativeGraph,retained);assert.equal(c.decodedNativeGraph,null);assert.ok(o.error.nativeEvidence.primary.parseFailures.some(v=>/expand|weight|size|bound/i.test(v.message)));assert.ok(c.rawJSON.includes('reviewExtra'));assert.equal(o.error.nativeEvidence.rawResponses.length,1);assert.equal(r.requests.length,1)
})
