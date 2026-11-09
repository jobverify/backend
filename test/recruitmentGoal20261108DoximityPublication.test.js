import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {fixture,replay} from './test-data/doximityPublication20261108.js'
const registered=()=>createCatalogScraper(getScraperCatalog().find(v=>v.source==='doximity'))

test('registered Doximity retains every complete current API and published hosted model before selection',async()=>{
 const r=replay();let audit,records,error
 try{await registered().run({...r.options,onAudit:value=>{audit=value},onRecords:value=>{records=value}})}catch(e){error=e}
 assert.deepEqual(r.uncaptured,[]);assert.equal(error?.message,undefined)
 assert.equal(audit.observations.length,10)
 for(const row of audit.observations)assert.deepEqual(row.sourceNativeRecord,fixture.expected.apiModels[row.jobId],'complete native API fields must survive')
 assert.equal(audit.observations.filter(v=>v.sourceNativePublishedModel).length,10,'current public own HTML models are missing from the registered route')
 assert.equal(records.length,10)
 for(const row of records)assert.deepEqual(row.sourceNativePublishedModel,fixture.expected.publishedModels[row.jobId])
})

test('registered Doximity awaits all ten complete records even with maxJobs zero',async()=>{
 const r=replay();let records,audit
 const jobs=await registered().run({...r.options,maxJobs:0,onAudit:value=>{audit=value},onRecords:async value=>{await Promise.resolve();records=value}})
 assert.deepEqual(r.uncaptured,[]);assert.equal(jobs.length,0);assert.equal(audit.observations.length,10)
 assert.equal(records?.length??0,10,'the registered native records observer is currently ignored')
 for(const row of records){assert.deepEqual(row.sourceNativeRecord,fixture.expected.apiModels[row.jobId]);assert.deepEqual(row.sourceNativePublishedModel,fixture.expected.publishedModels[row.jobId])}
})

test('registered Doximity retains the exact complete own visible criteria apart from application forms',async()=>{
 const r=replay();let audit
 await registered().run({...r.options,onAudit:value=>{audit=value}})
 assert.deepEqual(r.uncaptured,[])
 assert.equal(audit.observations.filter(v=>v.sourceNativeOwnDescription?.length>100).length,10,'full API descriptions do not replace verification of actual own visible role criteria')
 for(const row of audit.observations){const expected=fixture.expected.roles.find(v=>v.id===row.jobId);assert.equal(row.sourceNativeOwnDescription,expected.description);assert.equal(row.sourceNativeOwnDescriptionHTML,expected.descriptionHTML);assert.equal(row.requisitionId,expected.listingRecord.requisition_id);assert.equal(row.activeApplyVerified,false)}
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})
// Current originals are immutable. All changes below are synthetic controls.
import {mutateBody} from './test-data/doximityPublication20261108.js'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {createDoximityNativeScraper,readDoximityFailureEvidence} from '../scraper/doximity/native20261108.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const PRIMARY='https://work.doximity.com/positions/',EMBED='https://boards.greenhouse.io/embed/job_board/js?for=doximity',BOARD='https://job-boards.greenhouse.io/embed/job_board?for=doximity',API='https://boards-api.greenhouse.io/v1/boards/doximity',FIRST=fixture.expected.roles[0],ROLE=FIRST.listingRecord.absolute_url,HOLD='7950903',HOLD_URL='https://job-boards.greenhouse.io/doximity/jobs/'+HOLD
const failureOf=async pending=>{try{await pending;assert.fail('Expected source acquisition/qualification to reject')}catch(error){if(error?.code==='ERR_ASSERTION')throw error;return error}}
const alterRemix=(p,change)=>{const text=Buffer.from(p.bodyBase64,'base64').toString(),script=readNativeDocument(text).nodes(n=>n.tag==='script'&&!n.attrs.src&&n.raw.includes('window.__remixContext ='))[0];assert.ok(script);const match=/^\s*window\.__remixContext\s*=\s*([\s\S]*);\s*$/.exec(script.raw);assert.ok(match);const value=JSON.parse(match[1]);change(value);mutateBody(p,text.replace(script.raw,'window.__remixContext = '+JSON.stringify(value).replaceAll('<','\\u003c')+';'))}
const withPost=(change,id=FIRST.id)=>replay({transform:p=>{if(p.requestedURL==='https://job-boards.greenhouse.io/doximity/jobs/'+id)alterRemix(p,m=>change(m.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost))}})

