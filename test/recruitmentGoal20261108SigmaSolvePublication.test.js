import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {fixture,replay} from './test-data/sigmasolvePublication20261108.js'
const registered=()=>createCatalogScraper(getScraperCatalog().find(v=>v.source==='sigmasolve'))

test('registered Sigma Solve retains the complete own visible criteria rather than its SEO summary',async()=>{
 const r=replay(),jobs=await registered().run(r.options)
 assert.deepEqual(r.uncaptured,[]);assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobDescription,fixture.expected.model.description)
 assert.equal(jobs[0].sourceNativeOwnDescriptionHTML,fixture.expected.model.descriptionHTML)
 assert.deepEqual(jobs[0].sourceNativeRecord,fixture.expected.model)
})

test('an own role URL slug is not fabricated as a native posting or formal requisition ID',async()=>{
 const r=replay(),jobs=await registered().run(r.options)
 assert.equal(jobs[0].jobId,null);assert.equal(jobs[0].requisitionId,null)
 assert.equal(jobs[0].nativeObservationKey,fixture.expected.model.roleURL)
})

test('Sigma Solve preserves an unknown workplace mode instead of defaulting to onsite',async()=>{
 const r=replay(),jobs=await registered().run(r.options)
 assert.equal(jobs[0].remoteStatus,null);assert.equal(jobs[0].sourceRemoteStatusUnresolved,true)
 assert.equal(jobs[0].country,'United States');assert.equal(jobs[0].postingDate,null)
})

test('maxJobs zero still awaits the complete records observer and both native publication phases',async()=>{
 const r=replay();let records,audit
 const jobs=await registered().run({...r.options,maxJobs:0,onRecords:async value=>{await Promise.resolve();records=value},onAudit:value=>{audit=value}})
 assert.equal(records?.length??0,1);assert.equal(jobs.length,0)
 assert.equal(records[0].jobDescription,fixture.expected.model.description);assert.equal(audit.observations.length,1);assert.equal(r.requests.length,4)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})
// Synthetic controls mutate copies; the two original response bodies stay immutable.
import {mutateBody} from './test-data/sigmasolvePublication20261108.js'
import {createSigmaSolveNativeScraper,readSigmaSolveFailureEvidence} from '../scraper/sigmasolve/native20261108.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const PRIMARY=fixture.packets[0].requestedURL,ROLE=fixture.expected.model.roleURL
const failureOf=async promise=>{try{await promise;assert.fail('Expected Sigma Solve collection to reject')}catch(error){if(error?.code==='ERR_ASSERTION')throw error;return error}}
const change=(p,from,to)=>{const text=Buffer.from(p.bodyBase64,'base64').toString();assert.ok(text.includes(from));mutateBody(p,text.replace(from,to))}

test('India selection happens after retaining the complete explicit foreign role and never certifies India zero',async()=>{
 const r=replay();let records;const jobs=await registered().run({...r.options,countryFilter:'India',onRecords:v=>{records=v}})
 assert.equal(jobs.length,0);assert.equal(records.length,1);assert.equal(records[0].country,'United States');assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})

test('factory defaults survive undefined run options and complete the audit before a zero result cap',async()=>{
 const r=replay();let records;const jobs=await createSigmaSolveNativeScraper({...r.options,maxJobs:0,onRecords:v=>{records=v}}).run({maxJobs:undefined,onRecords:undefined,now:undefined,fetchPage:undefined})
 assert.equal(jobs.length,0);assert.equal(records.length,1);assert.equal(r.requests.length,4)
})

test('finite page limits cannot silently truncate a native publication cohort',async()=>{
 for(const maxPages of [0,1,3]){const r=replay(),error=await failureOf(createSigmaSolveNativeScraper().run({...r.options,maxPages}));assert.equal(error.code,'SIGMASOLVE_INVALID_OPTIONS');assert.equal(r.requests.length,0)}
})

