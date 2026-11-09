import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const directory=new URL('./test-data-20261107/',import.meta.url),fixture=JSON.parse(fs.readFileSync(new URL('discovery-manifest.json',directory))),sha=b=>createHash('sha256').update(b).digest('hex')
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):x
const key=(url,init={})=>(init.method||'GET')+' '+url+' '+(init.body?JSON.stringify(canonical(JSON.parse(init.body))):'')
const packets=new Map(fixture.requests.map(r=>[key(r.url,r),r]))
const registered=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='evonik'))
function replay(change){const calls=[];return {calls,fetchImpl:async(url,init={})=>{const row=packets.get(key(url,init));assert.ok(row,'Uncaptured exact request '+key(url,init));const bytes=gunzipSync(fs.readFileSync(new URL(row.bodySHA256+'.gz',directory)));assert.equal(sha(bytes),row.bodySHA256);assert.equal(bytes.length,row.bodyBytes);calls.push({url,init});const replacement=change?.(bytes.toString(),row,calls.filter(x=>x.url===url).length);const response=new Response(replacement??bytes,{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalURL,configurable:true});return response}}}
async function read(change,options={}){const r=replay(change),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected real network')};try{return {jobs:await registered().run({...options,fetchImpl:r.fetchImpl,now:()=> '2026-11-07T00:00:00.000Z'}),calls:r.calls}}finally{globalThis.fetch=old}}

test('Evonik registered source retains seven verified India roles beyond old three and holds the eighth title contradiction',async()=>{
 const {jobs}=await read();assert.deepEqual(jobs.map(j=>j.jobId).sort(),fixture.expectedIndiaIds.filter(id=>id!=='R51735').toSorted());assert.equal(jobs.length,7)
 for(const j of jobs){assert.equal(j.companyName,'Evonik');assert.equal(j.country,'India');assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.sourceDescription,j.nativeSourceRecord.description);assert.equal(j.nativeHiringOrganization.name,'Evonik');assert.equal(j.applicationVisited,false)}
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readSourceObservationEvidence(jobs,'evonik').observedVacancyCount,8)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRows.length,1);assert.equal(jobs.nativeCollectionEvidence.heldNativeRows[0].id,'R51735');assert.deepEqual(jobs.nativeCollectionEvidence.heldNativeRows[0].qualificationIssues,['JobPosting:native-title-date-or-full-criteria-contradiction']);assert.equal(jobs.nativeCollectionEvidence.observations.filter(o=>o.additionalLocationCountryScopeUnresolved).length,3)
})

