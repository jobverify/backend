import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {decodeHTML,encodeHTML} from 'entities'
import {run} from '../scraper/precisely.workday/script.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const quality=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/precisely-native-quality.json.gz',import.meta.url))))
const packets=quality.packets,all=[...packets,...quality.legacyPackets],now='2026-11-05T23:59:00.000Z',sha=v=>createHash('sha256').update(v).digest('hex')
const replay=async(t,mutate=()=>{},options={})=>{
 const {registered=false,...settings}=options,calls=[],audits=[],counts=new Map(),fetchImpl=async(url,init)=>{calls.push({url,init});const q=structuredClone(all.find(q=>q.requestedURL===url));assert.ok(q,'Only a retained declared public URL may be read: '+url);const n=(counts.get(url)||0)+1;counts.set(url,n);mutate(q,n);const response=new Response(q.bodyText,{status:q.status,headers:q.headers||{'content-type':q.contentType}});Object.defineProperty(response,'url',{value:q.finalURL});return response}
 t.mock.method(globalThis,'fetch',fetchImpl);let jobs,error;try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='precisely')).run:run)({now:()=>now,minIntervalMs:0,requestIntervalMs:0,fetchImpl,onAudit:v=>audits.push(v),...settings})}catch(e){error=e}return {jobs,error,calls,audits}
}
const change=(q,from,to)=>{const before=q.bodyText;q.bodyText=q.bodyText.replace(from,to);assert.ok(q.bodyText!==before,'Mutation must alter the actual retained body')}
const mutateFeed=(q,fn)=>{if(q.requestedURL===packets[3].requestedURL){const feed=JSON.parse(q.bodyText);fn(feed);q.bodyText=JSON.stringify(feed)}}

test('Precisely follows its own international board and recovers nine complete native India records through the registered route',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{registered:true});assert.ifError(error);assert.equal(jobs.length,9);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.nativeRoleClosingReconciled));assert.ok(calls.every(c=>!c.url.includes('us-jobs')&&!c.url.includes('preciselyusjobs')));assert.equal(calls.length,8)
})

test('Precisely bare-text transports cannot replace original HTTP metadata',async()=>{
 let reads=0;await assert.rejects(run({fetchText:async()=>{reads++;return packets[0].bodyText}}),/HTTP response metadata/);assert.equal(reads,0)
})