test('a bounded request failure retains the complete opening role and the current closing listing',async()=>{
 const r=replay(),error=await failureOf(registered().run({...r.options,maxRequests:3}));assert.equal(error.code,'SIGMASOLVE_REQUEST_BUDGET');assert.equal(r.requests.length,3);assert.equal(error.nativeEvidence.observations.length,1);assert.deepEqual(error.nativeEvidence.observations[0].sourceNativeRecord,fixture.expected.model);assert.equal(error.nativeEvidence.observations[0].sourceCurrentNativeRoleQualified,false)
})

test('a closing location contradiction is retained and stops the registered route',async()=>{
 const r=replay({transform:(p,calls)=>{if(p.requestedURL===ROLE&&calls.length===4)change(p,'>United States</span>','>India</span>')}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,4);assert.equal(error.nativeEvidence.observations[0].sourceNativeClosingRecord.metadata.find(v=>v.label==='Location').value,'India');assert.equal(error.nativeEvidence.observations[0].country,'United States');assert.equal(error.nativeEvidence.observations[0].sourceCurrentNativeRoleQualified,false)
})

test('changed complete closing criteria remain available but yield no qualified candidates',async()=>{
 const r=replay({transform:(p,calls)=>{if(p.requestedURL===ROLE&&calls.length===4)change(p,'What You','Changed duties: What You')}});let audit;const jobs=await registered().run({...r.options,onAudit:v=>{audit=v}});assert.equal(jobs.length,0);assert.equal(audit.observations.length,1);assert.notEqual(audit.observations[0].sourceNativeRecord.description,audit.observations[0].sourceNativeClosingRecord.description);assert.equal(audit.observations[0].sourceNativeCurrentPublicationQualified,false)
})

test('an unknown additional native metadata field is preserved without qualifying the reviewed contract',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===ROLE)change(p,'<span class="inline-flex items-center gap-3 rounded-lg px-4 py-2"','<span><span>Unreviewed worksite</span><span>India</span></span><span class="inline-flex items-center gap-3 rounded-lg px-4 py-2"')}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records[0].sourceNativeRecord.metadata.find(v=>v.label==='Unreviewed worksite').value,'India');assert.equal(records[0].country,'United States');assert.equal(records[0].sourceNativeContractQualified,false)
})

test('corporate schema addresses cannot replace the explicit native role country',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===ROLE)change(p,'"addressCountry":"US"','"addressCountry":"India"')}}),jobs=await registered().run(r.options);assert.equal(jobs[0].country,'United States');assert.equal(jobs[0].sourceNativeRecord.head.schemas[0].address.addressCountry,'India');assert.equal(jobs[0].sourceNativeCountryEvidence.corporateSchemaAddressUsed,false)
})

test('hidden duplicate criteria do not become visible published job requirements',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===ROLE)change(p,'max-w-4xl space-y-3','max-w-4xl space-y-3 hidden-placeholder" hidden="')}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,2)
})

test('a foreign role canonical or unrelated application link is rejected without requesting either target',async()=>{
 for(const kind of ['canonical','application']){const r=replay({transform:p=>{if(p.requestedURL===ROLE)change(p,kind==='canonical'?'href="'+ROLE+'"':'apply-for-job?job=content-growth-strategist',kind==='canonical'?'href="https://example.com/unrelated"':'apply-for-job?job=unrelated')}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,2);assert.deepEqual(r.uncaptured,[])}
})

test('zero native openings or a nonnumeric count does not qualify a current vacancy',async()=>{
 for(const value of ['0','not-published']){const r=replay({transform:p=>{if(p.requestedURL===ROLE)change(p,'>1</span>','>'+value+'</span>')}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records[0].sourceNativeRecord.metadata.find(v=>v.label==='Openings').value,value);assert.equal(records[0].sourceNativeCurrentPublicationQualified,false)}
})

test('a changed primary base URI cannot delegate relative own-role links to another host',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===PRIMARY)change(p,'<head>','<head><base href="https://example.com/">')}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,1)
})

