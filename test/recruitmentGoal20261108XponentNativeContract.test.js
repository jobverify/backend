import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {extractSearchResults} from '../scraper/xponentai/script.js'
import {fixture,replay,mutateBody} from './test-data/xponentai20261108.js'
import {createXponentNativeScraper,readXponentFailureEvidence} from '../scraper/xponentai/native20261108.js'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
test('registered xponent.ai route recovers all ten complete own-page descriptions and full native models',async()=>{
 const r=replay();let jobs,error,audit,records
 try{jobs=await createCatalogScraper(getScraperCatalog().find(v=>v.source==='xponentai')).run({...r.options,onAudit:v=>{audit=v},onRecords:v=>{records=v}})}catch(e){error=e}
 assert.deepEqual(r.uncaptured,[]);assert.equal(error?.message,undefined)
 assert.equal(jobs.filter(v=>v.sourceDescription?.length>500).length,10,'empty API content must not discard the complete own-page descriptions')
 assert.deepEqual(records.map(v=>v.sourceNativeRecord),fixture.expected.nativeModels)
 assert.equal(audit.observations.length,10);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(r.requests.length,46)
 for(const job of jobs){const expected=fixture.expected.roles.find(v=>v.id===job.jobId);assert.equal(job.sourceDescription,expected.description);assert.equal(job.sourceNativeDescriptionHTML,expected.descriptionHTML);assert.equal(job.country,null);assert.equal(job.workplaceType,null);assert.equal(job.remoteStatus,null);assert.equal(job.requisitionId,null);assert.equal(job.activeApplyVerified,false)}
})
const FIRST=fixture.expected.nativeModels[0],ROLE=FIRST.link,FEED='https://xponent.ai/wp-json/wp/v2/awsm_job_openings',PRIMARY='https://xponent.ai/career/'
const failureOf=async task=>{try{await task;assert.fail('Expected held native source to reject')}catch(e){if(e?.code==='ERR_ASSERTION')throw e;return e}}
const withSchema=alter=>replay({transform:p=>{if(p.requestedURL!==ROLE)return;let text=Buffer.from(p.bodyBase64,'base64').toString();const scripts=readNativeDocument(text).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json');assert.equal(scripts.length,1);const schema=JSON.parse(scripts[0].raw);alter(schema);text=text.replace(scripts[0].raw,JSON.stringify(schema));mutateBody(p,text)}})
test('missing page totals retain all ten decoded native listing models before holding the attempt',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===FEED)delete p.headers['x-wp-total']}}),error=await failureOf(createXponentNativeScraper().run(r.options))
 assert.equal(error.code,'XPONENT_NATIVE_PROOF');assert.equal(r.requests.length,3);assert.equal(error.nativeEvidence.observations.length,10)
 assert.deepEqual(error.nativeEvidence.observations.map(v=>v.listingRecord),fixture.expected.nativeModels)
})
test('maxJobs zero retains the full native audit, criteria and detached callbacks',async()=>{
 const r=replay();let audit,records
 const jobs=await createXponentNativeScraper(r.options).run({maxJobs:0,onAudit:v=>{audit=v;v.observations[0].nativeRecord.title.rendered='observer mutation'},onRecords:v=>{records=v;v[0].sourceNativeRecord.title.rendered='observer mutation'}})
 assert.equal(jobs.length,0);assert.equal(audit.observations.length,10);assert.equal(records.length,10);assert.equal(r.requests.length,46)
 assert.equal(jobs.nativeCollectionEvidence.observations[0].nativeRecord.title.rendered,FIRST.title.rendered)
 assert.equal(readSourceObservationEvidence(jobs,'xponentai').observedRecordCount,10)
})
test('a denial at the first own role stops acquisition with every completed original retained',async()=>{
 let callbacks=0;const r=replay({transform:p=>{if(p.requestedURL===ROLE){p.status=403;mutateBody(p,'<html>Access denied</html>')}}}),error=await failureOf(createXponentNativeScraper().run({...r.options,onAudit:()=>{callbacks++},onRecords:()=>{callbacks++}}))
 assert.equal(error.status,403);assert.equal(r.requests.length,5);assert.equal(callbacks,0);assert.equal(error.nativeEvidence.observations.length,10)
 assert.equal(error.nativeEvidence.ownNativeModels,1);assert.equal(error.nativeEvidence.completeDescriptions,0)
 assert.equal(error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true)
})
test('budget exhaustion preserves a completed full role plus the other native listing models',async()=>{
 const r=replay(),error=await failureOf(createXponentNativeScraper().run({...r.options,maxRequests:5}))
 assert.equal(error.code,'XPONENT_REQUEST_BUDGET');assert.equal(error.status,undefined);assert.equal(r.requests.length,5)
 assert.equal(error.nativeEvidence.observations.length,10);assert.equal(error.nativeEvidence.completeDescriptions,1)
 assert.equal(error.nativeEvidence.observations[0].openingRow.sourceDescription,fixture.expected.roles[0].description)
})
test('native unknown fields remain available in complete own models',async()=>{
 const added={native_unmapped_criteria:{full:'publisher criteria must survive',countries:['unqualified new field']}}
 const r=replay({transform:p=>{if(!p.requestedURL.startsWith(FEED))return;const value=JSON.parse(Buffer.from(p.bodyBase64,'base64'));if(Array.isArray(value))Object.assign(value[0],added);else if(value.id===FIRST.id)Object.assign(value,added);mutateBody(p,JSON.stringify(value))}})
 let records;await createXponentNativeScraper().run({...r.options,onRecords:v=>{records=v}})
 assert.deepEqual(records[0].sourceNativeRecord.native_unmapped_criteria,added.native_unmapped_criteria)
 assert.deepEqual(records[0].sourceNativeClosingRecord.native_unmapped_criteria,added.native_unmapped_criteria)
})
test('a typed own-role India address is honored without borrowing form or corporation countries',async()=>{
 const r=withSchema(v=>{v.jobLocation={address:{addressCountry:'IN'}}});let records
 const jobs=await createXponentNativeScraper().run({...r.options,onRecords:v=>{records=v}}),row=records[0]
 assert.equal(row.country,'India');assert.equal(row.sourceCurrentNativeRoleQualified,true);assert.equal(jobs[0].country,'India')
 assert.equal(row.sourceNativeCountryEvidence.applicationFormCountryUsed,false);assert.equal(row.sourceNativeCountryEvidence.companyAddressUsed,false)
 assert.equal(row.sourceNativeActiveHiringVerified,false)
})
test('conflicting typed role countries remain unresolved and retained',async()=>{
 const r=withSchema(v=>{v.jobLocation=[{address:{addressCountry:'IN'}},{address:{addressCountry:'US'}}]});let records
 await createXponentNativeScraper().run({...r.options,onRecords:v=>{records=v}})
 assert.equal(records[0].country,null);assert.equal(records[0].sourceNativeCountryConflict,true);assert.equal(records[0].sourceCurrentNativeRoleQualified,false)
 assert.equal(records[0].sourceDescription,fixture.expected.roles[0].description)
})
test('expired own publication evidence remains in the full audit without admission',async()=>{
 const r=withSchema(v=>{v.validThrough='2000-01-01T00:00:00Z';v.jobLocation={address:{addressCountry:'India'}}});let records
 const jobs=await createXponentNativeScraper().run({...r.options,onRecords:v=>{records=v}})
 assert.equal(jobs.length,9);assert.equal(records.length,10);assert.equal(records[0].sourceNativeTemporalQualified,false)
 assert.ok(records[0].sourceNativeIssues.includes('own-schema-expiry-invalid-or-past'))
 assert.equal(records[0].sourceNativeSchema.validThrough,'2000-01-01T00:00:00Z')
})
test('wrong native publisher and wrong canonical cannot supply a role',async()=>{
 const r=withSchema(v=>{v.hiringOrganization.name='Other Company'}),error=await failureOf(createXponentNativeScraper().run(r.options))
 assert.equal(error.code,'XPONENT_NATIVE_PROOF');assert.equal(r.requests.length,5)
 const changed=replay({transform:p=>{if(p.requestedURL===ROLE)mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString().replace('href="'+ROLE+'"','href="https://xponent.ai/jobs/other/"'))}})
 assert.equal((await failureOf(createXponentNativeScraper().run(changed.options))).code,'XPONENT_NATIVE_PROOF');assert.equal(changed.requests.length,5)
})
test('missing complete own criteria cannot turn API empty content into a successful empty source',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===ROLE)mutateBody(p,Buffer.from(p.bodyBase64,'base64').toString().replace('content-section job-extennn','content-section missing-criteria'))}}),error=await failureOf(createXponentNativeScraper().run(r.options))
 assert.equal(error.code,'XPONENT_NATIVE_PROOF');assert.equal(error.nativeEvidence.observations.length,10);assert.equal(error.nativeEvidence.rawResponses.length,5)
})
test('an empty native published-post feed never proves an India or company zero',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===FEED){mutateBody(p,'[]');p.headers['x-wp-total']='0';p.headers['x-wp-totalpages']='0'}}})
 const jobs=await createXponentNativeScraper().run(r.options);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
})
test('missing pagination handoffs do not silently truncate a declared multi-page feed',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===FEED){p.headers['x-wp-total']='11';p.headers['x-wp-totalpages']='2'}}}),error=await failureOf(createXponentNativeScraper().run(r.options))
 assert.equal(error.code,'XPONENT_NATIVE_PROOF');assert.equal(r.requests.length,3);assert.equal(error.nativeEvidence.observations.length,10)
})
for(const status of [403,429,503])test('HTTP '+status+' survives a stalled response body with its primary diagnostics',async()=>{
 let reads=0;const fetchImpl=async url=>{reads++;const response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('partial denial'))}}),{status,headers:{'content-type':'text/html','retry-after':'7'}});Object.defineProperty(response,'url',{value:String(url)});return response}
 const error=await failureOf(createXponentNativeScraper().run({fetchImpl,readTimeoutMs:20,rateLimitMs:0}));assert.equal(error.status,status);assert.equal(error.acquisitionFailure.code,'XPONENT_READ_TIMEOUT');assert.equal(reads,1)
 if(status===429)assert.equal(error.retryDelayMs,7000)
 assert.equal(error.nativeEvidence.rawResponses[0].response.status,status);assert.equal(error.nativeEvidence.rawResponses[0].response.bodyComplete,false)
})
for(const reason of [false,0,'',Object.freeze({cancel:'opaque caller'})])test('factory caller pre-abort retains the exact reason '+String(reason),async()=>{
 const r=replay(),c=new AbortController();c.abort(reason);let caught,rejected=false
 try{await createXponentNativeScraper({...r.options,signal:c.signal}).run({signal:undefined,maxJobs:-1})}catch(e){caught=e;rejected=true}
 assert.equal(rejected,true);assert.equal(caught,reason);assert.equal(r.requests.length,0)
})
const clock=t=>{let value=1000;const prior=Object.getOwnPropertyDescriptor(performance,'now');Object.defineProperty(performance,'now',{configurable:true,value:()=>value});t.after(()=>prior?Object.defineProperty(performance,'now',prior):delete performance.now);return ms=>{value+=ms}}
test('elapsed audit deadline prevents admission of a later records observer',async t=>{
 const advance=clock(t),r=replay();let records=0;const error=await failureOf(createXponentNativeScraper().run({...r.options,onAudit:()=>advance(15001),onRecords:()=>{records++}}))
 assert.equal(error.code,'XPONENT_AUDIT_TIMEOUT');assert.equal(error.status,undefined);assert.equal(records,0);assert.equal(error.nativeEvidence.completeDescriptions,10)
})
test('undefined factory callbacks retain one shared budget and every full model',async t=>{
 const advance=clock(t),r=replay();let audits=0,records=0
 const scraper=createXponentNativeScraper({...r.options,onAudit:()=>{audits++;advance(10000)},onRecords:v=>{records=v.length;advance(5001)}}),error=await failureOf(scraper.run({onAudit:undefined,onRecords:undefined,fetchImpl:undefined,now:undefined}))
 assert.equal(error.code,'XPONENT_AUDIT_TIMEOUT');assert.equal(audits,1);assert.equal(records,10)
})
test('caller cancellation after complete native audit retains detached evidence',async()=>{
 const r=replay(),c=new AbortController(),reason=Object.freeze({cancel:'after audit'});let caught,records=0
 try{await createXponentNativeScraper().run({...r.options,signal:c.signal,onAudit:()=>c.abort(reason),onRecords:()=>{records++}})}catch(e){caught=e}
 assert.equal(caught,reason);assert.equal(records,0);const evidence=readXponentFailureEvidence(c.signal);assert.equal(evidence.completeDescriptions,10);evidence.observations.length=0
 assert.equal(readXponentFailureEvidence(c.signal).observations.length,10)
})
test('effective catalog has no stale zero or sentinel and keeps the source dry-run path',()=>{
 const p=getScraperCatalog().find(v=>v.source==='xponentai');assert.equal(p.atsPlatform,'wp-job-openings-native-own-html');assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.backfillMode,null)
 assert.match(p.dryRunFile.replaceAll('\\','/'),/\/scraper\/xponentai\/jobs\.json$/);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false)
})
test('legacy listing normalization keeps city evidence without inventing India or an onsite workplace',()=>{
 const source=structuredClone(fixture.expected.nativeModels[0]);source.class_list.push('job-location-bangalore')
 const [job]=extractSearchResults([source]);assert.equal(job.country,null);assert.equal(job.remoteStatus,null);assert.equal(job.requisitionId,null)
})