test('Precisely current and labelled historical original HTTP bodies retain their exact hashes',()=>{
 assert.equal(packets.length,4);assert.equal(quality.legacyPackets.length,3);for(const q of all){assert.equal(q.replayed,false);assert.equal(sha(q.bodyText),q.bodySHA256);assert.equal(Buffer.byteLength(q.bodyText),q.bodyBytes)}
})
test('Precisely all 26 full records, six country conflicts and one prospect remain inspectable',async t=>{
 const {jobs,error,audits}=await replay(t);assert.ifError(error);const a=audits[0];assert.equal(a.nativeRecords,26);assert.equal(a.nativeRoleClosingReconciled,9);assert.equal(a.heldNativeRows.length,6);assert.equal(a.excludedNativeRows.length,11);assert.equal(a.excludedNativeRows.filter(r=>r.reason==='native-prospect-post').length,1);assert.equal(a.opening.feed.jobs.length,26);assert.ok(a.heldNativeRows.some(r=>r.record.id===4745248005&&r.record.content.includes('INSERT JOB DESCRIPTION')));assert.ok(a.heldNativeRows.some(r=>r.record.id===4748374005));assert.equal(jobs.length,9)
})
test('Precisely whole native records and both original response sets survive extraction',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(jobs[0].sourceNativeRetainedResponses.length,8);for(const q of jobs[0].sourceNativeRetainedResponses)assert.equal(sha(q.rawText),q.bodySHA256);for(const j of jobs){assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord);assert.equal(j.nativeSourceRecord.job.id,Number(j.jobId));assert.equal(j.sourceDescription,j.jobDescription);assert.ok(j.sourceDescription.includes('Application and Interview Impersonation Notice'));assert.ok(j.sourceDescription.includes('Precisely uses Greenhouse'))}
})
test('Precisely the separately published AI recruitment disclosure is retained in full criteria',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.ok(jobs.every(j=>j.nativeAIRecruitmentDisclosureIncluded&&j.sourceDescription.includes('AI-powered Talent Matching feature')&&j.nativeAIRecruitmentDisclosureHTML===j.nativeSourceRecord.job.ai_disclaimer))
})
test('Precisely native posting, internal job and formal requisition identifiers remain distinct',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs.find(j=>j.jobId==='4737662005');assert.equal(j.nativeInternalJobID,'4456284005');assert.equal(j.requisitionId,'2258');assert.ok(jobs.every(j=>j.nativeCanonicalRoleURL===null&&j.numberOfOpenings===null&&j.legalEmployer===null));assert.equal(j.nativeHiringOrganization.name,'Precisely International Jobs')
})
test('Precisely country-only India does not become a city, campus or remote employment claim',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.ok(jobs.every(j=>j.country==='India'&&j.location==='India'&&j.city===null&&j.state===null&&j.remoteStatus===null&&j.employmentType===null&&!j.sourceWorksiteCountryProof.cityIsCountryProof))
})
test('Precisely native first_published is separate from later updates and first-ever publication',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs.find(j=>j.jobId==='4725647005');assert.equal(j.postingDate,'2026-08-25T18:37:05.000Z');assert.equal(j.nativeUpdatedAt,'2026-10-01T09:41:30-04:00');assert.notEqual(j.postingDate,new Date(j.nativeUpdatedAt).toISOString());assert.equal(j.firstEverPublication,null);assert.equal(j.closingDate,null);assert.equal(j.sourceDatePrecision,'second')
})
test('Precisely an office or title cannot supply a missing own country label',async t=>{
 const {jobs,error,audits}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005).location.name='Bangalore'}));assert.ifError(error);assert.equal(jobs.length,8);assert.ok(!jobs.some(j=>j.jobId==='4737662005'));assert.ok(audits[0].heldNativeRows.some(r=>r.reason==='native-country-unproven'))
})
test('Precisely a contradictory own office country withholds the role',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005).offices[0].name='Canada'}));assert.ifError(error);assert.equal(jobs.length,8);assert.ok(!jobs.some(j=>j.jobId==='4737662005'))
})
test('Precisely complete own location India remains evidence without an office association',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005).offices=[]}));assert.ifError(error);assert.equal(jobs.length,9);assert.equal(jobs.find(j=>j.jobId==='4737662005').country,'India')
})
test('Precisely introduction and legal boilerplate cannot replace full native role criteria',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005).content='&lt;div class="content-intro"&gt;'+('Precisely company introduction. '.repeat(40))+'&lt;/div&gt;&lt;p&gt;INSERT JOB DESCRIPTION&lt;/p&gt;'}));assert.ifError(error);assert.equal(jobs.length,8);assert.ok(!jobs.some(j=>j.jobId==='4737662005'))
})
test('Precisely hidden and delegated eligibility in either criteria field requires review',async t=>{
 for(const [field,extra]of [['content','&lt;p hidden&gt;Additional certification is mandatory.&lt;/p&gt;'],['ai_disclaimer','<span hidden>Mandatory certification.</span>'],['content','&lt;iframe src="https://unreviewed.example/criteria"&gt;&lt;/iframe&gt;'],['content','&lt;textarea readonly&gt;Extra eligibility&lt;/textarea&gt;']]){const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005)[field]+=extra}));assert.ifError(error);assert.equal(jobs.length,8)}
})
test('Precisely stylesheet-hidden mandatory content cannot disappear silently',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005).content+='&lt;p style="display:none"&gt;Mandatory extra licence.&lt;/p&gt;'}));assert.ifError(error);assert.equal(jobs.length,8)
})
test('Precisely a foreign based-in title cannot inherit India from native fields',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005).title+=' (based in Toronto, Canada)'}));assert.ifError(error);assert.equal(jobs.length,8)
})
test('Precisely foreign workplace clauses cannot hide inside complete own criteria',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005).content+='&lt;p&gt;This role will be based in Toronto, Canada.&lt;/p&gt;'}));assert.ifError(error);assert.equal(jobs.length,8)
})
test('Precisely unreviewed metadata and new native fields are quarantined',async t=>{
 for(const edit of [r=>{r.metadata=[{name:'Mandatory qualification',value:'Additional licence'}]},r=>{r.workplaceCountry='Canada'}]){const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>edit(f.jobs.find(r=>r.id===4737662005))));assert.ifError(error);assert.equal(jobs.length,8)}
})
test('Precisely a changed native publishing employer cannot be replaced with the configured name',async t=>{
 const {jobs,error,calls}=await replay(t,q=>mutateFeed(q,f=>{f.jobs[7].company_name='Another company'}));assert.ok(!jobs);assert.match(error.message,/employer/);assert.equal(calls.length,4)
})
test('Precisely duplicate native IDs and incomplete inventory totals cannot qualify',async t=>{
 for(const edit of [f=>{f.jobs.push(f.jobs[7]);f.meta.total++},f=>{f.meta.total++}]){const {jobs,error,calls}=await replay(t,q=>mutateFeed(q,edit));assert.ok(!jobs);assert.match(error.message,/identity|count|shape/);assert.equal(calls.length,4)}
})
test('Precisely declared canonical redirects cannot cross authority or select the US account',async t=>{
 for(const edit of [q=>{if(q.requestedURL===packets[1].requestedURL)q.headers.location='https://another.example/careers'},q=>{if(q.requestedURL===packets[2].requestedURL)change(q,/for=preciselyinternationaljobs/g,'for=preciselyusjobs')}]){const {jobs,error,calls}=await replay(t,edit);assert.ok(!jobs);assert.ok(error);assert.ok(calls.length<=3)}
})
test('Precisely changed closing whole records are withheld while unchanged roles reconcile',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(n===2)mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005).content+='&lt;p&gt;A newly mandatory registration.&lt;/p&gt;'})});assert.ifError(error);assert.equal(jobs.length,8);assert.ok(jobs.every(j=>j.sourceDetailComplete));assert.ok(audits[0].heldNativeRows.some(r=>r.reason==='closing whole native job record changed'))
})
test('Precisely closing inventory identity changes withhold all stale observations',async t=>{
 const {jobs,error}=await replay(t,(q,n)=>{if(n===2)mutateFeed(q,f=>{f.jobs.pop();f.meta.total--})});assert.ok(!jobs);assert.match(error.message,/identities changed/)
})
test('Precisely reordered complete native feeds preserve each own model by ID',async t=>{
 const {jobs,error}=await replay(t,(q,n)=>{if(n===2)mutateFeed(q,f=>f.jobs.reverse())});assert.ifError(error);assert.equal(jobs.length,9);assert.ok(jobs.every(j=>j.nativeRoleClosingReconciled))
})
test('Precisely passed application deadlines and future publications withhold current-vacancy claims',async t=>{
 for(const edit of [r=>{r.application_deadline='2026-11-01T00:00:00Z'},r=>{r.first_published='2026-11-07T00:00:00Z'}]){const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>edit(f.jobs.find(r=>r.id===4737662005))));assert.ifError(error);assert.equal(jobs.length,8)}
})
test('Precisely country-only labels and native education settings do not invent qualifications',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.ok(jobs.every(j=>j.nativeEducationApplicationSetting==='education_optional'&&j.experienceRequired===null&&j.legalEmployer===null&&j.numberOfOpenings===null))
})
test('Precisely application links, AI opt-out URLs and publisher programs are never visited or executed',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.ok(calls.every(c=>packets.some(q=>q.requestedURL===c.url)));assert.ok(jobs.every(j=>!j.applicationVisited&&!j.applicationFormSubmitted&&!j.activeApplyVerified&&j.nativeApplicationsOpen===null));assert.ok(jobs[0].sourceNativeCollectionAudit.opening.international.publisherProgramsExecuted===false)
})
test('Precisely full company scope, unresolved records and lifecycle cleanup remain unqualified',async t=>{
 const {jobs,error,audits}=await replay(t);assert.ifError(error);assert.ok(jobs.every(j=>!j.sourceScopeComplete&&!j.sourceListingComplete&&!j.lifecycleCleanupAllowed));assert.ok(audits[0].unresolved.includes('native-role-country-or-content-unresolved'));assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const status of [202,403,429])test('Precisely the first HTTP '+status+' stops the source without retries',async t=>{const {jobs,error,calls}=await replay(t,q=>{q.status=status});assert.ok(!jobs);assert.equal(error.status,status);assert.equal(calls.length,1)})
test('Precisely a failed closing read cannot restore partial records as complete',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===packets[0].requestedURL&&n===2)q.status=403});assert.ok(!jobs);assert.equal(error.status,403);assert.equal(calls.length,5);assert.equal(audits[0].nativeRoleClosingReconciled,0)
})
test('Precisely reads remain anonymous GETs with exact original HTTP metadata',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.credentials==='omit'&&c.init.redirect==='manual'&&!c.init.body));assert.ok(jobs[0].sourceNativeCollectionAudit.responses.every(q=>q.httpMetadataVerified&&q.bodySHA256))
})
test('Precisely caller zero caps, unsupported controls and pre-abort cause no reads',async t=>{
 const zero=await replay(t,()=>{},{maxJobs:0});assert.ifError(zero.error);assert.equal(zero.jobs.length,0);assert.equal(zero.calls.length,0);for(const options of [{maxJobs:-1},{maxPages:1},{fetchJson:async()=>({})}]){const r=await replay(t,()=>{},options);assert.ok(r.error);assert.equal(r.calls.length,0)}const reason=Error('Cancel Precisely before reads'),r=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('Precisely positive caps reconcile all native records before slicing output',async t=>{
 const {jobs,error,calls,audits}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,8);assert.equal(audits[0].nativeRoleClosingReconciled,9)
})
test('Precisely oversized responses and observed HTTP URL drift stop immediately',async t=>{
 for(const edit of [q=>{q.headers['content-length']='5000000'},q=>{q.finalURL+='?unreviewed=1'}]){const {jobs,error,calls}=await replay(t,edit);assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,1)}
})
test('Precisely exact cancellation interrupts an uncooperative HTTP transport',async t=>{
 const c=new AbortController(),reason=Error('Cancel Precisely pending HTTP'),timer=setTimeout(()=>c.abort(reason),15);try{const {error}=await replay(t,()=>{},{signal:c.signal,fetchImpl:()=>new Promise(()=>{})});assert.equal(error,reason)}finally{clearTimeout(timer)}
})
test('Precisely exact cancellation interrupts an uncooperative audit callback',async t=>{
 const c=new AbortController(),reason=Error('Cancel Precisely audit'),r=await replay(t,()=>{},{signal:c.signal,maxJobs:0,onAudit:async()=>{setTimeout(()=>c.abort(reason),10);await new Promise(()=>{})}});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})