test('additional array-typed or case-insensitive JobPosting schemas require explicit native contract review',async()=>{
 for(const type of ['application/ld+json','application/LD+JSON']){const r=replay({transform:p=>{if(p.requestedURL===ROLE)mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString()+'<script type="'+type+'">'+JSON.stringify({'@context':'https://schema.org','@type':['JobPosting'],title:'Different job',validThrough:'2001-01-01T00:00:00Z'})+'</script>')}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,2);assert.equal(error.nativeEvidence.observations[0].sourceNativeRecord.head.schemas.length,2)}
})

test('unreviewed explicit native expiry metadata is retained without current-vacancy qualification',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===ROLE)change(p,'</head>','<meta name="validThrough" content="2001-01-01T00:00:00Z"></head>')}});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.ok(records[0].sourceNativeRecord.head.metas.some(v=>v.name==='validThrough'));assert.equal(records[0].sourceNativeCurrentPublicationQualified,false)
})

test('an added closing native role is retained in the incomplete closing cohort before stopping',async()=>{
 const r=replay({transform:(p,calls)=>{if(p.requestedURL===PRIMARY&&calls.length===3){const card=fixture.expected.listing.originalHTML,newCard=card.replaceAll('content-growth-strategist','new-native-role').replaceAll('Content &amp; Growth Strategist','New Native Role');change(p,card,card+newCard)}}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,3);assert.equal(error.nativeEvidence.closingListingRecords?.length??0,2);assert.equal(error.nativeEvidence.observations.length,1)
})

for(const reason of [false,0,''])test('exact caller cancellation wins invalid options before any public read: '+JSON.stringify(reason),async()=>{
 const r=replay(),controller=new AbortController();controller.abort(reason);let caught,rejected=false;try{await createSigmaSolveNativeScraper({...r.options,signal:controller.signal}).run({signal:undefined,maxJobs:-1})}catch(e){caught=e;rejected=true}assert.equal(rejected,true);assert.equal(caught,reason);assert.equal(r.requests.length,0)
})

test('mid-acquisition opaque caller cancellation never inspects the foreign reason for evidence',async()=>{
 const controller=new AbortController(),reason=new Proxy(Object.freeze({opaque:true}),{get(target,key){if(key==='nativeEvidence')throw Error('foreign evidence getter');return Reflect.get(target,key)}}),r=replay({transform:p=>{if(p.requestedURL===PRIMARY)controller.abort(reason)}});let caught;try{await registered().run({...r.options,signal:controller.signal})}catch(e){caught=e}assert.equal(caught,reason);assert.equal(r.requests.length,1);assert.equal(readSigmaSolveFailureEvidence(controller.signal).source,'sigmasolve')
})

for(const status of [403,429,503])test('native HTTP '+status+' with a stalled body keeps status, Retry-After, partial bytes and stops',async()=>{
 const r=replay(),fetchImpl=async(url,init)=>{if(String(url)===ROLE){r.requests.push(String(url));const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('partial upstream response'))}}),{status,headers:{'content-type':'text/html','retry-after':'5'}});Object.defineProperty(response,'url',{value:String(url)});return response}return r.options.fetchImpl(url,init)},error=await failureOf(createSigmaSolveNativeScraper().run({...r.options,fetchPage:undefined,fetchText:undefined,fetchImpl,readTimeoutMs:25}));assert.equal(error.status,status);assert.equal(error.nativeEvidence.rawResponses.at(-1).response.headers['retry-after'],'5');if(status===429)assert.equal(error.retryDelayMs,5000);assert.equal(error.acquisitionFailure.code,'SIGMASOLVE_READ_TIMEOUT');assert.equal(r.requests.length,2);assert.equal(error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,false);assert.ok(error.nativeEvidence.rawResponses.at(-1).response.bodyBytes>0)
})

