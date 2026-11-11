import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {hasOfficialHomepageSignal,extractCareersUrlFromHomepage,extractOpenRoles,inspectHomepage,inspectApplicationForm,run,HOMEPAGE_URL,CAREERS_URL,APPLY_URL} from './script.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {extractionRawJobMetrics} from '../../scraper-support/utils/extractionRawJobMetrics.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'
import {withRetry} from '../../scraper-support/utils/retry.js'
import {createThenceTransport} from './transport20261111.js'
import {enrichJobWithPublicExperience,enrichJobsWithPublicExperience} from '../../scraper-support/utils/publicExperienceEnrichment.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current20261111.json.gz',import.meta.url))))
const live=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/live20261111.json.gz',import.meta.url))))
const text=index=>Buffer.from(fixture.responses[index].bodyBase64,'base64').toString('utf8')
test('five original dated public packets retain byte hashes and original provenance without invented closing captures',()=>{
 assert.equal(fixture.responses.length,5);for(let i=0;i<5;i++){const p=fixture.responses[i],{bodyBase64,...manifest}=p;assert.deepEqual(manifest,fixture.originalManifest.packets[i]);assert.equal(Buffer.from(bodyBase64,'base64').length,p.bodyBytes);assert.equal(createHash('sha256').update(Buffer.from(bodyBase64,'base64')).digest('hex'),p.bodySHA256)}
})
test('genuine current homepage publisher resolves only its active relative careers handoff to its own canonical authority',()=>{
 assert.equal(hasOfficialHomepageSignal(text(2)),true);assert.equal(extractCareersUrlFromHomepage(text(2)),'https://www.thence.digital/careers')
})
test('genuine16 application choices keep stable internal IDs and unknown formal ID/country/criteria, including actual consumers',()=>{
 const choices=extractOpenRoles(text(4));assert.equal(choices.length,16);assert.equal(choices[0].jobId,'thence-product-data-analyst')
 for(const choice of choices){assert.equal(choice.country,null);assert.equal(choice.requisitionId,null);assert.equal(choice.nativeLegalEmployer,null);assert.equal(choice.sourceCountryScopeUnresolved,true);assert.equal(choice.jobDescription,null)}
 const normalized=choices.map(job=>normalizeScrapedJob(job,{source:'thence',companyName:'Thence Private Limited',countryFilter:'India'}));assert.equal(analyzePublishableJobs(choices).indiaJobs.length,0);assert.equal(analyzePublishableJobs(normalized).indiaJobs.length,0)
})
function replay(mutate){
 let index=0;const used=[]
 return{used,fetchImpl:async(url,init)=>{const packet=live.originalPages[index++];assert.ok(packet,'unexpected additional read');assert.equal(url,packet.url,'global actual capture order');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');used.push(packet);let p={...packet,body:Buffer.from(packet.rawBodyBase64,'base64')};p=mutate?.(p,index-1)??p;const response=new Response(p.body,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalUrl});return response}}
}
const home=text(2),careers=text(4)
function nodeChange(html,predicate,mutate){const d=document(html),nodes=d.nodes(predicate);assert.equal(nodes.length,1,'controlled mutation must bind exact original node');const n=nodes[0];return html.slice(0,n.start)+mutate(d.outer(n),n,d)+html.slice(n.end)}
const titleChange=(html,mutate)=>{const matches=[...html.matchAll(/<title\b[^>]*>[\s\S]*?<\/title>/gi)];assert.equal(matches.length,1);const n=matches[0];return html.slice(0,n.index)+mutate(n[0])+html.slice(n.index+n[0].length)}
test('derived original parser evidence demonstrates the removed false India promotion and unchanged internal IDs',()=>{
 const before=fixture.priorParserObservation.jobs,after=extractOpenRoles(careers);assert.equal(analyzePublishableJobs(before).indiaJobs.length,16);assert.equal(analyzePublishableJobs(after).indiaJobs.length,0);assert.deepEqual(after.map(j=>j.jobId),before.map(j=>j.jobId));assert.ok(before.every(j=>j.requisitionId===j.jobId));assert.ok(after.every(j=>j.requisitionId===null))
})
test('actual eight-packet current fixture has distinct opening/closing packets and original full byte/clock fidelity',()=>{
 assert.equal(live.originalPages.length,8);for(const p of live.originalPages){assert.equal(createHash('sha256').update(Buffer.from(p.rawBodyBase64,'base64')).digest('hex'),p.sha256);assert.equal(Buffer.from(p.rawBodyBase64,'base64').length,p.bytes);assert.ok(p.observedAt>=p.requestedAt)}
 assert.equal(new Set(live.originalPages.map(p=>p.requestedAt)).size,8);for(let i=0;i<4;i++){assert.equal(live.originalPages[i].url,live.originalPages[i+4].url);assert.notEqual(live.originalPages[i].requestedAt,live.originalPages[i+4].requestedAt)}
})
test('full genuine replay preserves application choice accounting without claiming native vacancies or India eligibility',async()=>{
 const r=replay(),jobs=await run({fetchImpl:r.fetchImpl});assert.equal(r.used.length,8);assert.equal(jobs.length,16);assert.equal(jobs.sourceAudit.originalPages[0].url,HOMEPAGE_URL);assert.equal(jobs[0].applyUrl,APPLY_URL);assert.equal(jobs.sourceAudit.observedApplicationRoleChoices,16);assert.equal(jobs.sourceAudit.confirmedNativeVacancyTotal,null);assert.equal(jobs.sourceAudit.closingApplicationChoicesMatch,true);assert.equal(readSourceObservationEvidence(jobs,'thence'),null)
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.deepEqual(extractionRawJobMetrics({source:'thence'},jobs,inventory),{rawJobs:16,rawJobsBasis:'extracted-jobs-fallback'});assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,0);assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length,0);assert.equal(extractionDetailHealth(jobs).missingDescriptions,16)
 assert.deepEqual(jobs.sourceAudit.originalPages.map(p=>p.rawBodyBase64),r.used.map(p=>p.rawBodyBase64));assert.deepEqual(jobs.map(j=>j.sourceNativeApplicationOption.value),live.applicationRoleCandidates.map(j=>j.sourceNativeApplicationOption.value));assert.equal(jobs[0].sourceApplicationChoiceEvidence.originalPages.length,8);assert.doesNotThrow(()=>JSON.stringify(jobs))
})
test('actual registered adapter and normalization preserve unresolved country against provider India default',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='thence');assert.equal(provider.countryFilter,'India');const r=replay(),jobs=await createCatalogScraper(provider).run({fetchImpl:r.fetchImpl});assert.equal(jobs.length,16);assert.ok(jobs.every(j=>j.country===null&&j.sourceCountryScopeUnresolved===true));assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,0);assert.equal(extractionRawJobMetrics(provider,jobs,readInventoryEvidence(jobs)).rawJobsBasis,'extracted-jobs-fallback');const normalized=jobs.map(j=>normalizeScrapedJob(j,provider));assert.ok(normalized.every(j=>j.country===null&&j.requisitionId===null&&j.jobDescription===null));assert.equal(analyzePublishableJobs(normalized).indiaJobs.length,0)
})
for(const [name,html]of [['homepage',home],['careers',careers]]){
 const check=name==='homepage'?inspectHomepage:inspectApplicationForm
 for(const tag of ['blockquote','pre','code','template'])test(name+' quoted/inert '+tag+' publisher title cannot establish publisher identity',()=>assert.throws(()=>check(titleChange(html,raw=>'<'+tag+'>'+raw+'</'+tag+'>')),/title/))
 for(const tag of ['blockquote','pre','code','template'])test(name+' quoted/inert '+tag+' canonical cannot establish own document identity',()=>assert.throws(()=>check(nodeChange(html,n=>n.tag==='link'&&n.attrs.rel==='canonical',raw=>'<'+tag+'>'+raw+'</'+tag+'>')),/canonical/))
 test(name+' foreign canonical is held',()=>assert.throws(()=>check(nodeChange(html,n=>n.tag==='link'&&n.attrs.rel==='canonical',raw=>raw.replace('www.thence.digital','other.example'))),/publisher/))
 test(name+' conflicting duplicate canonical is held',()=>assert.throws(()=>check(html.replace('</head>','<link rel="canonical" href="https://other.example/"></head>')),/canonical/))
 test(name+' mismatched current publisher metadata is held',()=>assert.throws(()=>check(nodeChange(html,n=>n.tag==='meta'&&n.attrs.property==='og:title',raw=>raw.replace('content="','content="Other '))),/publisher/))
 for(const wrapper of ['','<div hidden>','<blockquote>'])test(name+' base changes remain forbidden under '+(wrapper||'plain'),()=>assert.throws(()=>check(html.replace('</head>',wrapper+'<base href="https://other.example/">'+(wrapper?'</'+wrapper.match(/^<([a-z]+)/)[1]+'>':'')+'</head>')),/base/))
 test(name+' template base decoy is inert',()=>assert.doesNotThrow(()=>check(html.replace('</head>','<template><base href="https://other.example/"></template></head>'))))
}
for(const target of ['https://other.example/careers','//other.example/careers','https://www.thence.digital@other.example/careers','http://www.thence.digital/careers','/careers?account=other','javascript:location.href="https://other.example/"'])test('homepage current careers authority rejects '+target,()=>assert.throws(()=>inspectHomepage(home.replaceAll('href="/careers"','href="'+target.replaceAll('"','&quot;')+'"')),/handoff/))
test('relative careers link alone cannot bypass exact own publisher proof',()=>assert.equal(hasOfficialHomepageSignal('<title>Other</title><a href="/careers">Careers</a>'),false))
test('inert/script relative-careers decoy is not a genuine corporate handoff',()=>{const html=home.replaceAll('href="/careers"','href="/other"');assert.throws(()=>inspectHomepage(html.replace('</body>','<template><a href="/careers">Careers</a></template><script>const candidate="/careers"</script></body>')),/handoff/)})
for(const tag of ['blockquote','pre','code','template'])test('quoted/inert '+tag+' own form is not application-choice evidence',()=>assert.throws(()=>inspectApplicationForm(nodeChange(careers,n=>n.tag==='form'&&n.attrs.id==='job-application-form',raw=>'<'+tag+'>'+raw+'</'+tag+'>')),/form/))
test('selector outside bound own application form is held',()=>{
 const d=document(careers),select=d.nodes(n=>n.tag==='select'&&n.attrs.id==='jaf-select_role')[0],outside=d.outer(select),html=careers.slice(0,select.start)+careers.slice(select.end);assert.throws(()=>inspectApplicationForm(html.replace('</body>',outside+'</body>')),/selector/)
})
for(const [name,change]of[
 ['missing option value',raw=>raw.replace('value="Product Data Analyst"','')],['value/display conflict',raw=>raw.replace('value="Product Data Analyst"','value="Other Role"')],['duplicate role choice',raw=>raw+raw],['malformed blank title',raw=>raw.replace('Product Data Analyst</option>','</option>')]
])test('application choice '+name+' is held',()=>assert.throws(()=>inspectApplicationForm(nodeChange(careers,n=>n.tag==='option'&&n.attrs.value==='Product Data Analyst',change))))
test('source preserves exact decoded title/option and original text entities without inventing criteria',()=>{
 const choices=extractOpenRoles(careers),founder=choices.find(j=>j.title==="Asst. Manager - Founder's Office"),communication=choices.find(j=>j.title==='Senior Manager - Business Content & Communication');assert.ok(founder.sourceNativeApplicationOption.rawDisplayTextFragments.join('').includes('&#x27;'));assert.ok(communication.sourceNativeApplicationOption.rawDisplayTextFragments.join('').includes('&amp;'));assert.ok(choices.every(j=>j.jobDescription===null&&j.experienceRequired===null&&j.employmentType===null&&j.publicExperienceChecked===false&&j.skipPublicExperienceEnrichment===true))
})
test('application-intake salary INR, brochure India and applicant experience remain non-vacancy facts',()=>{assert.match(careers,/Current-CTC-LPA-INR/);assert.match(careers,/India/);const jobs=extractOpenRoles(careers);assert.ok(jobs.every(j=>j.sourceRecordKind==='application-role-choice'&&j.sourceNativeVacancyConfirmed===false&&j.country===null&&j.city===null&&j.location===null&&j.nativeLegalEmployer===null&&j.requisitionId===null));assert.equal(extractionDetailHealth(jobs).missingDescriptions,16)})
for(const index of [0,1])for(const location of ['https://other.example/','http://www.thence.digital/','https://www.thence.digital/#other'])test('redirect authority '+index+' cannot leave reviewed chain '+location,async()=>{
 const r=replay((p,i)=>i===index?{...p,headers:{...p.headers,location}}:p);await assert.rejects(run({fetchImpl:r.fetchImpl}));assert.equal(r.used.length,index+1)
})
for(const index of [0,3,7])test('actual403 stops both local reads and outer retries at packet '+index,async()=>{
 let attempts=0,total=0,last
 await assert.rejects(withRetry(async()=>{attempts++;const r=replay((p,i)=>i===index?{...p,status:403}:p);try{return await run({fetchImpl:async(...args)=>{total++;return r.fetchImpl(...args)}})}catch(e){last=e;throw e}},{attempts:2,baseDelayMs:0,label:'thence-403'}))
 assert.equal(attempts,1);assert.equal(total,index+1);assert.equal(last.status,403);assert.equal(last.abortRetries,true);assert.equal(extractionFailureDetails(last).failureKind,'blocked_or_access_denied');assert.equal(last.nativeEvidence.observedListingCount,null);assert.equal(last.nativeEvidence.retainedResponses[index].rawBodyBase64,live.originalPages[index].rawBodyBase64)
})
test('404 careers page is held and never silently converted into verified empty inventory',async()=>{const r=replay((p,i)=>i===3?{...p,status:404}:p);await assert.rejects(run({fetchImpl:r.fetchImpl}),e=>e.status===404&&e.abortRetries===true);assert.equal(r.used.length,4)})
for(const index of [2,6])test('changed opening/closing corporate current handoff is held at '+index,async()=>{const r=replay((p,i)=>i===index?{...p,body:p.body.toString().replaceAll('href="/careers"','href="/other"')}:p);await assert.rejects(run({fetchImpl:r.fetchImpl}));assert.equal(r.used.length,index+1)})
test('closing option membership/value change cannot return old candidates',async()=>{const r=replay((p,i)=>i===7?{...p,body:p.body.toString().replaceAll('UI Tester','Senior UI Tester')}:p);await assert.rejects(run({fetchImpl:r.fetchImpl}),/closing/);assert.equal(r.used.length,8)})
for(const [name,change]of[
 ['wrong HTTP URL',p=>({...p,finalUrl:'https://other.example/'})],['wrong HTML MIME',p=>({...p,headers:{...p.headers,'content-type':'application/json'}})],['oversized original body',p=>({...p,body:Buffer.alloc(2000001,65)})]
])test('native HTTP metadata/body '+name+' is held',async()=>{const r=replay((p,i)=>i===2?change(p):p);await assert.rejects(run({fetchImpl:r.fetchImpl}));assert.equal(r.used.length,3)})
test('legacy body-only callback cannot fabricate current redirect/native status evidence',async()=>assert.rejects(run({fetchText:async()=>home}),/HTTP response metadata/))
for(const reason of [Object.freeze(Error('frozen caller')),null,'caller-exact'])test('already canceled caller reason is exact '+String(reason),async()=>{const caller=new AbortController();caller.abort(reason);await assert.rejects(run({signal:caller.signal,fetchImpl:()=>assert.fail('no read')}),e=>e===reason)})
test('ignored fetch is raced and late body cleanup runs once',async()=>{
 let resolve,cancels=0;const pending=new Promise(r=>resolve=r),session=createThenceTransport({sourceTimeoutMs:1000,requestTimeoutMs:10,fetchImpl:()=>pending},[])
 try{await assert.rejects(session.read(CAREERS_URL,'html'),e=>e.name==='TimeoutError');resolve({status:200,url:CAREERS_URL,headers:new Headers({'content-type':'text/html'}),body:{cancel(){cancels++}}});await new Promise(r=>setTimeout(r,10));assert.equal(cancels,1)}finally{session.close()}
})
test('ignored acquired reader is canceled/released once on request deadline',async()=>{
 let cancels=0,releases=0;const session=createThenceTransport({sourceTimeoutMs:1000,requestTimeoutMs:10,fetchImpl:async()=>({status:200,url:CAREERS_URL,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancels++},releaseLock(){releases++}})}})},[])
 try{await assert.rejects(session.read(CAREERS_URL,'html'),e=>e.name==='TimeoutError');assert.equal(cancels,1);assert.equal(releases,1)}finally{session.close()}
})
test('source monotonic deadline catches a synchronous ignored callback stall',async()=>{const session=createThenceTransport({sourceTimeoutMs:10,requestTimeoutMs:10},[]);try{await assert.rejects(session.race(()=>{const until=performance.now()+25;while(performance.now()<until){/* Simulate synchronous caller work beyond deadline. */}return true}),e=>e.name==='TimeoutError')}finally{session.close()}})
test('request monotonic deadline catches synchronous fetch stall',async()=>{const session=createThenceTransport({sourceTimeoutMs:1000,requestTimeoutMs:10,fetchImpl:async()=>{const until=performance.now()+25;while(performance.now()<until){/* Simulate a fetch callback that blocks the timer. */}const response=new Response('native',{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:CAREERS_URL});return response}},[]);try{await assert.rejects(session.read(CAREERS_URL,'html'),e=>e.name==='TimeoutError')}finally{session.close()}})
test('ignored source callback is actively raced by source timer',async()=>{const session=createThenceTransport({sourceTimeoutMs:10,requestTimeoutMs:10},[]);try{await assert.rejects(session.race(()=>new Promise(()=>{})),e=>e.name==='TimeoutError')}finally{session.close()}})
test('bounded transport rejects undeclared authority before network',async()=>{const session=createThenceTransport({fetchImpl:()=>assert.fail('no request')},[]);try{await assert.rejects(session.read('https://other.example/','html'),/authority/)}finally{session.close()}})
test('source request budget is independent from duration',async()=>{const session=createThenceTransport({fetchImpl:()=>assert.fail('no request')},Array.from({length:12},()=>({})));try{await assert.rejects(session.read(CAREERS_URL,'html'),/budget/)}finally{session.close()}})
for(const callback of ['fetchResponse','fetchBytes','fetchHtml','fetchJson','fetchPage'])test('unsupported '+callback+' cannot silently fall through to a live request',async()=>assert.rejects(run({[callback]:async()=>careers,fetchImpl:()=>assert.fail('no live request')}),/HTTP response metadata/))
test('already-aborted caller reason takes priority over invalid callback/deadline settings',async()=>{const c=new AbortController(),reason=Object.freeze(Error('exact aborted identity'));c.abort(reason);await assert.rejects(run({signal:c.signal,requestTimeoutMs:0,fetchText:async()=>home}),e=>e===reason)})
test('active in-flight caller cancellation preserves exact identity with ignored fetch',async()=>{const c=new AbortController(),reason=Object.freeze(Error('exact live caller'));const session=createThenceTransport({signal:c.signal,sourceTimeoutMs:1000,requestTimeoutMs:1000,fetchImpl:()=>new Promise(()=>{})},[]);try{const pending=session.read(CAREERS_URL,'html');setTimeout(()=>c.abort(reason),5);await assert.rejects(pending,e=>e===reason)}finally{session.close()}})
test('successful bounded source callback clears its listener and closing stops further reads',async()=>{const session=createThenceTransport({},[]);assert.equal(await session.race(()=>42),42);session.close();assert.throws(()=>session.check())})
for(const status of [200,403])test('non-UTF8 response retains original status and raw bytes before text qualification '+status,async()=>{
 const r=replay((p,i)=>i===2?{...p,status,body:Buffer.from([255])}:p);let failure
 try{await run({fetchImpl:r.fetchImpl});assert.fail('invalid body must hold')}catch(e){failure=e}
 const packet=failure.nativeEvidence.retainedResponses[2];assert.equal(packet.status,status);assert.equal(packet.rawBodyBase64,'/w==');assert.equal(packet.bodyBytes,1);assert.equal(packet.bodySHA256,createHash('sha256').update(Buffer.from([255])).digest('hex'));if(status===403)assert.equal(extractionFailureDetails(failure).failureKind,'blocked_or_access_denied')
})
test('actual single enrichment consumers preserve all16 unknown native requirements without any raw/JSON/browser request',async()=>{
 const provider={source:'thence',companyName:'Thence Private Limited',countryFilter:'India'},raw=extractOpenRoles(careers),normalized=raw.map(j=>normalizeScrapedJob(j,provider)),requests={raw:0,json:0,browser:0,global:0},originalFetch=globalThis.fetch
 globalThis.fetch=async()=>{requests.global++;throw Error('No real network allowed')}
 const options={fetchText:async url=>{requests.raw++;return{status:200,url,html:careers}},fetchJson:async()=>{requests.json++;throw Error('No native JSON')},fetchBrowserText:async url=>{requests.browser++;return{status:200,url,html:careers}}}
 try{for(const job of [...raw,...normalized]){const enriched=await enrichJobWithPublicExperience(job,options);assert.equal(enriched.experienceRequired,null,job.title);assert.equal(enriched.sourceExperienceRequired??null,null);assert.equal(enriched.jobDescription,null);assert.equal(enriched.country,null);assert.equal(enriched.requisitionId,null);assert.equal(enriched.publicExperienceChecked,false);assert.equal(enriched.skipPublicExperienceEnrichment,true);assert.equal(enriched.sourceExperienceScopeUnresolved,true)}assert.deepEqual(requests,{raw:0,json:0,browser:0,global:0})}finally{globalThis.fetch=originalFetch}
})
test('actual bulk enrichment preserves all16 normalized choices including UX Intern without native requirement promotion or requests',async()=>{
 const raw=extractOpenRoles(careers),normalized=raw.map(j=>normalizeScrapedJob(j,{source:'thence',companyName:'Thence Private Limited',countryFilter:'India'})),requests={raw:0,json:0,browser:0,global:0},originalFetch=globalThis.fetch
 globalThis.fetch=async()=>{requests.global++;throw Error('No real network allowed')}
 try{for(const jobs of[raw,normalized]){const enriched=await enrichJobsWithPublicExperience(jobs,{fetchText:async url=>{requests.raw++;return{status:200,url,html:careers}},fetchJson:async()=>{requests.json++;throw Error('No native JSON')},fetchBrowserText:async url=>{requests.browser++;return{status:200,url,html:careers}}});assert.equal(enriched.length,16);assert.ok(enriched.some(j=>j.title==='UX Intern'));for(const job of enriched){assert.equal(job.experienceRequired,null,job.title);assert.equal(job.sourceExperienceRequired??null,null);assert.equal(job.jobDescription,null);assert.equal(job.country,null);assert.equal(job.requisitionId,null);assert.equal(job.publicExperienceChecked,false);assert.equal(job.sourceExperienceScopeUnresolved,true)}assert.equal(analyzePublishableJobs(enriched).indiaJobs.length,0)}assert.deepEqual(requests,{raw:0,json:0,browser:0,global:0})}finally{globalThis.fetch=originalFetch}
})