for(const [name,field,markup]of [
 ['div workplace criteria','content','<div>This role will be based in Toronto, Canada.</div>'],
 ['enabled AI workplace criteria','ai_disclaimer','<p>This role will be based in Toronto, Canada.</p>'],
 ['semantic itemprop geography','content','<span itemprop="addressCountry">Canada</span>'],
])test('Precisely review: '+name+' cannot preserve an India-complete role',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{f.jobs.find(r=>r.id===4737662005)[field]+=field==='content'?encodeHTML(markup):markup}),{registered:true});assert.ifError(error);assert.equal(jobs.length,8);assert.ok(!jobs.some(j=>j.jobId==='4737662005'))
})
for(const [name,edit]of [
 ['office country suffix',r=>{r.offices[0].name='Toronto, Canada'}],
 ['additional office country field',r=>{r.offices[0].country='Canada'}],
])test('Precisely review: '+name+' cannot preserve an India-complete role',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>edit(f.jobs.find(r=>r.id===4737662005))),{registered:true});assert.ifError(error);assert.equal(jobs.length,8);assert.ok(!jobs.some(j=>j.jobId==='4737662005'))
})
test('Precisely review: wrapping original company boilerplate cannot replace omitted role criteria',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{const r=f.jobs.find(r=>r.id===4737662005),html=decodeHTML(r.content),parts=[...html.matchAll(/<div class="content-(?:intro|conclusion)">[\s\S]*?<\/div>/g)].map(m=>m[0]);assert.equal(parts.length,2);const replaced=encodeHTML('<div>'+parts.join('')+'</div>');assert.notEqual(replaced,r.content);r.content=replaced}),{registered:true});assert.ifError(error);assert.equal(jobs.length,8);assert.ok(!jobs.some(j=>j.jobId==='4737662005'))
})
test('Precisely review: extra class tokens cannot turn original boilerplate into role criteria',async t=>{
 const {jobs,error}=await replay(t,q=>mutateFeed(q,f=>{const r=f.jobs.find(r=>r.id===4737662005),parts=[...decodeHTML(r.content).matchAll(/<div class="content-(?:intro|conclusion)">[\s\S]*?<\/div>/g)].map(m=>m[0]);assert.equal(parts.length,2);const replaced=encodeHTML(parts.join('').replace('class="content-intro"','class="content-intro candidate-extra"'));assert.notEqual(replaced,r.content);r.content=replaced}),{registered:true});assert.ifError(error);assert.equal(jobs.length,8);assert.ok(!jobs.some(j=>j.jobId==='4737662005'))
})
test('Precisely review: zero-result failures retain all successful original public response bodies',async t=>{
 const {jobs,error,audits,calls}=await replay(t,(q,n)=>{if(q.requestedURL===packets[0].requestedURL&&n===2)q.status=403},{registered:true});assert.ok(!jobs);assert.equal(error.status,403);assert.equal(calls.length,5);const retained=audits[0].retainedResponses;assert.ok(Array.isArray(retained));assert.equal(retained.length,5);for(let i=0;i<4;i++){assert.equal(retained[i].rawText,packets[i].bodyText);assert.equal(sha(retained[i].rawText),retained[i].bodySHA256)}assert.deepEqual(error.recruitmentObservations.retainedResponses,retained)
})