const elapsed=t=>{let value=1000;const descriptor=Object.getOwnPropertyDescriptor(performance,'now');Object.defineProperty(performance,'now',{configurable:true,value:()=>value});t.after(()=>descriptor?Object.defineProperty(performance,'now',descriptor):delete performance.now);return ms=>{value+=ms}}

test('audit and records observers use one combined elapsed budget and preserve complete evidence',async t=>{
 const advance=elapsed(t),r=replay();let records=0;const error=await failureOf(createSigmaSolveNativeScraper().run({...r.options,onAudit:()=>advance(10000),onRecords:v=>{records=v.length;advance(5001)}}));assert.equal(error.code,'SIGMASOLVE_AUDIT_TIMEOUT');assert.equal(records,1);assert.equal(error.nativeEvidence.observations[0].sourceNativeRecord.description,fixture.expected.model.description)
})

test('an earlier audit expiry wins when one synchronous callback crosses audit and source deadlines',async t=>{
 const advance=elapsed(t),r=replay(),error=await failureOf(createSigmaSolveNativeScraper().run({...r.options,auditTimeoutMs:1000,sourceTimeoutMs:100000,onAudit:()=>advance(100001)}));assert.equal(error.code,'SIGMASOLVE_AUDIT_TIMEOUT')
})

test('returned candidates and observer records cannot mutate the complete audit models',async()=>{
 const r=replay(),jobs=await registered().run({...r.options,onRecords:v=>{v[0].sourceNativeRecord.title='observer mutation'}});jobs[0].sourceNativeRecord.title='candidate mutation';assert.equal(jobs.nativeCollectionEvidence.observations[0].sourceNativeRecord.title,fixture.expected.model.title)
})

test('text-only supplied readers cannot fabricate original HTTP qualification',async()=>{
 const r=replay(),error=await failureOf(createSigmaSolveNativeScraper().run({...r.options,fetchPage:undefined,fetchImpl:undefined}));assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,1)
})
import {extractOpeningSummaries,extractJobsFromDetailPages} from '../scraper/sigmasolve/script.js'
const originals=()=>({primary:Buffer.from(fixture.packets[0].bodyBase64,'base64').toString(),role:Buffer.from(fixture.packets[1].bodyBase64,'base64').toString()})
test('the public detail extraction helper also retains full authored criteria',()=>{
 const html=originals(),summary=extractOpeningSummaries(html.primary)[0],row=extractJobsFromDetailPages([{summary,detailHtml:html.role}])[0];assert.equal(row.jobDescription,fixture.expected.model.description);assert.equal(row.sourceNativeOwnDescriptionHTML,fixture.expected.model.descriptionHTML)
})
test('the public detail extraction helper cannot fabricate a requisition or workplace mode',()=>{
 const html=originals(),summary=extractOpeningSummaries(html.primary)[0],row=extractJobsFromDetailPages([{summary,detailHtml:html.role}])[0];assert.equal(row.requisitionId,null);assert.equal(row.remoteStatus,null);assert.equal(row.country,'United States')
})

// One substantive post-review pass. Each control changes copies of originals only.
test('unfamiliar complete native metadata carriers are retained and cannot qualify an expired role',async()=>{
 for(const [carrier,value] of [
  ['<div><span>Valid through</span><span>2001-01-01</span></div>','2001-01-01'],
  ['<span><span>Valid through</span><span>2001-01-01</span><span>Expired</span></span>','2001-01-01 Expired']
 ]){
  const anchor='<span class="inline-flex items-center gap-3 rounded-lg px-4 py-2"',r=replay({transform:p=>{if(p.requestedURL===ROLE)change(p,anchor,carrier+anchor)}});let records
  const jobs=await registered().run({...r.options,onRecords:v=>{records=v}})
  assert.equal(jobs.length,0);assert.equal(r.requests.length,4);assert.equal(records.length,1)
  for(const model of [records[0].sourceNativeRecord,records[0].sourceNativeClosingRecord]){
   const retained=model.metadata.find(v=>v.label==='Valid through');assert.ok(retained);assert.equal(retained.value,value);assert.equal(retained.nativeHTML,carrier);assert.ok(model.originalHeaderHTML.includes(carrier))
  }
  assert.equal(records[0].sourceNativeContractQualified,false);assert.equal(records[0].sourceNativeCurrentPublicationQualified,false)
 }
})

