import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {fixture,replay} from './test-data/hiddenbrainsPublication20261108.js'
const registered=()=>createCatalogScraper(getScraperCatalog().find(v=>v.source==='hiddenbrainsinfotech'))
test('Hidden Brains title text cannot manufacture formal posting or requisition identifiers',async()=>{
 const r=replay(),jobs=await registered().run(r.options),rows=jobs.nativeCollectionEvidence?.observations??jobs;assert.ok(rows.length>0);assert.ok(rows.every(v=>v.jobId===null&&v.requisitionId===null));assert.ok(rows.every(v=>v.sourceNativeFormalIDKindKnown===false))
})
test('Hidden Brains observes every complete native role before geographic selection including the Abu Dhabi title',async()=>{
 const r=replay();let records;await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(records?.length??0,15);assert.deepEqual(records.map(v=>v.sourceNativeRecord.title),fixture.expected.records.map(v=>v.title));assert.ok(records.some(v=>v.title==='MERN Fullstack Developer - (Onsite - Abu Dhabi)'));assert.ok(records.every(v=>v.country===null&&v.sourceScopeComplete===false))
})
test('Hidden Brains maxJobs zero still awaits full records and both original primary observations',async()=>{
 const r=replay();let records,audit;const jobs=await registered().run({...r.options,maxJobs:0,onRecords:async v=>{await Promise.resolve();records=v},onAudit:v=>{audit=v}});assert.equal(jobs.length,0);assert.equal(records?.length??0,15);assert.equal(r.requests.length,2);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false)
})
test('Hidden Brains preserves full original native fields, description references, category memberships and display carriers',async()=>{
 const r=replay();let records;await registered().run({...r.options,onRecords:v=>{records=v}});assert.ok(records,'complete source-native observations delivered');assert.deepEqual(records.map(v=>v.sourceNativeRecord),fixture.expected.records);assert.deepEqual(records.map(v=>v.sourceNativeClosingRecord),fixture.expected.records)
})

