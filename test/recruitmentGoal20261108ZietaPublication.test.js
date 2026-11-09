import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {extractJobs} from '../scraper/zietatechnologies/script.js'
import {fixture,replay} from './test-data/zietaPublication20261108.js'
const original=()=>Buffer.from(fixture.packets[0].bodyBase64,'base64').toString(),registered=()=>createCatalogScraper(getScraperCatalog().find(v=>v.source==='zietatechnologies'))
test('Zieta public extraction retains all authored native criteria and original role fields',()=>{
 const rows=extractJobs(original());assert.equal(rows.length,1);assert.equal(rows[0].jobDescription,fixture.expected.models[0].fullCriteriaText);assert.deepEqual(rows[0].sourceNativeRecord,fixture.expected.models[0]);assert.equal(rows[0].sourceNativeOwnDescriptionHTML,fixture.expected.models[0].roleHTML)
})
test('Zieta resume mailing and possible relocation do not fabricate a primary workplace or country',()=>{
 const row=extractJobs(original())[0];assert.equal(row.location,null);assert.equal(row.city,null);assert.equal(row.state,null);assert.equal(row.country,null);assert.equal(row.sourceCountryScopeUnresolved,true)
})
test('Zieta retains the native Refer value without inventing formal posting or requisition identifiers',async()=>{
 const r=replay(),jobs=await registered().run(r.options),row=jobs[0]??jobs.nativeCollectionEvidence.observations[0];assert.equal(row.jobId,null);assert.equal(row.requisitionId,null);assert.equal(row.sourceNativeRecord.reference.value,'GAMS21');assert.equal(row.sourceNativeRecord.reference.kind,'advertisement-reference;formal-posting-or-requisition-kind-unstated')
})
test('registered Zieta maxJobs zero still completes both reads and awaits full native records observation',async()=>{
 const r=replay();let records,audit;const jobs=await registered().run({...r.options,maxJobs:0,onRecords:async v=>{await Promise.resolve();records=v},onAudit:v=>{audit=v}})
 assert.equal(records?.length??0,1);assert.equal(r.requests.length,2);assert.equal(jobs.length,0);assert.deepEqual(records[0].sourceNativeRecord,fixture.expected.models[0]);assert.deepEqual(records[0].sourceNativeClosingRecord,fixture.expected.models[0]);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false)
})

import {mutateBody,PRIMARY} from './test-data/zietaPublication20261108.js'
import {createZietaNativeScraper,readZietaFailureEvidence} from '../scraper/zietatechnologies/native20261108.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const model=fixture.expected.models[0],failureOf=async promise=>{try{await promise;assert.fail('Expected Zieta collection to reject')}catch(error){if(error?.code==='ERR_ASSERTION')throw error;return error}},change=(p,from,to)=>{const text=Buffer.from(p.bodyBase64,'base64').toString();assert.ok(text.includes(from));mutateBody(p,text.replace(from,to))},noAnimation=p=>mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString().replace(/\bwow\s+fadeInLeft\b/g,''))

test('paired Zieta originals retain complete authored criteria while animation and primary-country proof stay held',async()=>{
 const r=replay();let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}}),row=records[0]
 assert.equal(jobs.length,0);assert.equal(records.length,1);assert.equal(row.jobDescription.length,847);assert.equal(row.sourceNativePairQualified,true);assert.equal(row.sourceNativeAdvertisementPairObserved,true);assert.equal(row.sourceNativeCriteriaComplete,true);assert.equal(row.sourceNativeCriteriaVisibilityQualified,false);assert.equal(row.sourceNativeCurrentPublicationQualified,false);assert.equal(row.country,null);assert.equal(row.sourceNativeRecord.nativeCountryMentions[0].scope,'possible-travel-or-relocation');assert.equal(row.sourceNativeCountryEvidence.resumeMailingAddressUsed,false);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