// Single post-review fix pass. These conflicts are synthetic test mutations.
for(const surface of ['primary-bootstrap','index','collection','own-json','own-bootstrap','schema'])test('duplicate decoded JSON keys are rejected in '+surface,async()=>{
 const r=replay({transform:p=>{
  let text=Buffer.from(p.bodyBase64,'base64').toString(),changed=false
  if(surface==='primary-bootstrap'&&p.requestedURL===PRIMARY||surface==='own-bootstrap'&&p.requestedURL===ROLE){
   const node=readNativeDocument(text).nodes(n=>n.tag==='script'&&n.attrs.id==='awsm-job-scripts-js-extra')[0],raw=node.raw.replace(/"job_id"\s*:\s*"(\d+)"/,'"job_id":"wrong","job_\\u0069d":"$1"');assert.notEqual(raw,node.raw);text=text.replace(node.raw,raw);changed=true
  }
  if(surface==='index'&&p.requestedURL==='https://xponent.ai/wp-json/'){text=text.replace(/"home"\s*:/,'"home":"https://other.invalid","h\\u006fme":');changed=true}
  if(surface==='collection'&&p.requestedURL===FEED||surface==='own-json'&&p.requestedURL===FEED+'/'+FIRST.id){text=text.replace(/"status"\s*:\s*"publish"/,'"status":"draft","st\\u0061tus":"publish"');changed=true}
  if(surface==='schema'&&p.requestedURL===ROLE){const script=readNativeDocument(text).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0],raw=script.raw.trim().replace(/}$/,',"jobLocation":{"address":{"addressCountry":"US"}},"jobLoc\\u0061tion":{"address":{"addressCountry":"IN"}}}');text=text.replace(script.raw,raw);changed=true}
  if(changed)mutateBody(p,text)
 }})
 const error=await failureOf(createXponentNativeScraper().run(r.options));assert.equal(error.code,'XPONENT_NATIVE_PROOF');assert.ok(error.nativeEvidence.rawResponses.length>0)
 assert.equal(error.nativeEvidence.rawResponses.at(-1).response.bodyComplete,true)
 assert.match(Buffer.from(error.nativeEvidence.rawResponses.at(-1).response.rawBodyBase64,'base64').toString(),/\\u006[19f]/)
})