import {mutateBody,PRIMARY} from './test-data/hiddenbrainsPublication20261108.js'
import {createHiddenBrainsNativeScraper,readHiddenBrainsFailureEvidence} from '../scraper/hiddenbrainsinfotech/native20261108.js'
import {readLiteralFlightRecords} from '../scraper-support/utils/kulaFlight.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const models=fixture.expected.records,first=models[0],failureOf=async promise=>{try{await promise;assert.fail('Expected Hidden Brains collection rejection')}catch(e){if(e?.code==='ERR_ASSERTION')throw e;return e}},change=(p,from,to)=>{const s=Buffer.from(p.bodyBase64,'base64').toString();assert.ok(s.includes(from));mutateBody(p,s.replace(from,to))}
const changeFlight=(p,edit)=>{let html=Buffer.from(p.bodyBase64,'base64').toString();const records=readLiteralFlightRecords(html);edit(records);const body=[...records].map(([id,r])=>r.kind==='text'?id+':T'+Buffer.byteLength(r.value).toString(16)+','+r.value:id+':'+(r.value===undefined?r.raw:JSON.stringify(r.value))+'\n').join('');for(const f of fixture.expected.frames){assert.ok(html.includes(f.nativeHTML));html=html.replace(f.nativeHTML,'')}mutateBody(p,html.replace('</body>','<script>self.__next_f.push('+JSON.stringify([1,body])+')</script></body>'))}
const nativeCategories=records=>{let value;const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v.categories))value=v.categories;for(const n of Object.values(v))walk(n)};for(const r of records.values())if(r.kind==='model')walk(r.value);assert.ok(value);return value}
const main=records=>nativeCategories(records).find(v=>v.categoryName==='ALL POSITIONS')
const eachNativeRole=(records,edit)=>{const seen=new Set();for(const c of nativeCategories(records))for(let role of c.jobs){while(typeof role==='string'&&/^\$[0-9a-f]+$/i.test(role))role=records.get(role.slice(1))?.value;if(role&&typeof role==='object'&&!seen.has(role)){seen.add(role);edit(role)}}}
test('paired complete Hidden Brains models preserve all60 display occurrences and native category data without rendered or country proof',async()=>{
 const r=replay(),jobs=await registered().run(r.options),a=jobs.nativeCollectionEvidence;assert.equal(jobs.length,0);assert.equal(a.observations.length,15);assert.equal(a.opening.frames.length,68);assert.equal(a.opening.flightRecords.length,115);assert.equal(a.opening.displayCardOccurrences,60);assert.equal(a.opening.desktopCardOccurrences,30);assert.equal(a.opening.mobileCardOccurrences,30);assert.deepEqual(a.opening.nativeCategoryScope,fixture.expected.nativeCategoryScope);assert.ok(a.observations.every(v=>v.sourceNativeAdvertisementPairObserved&&v.sourceNativeCriteriaComplete&&!v.sourceNativeCurrentPublicationQualified&&!v.sourceNativeCriteriaVisibilityQualified&&v.country===null));assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(a.companyIndiaTotal,null)
})
test('Hidden Brains undefined run fields preserve defined factory defaults and zero-cap observations',async()=>{
 const r=replay();let records;const jobs=await createHiddenBrainsNativeScraper({...r.options,maxJobs:0,onRecords:v=>{records=v}}).run({maxJobs:undefined,fetchPage:undefined,onRecords:undefined,now:undefined});assert.equal(jobs.length,0);assert.equal(records.length,15);assert.equal(r.requests.length,2)
})
test('finite Hidden Brains page caps reject before any silent native inventory truncation',async()=>{
 for(const maxPages of [0,1,3]){const r=replay(),e=await failureOf(registered().run({...r.options,maxPages}));assert.equal(e.code,'HIDDEN_BRAINS_INVALID_OPTIONS');assert.equal(r.requests.length,0)}
})
test('a bounded Hidden Brains request failure retains all15 complete opening models and original bytes',async()=>{
 const r=replay(),e=await failureOf(registered().run({...r.options,maxRequests:1}));assert.equal(e.code,'HIDDEN_BRAINS_REQUEST_BUDGET');assert.equal(e.nativeEvidence.rawResponses.length,1);assert.deepEqual(e.nativeEvidence.openingRecords,models);assert.equal(e.nativeEvidence.observations.length,15);assert.ok(e.nativeEvidence.observations.every(v=>v.sourceNativeClosingRecord===null))
})
test('a changed closing Hidden Brains title is retained as its own model before rejecting unreconciled native identity',async()=>{
 const r=replay({transform:(p,calls)=>{if(calls.length===2)changeFlight(p,records=>{main(records).jobs[0].job_title='Changed closing title'})}}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,2);assert.equal(e.nativeEvidence.closingRecords.length,16);assert.ok(e.nativeEvidence.closingRecords.some(v=>v.title===first.title&&v.categoryName==='BUSINESS_DEV'&&v.fullCriteriaText===first.fullCriteriaText));assert.equal(e.nativeEvidence.closingRecords[0].title,'Changed closing title');assert.ok(e.nativeEvidence.observations.some(v=>v.sourceNativeClosingRecord?.title==='Changed closing title'));assert.deepEqual(e.nativeEvidence.openingRecords,models)
})
test('a changed closing publisher head retains every complete Hidden Brains closing model before stopping',async()=>{
 const r=replay({transform:(p,calls)=>{if(calls.length===2)change(p,fixture.expected.head.titles[0],'page_title')}}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.closingRecords.length,15);assert.equal(e.nativeEvidence.closingRecords[0].head.titles[0],'page_title');assert.equal(e.nativeEvidence.closingRecords[0].fullCriteriaText,first.fullCriteriaText);assert.equal(r.requests.length,2)
})
test('missing native Hidden Brains description references retain all raw roles and other complete criteria before rejection',async()=>{
 const r=replay({transform:p=>changeFlight(p,records=>{main(records).jobs[0].job_description='$deadbeef'})}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.openingRecords.length,16);assert.ok(e.nativeEvidence.openingRecords.some(v=>v.title===first.title&&v.categoryName==='BUSINESS_DEV'&&v.nativeDescriptionHTML===first.nativeDescriptionHTML));assert.equal(e.nativeEvidence.openingRecords[0].rawNativeRole.job_description,'$deadbeef');assert.equal(e.nativeEvidence.openingRecords[0].nativeDescriptionHTML,null);assert.equal(e.nativeEvidence.openingRecords[1].fullCriteriaText,models[1].fullCriteriaText)
})
test('a Hidden Brains all-positions count conflict retains the full native category component and all role models',async()=>{
 const r=replay({transform:p=>changeFlight(p,records=>{main(records).count++})}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.openingRecords.length,15);assert.equal(e.nativeEvidence.opening.nativeCategoryScope.categories[0].count,16);assert.equal(r.requests.length,1)
})
test('hidden criteria repeated across native Hidden Brains categories remain original evidence without complete-source qualification',async()=>{
 const marker='<p hidden>Workplace: Toronto, Canada.</p>',r=replay({transform:p=>changeFlight(p,records=>{for(const item of records.values())if(item.kind==='text'&&item.value===first.nativeDescriptionHTML)item.value+=marker})}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.openingRecords.length,15);assert.ok(e.nativeEvidence.openingRecords[0].nativeDescriptionHTML.includes(marker));assert.equal(e.nativeEvidence.observations[0].country,null);assert.equal(r.requests.length,1)
})
test('hidden Hidden Brains data carriers retain all models before rejecting source visibility',async()=>{
 const r=replay({transform:p=>mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString().replaceAll('<script','<script hidden'))}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.openingRecords.length,15);assert.equal(e.nativeEvidence.opening.frames.length,68);assert.equal(r.requests.length,1)
})
test('unknown Hidden Brains native role fields are retained rather than dropped or interpreted as publication proof',async()=>{
 const r=replay({transform:p=>changeFlight(p,records=>{eachNativeRole(records,role=>{if(role.job_title===first.title)role.validThrough='2001-01-01'})})});let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(jobs.length,0);assert.equal(records[0].sourceNativeRecord.rawNativeRole.validThrough,'2001-01-01');assert.equal(records[0].sourceNativeContractQualified,false);assert.equal(records[0].sourceNativeAdvertisementPairObserved,false)
})
test('unfamiliar native schema is retained and cannot qualify a Hidden Brains native advertisement pair',async()=>{
 const schema={'@type':'CreativeWork',expires:'2001-01-01'},r=replay({transform:p=>change(p,'</head>','<script type="application/ld+json">'+JSON.stringify(schema)+'</script></head>')});let records;await registered().run({...r.options,onRecords:v=>{records=v}});assert.deepEqual(records[0].sourceNativeRecord.head.schemas.find(v=>v.parsed?.['@type']==='CreativeWork').parsed,schema);assert.equal(records[0].sourceNativeContractQualified,false)
})
test('malformed Hidden Brains schemas preserve all intact models and exact declaration text before stopping',async()=>{
 const raw='{broken}',r=replay({transform:p=>change(p,'</head>','<script type="application/ld+json">'+raw+'</script></head>')}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.openingRecords.length,15);assert.equal(e.nativeEvidence.openingRecords[0].head.schemas.find(v=>v.raw===raw).raw,raw);assert.ok(e.nativeEvidence.openingRecords[0].head.schemas.find(v=>v.raw===raw).parseFailure);assert.equal(r.requests.length,1)
})
test('a malformed additional Flight record preserves all previously intact Hidden Brains roles and its own literal original',async()=>{
 const raw='ff:{broken}\n',r=replay({transform:p=>change(p,'</body>','<script>self.__next_f.push('+JSON.stringify([1,raw])+')</script></body>')}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.openingRecords.length,15);assert.equal(e.nativeEvidence.opening.flightRecords.find(v=>v.id==='ff').raw,'{broken}');assert.equal(e.nativeEvidence.rawResponses.length,1)
})
test('a changed Hidden Brains display carrier keeps its complete original markup before withholding native contract qualification',async()=>{
 const card=fixture.expected.displayCards[0],changed=card.nativeHTML.replace('JobPostView_inner-box__','JobPostView_opening-card__'),r=replay({transform:p=>change(p,card.nativeHTML,changed)}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.openingRecords.length,15);assert.ok(e.nativeEvidence.openingRecords[0].displayCards.some(v=>v.nativeHTML===changed));assert.equal(e.nativeEvidence.rawResponses.length,1)
})
test('unreviewed Hidden Brains display expiry content is retained before rejecting the changed native carrier',async()=>{
 const card=fixture.expected.displayCards[0],marker='<h5>Expired 2001-01-01</h5>',changed=card.nativeHTML.replace('<div', '<div').replace('><div','>'+marker+'<div'),r=replay({transform:p=>change(p,card.nativeHTML,changed)}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.openingRecords.length,15);assert.ok(e.nativeEvidence.openingRecords[0].displayCards.some(v=>v.nativeHTML===changed));assert.equal(r.requests.length,1)
})
test('foreign Hidden Brains canonical and base declarations retain complete models without requesting targets',async()=>{
 for(const kind of ['canonical','base']){const r=replay({transform:p=>kind==='canonical'?change(p,'rel="canonical" href="'+PRIMARY+'"','rel="canonical" href="https://example.com/foreign"'):change(p,'</head>','<base href="https://example.com/foreign"></head>')}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(e.nativeEvidence.openingRecords.length,15);assert.deepEqual(r.uncaptured,[]);assert.equal(r.requests.length,1)}
})
for(const reason of [false,0,''])test('Hidden Brains exact caller reason precedes invalid run options: '+JSON.stringify(reason),async()=>{
 const r=replay(),c=new AbortController();c.abort(reason);let value=Symbol();try{await createHiddenBrainsNativeScraper({...r.options,signal:c.signal}).run({signal:undefined,maxJobs:-1})}catch(e){value=e}assert.equal(value,reason);assert.equal(r.requests.length,0)
})
test('mid-read Hidden Brains opaque caller cancellation keeps exact identity and detached earlier evidence',async()=>{
 const c=new AbortController(),reason=new Proxy(Object.freeze({opaque:true}),{get(t,k){if(k==='nativeEvidence')throw Error('foreign evidence getter');return Reflect.get(t,k)}}),r=replay({transform:()=>c.abort(reason)});let caught;try{await registered().run({...r.options,signal:c.signal})}catch(e){caught=e}assert.equal(caught,reason);assert.equal(r.requests.length,1);assert.equal(readHiddenBrainsFailureEvidence(c.signal).rawResponses.length,0)
})
for(const status of [403,429,503])test('Hidden Brains HTTP'+status+' with a stalled closing entity preserves status headers partial bytes and all opening models',async()=>{
 const r=replay(),fetchImpl=async(u,i)=>{if(r.requests.length===1){r.requests.push(String(u));const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('partial upstream original'))}}),{status,headers:{'content-type':'text/html','retry-after':'5'}});Object.defineProperty(response,'url',{value:String(u)});return response}return r.options.fetchImpl(u,i)},e=await failureOf(createHiddenBrainsNativeScraper().run({...r.options,fetchPage:undefined,fetchText:undefined,fetchImpl,readTimeoutMs:25}));assert.equal(e.status,status);if(status===429)assert.equal(e.retryDelayMs,5000);assert.equal(e.acquisitionFailure.code,'HIDDEN_BRAINS_READ_TIMEOUT');assert.equal(e.nativeEvidence.rawResponses.at(-1).response.headers['retry-after'],'5');assert.equal(e.nativeEvidence.rawResponses.at(-1).response.bodyComplete,false);assert.ok(e.nativeEvidence.rawResponses.at(-1).response.bodyBytes>0);assert.deepEqual(e.nativeEvidence.openingRecords,models);assert.equal(r.requests.length,2)
})
const elapsed=t=>{let value=1000;const d=Object.getOwnPropertyDescriptor(performance,'now');Object.defineProperty(performance,'now',{configurable:true,value:()=>value});t.after(()=>d?Object.defineProperty(performance,'now',d):delete performance.now);return ms=>{value+=ms}}
test('Hidden Brains callbacks share one aggregate elapsed observer deadline',async t=>{
 const advance=elapsed(t),r=replay();let count=0;const e=await failureOf(registered().run({...r.options,onAudit:()=>advance(10000),onRecords:v=>{count=v.length;advance(5001)}}));assert.equal(e.code,'HIDDEN_BRAINS_AUDIT_TIMEOUT');assert.equal(count,15);assert.deepEqual(e.nativeEvidence.openingRecords,models)
})
test('the earlier Hidden Brains source deadline survives a later audit expiry',async t=>{
 const advance=elapsed(t),r=replay(),e=await failureOf(registered().run({...r.options,sourceTimeoutMs:1000,auditTimeoutMs:15000,onAudit:()=>advance(15001)}));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_TIMEOUT')
})
test('the earlier Hidden Brains audit expiry wins across a synchronous callback that also crosses the source deadline',async t=>{
 const advance=elapsed(t),r=replay(),e=await failureOf(registered().run({...r.options,sourceTimeoutMs:100000,auditTimeoutMs:1000,onAudit:()=>advance(100001)}));assert.equal(e.code,'HIDDEN_BRAINS_AUDIT_TIMEOUT')
})
test('detached Hidden Brains record observers cannot rewrite complete original models',async()=>{
 const r=replay(),jobs=await registered().run({...r.options,onRecords:v=>{v[0].sourceNativeRecord.title='callback mutation'}});assert.equal(jobs.nativeCollectionEvidence.observations[0].sourceNativeRecord.title,first.title);assert.equal(jobs.nativeCollectionEvidence.openingRecords[0].title,first.title)
})
test('contradictory supplied Hidden Brains HTTP metadata or body retains original claims before rejection',async()=>{
 for(const patch of [{redirected:true},{bodyComplete:false},{html:'different decoded body'},{status:204}]){const r=replay(),fetchPage=async(u,i)=>({...await r.options.fetchPage(u,i),...patch}),e=await failureOf(registered().run({...r.options,fetchPage}));assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.rawResponses.length,1);const q=e.nativeEvidence.rawResponses[0].response;assert.equal(q.rawBodyBase64,fixture.packets[0].bodyBase64);assert.equal(q.suppliedProvenanceQualified,false);if(patch.status)assert.equal(e.status,patch.status);else assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF')}
})
test('text-only Hidden Brains readers cannot manufacture original HTTP provenance',async()=>{
 const r=replay(),e=await failureOf(registered().run({...r.options,fetchPage:undefined,fetchImpl:undefined}));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1)
})
test('foreign frozen Hidden Brains observer failures retain their exact evidence through cause',async()=>{
 const foreign=Object.freeze(Object.assign(Error('foreign observer'),{nativeEvidence:Object.freeze({owner:'foreign'})})),r=replay(),e=await failureOf(registered().run({...r.options,onRecords:()=>{throw foreign}}));assert.equal(e.cause,foreign);assert.deepEqual(foreign.nativeEvidence,{owner:'foreign'});assert.deepEqual(e.nativeEvidence.openingRecords,models)
})