test('expanded registered source reads all 54 original responses before retaining the two unresolved worksite candidates',async()=>{
 const r=replay();let records;const jobs=await registered().run({...r.options,onRecords:v=>{records=v}})
 assert.equal(r.requests.length,54);assert.deepEqual(r.uncaptured,[]);assert.equal(records.length,10);assert.deepEqual(jobs.map(v=>v.jobId).sort(),fixture.expected.countryScopeUnresolvedIds.slice().sort())
 assert.ok(records.every(v=>v.country==='United States'));assert.equal(records.filter(v=>v.sourceCountryScopeUnresolved).length,2);assert.ok(records.every(v=>v.sourceNativeTemporalQualified))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})

test('inactive primary embed and a different employer board cannot delegate Doximity jobs',async()=>{
 for(const stage of ['primary','embed']){const r=replay({transform:p=>{if(stage==='primary'&&p.requestedURL===PRIMARY)mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString().replace('src="'+EMBED+'"','type="application/json" src="'+EMBED+'"'));if(stage==='embed'&&p.requestedURL===EMBED)mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString().replace('for=doximity','for=curative'))}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert.equal(r.requests.length,stage==='primary'?1:2)}
})

test('duplicate decoded keys in the hosted native model cannot hide a conflicting location',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===ROLE){const text=Buffer.from(p.bodyBase64,'base64').toString();mutateBody(p,text.replace(/"job_post_location"\s*:/,'"job_post_location":"Other country","job_post_loc\\u0061tion":'))}}}),error=await failureOf(registered().run(r.options))
 assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert.equal(r.requests.length,32);assert.equal(error.nativeEvidence.completeAPIModels,10);assert.equal(error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true)
})

for(const field of ['public_url','company_name','hiring_plan_id'])test('a conflicting hosted '+field+' is retained without qualification',async()=>{
 const r=withPost(p=>{p[field]=field==='hiring_plan_id'?1:field==='company_name'?'Curative':'https://job-boards.greenhouse.io/doximity/jobs/1'}),error=await failureOf(registered().run(r.options))
 assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert.equal(r.requests.length,32);assert.equal(error.nativeEvidence.observations.length,10);assert.equal(error.nativeEvidence.observations[0].sourceNativePublishedModel[field],field==='hiring_plan_id'?1:field==='company_name'?'Curative':'https://job-boards.greenhouse.io/doximity/jobs/1');assert.equal(error.nativeEvidence.observations[0].sourceCurrentNativeRoleQualified,false)
})

test('a later invalid native board model keeps the preceding nine full listings',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===BOARD)alterRemix(p,m=>{m.state.loaderData['routes/embed.job_board'].jobPosts.data[9].id=0})}}),error=await failureOf(registered().run(r.options))
 assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert.equal(r.requests.length,3);assert.equal(error.nativeEvidence.observations.length,9)
 assert.deepEqual(error.nativeEvidence.observations.map(v=>v.sourceNativeHostedListingRecord),fixture.expected.roles.slice(0,9).map(v=>v.listingRecord))
})

test('invalid API listing proof stops admission after its completed original while retaining the full decoded listing',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===API+'/jobs?content=true'){const value=JSON.parse(Buffer.from(p.bodyBase64,'base64'));value.jobs[9].id=0;mutateBody(p,JSON.stringify(value))}}}),error=await failureOf(registered().run(r.options))
 assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert.equal(r.requests.length,7,'the source must stop physical admission when native API proof becomes unusable');assert.equal(error.nativeEvidence.apiListingHistory[0].length,10)
})

test('all new native fields survive while their unreviewed meaning holds qualification',async()=>{
 const added={unknownCountryMeaning:['do not project into an India job'],full:'native field survives'}
 const r=replay({transform:p=>{if(p.requestedURL===ROLE)alterRemix(p,m=>{m.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost.native_unmapped=added});if(p.requestedURL.startsWith(API+'/jobs/')){const v=JSON.parse(Buffer.from(p.bodyBase64,'base64'));if(v.id===Number(FIRST.id)){v.native_unmapped=added;mutateBody(p,JSON.stringify(v))}}}});let records
 await registered().run({...r.options,onRecords:v=>{records=v}});const row=records.find(v=>v.jobId===FIRST.id)
 assert.deepEqual(row.sourceNativeRecord.native_unmapped,added);assert.deepEqual(row.sourceNativePublishedModel.native_unmapped,added);assert.deepEqual(row.sourceNativePublishedClosingModel.native_unmapped,added);assert.equal(row.sourceCurrentNativeRoleQualified,false);assert.equal(row.sourceNativePublishedContractQualified,false)
})