for(const field of ['url','@id','mainEntityOfPage'])test('explicit own schema '+field+' must identify the same role',async()=>{
 const r=withSchema(v=>{v.jobLocation={address:{addressCountry:'IN'}};v[field]=field==='mainEntityOfPage'?{'@id':'https://xponent.ai/jobs/other-role/'}:'https://xponent.ai/jobs/other-role/'})
 const error=await failureOf(createXponentNativeScraper().run(r.options));assert.equal(error.code,'XPONENT_NATIVE_PROOF');assert.equal(r.requests.length,5)
 assert.equal(error.nativeEvidence.ownNativeModels,1)
})

test('closing own publication uses the closing clock when expiry is crossed during acquisition',async()=>{
 let now='2026-11-07T20:00:00.000Z',ownReads=0,records
 const r=withSchema(v=>{v.validThrough='2026-11-07T20:00:01.000Z';v.jobLocation={address:{addressCountry:'IN'}}}),fetchImpl=async(url,init)=>{if(String(url)===ROLE&&++ownReads===2)now='2026-11-07T20:00:02.000Z';return r.options.fetchImpl(url,init)}
 const jobs=await createXponentNativeScraper().run({...r.options,fetchImpl,now:()=>now,onRecords:v=>{records=v}})
 assert.equal(records[0].sourceNativePublication.qualified,true);assert.equal(records[0].sourceNativeTemporalQualified,false);assert.equal(records[0].sourceCurrentNativeRoleQualified,false)
 assert.equal(jobs.some(v=>v.jobId===String(FIRST.id)),false);assert.ok(records[0].sourceNativeIssues.includes('own-schema-expiry-invalid-or-past'))
})