test('malformed Hidden Brains category jobs retain all intact main role models and the original malformed carrier before rejection',async()=>{
 const malformed={unexpected:'malformed native category'},r=replay({transform:p=>changeFlight(p,records=>{nativeCategories(records)[1].jobs=malformed})}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);const expected=models.map(v=>({...v,categoryMemberships:v.categoryMemberships.filter(m=>m.categoryName!=='BUSINESS_DEV')}));assert.deepEqual(e.nativeEvidence.openingRecords,expected);assert.deepEqual(e.nativeEvidence.opening.nativeCategoryScope.categories[1].jobs,malformed);assert.equal(e.nativeEvidence.rawResponses.length,1)
})
test('a non-text Hidden Brains job type retains its full raw role and every other complete model before a native proof failure',async()=>{
 const r=replay({transform:p=>changeFlight(p,records=>eachNativeRole(records,role=>{if(role.job_title===first.title)role.job_type=123}))}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.openingRecords.length,15);assert.equal(e.nativeEvidence.openingRecords[0].rawNativeRole.job_type,123);assert.equal(e.nativeEvidence.openingRecords[0].fullCriteriaText,first.fullCriteriaText);assert.deepEqual(e.nativeEvidence.openingRecords.slice(1),models.slice(1));assert.equal(e.nativeEvidence.rawResponses.length,1)
})
test('a role declared only in another Hidden Brains category receives its own complete observation before inventory rejection',async()=>{
 const title='Extra unpublished native declaration',r=replay({transform:p=>changeFlight(p,records=>{const category=nativeCategories(records)[1],role=structuredClone(first.rawNativeRole);role.job_title=title;category.jobs.push(role);category.count++})}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.openingRecords.length,16);const extra=e.nativeEvidence.openingRecords.find(v=>v.title===title);assert.ok(extra);assert.equal(extra.nativeDescriptionHTML,first.nativeDescriptionHTML);assert.equal(extra.fullCriteriaText,first.fullCriteriaText);assert.equal(extra.rawNativeRole.job_title,title);assert.equal(extra.categoryName,'BUSINESS_DEV');assert.equal(e.nativeEvidence.opening.nativeCategoryScope.categories[0].count,15);assert.equal(e.nativeEvidence.observations.length,16);assert.ok(e.nativeEvidence.observations.every(v=>!v.sourceNativeCurrentPublicationQualified&&!v.sourceNativeAdvertisementPairObserved))
})
test('an unsupported Hidden Brains Flight frame retains its declaration and all complete roles before contract rejection',async()=>{
 const raw='self.__next_f.push([99,"unreviewed-control"])',r=replay({transform:p=>change(p,'</body>','<script>'+raw+'</script></body>')}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.deepEqual(e.nativeEvidence.openingRecords,models);assert.equal(e.nativeEvidence.opening.frames.at(-1).raw,raw);assert.ok(e.nativeEvidence.opening.parseIssues.some(v=>v.stage==='frame'));assert.equal(e.nativeEvidence.rawResponses.length,1)
})
test('an unsupported Hidden Brains Flight record control retains raw payload and intact models without claiming a known native contract',async()=>{
 const raw='ff:Z{"job_title":"Unknown role"}\n',r=replay({transform:p=>change(p,'</body>','<script>self.__next_f.push('+JSON.stringify([1,raw])+')</script></body>')}),e=await failureOf(registered().run(r.options));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.deepEqual(e.nativeEvidence.openingRecords,models);assert.equal(e.nativeEvidence.opening.flightRecords.find(v=>v.id==='ff').raw,'Z{"job_title":"Unknown role"}');assert.ok(e.nativeEvidence.opening.parseIssues.length);assert.equal(e.nativeEvidence.rawResponses.length,1)
})
test('malformed supplied Hidden Brains status URL or headers preserve available original bytes and exact claims before validation',async()=>{
 for(const patch of [{status:'200'},{headers:undefined},{url:undefined}]){const r=replay(),fetchPage=async(u,i)=>({...await r.options.fetchPage(u,i),...patch}),e=await failureOf(registered().run({...r.options,fetchPage}));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.rawResponses.length,1);const q=e.nativeEvidence.rawResponses[0].response;assert.equal(q.rawBodyBase64,fixture.packets[0].bodyBase64);assert.equal(q.suppliedProvenanceQualified,false);for(const [k,v]of Object.entries(patch))assert.equal(q.suppliedOriginalMetadata[k],v)}
})
test('unspecified supplied Hidden Brains completeness or redirect provenance stays unknown instead of becoming complete buffer EOF',async()=>{
 for(const key of ['bodyComplete','redirected']){const r=replay(),fetchPage=async(u,i)=>{const q=await r.options.fetchPage(u,i);delete q[key];return q},e=await failureOf(registered().run({...r.options,fetchPage}));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.rawResponses.length,1);const q=e.nativeEvidence.rawResponses[0].response;assert.equal(q.rawBodyBase64,fixture.packets[0].bodyBase64);assert.equal(q.suppliedProvenanceQualified,false);assert.ok(!q.suppliedProvidedFields.includes(key));if(key==='bodyComplete')assert.equal(q.bodyComplete,null)}
})
test('a contradictory unencoded supplied Hidden Brains content length retains the original header and bytes without completeness qualification',async()=>{
 const r=replay(),fetchPage=async(u,i)=>{const q=await r.options.fetchPage(u,i);delete q.headers['content-encoding'];q.headers['content-length']='999999';return q},e=await failureOf(registered().run({...r.options,fetchPage}));assert.equal(e.code,'HIDDEN_BRAINS_NATIVE_PROOF');assert.equal(r.requests.length,1);assert.equal(e.nativeEvidence.rawResponses.length,1);const q=e.nativeEvidence.rawResponses[0].response;assert.equal(q.headers['content-length'],'999999');assert.equal(q.rawBodyBase64,fixture.packets[0].bodyBase64);assert.equal(q.suppliedProvenanceQualified,false)
})
test('explicit supplied Hidden Brains encoded entity length is not compared with decompressed original body length',async()=>{
 const r=replay(),fetchPage=async(u,i)=>{const q=await r.options.fetchPage(u,i);q.headers['content-encoding']='gzip';q.headers['content-length']='99999';return q},jobs=await registered().run({...r.options,fetchPage});assert.equal(jobs.length,0);assert.equal(r.requests.length,2);assert.equal(jobs.nativeCollectionEvidence.observations.length,15);assert.ok(jobs.nativeCollectionEvidence.observations.every(v=>v.sourceNativeAdvertisementPairObserved&&!v.sourceNativeCurrentPublicationQualified))
})