test('active text without animation remains an unknown-country observation rather than an accepted India role',async()=>{
 for(const countryFilter of ['Global','India','United States']){const r=replay({transform:noAnimation}),jobs=await registered().run({...r.options,countryFilter});assert.equal(jobs.length,1);assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceCurrentNativeRoleQualified,false);assert.equal(jobs[0].sourceNativeCriteriaVisibilityQualified,true);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs[0].sourceScopeComplete,false)}
})
test('undefined Zieta run options preserve defined factory defaults and await records even with a zero cap',async()=>{
 const r=replay();let records;const jobs=await createZietaNativeScraper({...r.options,maxJobs:0,onRecords:v=>{records=v}}).run({maxJobs:undefined,fetchPage:undefined,onRecords:undefined,now:undefined});assert.equal(jobs.length,0);assert.equal(records.length,1);assert.equal(r.requests.length,2)
})
test('finite page limits reject before silently truncating Zieta native observation',async()=>{
 for(const maxPages of [0,1,3]){const r=replay(),error=await failureOf(createZietaNativeScraper().run({...r.options,maxPages}));assert.equal(error.code,'ZIETA_INVALID_OPTIONS');assert.equal(r.requests.length,0)}
})
test('a bounded Zieta request failure retains the whole opening model and original response',async()=>{
 const r=replay(),error=await failureOf(registered().run({...r.options,maxRequests:1}));assert.equal(error.code,'ZIETA_REQUEST_BUDGET');assert.equal(r.requests.length,1);assert.deepEqual(error.nativeEvidence.observations[0].sourceNativeRecord,model);assert.equal(error.nativeEvidence.observations[0].sourceNativeClosingRecord,null);assert.equal(error.nativeEvidence.rawResponses.length,1);assert.equal(error.nativeEvidence.sourceScopeComplete,false)
})
test('a changed complete closing title is retained without paired-publication qualification',async()=>{
 const r=replay({transform:(p,calls)=>{if(calls.length===2)change(p,'Title : LEAD SYSTEMS ANALYST','Title : NEW NATIVE ROLE')}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records[0].sourceNativeClosingRecord.title,'NEW NATIVE ROLE');assert.equal(records[0].sourceNativeRecord.title,model.title);assert.equal(records[0].sourceNativePairQualified,false);assert.equal(r.requests.length,2)
})
test('a placeholder closing publisher title retains the current complete role model and stops',async()=>{
 const r=replay({transform:(p,calls)=>{if(calls.length===2)change(p,':: Zieta Technologies ::','page_title')}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(r.requests.length,2);assert.equal(error.nativeEvidence.observations[0].sourceNativeClosingRecord.head.titles[0],'page_title');assert.equal(error.nativeEvidence.observations[0].sourceNativeClosingRecord.fullCriteriaText,model.fullCriteriaText);assert.equal(error.nativeEvidence.rawResponses.length,2)
})
test('an added closing native cohort member is preserved before rejecting the changed cohort',async()=>{
 const second=model.roleHTML.replaceAll('GAMS21','GAMS22').replaceAll('LEAD SYSTEMS ANALYST','SECOND NATIVE ROLE'),r=replay({transform:(p,calls)=>{if(calls.length===2)change(p,model.roleHTML,model.roleHTML+second)}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(error.nativeEvidence.closingRecords.length,2);assert.equal(error.nativeEvidence.observations.length,2);assert.equal(error.nativeEvidence.observations.find(v=>v.sourceNativeClosingRecord?.reference.value==='GAMS22').sourceNativeClosingRecord.title,'SECOND NATIVE ROLE');assert.equal(r.requests.length,2)
})
test('duplicate native Refer labels retain every original role observation without merging their models',async()=>{
 const second=model.roleHTML.replaceAll('LEAD SYSTEMS ANALYST','SECOND NATIVE ROLE'),r=replay({transform:p=>change(p,model.roleHTML,model.roleHTML+second)});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records.length,2);assert.deepEqual(records.map(v=>v.sourceNativeRecord.title),[model.title,'SECOND NATIVE ROLE']);assert.ok(records.every(v=>!v.sourceNativeContractQualified));assert.equal(jobs.nativeCollectionEvidence.openingRecords.length,2)
})
test('an unfamiliar expiry carrier is preserved before withholding otherwise active source-text qualification',async()=>{
 const field='<h5>Valid through: 2001-01-01 Expired</h5>',r=replay({transform:p=>{noAnimation(p);change(p,'Title : LEAD SYSTEMS ANALYST', 'Title : LEAD SYSTEMS ANALYST');change(p,model.blocks[0].nativeHTML,field+model.blocks[0].nativeHTML)}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.ok(records[0].sourceNativeRecord.blocks.some(v=>v.nativeHTML===field));assert.equal(records[0].sourceNativeContractQualified,false)
})
test('additional native JobPosting schemas and expiry metadata are retained without overriding source geography',async()=>{
 const insert='<script type="application/LD+JSON">'+JSON.stringify({'@type':['JobPosting'],jobLocation:{address:{addressCountry:'India'}},validThrough:'2001-01-01'})+'</script><meta name="validThrough" content="2001-01-01">',r=replay({transform:p=>{noAnimation(p);change(p,'</head>',insert+'</head>')}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records[0].country,null);assert.equal(records[0].sourceNativeRecord.head.schemas.length,1);assert.ok(records[0].sourceNativeRecord.head.metas.some(v=>v.name==='validThrough'));assert.equal(records[0].sourceNativeContractQualified,false)
})
test('a missing requirement carrier retains the partial original model and stops at the first unusable page',async()=>{
 const requirement=model.blocks.find(v=>v.tag==='p'&&v.text.startsWith('Require')),r=replay({transform:p=>change(p,requirement.nativeHTML,'')}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.ok(error.nativeEvidence.observations[0].sourceNativeRecord);assert.equal(error.nativeEvidence.observations[0].sourceNativeRecord.reference.value,'GAMS21');assert.equal(error.nativeEvidence.rawResponses.length,1)
})
test('an anchor without href cannot stand in for the missing publisher-declared careers self-link',async()=>{
 const r=replay({transform:p=>{const text=Buffer.from(p.bodyBase64,'base64').toString();assert.ok(text.includes('href="index.php?page=careers"'));mutateBody(p,text.replaceAll('href="index.php?page=careers"','href="#"')+'<a>No href</a>')}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(error.nativeEvidence.observations[0].sourceNativeRecord.title,model.title)
})
test('inert template role originals survive as evidence without becoming a native advertisement observation',async()=>{
 const r=replay({transform:p=>change(p,model.roleHTML,'<template>'+model.roleHTML+'</template>')});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records.length,1);assert.equal(records[0].sourceNativeRecord.roleHTML,model.roleHTML);assert.equal(records[0].sourceNativeAdvertisementPairObserved,false);assert.equal(records[0].sourceNativeContractQualified,false)
})
test('foreign canonical and application controls are retained without requesting their targets',async()=>{
 for(const kind of ['canonical','application']){
  const r=replay({transform:p=>{if(kind==='canonical')change(p,'</head>','<link rel="canonical" href="https://example.com/foreign"></head>');else{noAnimation(p);change(p,model.applicationControl.nativeHTML,model.applicationControl.nativeHTML.replace('href="#"','href="https://example.com/foreign"'))}}})
  if(kind==='canonical'){const error=await failureOf(registered().run(r.options));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(error.nativeEvidence.observations[0].sourceNativeRecord.head.canonicals[0],'https://example.com/foreign')}
  else{let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records[0].sourceNativeRecord.applicationControl.attrs.href,'https://example.com/foreign');assert.equal(records[0].sourceNativeContractQualified,false)}
  assert.deepEqual(r.uncaptured,[])
 }
})
for(const reason of [false,0,''])test('exact caller cancellation precedes invalid Zieta options: '+JSON.stringify(reason),async()=>{
 const r=replay(),controller=new AbortController();controller.abort(reason);let caught,rejected=false;try{await createZietaNativeScraper({...r.options,signal:controller.signal}).run({signal:undefined,maxJobs:-1})}catch(e){caught=e;rejected=true}assert.equal(rejected,true);assert.equal(caught,reason);assert.equal(r.requests.length,0)
})
test('mid-read opaque caller cancellation is preserved without inspecting the foreign reason for evidence',async()=>{
 const controller=new AbortController(),reason=new Proxy(Object.freeze({opaque:true}),{get(t,k){if(k==='nativeEvidence')throw Error('foreign evidence getter');return Reflect.get(t,k)}}),r=replay({transform:()=>controller.abort(reason)});let caught;try{await registered().run({...r.options,signal:controller.signal})}catch(e){caught=e}assert.equal(caught,reason);assert.equal(r.requests.length,1);assert.equal(readZietaFailureEvidence(controller.signal).source,'zietatechnologies')
})
for(const status of [403,429,503])test('Zieta HTTP '+status+' with a stalled closing body retains HTTP evidence, partial bytes and earlier complete models',async()=>{
 const r=replay(),fetchImpl=async(url,init)=>{if(r.requests.length===1){r.requests.push(String(url));const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('partial upstream original'))}}),{status,headers:{'content-type':'text/html','retry-after':'5'}});Object.defineProperty(response,'url',{value:String(url)});return response}return r.options.fetchImpl(url,init)},error=await failureOf(createZietaNativeScraper().run({...r.options,fetchPage:undefined,fetchText:undefined,fetchImpl,readTimeoutMs:25}));assert.equal(error.status,status);if(status===429)assert.equal(error.retryDelayMs,5000);assert.equal(error.acquisitionFailure.code,'ZIETA_READ_TIMEOUT');assert.equal(error.nativeEvidence.rawResponses.at(-1).response.headers['retry-after'],'5');assert.equal(error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,false);assert.ok(error.nativeEvidence.rawResponses.at(-1).response.bodyBytes>0);assert.deepEqual(error.nativeEvidence.observations[0].sourceNativeRecord,model);assert.equal(r.requests.length,2)
})
const elapsed=t=>{let value=1000;const d=Object.getOwnPropertyDescriptor(performance,'now');Object.defineProperty(performance,'now',{configurable:true,value:()=>value});t.after(()=>d?Object.defineProperty(performance,'now',d):delete performance.now);return ms=>{value+=ms}}
test('Zieta audit and records callbacks share one combined elapsed deadline',async t=>{
 const advance=elapsed(t),r=replay();let seen=0;const error=await failureOf(createZietaNativeScraper().run({...r.options,onAudit:()=>advance(10000),onRecords:v=>{seen=v.length;advance(5001)}}));assert.equal(error.code,'ZIETA_AUDIT_TIMEOUT');assert.equal(seen,1);assert.deepEqual(error.nativeEvidence.observations[0].sourceNativeRecord,model)
})
test('the earlier Zieta audit deadline wins when one synchronous callback crosses both source and audit deadlines',async t=>{
 const advance=elapsed(t),r=replay(),error=await failureOf(createZietaNativeScraper().run({...r.options,auditTimeoutMs:1000,sourceTimeoutMs:100000,onAudit:()=>advance(100001)}));assert.equal(error.code,'ZIETA_AUDIT_TIMEOUT')
})
test('the earlier Zieta source deadline wins when the callback later crosses the audit deadline',async t=>{
 const advance=elapsed(t),r=replay(),error=await failureOf(createZietaNativeScraper().run({...r.options,auditTimeoutMs:15000,sourceTimeoutMs:1000,onAudit:()=>advance(15001)}));assert.equal(error.code,'ZIETA_NATIVE_TIMEOUT')
})
test('detached Zieta callbacks and returned observations cannot mutate original audit models',async()=>{
 const r=replay({transform:noAnimation}),jobs=await registered().run({...r.options,onRecords:v=>{v[0].sourceNativeRecord.title='observer mutation'}});assert.equal(jobs.length,1);jobs[0].sourceNativeRecord.title='candidate mutation';assert.equal(jobs.nativeCollectionEvidence.observations[0].sourceNativeRecord.title,model.title)
})
test('explicitly redirected or incomplete supplied Zieta entities retain contradictory raw provenance and reject',async()=>{
 for(const patch of [{redirected:true},{bodyComplete:false}]){const r=replay(),fetchPage=async(u,i)=>({...await r.options.fetchPage(u,i),...patch}),error=await failureOf(registered().run({...r.options,fetchPage}));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(r.requests.length,1);const p=error.nativeEvidence.rawResponses[0].response;assert.equal(p.rawBodyBase64,fixture.packets[0].bodyBase64);for(const [k,v]of Object.entries(patch))assert.equal(p.suppliedOriginalMetadata[k],v)}
})
test('text-only supplied Zieta readers cannot fabricate original HTTP metadata',async()=>{
 const r=replay(),error=await failureOf(createZietaNativeScraper().run({...r.options,fetchPage:undefined,fetchImpl:undefined}));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(r.requests.length,1)
})
test('a frozen producer callback failure keeps its exact original evidence through cause',async()=>{
 const r=replay(),foreign=Object.freeze(Object.assign(Error('producer callback failure'),{nativeEvidence:Object.freeze({owner:'foreign'})})),error=await failureOf(registered().run({...r.options,onRecords:()=>{throw foreign}}));assert.equal(error.cause,foreign);assert.deepEqual(foreign.nativeEvidence,{owner:'foreign'});assert.equal(error.nativeEvidence.source,'zietatechnologies');assert.deepEqual(error.nativeEvidence.observations[0].sourceNativeRecord,model)
})

for(const scope of ['carrier','criteria'])test('unexecuted Zieta animation on the '+scope+' retains its original controls without publication qualification',async()=>{
 const r=replay({transform:p=>{noAnimation(p);if(scope==='carrier')change(p,model.roleHTML,model.roleHTML.replace('class="transparentbox"','class="transparentbox wow fadeInLeft"'));else change(p,model.blocks.find(v=>v.tag==='p'&&v.text.startsWith('Description')).nativeHTML,model.blocks.find(v=>v.tag==='p'&&v.text.startsWith('Description')).nativeHTML.replace('<p','<p class="wow fadeInLeft"'))}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records.length,1);assert.equal(records[0].sourceNativeCriteriaVisibilityQualified,false);assert.equal(records[0].sourceNativeCurrentPublicationQualified,false);assert.equal(records[0].sourceDetailComplete,false);assert.equal(records[0].sourceNativeRecord.animationControls.length,1);assert.equal(records[0].sourceNativeRecord.animationControls[0].scope,scope);assert.match(records[0].sourceNativeRecord.animationControls[0].nativeHTML,/wow fadeInLeft/)
})
test('extended Zieta Refer tokens remain complete native evidence and cannot pass a supported reference prefix',async()=>{
 for(const value of ['GAMS21/US','GAMS21_ALT']){const r=replay({transform:p=>{noAnimation(p);change(p,'GAMS21',value)}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records[0].sourceNativeRecord.reference.value,value);assert.equal(records[0].nativeAdvertisementReference,value);assert.equal(records[0].sourceNativeContractQualified,false)}
})
test('an unfamiliar complete expiry-bearing schema is preserved while native publication stays held',async()=>{
 const declaration={'@context':'https://schema.org','@type':'CreativeWork',name:'Job advertisement',expires:'2001-01-01'},r=replay({transform:p=>{noAnimation(p);change(p,'</head>','<script type="application/ld+json">'+JSON.stringify(declaration)+'</script></head>')}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.deepEqual(records[0].sourceNativeRecord.head.schemas,[declaration]);assert.equal(records[0].sourceNativeContractQualified,false)
})
test('malformed and duplicate-key Zieta schemas retain complete intact role models and raw declarations before stopping',async()=>{
 for(const declaration of ['{broken}','{"@type":"Thing","name":"one","name":"two"}']){const r=replay({transform:p=>change(p,'</head>','<script type="application/ld+json">'+declaration+'</script></head>')}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(error.nativeEvidence.rawResponses.length,1);const kept=error.nativeEvidence.observations[0]?.sourceNativeRecord;assert.ok(kept,'complete role model survives malformed head metadata');assert.equal(kept.fullCriteriaText,model.fullCriteriaText);assert.equal(kept.roleHTML,model.roleHTML);assert.equal(kept.head.rawSchemaDeclarations[0].raw,declaration);assert.ok(kept.head.rawSchemaDeclarations[0].parseFailure);assert.equal(error.nativeEvidence.observations[0].sourceNativeCurrentPublicationQualified,false)}
})
test('an unfamiliar Zieta role carrier retains its whole original model without known-contract qualification',async()=>{
 const changed=model.roleHTML.replace('class="transparentbox"','class="openingcard"'),r=replay({transform:p=>change(p,model.roleHTML,changed)});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records.length,1);assert.equal(records[0].sourceNativeRecord.roleHTML,changed);assert.equal(records[0].sourceNativeRecord.fullCriteriaText,model.fullCriteriaText);assert.equal(records[0].sourceNativeRecord.reference.value,'GAMS21');assert.equal(records[0].sourceNativeContractQualified,false);assert.equal(jobs.nativeCollectionEvidence.opening.unreviewedSectionNodes[0].nativeHTML,changed)
})
test('an additional unknown-class Zieta role retains its own complete criteria and reference instead of a title fragment',async()=>{
 const second=model.roleHTML.replace('class="transparentbox"','class="openingcard"').replaceAll('GAMS21','GAMS22').replaceAll('LEAD SYSTEMS ANALYST','SECOND NATIVE ROLE'),r=replay({transform:p=>change(p,model.roleHTML,model.roleHTML+second)});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records.length,2);const kept=records.find(v=>v.sourceNativeRecord.reference?.value==='GAMS22');assert.ok(kept);assert.equal(kept.sourceNativeRecord.roleHTML,second);assert.ok(kept.sourceNativeRecord.fullCriteriaText.includes('Require'));assert.equal(kept.sourceNativeContractQualified,false);assert.equal(jobs.nativeCollectionEvidence.opening.unreviewedSectionNodes[0].nativeHTML,second)
})
test('contradictory supplied Zieta decoded text retains original HTTP bytes and both supplied body claims before rejection',async()=>{
 const r=replay(),fetchPage=async(u,i)=>({...await r.options.fetchPage(u,i),html:'different decoded body'}),error=await failureOf(registered().run({...r.options,fetchPage}));assert.equal(error.code,'ZIETA_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(error.nativeEvidence.rawResponses.length,1);const kept=error.nativeEvidence.rawResponses[0].response;assert.equal(kept.rawBodyBase64,fixture.packets[0].bodyBase64);assert.equal(kept.suppliedOriginalMetadata.html,'different decoded body');assert.equal(kept.status,200);assert.equal(kept.suppliedProvenanceQualified,false)
})
test('a supplied Zieta204 original retains its exact status and bytes without requiring a body-forbidden Response constructor',async()=>{
 const r=replay(),fetchPage=async(u,i)=>({...await r.options.fetchPage(u,i),status:204}),error=await failureOf(registered().run({...r.options,fetchPage}));assert.equal(error.status,204);assert.equal(r.requests.length,1);assert.equal(error.nativeEvidence.rawResponses.length,1);assert.equal(error.nativeEvidence.rawResponses[0].response.status,204);assert.equal(error.nativeEvidence.rawResponses[0].response.rawBodyBase64,fixture.packets[0].bodyBase64);assert.equal(error.nativeEvidence.rawResponses[0].response.suppliedProvenanceQualified,false)
})
test('Zieta source expiration during the closing rate-limit wait surfaces the exact source deadline code with opening evidence',async()=>{
 for(const sourceTimeoutMs of [100,200]){const r=replay(),error=await failureOf(registered().run({...r.options,sourceTimeoutMs,rateLimitMs:500}));assert.equal(error.code,'ZIETA_NATIVE_TIMEOUT');assert.equal(r.requests.length,1);assert.equal(error.nativeEvidence.rawResponses.length,1);assert.deepEqual(error.nativeEvidence.observations[0].sourceNativeRecord,model)}
})
test('caller cancellation during the closing Zieta rate-limit wait preserves its exact opaque false reason',async()=>{
 const r=replay(),controller=new AbortController();let timer;const fetchPage=async(u,i)=>{const p=await r.options.fetchPage(u,i);timer=setTimeout(()=>controller.abort(false),100);return p};let value='not-rejected';try{await registered().run({...r.options,fetchPage,signal:controller.signal,sourceTimeoutMs:1000,rateLimitMs:500})}catch(error){value=error}finally{clearTimeout(timer)}assert.equal(value,false);assert.equal(r.requests.length,1);assert.deepEqual(readZietaFailureEvidence(controller.signal).observations[0].sourceNativeRecord,model)
})
