import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {createWaymoScraper} from '../scraper/waymo/script.js'
import {accessibleNativePackets as packets} from '../scraper/waymo/test-data/accessibleNativePackets.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const SEARCH='https://careers.withwaymo.com/jobs/search?country_codes%5B%5D=IN',HOME='https://waymo.com/'
const FIRST='https://careers.withwaymo.com/jobs/program-manager-mapping-operations-hyderabad-telangana-india-2d84541a-eb99-4b04-b4df-c24c0813ad14'
const SECOND='https://careers.withwaymo.com/jobs/program-manager-vendor-service-delivery-lead-hyderabad-telangana-india'
const source=createCatalogScraper(getScraperCatalog().find(p=>p.source==='waymo')),now=()=> '2026-10-31T07:30:00.000Z'
const sha=value=>createHash('sha256').update(value).digest('hex')
function io(edit){const calls=[];return{calls,now,fetchText:async(url,init)=>{calls.push(url);const saved=packets.find(p=>p.url===url);assert.ok(saved,'Exact retained endpoint only: '+url);const p=structuredClone(saved);return edit?edit(p,url,init,calls):p.body}}}
async function settled(promise){let timer;try{return await Promise.race([promise.then(value=>({kind:'fulfilled',value}),reason=>({kind:'rejected',reason})),new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'pending'}),250)})])}finally{clearTimeout(timer)}}
const busy=()=>{const at=performance.now();while(performance.now()-at<30){}}
function partial(error){assert.equal(error.sourceScopeComplete,false);assert.equal(error.inventoryEvidence.listingComplete,false);assert.equal(error.inventoryEvidence.reportedTotal,null);assert.equal(error.inventoryEvidence.indiaFacetCount,null);assert.equal(error.abortRetries,true);return true}
for(const key of ['maxJobs','maxPages'])test('Waymo zero '+key+' observes nothing and does not manufacture source time',async()=>{
 let calls=0,clocks=0;const jobs=await source.run({[key]:0,fetchText:()=>{calls++;return''},now:()=>{clocks++;return now()}}),e=readInventoryEvidence(jobs)
 assert.equal(calls,0);assert.equal(clocks,0);assert.equal(jobs.length,0);assert.equal(e.firstParty,false);assert.equal(e.verifiedAt,null);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.pagesFetched,0)
})
for(const [key,code]of [['maxPages','WAYMO_PAGE_BUDGET'],['maxRequests','WAYMO_REQUEST_BUDGET']])test('Waymo finite '+key+' stops before a second GET with its original body retained',async()=>{
 const r=io();await assert.rejects(source.run({...r,[key]:1}),e=>{partial(e);assert.equal(e.code,code);assert.deepEqual(r.calls,[SEARCH]);assert.equal(e.retainedNativeResponses[0].response.body,packets.find(p=>p.url===SEARCH).body);return true})
})
test('Waymo finite job cap keeps the first full role model and prevents another role GET',async()=>{
 const r=io();await assert.rejects(source.run({...r,maxJobs:1}),e=>{partial(e);assert.equal(e.code,'WAYMO_JOB_BUDGET');assert.equal(r.calls.includes(SECOND),false);assert.equal(e.partialNativeJobs.length,1);assert.equal(e.partialNativeJobs[0].nativeJobId,'92ec5f0e26503f37040a9d824f3696a7');return true})
})
test('Waymo undefined override preserves a factory cap',async()=>{
 const r=io();await assert.rejects(createWaymoScraper({...r,maxPages:1}).run({maxPages:undefined}),e=>{assert.equal(e.code,'WAYMO_PAGE_BUDGET');assert.deepEqual(r.calls,[SEARCH]);return true})
})
test('Waymo invalid runtime options reject before callbacks',async()=>{
 for(const value of [{maxPages:-1},{maxRequests:0},{readTimeoutMs:0},{sourceTimeoutMs:0},{auditTimeoutMs:0},{onAudit:true},{now:true}]){let calls=0;await assert.rejects(source.run({...value,fetchText:()=>{calls++;return''}}),e=>e.code==='WAYMO_INVALID_OPTIONS');assert.equal(calls,0)}
})
for(const reason of [false,0,'',Object.freeze({caller:'opaque'})])test('Waymo pre-abort keeps its exact opaque caller reason '+String(reason),async()=>{
 const controller=new AbortController();controller.abort(reason);const out=await settled(source.run({signal:controller.signal,fetchText:()=>assert.fail('pre-aborted read')}));assert.equal(out.kind,'rejected');assert.equal(out.reason,reason)
})
for(const reason of [false,0,'',null,undefined])test('Waymo falsy transport rejection remains the original cause '+String(reason),async()=>{
 await assert.rejects(source.run({fetchText:()=>Promise.reject(reason),now}),e=>{partial(e);assert.ok(Object.hasOwn(e,'cause'));assert.equal(e.cause,reason);assert.equal(e.nativeEvidence.attempts.length,1);return true})
})
test('Waymo frozen source error remains inspectable without a replacement TypeError',async()=>{
 const cause=Object.freeze(Object.assign(Error('original frozen transport failure'),{code:'ORIGINAL_FROZEN'}));await assert.rejects(source.run({fetchText:()=>Promise.reject(cause),now}),e=>{partial(e);assert.equal(e.cause,cause);assert.match(e.message,/original frozen/);return true})
})
test('Waymo synchronous returned body survives a read deadline',async()=>{
 const out=await settled(source.run({now,readTimeoutMs:5,fetchText:()=>{busy();return packets.find(p=>p.url===SEARCH).body}}));assert.equal(out.kind,'rejected');assert.equal(out.reason.code,'WAYMO_READ_TIMEOUT');assert.equal(sha(out.reason.retainedNativeResponses[0].response.body),sha(packets.find(p=>p.url===SEARCH).body));partial(out.reason)
})
test('Waymo ignored later read retains the earlier complete native role as partial facts',async()=>{
 const r=io((p,url)=>url===SECOND?new Promise(()=>{}):p.body),out=await settled(source.run({...r,readTimeoutMs:10}));assert.equal(out.kind,'rejected');assert.equal(out.reason.code,'WAYMO_READ_TIMEOUT');assert.equal(r.calls.at(-1),SECOND);const j=out.reason.partialNativeJobs[0];assert.equal(j.nativeJobId,'92ec5f0e26503f37040a9d824f3696a7');assert.equal(j.country,'India');assert.equal(j.requisitionId,'5535');assert.ok(j.jobDescription.length>1500);assert.equal(j.sourceDetailComplete,false);partial(out.reason)
})
test('Waymo later country conflict throws while preserving earlier original full facts',async()=>{
 const r=io((p,url)=>url===SECOND?p.body.replace(/("addressCountry"\s*:\s*")IN("|\s)/,'$1US$2'):p.body)
 await assert.rejects(source.run(r),e=>{assert.equal(e.code,'WAYMO_NATIVE_PROOF');assert.equal(e.partialNativeJobs.length,1);assert.equal(e.partialNativeJobs[0].country,'India');assert.equal(e.partialNativeJobs[0].postingDate,'2026-10-06T15:10:46.000Z');assert.match(e.retainedNativeResponses.at(-1).response.body,/"addressCountry"\s*:\s*"US"/);partial(e);return true})
})
test('Waymo native transport uses anonymous manual GET and cancels a denied hanging entity',async t=>{
 let seen,read=false,canceled=false;t.mock.method(globalThis,'fetch',async(url,init)=>{seen=init;return{url,status:403,headers:new Headers({'retry-after':'120'}),body:{getReader(){read=true;assert.fail('denial entity read')},cancel(){canceled=true}}}})
 await assert.rejects(source.run({now}),e=>{assert.equal(e.status,403);assert.equal(seen.method,'GET');assert.equal(seen.redirect,'manual');assert.equal(seen.credentials,'omit');assert.equal(read,false);assert.equal(canceled,true);assert.equal(e.retainedNativeResponses[0].response.headers['retry-after'],'120');assert.equal(e.retainedNativeResponses[0].response.body,null);return true})
})
test('Waymo HTTP429 preserves cooldown evidence and forbids outer retries',async t=>{
 t.mock.method(globalThis,'fetch',async url=>({url,status:429,headers:new Headers({'retry-after':'120'}),body:{cancel(){}}}));await assert.rejects(source.run({now}),e=>{assert.equal(e.status,429);assert.equal(e.retryDelayMs,120000);assert.equal(e.abortRetries,true);return true})
})
test('Waymo audit receives a detached original snapshot without changing returned models',async()=>{
 const r=io();let audit;const jobs=await source.run({...r,onAudit:value=>{audit=value;value.retainedNativeResponses.length=0;value.partialNativeJobs.length=0}})
 assert.ok(audit);assert.equal(jobs.length,2);assert.equal(jobs[0].country,'India');assert.ok(jobs.nativeCollectionEvidence.retainedResponses.length>5)
})
test('Waymo ignored zero-scan audit is bounded without source observation',async()=>{
 const out=await settled(source.run({maxJobs:0,now,auditTimeoutMs:5,fetchText:()=>assert.fail('no zero-scan read'),onAudit:()=>new Promise(()=>{})}));assert.equal(out.kind,'rejected');assert.equal(out.reason.code,'WAYMO_AUDIT_TIMEOUT');assert.equal(out.reason.inventoryEvidence.firstParty,false);assert.equal(out.reason.inventoryEvidence.verifiedAt,null)
})
test('Waymo primary denial survives secondary audit rejection',async()=>{
 const cause=Object.assign(Error('original denial'),{status:403,requestUrl:SEARCH,finalUrl:SEARCH});await assert.rejects(source.run({now,fetchText:()=>Promise.reject(cause),onAudit:()=>Promise.reject(Error('secondary audit failure'))}),e=>{assert.equal(e.status,403);assert.match(e.nativeEvidence.auditSinkFailure.message,/secondary audit/);assert.equal(e.message,'original denial');return true})
})
test('Waymo native late denial retains actual metadata before deadline failure',async t=>{
 let canceled=false;t.mock.method(globalThis,'fetch',url=>{busy();return{url,status:403,headers:new Headers({'retry-after':'120'}),body:{cancel(){canceled=true}}}})
 const out=await settled(source.run({now,readTimeoutMs:5}));assert.equal(out.kind,'rejected');assert.equal(out.reason.status,403);const p=out.reason.retainedNativeResponses[0].response;assert.equal(p.headers['retry-after'],'120');assert.equal(p.body,null);assert.equal(canceled,true)
})
for(const complete of [false,true])test('Waymo native returned '+(complete?'completed entity':'partial chunk')+' retains bytes at its deadline',async t=>{
 const bytes=Buffer.from('original returned Waymo entity');let reads=0;t.mock.method(globalThis,'fetch',async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read(){if(complete&&reads++===0)return{done:false,value:bytes};busy();return complete?{done:true}:{done:false,value:bytes}},cancel(){},releaseLock(){}})}}))
 const out=await settled(source.run({now,readTimeoutMs:5}));assert.equal(out.kind,'rejected');const p=out.reason.retainedNativeResponses[0].response;assert.equal(p.bodyComplete,complete);assert.equal(p.rawBodyBase64,bytes.toString('base64'));if(complete)assert.ok(p.completedAt)
})
test('Waymo oversized native chunk retains the available original bounded prefix',async t=>{
 const bytes=Buffer.alloc(4000001,0x77);let reads=0,canceled=false;t.mock.method(globalThis,'fetch',async url=>({url,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read(){reads++;return{done:false,value:bytes}},cancel(){canceled=true},releaseLock(){}})}}))
 await assert.rejects(source.run({now}),e=>{assert.equal(e.code,'WAYMO_BODY_LIMIT');const p=e.retainedNativeResponses[0].response;assert.equal(p.receivedBodyBytes,4000001);assert.equal(p.bodyBytes,4000000);assert.equal(p.bodyComplete,false);assert.equal(sha(Buffer.from(p.rawBodyBase64,'base64')),sha(bytes.subarray(0,4000000)));assert.equal(reads,1);assert.equal(canceled,true);return true})
})
const editPosting=(html,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i,(_,a,b,c)=>{const d=JSON.parse(b);change(d);return a+JSON.stringify(d)+c})
for(const [name,change]of[
 ['employer country restriction',d=>{d.hiringOrganization.unreviewedHiringCountry='US'}],
 ['identifier foreign scope',d=>{d.identifier.unreviewedCountry='US'}],
 ['location extra geographic scope',d=>{d.jobLocation[0].geo={country:'US'}}],
 ['contradictory direct application',d=>{d.directApply=false}],
])test('Waymo rejects '+name+' before admitting its application frame',async()=>{
 const r=io((p,url)=>url===FIRST?editPosting(p.body,change):p.body);await assert.rejects(source.run(r),e=>{assert.equal(e.code,'WAYMO_NATIVE_PROOF');assert.deepEqual(r.calls,[SEARCH,HOME,FIRST]);assert.equal(e.retainedNativeResponses.at(-1).response.body.includes('application/ld+json'),true);return true})
})
test('Waymo credential-bearing application frame cannot admit an extra GET',async()=>{
 const r=io((p,url)=>url===FIRST?p.body.replaceAll('src="/pages/','src="https://user:secret@careers.withwaymo.com/pages/'):p.body);await assert.rejects(source.run(r),e=>{assert.equal(e.code,'WAYMO_NATIVE_PROOF');assert.deepEqual(r.calls,[SEARCH,HOME,FIRST]);return true})
})
test('Waymo credential-bearing form action cannot qualify a native application',async()=>{
 const r=io((p,url)=>url.includes('/blocks/')?p.body.replaceAll('https://careers.withwaymo.com/call_to_actions/','https://user:secret@careers.withwaymo.com/call_to_actions/'):p.body);await assert.rejects(source.run(r),e=>{assert.equal(e.code,'WAYMO_NATIVE_PROOF');assert.equal(r.calls.length,4);return true})
})
test('Waymo text callback cannot smuggle a foreign response object into a qualified native document',async()=>{
 const r=io(p=>({body:p.body,status:200,url:'https://wrong.example/foreign',contentType:'text/html'}))
 await assert.rejects(source.run(r),e=>{assert.equal(e.code,'WAYMO_TRANSPORT_CONTRACT');assert.deepEqual(r.calls,[SEARCH]);assert.equal(e.retainedNativeResponses[0].response.url,'https://wrong.example/foreign');return true})
})
// Single whole-review fix pass: producer errors, durable facts and actual form semantics.
for(const key of ['source','partialNativeJobs','retainedNativeResponses','inventoryEvidence','abortRetries'])test('Waymo review preserves a primary error with read-only '+key,async()=>{
 const producer=Error('original read-only producer failure'),value=key==='abortRetries'?false:Object.freeze({original:key});Object.defineProperty(producer,key,{value,writable:false,enumerable:true})
 await assert.rejects(source.run({now,fetchText:()=>Promise.reject(producer)}),e=>{assert.notEqual(e,producer);assert.equal(e.cause,producer);assert.match(e.message,/original read-only/);assert.equal(producer[key],value);partial(e);assert.equal(e.nativeEvidence.attempts.length,1);return true})
})
test('Waymo review keeps pre-existing producer evidence separate and unchanged',async()=>{
 const producer=Object.assign(Error('reused producer error'),{retainedNativeResponses:[{url:'https://careers.withwaymo.com/original',body:'original producer body'}],partialNativeJobs:[{jobId:'earlier-role',jobDescription:'full earlier model'}],inventoryEvidence:{status:'coverage-gap',reportedTotal:null}}),before=structuredClone({responses:producer.retainedNativeResponses,jobs:producer.partialNativeJobs,inventory:producer.inventoryEvidence})
 await assert.rejects(source.run({now,fetchText:()=>Promise.reject(producer)}),e=>{assert.notEqual(e,producer);assert.equal(e.cause,producer);assert.deepEqual({responses:producer.retainedNativeResponses,jobs:producer.partialNativeJobs,inventory:producer.inventoryEvidence},before);assert.equal(e.nativeEvidence.attempts.length,1);partial(e);return true})
})
function nativeIO(t,change){const calls=[];t.mock.method(globalThis,'fetch',async(url,init)=>{calls.push(url);const p=packets.find(p=>p.url===url);assert.ok(p,'Exact original native endpoint only');const status=change?.(url,calls)??p.status;const response=new Response(p.body,{status,headers:{'content-type':'text/html; charset=utf-8',...(status===429?{'retry-after':'120'}:{})}});Object.defineProperty(response,'url',{value:url});return response});return calls}
test('Waymo review partial429 retains the failed native receipt without an optional audit',async t=>{
 const calls=nativeIO(t,url=>url===SECOND?429:undefined),jobs=await source.run({now}),a=jobs.nativeCollectionEvidence
 assert.equal(calls.length,5);assert.equal(jobs.length,1);assert.equal(a.incompleteCollectionFailure.status,429);assert.equal(a.retainedNativeResponses.length,5);const failed=a.retainedNativeResponses.at(-1).response;assert.equal(failed.status,429);assert.equal(failed.headers['retry-after'],'120');assert.equal(failed.body,null)
})
test('Waymo review handled closing interruption has partial audit status and its real failure',async()=>{
 const r=io((p,url,init,calls)=>{if(url===SECOND&&calls.filter(x=>x===SECOND).length===2)throw Object.assign(Error('closing original202'),{status:202,requestUrl:url,finalUrl:url});return p.body});let audit;const jobs=await source.run({...r,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,1);assert.equal(audit.status,'partial');assert.ok(audit.gaps.length>0);assert.equal(audit.nativeCollectionEvidence.incompleteCollectionFailure.status,202);assert.equal(jobs.nativeCollectionEvidence.retainedNativeResponses.length,r.calls.length-1)
})
test('Waymo review successful native output durably keeps its complete receipt ledger',async t=>{
 const calls=nativeIO(t),jobs=await source.run({now});assert.equal(jobs.length,2);assert.equal(calls.length,12);assert.equal(jobs.nativeCollectionEvidence.retainedNativeResponses.length,12);assert.equal(jobs.nativeCollectionEvidence.retainedNativeResponses[0].response.body,packets.find(p=>p.url===SEARCH).body)
})
test('Waymo review closing interruption keeps the held second full opening model',async()=>{
 const r=io((p,url,init,calls)=>{if(url===SECOND&&calls.filter(x=>x===SECOND).length===2)throw Object.assign(Error('closing second202'),{status:202,requestUrl:url,finalUrl:url});return p.body}),jobs=await source.run(r),held=jobs.nativeCollectionEvidence.heldNativeFacts
 assert.equal(jobs.length,1);assert.equal(held.length,1);assert.equal(held[0].title,'Program Manager, Vendor Service Delivery Lead');assert.equal(held[0].country,'India');assert.equal(held[0].postingDate,'2026-09-29T19:09:38.000Z');assert.ok(held[0].jobDescription.length>1500);assert.ok(held[0].nativeJobPosting);assert.equal(held[0].sourceDetailComplete,false);assert.equal(held[0].activeApplyVerified,false)
})
test('Waymo review unavailable closing application retains its original opening application model',async()=>{
 let frame;const r=io((p,url,init,calls)=>{if(url.includes('/blocks/')&&!frame)frame=url;if(url===frame&&calls.filter(x=>x===frame).length===2)throw Object.assign(Error('closing app202'),{status:202,requestUrl:url,finalUrl:url});return p.body}),jobs=await source.run(r),job=jobs[0]
 assert.equal(jobs.length,1);assert.equal(job.nativeApplicationFailure.status,202);assert.ok(job.nativeApplicationEvidence);assert.equal(job.nativeApplicationEvidence.rawBody,packets.find(p=>p.url===frame).body);assert.equal(job.activeApplyVerified,false);assert.equal(job.sourceScopeComplete,false)
})
for(const [name,change]of[
 ['object streetAddress',d=>{d.jobLocation[0].address.streetAddress={'@type':'Place',unreviewedHiringCountry:'US'}}],
 ['array streetAddress',d=>{d.jobLocation[0].address.streetAddress=['unreviewed scope']}],
 ['array locality',d=>{d.jobLocation[0].address.addressLocality=[d.jobLocation[0].address.addressLocality]}],
 ['array region',d=>{d.jobLocation[0].address.addressRegion=[d.jobLocation[0].address.addressRegion]}],
 ['array country',d=>{d.jobLocation[0].address.addressCountry=['IN']}],
 ['array publication date',d=>{d.datePosted=[d.datePosted]}],
 ['array employment type',d=>{d.employmentType=[d.employmentType]}],
])test('Waymo review rejects '+name+' before another native read',async()=>{
 const r=io((p,url)=>url===FIRST?editPosting(p.body,change):p.body);await assert.rejects(source.run(r),e=>{assert.equal(e.code,'WAYMO_NATIVE_PROOF');assert.deepEqual(r.calls,[SEARCH,HOME,FIRST]);return true})
})
for(const [name,change]of[
 ['foreign submit destination',html=>html.replace(/<button\b(?=[^>]*\btype="submit")/i,'<button formaction="https://foreign.example/submit"')],
 ['GET submit method override',html=>html.replace(/<button\b(?=[^>]*\btype="submit")/i,'<button formmethod="get"')],
 ['different form association',html=>html.replace(/<button\b(?=[^>]*\btype="submit")/i,'<button form="different-form"')],
 ['inherited disabled fieldset',html=>html.replace(/(<form\b[^>]*>)([\s\S]*?)(<\/form>)/i,'$1<fieldset disabled>$2</fieldset>$3')],
])test('Waymo review cannot verify active application with '+name,async()=>{
 const r=io((p,url)=>{if(!url.includes('/blocks/'))return p.body;const modified=change(p.body);assert.notEqual(modified,p.body,'Counterexample must modify an actual native control');return modified})
 await assert.rejects(source.run(r),e=>{assert.equal(e.code,'WAYMO_NATIVE_PROOF');assert.equal(r.calls.length,4);assert.equal(e.partialNativeJobs[0].activeApplyVerified,false);return true})
})
for(const key of ['maxRequests','maxPages'])test('Waymo review '+key+' blocked frame is not reported as visited',async()=>{
 const r=io();await assert.rejects(source.run({...r,[key]:3}),e=>{assert.deepEqual(r.calls,[SEARCH,HOME,FIRST]);assert.equal(e.partialNativeJobs.length,1);assert.equal(e.partialNativeJobs[0].applicationVisited,false);assert.equal(e.partialNativeJobs[0].applicationAccessValidated,false);return true})
})