test('application country choices do not replace the own API role country evidence',async()=>{
 const r=withPost(p=>{p.questions=[{name:'Country',choices:['India']}]} );let records
 await registered().run({...r.options,onRecords:v=>{records=v}});assert.equal(records[0].country,'United States');assert.equal(records[0].sourceNativePublishedLocationEvidence.applicationFormCountriesUsed,false);assert.deepEqual(records[0].sourceNativePublishedModel.questions,[{name:'Country',choices:['India']}])
})

test('contradictory role-owned API country metadata remains held with every model intact',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL.startsWith(API+'/jobs/')){const value=JSON.parse(Buffer.from(p.bodyBase64,'base64'));if(value.id===Number(FIRST.id)){value.metadata??=[];value.metadata.push({name:'Country',value:'India'});mutateBody(p,JSON.stringify(value))}}}});let records
 await registered().run({...r.options,onRecords:v=>{records=v}});const row=records.find(v=>v.jobId===FIRST.id);assert.equal(row.country,null);assert.equal(row.sourceNativeCountryConflict,true);assert.equal(row.sourceCurrentNativeRoleQualified,false);assert.equal(records.length,10)
})

for(const instant of ['2999-01-01T00:00:00Z','2026-02-30T10:00:00Z'])test('invalid/future native first publication '+instant+' cannot qualify a current role',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL.startsWith(API+'/jobs/')){const value=JSON.parse(Buffer.from(p.bodyBase64,'base64'));if(value.id===Number(FIRST.id)){value.first_published=instant;mutateBody(p,JSON.stringify(value))}}}});let records
 await registered().run({...r.options,onRecords:v=>{records=v}});const row=records.find(v=>v.jobId===FIRST.id);assert.equal(row.sourceNativeTemporalQualified,false);assert.ok(row.sourceNativeIssues.includes('API-first-publication-invalid-or-future'));assert.equal(row.sourceNativeRecord.first_published,instant)
})

test('fresh closing publication time holds a role whose deadline expires during own acquisition',async()=>{
 let now='2026-11-08T20:00:00.000Z',reads=0,records;const r=withPost(p=>{p.application_deadline='2026-11-08T20:00:01.000Z'},HOLD),supplied=r.options.fetchPage
 const fetchPage=async(url,init)=>{if(url===HOLD_URL&&++reads===2)now='2026-11-08T20:00:02.000Z';return supplied(url,init)}
 const jobs=await registered().run({...r.options,fetchPage,now:()=>now,onRecords:v=>{records=v}}),row=records.find(v=>v.jobId===HOLD)
 assert.equal(row.sourceNativeOpeningPublication.qualified,true);assert.equal(row.sourceNativeClosingPublication.qualified,false);assert.equal(row.sourceNativeTemporalQualified,false);assert.equal(jobs.some(v=>v.jobId===HOLD),false)
})
for(const observer of ['onAudit','onRecords'])test('final publication admission includes time spent in '+observer,async()=>{
 let now='2026-11-08T20:00:00.000Z';const r=withPost(p=>{p.application_deadline='2026-11-08T20:00:01.000Z'},HOLD)
 const jobs=await registered().run({...r.options,now:()=>now,[observer]:()=>{now='2026-11-08T20:00:02.000Z'}})
 assert.equal(jobs.some(v=>v.jobId===HOLD),false);assert.equal(jobs.nativeCollectionEvidence.observations.find(v=>v.jobId===HOLD).sourceNativeTemporalQualified,false)
})

test('first own-page denial preserves all ten complete API models and stops further acquisition',async()=>{
 let callbacks=0;const r=replay({transform:p=>{if(p.requestedURL===ROLE){p.status=403;mutateBody(p,'Access denied')}}}),error=await failureOf(registered().run({...r.options,onAudit:()=>{callbacks++},onRecords:()=>{callbacks++}}))
 assert.equal(error.status,403);assert.equal(r.requests.length,32);assert.equal(callbacks,0);assert.equal(error.nativeEvidence.observations.length,10);assert.equal(error.nativeEvidence.completeAPIModels,10);assert.equal(error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true)
})