const firstId='R52796',firstOwn='https://www.evonik.com/en/careers/jobs/job.html?jobId='+firstId
const nativeFirst=row=>row.url.includes('/wday/cxs/')&&row.url.includes('_'+firstId+'-1')
const mutateOwn=(html,fn)=>html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,(all,start,raw,end)=>{const p=JSON.parse(raw);if(p['@type']!=='JobPosting')return all;fn(p);return start+JSON.stringify(p)+end})
const mutateNative=(body,fn)=>{const p=JSON.parse(body);fn(p);return JSON.stringify(p)}
const heldOwn=[
 ['foreign country',p=>p.jobLocation[0].address.addressCountry='US'],
 ['unknown country object',p=>p.jobLocation[0].address.addressCountry={name:'India',code:'US'}],
 ['extra Place countryCode',p=>p.jobLocation[0].countryCode='US'],
 ['extra Place country',p=>p.jobLocation[0].country='India'],
 ['extra nested address foreign country',p=>p.jobLocation[0].address.address={addressCountry:'US'}],
 ['extra address countryCode',p=>p.jobLocation[0].address.countryCode='US'],
 ['addressless extra Place',p=>p.jobLocation.push({'@type':'Place',name:'Unknown'})],
 ['unknown nested locality carrier',p=>p.jobLocation[0].address.addressLocality={name:'Thane',countryCode:'US'}],
 ['foreign brand',p=>p.hiringOrganization.name='Other Employer'],
 ['foreign employer authority',p=>p.hiringOrganization.sameAs='https://other.example'],
 ['extra employer URL authority',p=>p.hiringOrganization.url='https://other.example'],
 ['unknown additional native criteria',p=>p.qualifications={mandatoryRequirements:'Different independently advertised criteria'}],
 ['own native title contradiction',p=>p.title='Other title'],
 ['own date contradiction',p=>p.datePosted='2026-11-06'],
 ['wrong apply account',p=>p.sameAs=p.sameAs.replace('evonik.wd3','other.wd3')],
 ['wrong apply identity',p=>p.sameAs=p.sameAs.replace(/R\d+/,'R99999')],
]
for(const [label,change] of heldOwn)test('Evonik holds '+label+' with complete opening and closing originals',async()=>{
 const affectedId=['foreign brand','foreign employer authority','wrong apply account','wrong apply identity'].includes(label)?'R52149':firstId,affectedURL=firstOwn.replace(firstId,affectedId)
 const {jobs}=await read((body,row)=>row.url===affectedURL?mutateOwn(body,change):undefined);assert.equal(jobs.length,6);assert.ok(!jobs.some(j=>j.jobId===affectedId));const held=jobs.nativeCollectionEvidence.heldNativeRows.find(r=>r.id===affectedId);assert.ok(held?.qualificationIssues.length);assert.ok(held.ownOpeningHTML&&held.ownClosingHTML);assert.deepEqual(held.ownOpeningRecord,held.ownClosingRecord);assert.ok(held.nativeOpeningRecord.jobPostingInfo.jobDescription);assert.equal(readSourceObservationEvidence(jobs,'evonik').observedVacancyCount,8);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
const heldNative=[
 ['unknown country name carrier',p=>p.jobPostingInfo.country.name='US'],
 ['unknown country code carrier',p=>p.jobPostingInfo.country.code='US'],
 ['unknown country id carrier',p=>p.jobPostingInfo.country.id='bc33aa3152ec42d4995f4791a106ed09'],
 ['contradictory country descriptor',p=>p.jobPostingInfo.country.descriptor='United States of America'],
 ['foreign requisition country',p=>p.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US'],
 ['extra requisition countryCode',p=>p.jobPostingInfo.jobRequisitionLocation.countryCode='US'],
 ['extra root country authority',p=>p.countryCode='US'],
 ['extra role country authority',p=>p.jobPostingInfo.addressCountry='US'],
 ['foreign native legal employer',p=>p.hiringOrganization.name='Other Employer'],
 ['extra native legal employer authority',p=>p.hiringOrganization.sameAs='https://other.example'],
 ['foreign native logo account',p=>p.jobPostingInfo.logoImage.src='/wday/cxs/other/Other/sidebarimage/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
 ['native affirmative inactive status',p=>p.jobPostingInfo.posted=false],
 ['native applications unavailable',p=>p.jobPostingInfo.canApply=false],
 ['expired native role',p=>p.jobPostingInfo.endDate='2026-11-01'],
]
for(const [label,change] of heldNative)test('Evonik holds '+label+' without dropping native carrier',async()=>{
 const {jobs}=await read((body,row)=>nativeFirst(row)?mutateNative(body,change):undefined);assert.equal(jobs.length,6);const held=jobs.nativeCollectionEvidence.heldNativeRows.find(r=>r.id===firstId);assert.ok(held?.qualificationIssues.length);assert.deepEqual(held.nativeOpeningRecord.jobPostingInfo,held.nativeClosingRecord.jobPostingInfo);assert.ok(held.nativeOpeningRecord.hiringOrganization);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})
const fatalMutations=[
 ['missing India facet',(body,row)=>row.method==='POST'?mutateNative(body,p=>p.facets=p.facets.filter(x=>x.facetParameter!=='Country')):undefined,/Country facet/],
 ['changed India facet identity',(body,row)=>row.method==='POST'?mutateNative(body,p=>{const i=p.facets.find(x=>x.facetParameter==='Country')?.values.find(x=>x.descriptor==='India');if(i)i.id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}):undefined,/India facet identity/],
 ['duplicate native requisition',(body,row)=>row.method==='POST'&&JSON.parse(row.body).appliedFacets.Country?mutateNative(body,p=>p.jobPostings[1]=p.jobPostings[0]):undefined,/Duplicate native requisition/],
 ['unsupported native listing country carrier',(body,row)=>row.method==='POST'?mutateNative(body,p=>p.jobPostings[0].countryCode='US'):undefined,/listing identity/],
 ['wrong native listing path',(body,row)=>row.method==='POST'?mutateNative(body,p=>p.jobPostings[0].externalPath='https://other.example/job/R123'):undefined,/listing identity/],
 ['native requisition mismatch',(body,row)=>nativeFirst(row)?mutateNative(body,p=>p.jobPostingInfo.jobReqId='R99999'):undefined,/detail identity/],
 ['native public authority mismatch',(body,row)=>nativeFirst(row)?mutateNative(body,p=>p.jobPostingInfo.externalUrl=p.jobPostingInfo.externalUrl.replace('evonik.wd3','other.wd3')):undefined,/detail identity/],
 ['invalid native calendar',(body,row)=>nativeFirst(row)?mutateNative(body,p=>p.jobPostingInfo.startDate='2026-02-30'):undefined,/calendar/],
 ['future native publication',(body,row)=>nativeFirst(row)?mutateNative(body,p=>p.jobPostingInfo.startDate='2027-01-01'):undefined,/Future native/],
 ['missing full native criteria',(body,row)=>nativeFirst(row)?mutateNative(body,p=>p.jobPostingInfo.jobDescription='<p>Apply now</p>'):undefined,/full native criteria/],
 ['canonical mismatch',(body,row)=>row.url===firstOwn?body.replace('rel="canonical" href="'+firstOwn+'"','rel="canonical" href="'+firstOwn.replace('R52796','R99999')+'"'):undefined,/canonical/],
 ['own schema identity mismatch',(body,row)=>row.url===firstOwn?mutateOwn(body,p=>p.identifier.value='R99999'):undefined,/schema requisition/],
 ['own role base authority',(body,row)=>row.url===firstOwn?body.replace('</head>','<base href="https://other.example"></head>'):undefined,/base authority/],
 ['India closing inventory drift',(body,row,count)=>row.method==='POST'&&JSON.parse(row.body).appliedFacets.Country&&count===3?mutateNative(body,p=>p.jobPostings.reverse()):undefined,/opening\/closing/],
 ['native closing criteria drift',(body,row,count)=>nativeFirst(row)&&count===2?mutateNative(body,p=>p.jobPostingInfo.jobDescription+='<p>New mandatory criterion</p>'):undefined,/changed during closing/],
 ['own closing criteria drift',(body,row,count)=>row.url===firstOwn&&count===2?mutateOwn(body,p=>p.description+='<p>New mandatory criterion</p>'):undefined,/changed during closing/],
]
for(const [label,change,pattern] of fatalMutations)test('Evonik rejects '+label+' without an inventory result',async()=>assert.rejects(read(change),pattern))

test('Evonik requires full visible original criteria',async()=>{const {jobs}=await read((body,row)=>row.url===firstOwn?body.replace('class="jobpage__description','hidden class="jobpage__description'):undefined);assert.equal(jobs.length,6);assert.ok(jobs.nativeCollectionEvidence.heldNativeRows.find(r=>r.id===firstId).qualificationIssues.includes('own-role:visible-full-criteria-title-date-or-application-unproven'))})
test('Evonik holds an affirmative own-role closure but ignores identical footer prose',async()=>{const notice='<p>This job is closed.</p>';const {jobs}=await read((body,row)=>row.url===firstOwn?body.replace('class="container-00 jobpage">','class="container-00 jobpage">'+notice):undefined);assert.equal(jobs.length,6);assert.ok(jobs.nativeCollectionEvidence.heldNativeRows.find(r=>r.id===firstId).qualificationIssues.includes('own-role:affirmative-closed-notice'));const result=await read((body,row)=>row.url===firstOwn?body.replace('</footer>',notice+'</footer>'):undefined);assert.equal(result.jobs.length,7)})
test('Evonik transport keeps the existing identity, finite default representation and anonymous request contract',async()=>{const {calls}=await read();assert.equal(calls.length,38);for(const {url,init} of calls){assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.headers['User-Agent'],'Mozilla/5.0 (compatible; Jobverify careers inventory check)');assert.equal(init.headers.Accept,url.includes('/wday/cxs/')?'application/json':'text/html');assert.deepEqual(Object.keys(init.headers).sort(),(init.body?['Accept','Content-Type','User-Agent']:['Accept','User-Agent']).sort());assert.ok(!url.endsWith('/apply'))}})

test('Evonik caller pre-abort preserves an opaque reason and launches zero requests',async()=>{const c=new AbortController(),reason=Symbol('opaque');c.abort(reason);let calls=0;await assert.rejects(registered().run({signal:c.signal,fetchImpl:()=>{calls++}}),e=>e===reason);assert.equal(calls,0)})
test('Evonik immediate caller abort before scheduled fetch launches zero requests',async()=>{const c=new AbortController(),reason=Symbol('immediate');let calls=0;const work=registered().run({signal:c.signal,fetchImpl:()=>{calls++}});c.abort(reason);await assert.rejects(work,e=>e===reason);assert.equal(calls,0)})
test('Evonik pending headers stop at exact caller abort with no late native reads',async()=>{const c=new AbortController(),reason=Symbol('pending'),calls=[];let resolve;const work=registered().run({signal:c.signal,fetchImpl:async(url,init)=>{calls.push({url,init});return new Promise(r=>resolve=r)}});await new Promise(r=>setTimeout(r,0));c.abort(reason);await assert.rejects(work,e=>e===reason);assert.equal(calls.length,1);assert.equal(calls[0].init.signal.reason,reason);resolve(new Response('late'));await new Promise(r=>setTimeout(r,5));assert.equal(calls.length,1)})
test('Evonik pending response body is cancelled on exact caller abort',async()=>{const c=new AbortController(),reason=Symbol('body');let cancelled=false;const response=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.evonik.com/en/careers.html'});const work=registered().run({signal:c.signal,fetchImpl:async()=>response});await new Promise(r=>setTimeout(r,0));c.abort(reason);await assert.rejects(work,e=>e===reason);assert.equal(cancelled,true)})
test('Evonik aggregate deadline bounds pending headers and forbids late continuation',async()=>{let calls=0,resolve;const work=registered().run({timeoutMs:15,fetchImpl:async()=>{calls++;return new Promise(r=>resolve=r)}});await assert.rejects(work,/aggregate request deadline/);assert.equal(calls,1);resolve(new Response('late'));await new Promise(r=>setTimeout(r,5));assert.equal(calls,1)})
test('Evonik primary HTTP403 retains status and original body hash, never empty success',async()=>{const body='Native public access denied',r=new Response(body,{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:'https://www.evonik.com/en/careers.html'});await assert.rejects(registered().run({fetchImpl:async()=>r}),e=>e.status===403&&e.cause.status===403&&e.recruitmentObservations.receipts.length===1&&e.recruitmentObservations.receipts[0].bodySHA256===sha(body))})
test('Evonik rejects wrong MIME and final authority before interpreting a body',async()=>{for(const change of ['mime','authority']){const r=replay();await assert.rejects(registered().run({fetchImpl:async(url,init)=>{const response=await r.fetchImpl(url,init);if(change==='mime')response.headers.set('content-type','application/json');else Object.defineProperty(response,'url',{value:'https://other.example',configurable:true});return response}}),change==='mime'?/representation/:/authority/)}})
test('Evonik per-read default expires at15seconds inside unchanged90second aggregate',async t=>{t.mock.timers.enable({apis:['setTimeout']});let calls=0,requestSignal;const work=registered().run({fetchImpl:async(url,init)=>{calls++;requestSignal=init.signal;return new Promise(()=>{})}});await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(15000);await assert.rejects(work,/native request deadline/);assert.equal(calls,1);assert.equal(requestSignal.aborted,true)})
test('Evonik refuses forced record caps before issuing requests',async()=>{let calls=0;await assert.rejects(registered().run({maxJobs:1,fetchImpl:()=>{calls++}}),/truncation/);assert.equal(calls,0)})
test('Evonik retains empty optional country carriers without inventing or rejecting countries',async()=>{const {jobs}=await read((body,row)=>row.url===firstOwn?mutateOwn(body,p=>{p.jobLocation[0].countryCode='';p.jobLocation[0].address.country=null}):nativeFirst(row)?mutateNative(body,p=>{p.jobPostingInfo.country.name=null;p.jobPostingInfo.country.code=''}):undefined);assert.equal(jobs.length,7);const job=jobs.find(j=>j.jobId===firstId);assert.equal(job.nativeSourceRecord.jobLocation[0].countryCode,'');assert.equal(job.nativeSourceRecord.jobLocation[0].address.country,null);assert.equal(job.nativeWorkdayRecord.jobPostingInfo.country.name,null);assert.equal(job.country,'India')})
test('Evonik exact current38 genuine responses preserve full source-owned opening and closing models',async()=>{
 const profile=JSON.parse(fs.readFileSync(new URL('manifest.json',directory))),rows=profile.requests;let count=0
 const fetchImpl=async(url,init)=>{const row=rows[count++];assert.ok(row);assert.equal(url,row.url);assert.equal(init.method||'GET',row.method);assert.equal(init.body??null,row.body);assert.equal(init.redirect,row.redirect);assert.equal(init.credentials,row.credentials);for(const [k,v] of Object.entries(row.requestHeaders))assert.equal(new Headers(init.headers).get(k),v);const bytes=gunzipSync(fs.readFileSync(new URL(row.bodySHA256+'.gz',directory)));assert.equal(sha(bytes),row.bodySHA256);assert.equal(bytes.length,row.bodyBytes);const r=new Response(bytes,{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(r,'url',{value:row.finalURL});return r}
 const prior=globalThis.fetch;globalThis.fetch=()=>{throw Error('Actual network forbidden')};try{const jobs=await registered().run({fetchImpl,now:()=>profile.observedAt});assert.equal(count,38);assert.deepEqual(jobs.map(j=>j.jobId).sort(),profile.expectedIndiaIds.toSorted());for(const job of jobs){assert.deepEqual(job.nativeSourceRecord,profile.independentOracle.ownOpening[job.jobId]);assert.deepEqual(job.nativeClosingSourceRecord,profile.independentOracle.ownClosing[job.jobId]);assert.deepEqual(job.nativeWorkdayRecord,profile.independentOracle.nativeOpening[job.jobId]);assert.deepEqual(job.nativeClosingWorkdayRecord,profile.independentOracle.nativeClosing[job.jobId]);assert.equal(job.sourceDescription,job.nativeWorkdayRecord.jobPostingInfo.jobDescription)}assert.equal(readSourceObservationEvidence(jobs,'evonik').observedVacancyCount,8);assert.equal(jobs.nativeCollectionEvidence.heldNativeRows[0].id,'R51735');assert.deepEqual(jobs.nativeCollectionEvidence.originalResponses.map(r=>r.bodySHA256),rows.map(r=>r.bodySHA256))}finally{globalThis.fetch=prior}
})

test('Evonik review RED: frozen opaque caller abort remains the exact untouched object',async()=>{
 const controller=new AbortController(),reason=Object.freeze({abort:'caller'});let release,calls=0
 const pending=registered().run({signal:controller.signal,fetchImpl:()=>{calls++;return new Promise(resolve=>release=resolve)}})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 await assert.rejects(pending,error=>error===reason);assert.deepEqual(Reflect.ownKeys(reason),['abort']);assert.equal(calls,1)
 release(new Response('late'));await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1)
})
test('Evonik review RED: a response resolving after caller abort is disposed exactly once',async()=>{
 const controller=new AbortController(),reason=Symbol('caller');let release,cancelCalls=0,calls=0
 const pending=registered().run({signal:controller.signal,fetchImpl:()=>{calls++;return new Promise(resolve=>release=resolve)}})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason);await assert.rejects(pending,error=>error===reason)
 const response=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelCalls++}}),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.evonik.com/en/careers.html'})
 release(response);await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelCalls,1);assert.equal(calls,1)
})
test('Evonik review RED: errored denial body preserves primary numeric HTTP403',async()=>{
 const bodyFailure=Error('controlled HTTP403 response-body transport failure'),response=new Response(new ReadableStream({start(controller){controller.error(bodyFailure)}}),{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.evonik.com/en/careers.html'})
 await assert.rejects(registered().run({fetchImpl:async()=>response}),error=>{assert.equal(error.status,403);assert.equal(error.cause.status,403);assert.match(error.message,/HTTP 403/);assert.equal(error.responseBodyError,bodyFailure);assert.equal(error.recruitmentObservations.receipts.length,1);assert.equal(error.recruitmentObservations.receipts[0].status,403);assert.equal(error.recruitmentObservations.receipts[0].bodyReadComplete,false);assert.equal(error.recruitmentObservations.receipts[0].bodySHA256,undefined);return true})
})
test('Evonik never annotates an extensible opaque caller reason',async()=>{
 const controller=new AbortController(),reason={abort:'caller'};let release,calls=0
 const pending=registered().run({signal:controller.signal,fetchImpl:()=>{calls++;return new Promise(resolve=>release=resolve)}})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason);await assert.rejects(pending,error=>error===reason);assert.deepEqual(Reflect.ownKeys(reason),['abort']);release(new Response('late'));await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1)
})
test('Evonik preserves a frozen caller Error over already received HTTP403 headers',async()=>{
 const controller=new AbortController(),reason=Object.freeze(Error('opaque frozen caller Error'));let cancelled=0
 const response=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled++}}),{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.evonik.com/en/careers.html'});const keys=Reflect.ownKeys(reason)
 const pending=registered().run({signal:controller.signal,fetchImpl:async()=>response});await new Promise(resolve=>setImmediate(resolve));controller.abort(reason);await assert.rejects(pending,error=>error===reason);assert.deepEqual(Reflect.ownKeys(reason),keys);assert.equal(cancelled,1)
})
test('Evonik disposes late headers once after unchanged per-read expiry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let release,cancelled=0,calls=0
 const pending=registered().run({fetchImpl:()=>{calls++;return new Promise(resolve=>release=resolve)}});await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(15000);await assert.rejects(pending,/native request deadline/)
 const response=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled++}}),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.evonik.com/en/careers.html'});release(response);await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1);assert.equal(calls,1)
})
test('Evonik preserves received HTTP403 through its bounded body-read deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let cancelled=0,calls=0
 const response=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled++}}),{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.evonik.com/en/careers.html'})
 const pending=registered().run({fetchImpl:async()=>{calls++;return response}});await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(15000)
 await assert.rejects(pending,error=>{assert.equal(error.status,403);assert.equal(error.cause.status,403);assert.match(error.responseBodyError.message,/native request deadline/);assert.equal(error.recruitmentObservations.receipts[0].bodyReadComplete,false);return true});assert.equal(cancelled,1);assert.equal(calls,1)
})