for(const observer of ['onAudit','onRecords'])test('final admission rechecks publication after '+observer+' crosses expiry',async()=>{
 let now='2026-11-07T20:00:00.000Z',records
 const r=withSchema(v=>{v.validThrough='2026-11-07T20:00:01.000Z';v.jobLocation={address:{addressCountry:'IN'}}})
 const jobs=await createXponentNativeScraper().run({...r.options,now:()=>now,onAudit:()=>{if(observer==='onAudit')now='2026-11-07T20:00:02.000Z'},onRecords:v=>{records=v;if(observer==='onRecords')now='2026-11-07T20:00:02.000Z'}})
 assert.equal(jobs.some(v=>v.jobId===String(FIRST.id)),false)
 if(observer==='onAudit'){assert.equal(records[0].sourceNativeTemporalQualified,false);assert.equal(records[0].sourceCurrentNativeRoleQualified,false)}
})

test('a later invalid listing retains the preceding nine validated full models',async()=>{
 const r=replay({transform:p=>{if(p.requestedURL===FEED){const rows=JSON.parse(Buffer.from(p.bodyBase64,'base64'));rows[9].status='draft';mutateBody(p,JSON.stringify(rows))}}})
 const error=await failureOf(createXponentNativeScraper().run(r.options));assert.equal(error.code,'XPONENT_NATIVE_PROOF');assert.equal(r.requests.length,3)
 assert.deepEqual(error.nativeEvidence.observations.map(v=>v.listingRecord),fixture.expected.nativeModels.slice(0,9));assert.equal(error.nativeEvidence.rawResponses.length,3)
})

test('legacy normalization honors explicit native onsite labels without creating a default',()=>{
 for(const label of ['job-mode-onsite','job-mode-on-site','work-mode-onsite','work-module-on-site']){const model=structuredClone(FIRST);model.class_list.push(label);const [row]=extractSearchResults([model]);assert.equal(row.remoteStatus,'On-site');assert.equal(row.country,null)}
})