test('owned physical request budget retains a completed first hosted model and all API originals',async()=>{
 const r=replay(),error=await failureOf(registered().run({...r.options,maxRequests:32}));assert.equal(error.code,'DOXIMITY_REQUEST_BUDGET');assert.equal(error.status,undefined);assert.equal(r.requests.length,32);assert.equal(error.nativeEvidence.completeHostedCriteria,1);assert.equal(error.nativeEvidence.completeAPIModels,10);assert.equal(error.nativeEvidence.observations[0].sourceNativeOwnDescription,FIRST.description)
})
for(const status of [403,429,503])test('HTTP '+status+' retains primary metadata across a stalled original body',async()=>{
 let reads=0;const fetchImpl=async url=>{reads++;const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('partial denial'))}}),{status,headers:{'content-type':'text/html','retry-after':'7'}});Object.defineProperty(response,'url',{value:String(url)});return response}
 const error=await failureOf(createDoximityNativeScraper().run({fetchImpl,readTimeoutMs:20,rateLimitMs:0}));assert.equal(error.status,status);assert.equal(error.acquisitionFailure.code,'DOXIMITY_READ_TIMEOUT');assert.equal(reads,1);assert.equal(error.nativeEvidence.rawResponses[0].response.bodyComplete,false);if(status===429)assert.equal(error.retryDelayMs,7000)
})
let reasonCase=0
for(const reason of [false,0,'',Object.freeze({opaque:'caller cancellation'})])test('factory pre-abort preserves exact caller reason '+(++reasonCase),async()=>{
 const r=replay(),c=new AbortController();c.abort(reason);let rejected=false,caught
 try{await createDoximityNativeScraper({...r.options,signal:c.signal}).run({signal:undefined,maxJobs:-1})}catch(e){rejected=true;caught=e}
 assert.equal(rejected,true);assert.equal(caught,reason);assert.equal(r.requests.length,0)
})
test('mid-acquisition caller reason is never inspected for foreign evidence getters',async()=>{
 const c=new AbortController(),trap=Error('foreign reason getter must not run'),reason=new Proxy(Object.freeze({opaque:'caller'}),{get(target,key){if(key==='nativeEvidence'||key==='sourceAudit')throw trap;return Reflect.get(target,key)}}),r=replay({transform:p=>{if(p.requestedURL===PRIMARY)c.abort(reason)}});let caught,rejected=false
 try{await createDoximityNativeScraper().run({...r.options,signal:c.signal})}catch(e){caught=e;rejected=true}
 assert.equal(rejected,true);assert.equal(caught,reason);assert.equal(r.requests.length,1);assert.ok(readDoximityFailureEvidence(c.signal))
})
const elapsed=t=>{let value=1000;const descriptor=Object.getOwnPropertyDescriptor(performance,'now');Object.defineProperty(performance,'now',{configurable:true,value:()=>value});t.after(()=>descriptor?Object.defineProperty(performance,'now',descriptor):delete performance.now);return ms=>{value+=ms}}

