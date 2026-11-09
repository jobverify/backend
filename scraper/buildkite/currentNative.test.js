import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCurrentGreenhouseScraper} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=source=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/native-current-20261103.json.gz',import.meta.url))))
const replay=(source,mutate=()=>{})=>{const f=fixture(source),rows=new Map(f.responses.map(r=>[r.url,r])),requests=[],visits=new Map();return{requests,options:{fetchPage:async(url,context)=>{requests.push(url);const r=rows.get(url);assert.ok(r,'Original declared public entity: '+url);const page={url:r.finalUrl,status:r.status,headers:r.headers,bodyBase64:r.bodyBase64};const visit=(visits.get(url)||0)+1;visits.set(url,visit);await mutate(url,page,visit,context);return page}}}}
const changeJSON=(page,visit)=>{const value=JSON.parse(Buffer.from(page.bodyBase64,'base64'));visit(value);page.bodyBase64=Buffer.from(JSON.stringify(value)).toString('base64')}
test('Tripadvisor reconciles 81 complete public vacancies and one separate prospect with India zero on its configured board',async()=>{
 const r=replay('tripadvisor'),jobs=await createCurrentGreenhouseScraper('tripadvisor').run(r.options),a=jobs.sourceAudit,e=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(e.status,'complete-inventory');assert.equal(e.listingComplete,true);assert.equal(e.reportedTotal,81);assert.equal(e.indiaFacetCount,0)
 assert.equal(a.observations.length,82);assert.equal(a.observations.filter(row=>row.sourcePublicWorkCountryProof).length,7);assert.equal(a.nativeVacancyCount,81);assert.equal(a.nativeProspectCount,1)
 assert.equal(a.companyGlobalTotal,null);assert.equal(a.companyIndiaTotal,null);assert.equal(a.lifecycleCleanupAllowed,false)
 assert.equal(readSourceObservationEvidence(jobs,'tripadvisor').observedRecordCount,82);assert.equal(readSourceObservationEvidence(jobs,'tripadvisor').observedVacancyCount,81)
 assert.ok(a.observations.every(row=>row.sourceNativeRecord));assert.ok(a.observations.find(row=>row.jobId==='8083515').sourcePublicWorkCountryProof.countries.includes('Poland'))
 const lastOwn=r.requests.map((url,index)=>/\/jobs\/\d+\?pay_transparency=true$/.test(url)?index:-1).reduce((a,b)=>Math.max(a,b),-1)
 assert.ok(r.requests.lastIndexOf('https://boards-api.greenhouse.io/v1/boards/tripadvisor/jobs?content=true')>lastOwn)
})
test('Buildkite retains three genuine ANZ/timezone country gaps and all eight full descriptions',async()=>{
 const r=replay('buildkite'),jobs=await createCurrentGreenhouseScraper('buildkite').run(r.options),a=jobs.sourceAudit,e=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null)
 assert.equal(a.nativeVacancyCount,8);assert.equal(a.observations.filter(r=>r.sourcePublicWorkCountryProof).length,2);assert.equal(a.observations.filter(r=>r.sourceConfiguredBoardRoleQualified===false).length,3);assert.equal(a.observations.filter(r=>r.jobDescription).length,8)
})
test('final listing follows closing detail reads and holds a role removed during those reads',async()=>{
 const r=replay('tripadvisor',(url,page,visit)=>{if(url.endsWith('/jobs?content=true')&&visit===3)changeJSON(page,v=>{v.jobs=v.jobs.filter(r=>r.id!==7964563);v.meta.total=v.jobs.length})}),jobs=await createCurrentGreenhouseScraper('tripadvisor').run(r.options)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs.sourceAudit.observations.find(r=>r.jobId==='7964563').sourceConfiguredBoardRoleQualified,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
test('closing own criteria changes hold only that role while retaining both original bodies',async()=>{
 const r=replay('tripadvisor',(url,page,visit)=>{if(url.includes('/jobs/7964563?')&&visit===2)changeJSON(page,v=>{v.content+='<p>A newly published role condition.</p>'})}),jobs=await createCurrentGreenhouseScraper('tripadvisor').run(r.options)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs.sourceAudit.observations.filter(r=>r.sourceNativePostKind==='job'&&!r.sourceConfiguredBoardRoleQualified).length,1)
 assert.equal(jobs.sourceAudit.nativeAudit.observationHistory.length,82)
})
test('private application consent and opt-out fields remain raw evidence without gating complete public JDs',async()=>{
 const r=replay('tripadvisor',(url,page,visit)=>{if(visit>=2&&(url.endsWith('/jobs?content=true')||url.includes('/jobs/7964563?')))changeJSON(page,value=>{const row=value.jobs?.find(row=>row.id===7964563)||value;row.data_compliance=[{type:'changed-private-application-consent'}];row.ai_opt_out_request_url='https://example.invalid/private-request-not-fetched'})}),jobs=await createCurrentGreenhouseScraper('tripadvisor').run(r.options)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(jobs.sourceAudit.observations.find(r=>r.jobId==='7964563').sourceNativeRecord.data_compliance[0].type,'changed-private-application-consent');assert.ok(r.requests.every(url=>!url.includes('private-request')))
})
test('unrelated private form presentation changes do not become public vacancy prerequisites',async()=>{
 const r=replay('tripadvisor',(url,page)=>{if(url.startsWith('https://careers.tripadvisor.com/'))page.bodyBase64=Buffer.from(Buffer.from(page.bodyBase64,'base64').toString('utf8').replace('function renderSelectedFile() {','function renderSelectedFile() { throw new Error("Private form changed");')).toString('base64')}),jobs=await createCurrentGreenhouseScraper('tripadvisor').run(r.options)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('missing detail remains a per-role gap and preserves healthy peers in original native observations',async()=>{
 const r=replay('tripadvisor',(url,page)=>{if(url.includes('/jobs/7964563?')){page.status=404;page.bodyBase64=Buffer.from('Not found').toString('base64')}}),jobs=await createCurrentGreenhouseScraper('tripadvisor').run(r.options)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs.sourceAudit.observations.filter(r=>r.sourceNativeDetailQualified).length,81);assert.equal(jobs.sourceAudit.observations.length,82)
})
test('unparseable own public description is held per role without discarding healthy native peers',async()=>{
 const r=replay('tripadvisor',(url,page)=>{if(url.includes('/jobs/7964563?'))changeJSON(page,value=>{value.content='<meta name="bad" name="duplicate"><p>Unqualified public description</p>'})}),jobs=await createCurrentGreenhouseScraper('tripadvisor').run(r.options)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs.sourceAudit.observations.length,82);assert.equal(jobs.sourceAudit.observations.filter(r=>r.sourceNativeDetailQualified).length,81);assert.match(jobs.sourceAudit.observations.find(r=>r.jobId==='7964563').sourceNativeRecord.content,/duplicate/)
})
test('a new unambiguous India role keeps the complete own JD, original publication date and maxJobs zero compatibility',async()=>{
 const r=replay('buildkite',(url,page)=>{if(!url.startsWith('https://boards-api.'))return;changeJSON(page,value=>{const walk=node=>{if(!node||typeof node!=='object')return;if(node.id===4007134008){node.name='India';node.location='India'}if(node.id===5399250008&&typeof node.content==='string')node.content=node.content.replace('Australia, New Zealand or USA (West Coast only at this stage)','India');for(const item of Object.values(node))if(Array.isArray(item))for(const child of item)walk(child);else if(item&&typeof item==='object')walk(item)};walk(value)})})
 const jobs=await createCurrentGreenhouseScraper('buildkite').run({...r.options,maxJobs:0});assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'5399250008');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceDescription,jobs[0].sourceNativeRecord.content);assert.equal(jobs[0].sourcePostingDate,jobs[0].sourceNativeRecord.first_published);assert.notEqual(jobs[0].sourcePostingDate,jobs[0].sourceNativeRecord.updated_at)
})
test('denied host is never retried through another native path',async()=>{
 const r=replay('buildkite',(url,page)=>{if(new URL(url).hostname==='boards-api.greenhouse.io'){page.status=403;page.bodyBase64=Buffer.from('Forbidden').toString('base64')}}),jobs=await createCurrentGreenhouseScraper('buildkite').run(r.options)
 assert.equal(r.requests.filter(url=>new URL(url).hostname==='boards-api.greenhouse.io').length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('caller abort preserves opaque reason even when the reader ignores cancellation',async()=>{
 const controller=new AbortController(),reason={opaque:true},pending=createCurrentGreenhouseScraper('buildkite').run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})});setTimeout(()=>controller.abort(reason),5);await assert.rejects(pending,error=>error===reason)
})
test('collection deadline bounds ignored readers and asynchronous observers',async()=>{
 await assert.rejects(createCurrentGreenhouseScraper('buildkite').run({collectionTimeoutMs:20,fetchPage:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
 const r=replay('buildkite');await assert.rejects(createCurrentGreenhouseScraper('buildkite').run({...r.options,collectionTimeoutMs:100,onAudit:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
})
test('asynchronous observer rejections are awaited and retain their identity',async()=>{
 const r=replay('buildkite'),failure=Error('observer rejected');await assert.rejects(createCurrentGreenhouseScraper('buildkite').run({...r.options,onAudit:async()=>{throw failure}}),error=>error===failure)
})
test('invalid initial clock rejects before allocating a collection timer',async()=>{
 const original=setTimeout,active=[];globalThis.setTimeout=(fn,ms,...args)=>{const timer=original(fn,ms,...args);active.push(timer);return timer}
 try{await assert.rejects(createCurrentGreenhouseScraper('buildkite').run({now:()=> 'invalid clock'}),/invalid collection clock/);assert.equal(active.length,0)}finally{globalThis.setTimeout=original;for(const timer of active)clearTimeout(timer)}
})
test('default reader body waits obey caller cancellation and preserve the opaque reason',async()=>{
 const controller=new AbortController(),reason={original:true};let observedSignal
 const pending=createCurrentGreenhouseScraper('buildkite').run({signal:controller.signal,fetchImpl:async(url,options)=>{observedSignal=options.signal;return{url,status:200,headers:new Headers({'content-type':'text/html'}),arrayBuffer:()=>new Promise(()=>{})}}});setTimeout(()=>controller.abort(reason),5)
 await assert.rejects(pending,error=>error===reason);assert.equal(observedSignal.aborted,true)
})