test('a changed complete closing title retains its actual header and criteria before rejecting the conflict',async()=>{
 const r=replay({transform:(p,calls)=>{if(p.requestedURL===ROLE&&calls.length===4){const text=Buffer.from(p.bodyBase64,'base64').toString();assert.ok(text.includes('Content &amp; Growth Strategist'));mutateBody(p,text.replaceAll('Content &amp; Growth Strategist','New Role Title'))}}}),error=await failureOf(registered().run(r.options))
 assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,4);assert.equal(error.nativeEvidence.rawResponses.length,4)
 const record=error.nativeEvidence.observations[0],closing=record.sourceNativeClosingRecord
 assert.ok(closing);assert.equal(closing.title,'New Role Title');assert.equal(closing.description,fixture.expected.model.description);assert.equal(closing.descriptionHTML,fixture.expected.model.descriptionHTML);assert.equal(closing.applicationURL,fixture.expected.model.applicationURL);assert.deepEqual(closing.metadata,fixture.expected.model.metadata);assert.equal(closing.head.title,'New Role Title | Sigma Solve');assert.ok(closing.originalHeaderHTML.includes('New Role Title'));assert.equal(record.sourceNativeCurrentPublicationQualified,false);assert.equal(error.nativeEvidence.sourceScopeComplete,false)
})

test('a missing closing criteria carrier retains the complete available native header as an unqualified partial model',async()=>{
 const r=replay({transform:(p,calls)=>{if(p.requestedURL===ROLE&&calls.length===4)change(p,fixture.expected.model.descriptionHTML,'<div>No description provided.</div>')}}),error=await failureOf(registered().run(r.options))
 assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,4);assert.equal(error.nativeEvidence.rawResponses.length,4)
 const record=error.nativeEvidence.observations[0],closing=record.sourceNativeClosingRecord
 assert.ok(closing);assert.equal(closing.title,fixture.expected.model.title);assert.equal(closing.description,null);assert.equal(closing.descriptionHTML,null);assert.equal(closing.originalHeaderHTML,fixture.expected.model.originalHeaderHTML);assert.equal(closing.applicationURL,fixture.expected.model.applicationURL);assert.deepEqual(closing.metadata,fixture.expected.model.metadata);assert.deepEqual(closing.head,fixture.expected.model.head);assert.equal(record.sourceNativeRecord.description,fixture.expected.model.description);assert.equal(record.sourceNativeCurrentPublicationQualified,false)
})

test('explicitly redirected or incomplete supplied entities retain contradictory provenance without qualifying',async()=>{
 for(const patch of [{redirected:true},{bodyComplete:false}]){
  const r=replay(),fetchPage=async(url,init)=>({...await r.options.fetchPage(url,init),...patch}),error=await failureOf(registered().run({...r.options,fetchPage}))
  assert.equal(error.code,'SIGMASOLVE_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(error.nativeEvidence.rawResponses.length,1);assert.equal(error.nativeEvidence.observations.length,0)
  const receipt=error.nativeEvidence.rawResponses[0];assert.equal(receipt.requestedURL,PRIMARY);assert.equal(receipt.response.status,200);assert.equal(receipt.response.url,PRIMARY);assert.equal(receipt.response.rawBodyBase64,fixture.packets[0].bodyBase64)
  for(const [key,value] of Object.entries(patch))assert.equal(receipt.response.suppliedOriginalMetadata[key],value)
  assert.equal(receipt.response.bodyComplete,patch.bodyComplete??null);assert.equal(error.nativeEvidence.sourceScopeComplete,false)
 }
})