test('factory observers and records share one elapsed budget including both callbacks',async t=>{
 const advance=elapsed(t),r=replay();let audits=0,records=0;const scraper=createDoximityNativeScraper({...r.options,onAudit:()=>{audits++;advance(10000)},onRecords:v=>{records=v.length;advance(5001)}}),error=await failureOf(scraper.run({onAudit:undefined,onRecords:undefined,now:undefined,fetchPage:undefined}))
 assert.equal(error.code,'DOXIMITY_AUDIT_TIMEOUT');assert.equal(audits,1);assert.equal(records,10);assert.equal(error.nativeEvidence.completeHostedCriteria,10)
})
test('the earlier audit expiry wins when a blocked callback passes both audit and source deadlines',async t=>{
 const advance=elapsed(t),r=replay(),error=await failureOf(createDoximityNativeScraper().run({...r.options,sourceTimeoutMs:100000,auditTimeoutMs:1000,onAudit:()=>advance(100001)}))
 assert.equal(error.code,'DOXIMITY_AUDIT_TIMEOUT');assert.equal(error.status,undefined);assert.equal(error.nativeEvidence.completeHostedCriteria,10)
})
test('returned candidates cannot mutate the separately retained complete audit models',async()=>{
 const r=replay(),jobs=await registered().run(r.options);assert.ok(jobs.length);const id=jobs[0].jobId,original=jobs.nativeCollectionEvidence.observations.find(v=>v.jobId===id).sourceNativeRecord.title
 jobs[0].sourceNativeRecord.title='caller mutation';jobs[0].sourceNativePublishedModel.title='caller mutation'
 assert.equal(jobs.nativeCollectionEvidence.observations.find(v=>v.jobId===id).sourceNativeRecord.title,original);assert.equal(jobs.nativeCollectionEvidence.observations.find(v=>v.jobId===id).sourceNativePublishedModel.title,original)
})
test('unexecuted embed settings cannot declare an active native board handoff',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===EMBED){const source=Buffer.from(p.bodyBase64,'base64').toString(),changed=source.replace(/(Grnhse\.Settings\s*=\s*\{[\s\S]*?\n\};)/,'function unusedNativeSettings(){ $1 }');assert.notEqual(changed,source);mutateBody(p,changed)}}}),error=await failureOf(registered().run(r.options))
 assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert.equal(r.requests.length,2)
})
test('the legacy logical API read budget survives a longer physical-body budget and preserves observed HTTP failure',async()=>{
 const r=replay();let callbacks=0
 const fetchImpl=async(url,init)=>{if(String(url)===API+'/jobs/'+FIRST.id+'?pay_transparency=true'){r.requests.push(String(url));const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('partial API failure'))}}),{status:503,headers:{'content-type':'application/json','retry-after':'7'}});Object.defineProperty(response,'url',{value:String(url)});return response}return r.options.fetchImpl(url,init)}
 const error=await failureOf(createDoximityNativeScraper().run({...r.options,fetchPage:undefined,fetchImpl,rateLimitMs:0,readTimeoutMs:100,nativeReadTimeoutMs:25,onAudit:()=>{callbacks++}}))
 assert.equal(error.status,503);assert.equal(error.acquisitionFailure.code,'GREENHOUSE_READ_TIMEOUT');assert.equal(callbacks,0)
 assert.equal(error.nativeEvidence.rawResponses.find(v=>v.response.status===503).response.bodyComplete,false);assert.equal(r.requests.filter(v=>v===PRIMARY).length,2)
})

test('review R1 rejects literal and unresolved computed writes that replace the declared embed handoff',async()=>{
 const attacks=['Grnhse.Settings["boardURI"]="https://job-boards.greenhouse.io/embed/job_board?for=curative";','Grnhse["Settings"].targetDomain="https://example.com";','Grnhse.Settings[fieldFromPublisher]="unreviewed";','Object.assign(Grnhse.Settings,{boardURI:"https://example.com"});']
 for(const attack of attacks){const r=replay({transform:p=>{if(p.requestedURL===EMBED){const text=Buffer.from(p.bodyBase64,'base64').toString();mutateBody(p,text+'\n'+attack)}}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert.equal(r.requests.length,2)}
})

test('review R2 rejects another executable script replacing or mutating the active native context',async()=>{
 const attacks=['window["__remixContext"]={};','window.__remixContext["state"]={};','window.__remixContext[keyFromPublisher]={};','Object.assign(window.__remixContext,{state:{}});','delete window["__remixContext"];']
 for(const attack of attacks){const r=replay({transform:p=>{if(p.requestedURL===BOARD){const text=Buffer.from(p.bodyBase64,'base64').toString();mutateBody(p,text+'<script>'+attack+'</script>')}}}),error=await failureOf(registered().run(r.options));assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert.equal(r.requests.length,3)}
})

test('review R3 preserves the earlier logical API deadline when one synchronous read crosses both budgets',async t=>{
 const advance=elapsed(t),r=replay({transform:p=>{if(p.requestedURL===API+'/jobs/'+FIRST.id+'?pay_transparency=true')advance(101)}}),error=await failureOf(createDoximityNativeScraper().run({...r.options,nativeReadTimeoutMs:25,readTimeoutMs:100,sourceTimeoutMs:100000}))
 assert.equal(error.code,'GREENHOUSE_READ_TIMEOUT');assert.equal(error.nativeEvidence.completeHostedCriteria,0);assert.equal(r.requests.length,8)
})
