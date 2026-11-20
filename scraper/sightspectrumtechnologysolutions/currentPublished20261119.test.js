import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{readSightPublishedPage,sightPublishedRole,runSightPublished}from'./currentPublished20261119.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url)))),text=r=>Buffer.from(r.bodyBase64,'base64').toString(),page=readSightPublishedPage(text(fixture.responses[0])),jobs=JSON.parse(text(fixture.responses[3])),item=jobs.dataItems[0],observedAt='2026-11-19T18:00:00Z'
function replay(change,extra={}){const counts=new Map();return runSightPublished({requestIntervalMs:0,now:()=>observedAt,...extra,fetchImpl:async(u,init)=>{assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');const n=counts.get(u)||0;counts.set(u,n+1);const r=fixture.responses.filter(r=>r.requestedUrl===u)[n];assert.ok(r,'Only current native reads '+u);if(u.includes('/items/query?'))assert.ok(init.headers.Authorization,'Current anonymous public site/app instance binds GET');const response=new Response(change?change(text(r),u,n):text(r),{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response}})}
test('SightSpectrum binds actual native Wix record ID, same-role Chennai publication/schema and declared Apply control with explicit partial limits',()=>{
 const job=sightPublishedRole(item,{page,observedAt});assert.equal(job.jobId,item.id);assert.equal(job.requisitionId,null);assert.equal(job.country,'India');assert.equal(job.location,'chennai');assert.equal(job.sourceNativeRecord,item);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceNativeApplication.jobId,item.id);assert.equal(job.sourceNativeApplication.activationVerified,false);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.postingDate,'2026-04-28T07:08:59.051Z')
})
test('SightSpectrum preserves the real UI/UX versus frontend authored discrepancy as partial and does not pad missing criteria',()=>{
 const mismatch=sightPublishedRole(jobs.dataItems[1],{page,observedAt});assert.equal(mismatch.title,'UI/UX Designer');assert.match(mismatch.sourceDescription,/Frontend Engineer/);assert.equal(mismatch.sourceCriteriaConflict,true);assert.equal(mismatch.sourceDetailComplete,false)
 const missing={...item,data:{...item.data,description:null}},job=sightPublishedRole(missing,{page,observedAt});assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceNativeRecord,missing);assert.equal(job.sourceNativeDescription,null)
})
test('SightSpectrum holds archived/expired/foreign/employer/application contradictions while retaining original native models',()=>{
 for(const patch of[{status:'archived'},{publicTo:'2020-01-01'},{validThrough:'2020-01-01'},{country:'United States'},{hiringOrganization:{name:'Other Employer'}},{description:'<p>Location: Boston, United States</p>'},{description:'<p>This position has been filled.</p>'}])assert.throws(()=>sightPublishedRole({...item,data:{...item.data,...patch}},{page,observedAt}))
 const changed=structuredClone(page);changed.roles.find(r=>r.id===item.id).apply.disabled=true;assert.throws(()=>sightPublishedRole(item,{page:changed,observedAt}),/application|Apply/)
})
test('SightSpectrum reads complete own anonymous native GET models twice and preserves all publication dates without company cleanup',async()=>{
 const result=await replay();assert.equal(result.length,2);assert.ok(result.every(j=>j.sourceClosingQualified&&j.country==='India'&&j.sourceDetailComplete===false));const a=result.nativeCollectionEvidence;assert.equal(a.openingNativeRecords.length,2);assert.equal(a.closingNativeRecords.length,2);assert.equal(a.originalResponses.length,8);assert.equal(a.companyIndiaTotal,null);assert.equal(a.lifecycleCleanupAllowed,false)
})
test('SightSpectrum holds changed closing native records and refuses truncated models, metadata-free transport and opaque caller abort',async()=>{
 const changed=await replay((s,u,n)=>u===fixture.responses[3].requestedUrl&&n===1?JSON.stringify({...JSON.parse(s),dataItems:JSON.parse(s).dataItems.map((r,i)=>i? r:{...r,data:{...r.data,description:'Changed complete native model'}})}):s);assert.equal(changed.length,1);assert.equal(changed.nativeCollectionEvidence.held.length,1)
 await assert.rejects(replay((s,u)=>u===fixture.responses[3].requestedUrl?JSON.stringify({...JSON.parse(s),pagingMetadata:{...JSON.parse(s).pagingMetadata,total:20}}):s),/pagination|count|total/)
 await assert.rejects(runSightPublished({fetchText:async()=>''}),/metadata/)
 const c=new AbortController(),reason={cancel:'caller'};c.abort(reason);await assert.rejects(runSightPublished({signal:c.signal}),e=>e===reason)
})

test('SightSpectrum qualifies explicit native negative flags and short criteria before retaining partial publications',()=>{
 for(const patch of[{isClosed:true},{archived:true},{shortDescription:'<p>This position has been filled.</p>'}])assert.throws(()=>sightPublishedRole({...item,data:{...item.data,...patch}},{page,observedAt}),/closed|availability/i)
 const partial={...item,data:{...item.data,shortDescription:'Native short criteria retained verbatim'}},job=sightPublishedRole(partial,{page,observedAt});assert.equal(job.sourceNativeShortDescription,partial.data.shortDescription);assert.ok(job.sourceNativeVisibleRole.model);assert.match(job.sourceNativeVisibleRole.text,/Strong SQL and Python/)
})

test('SightSpectrum holds an actual same-role SSR criteria closure while preserving the other independent role',async()=>{
 const result=await replay((s,u)=>u==='https://www.sightspectrum.com/careers'?s.replace('Build and manage scalable data pipelines and infrastructure to support analytics and business insights.','This position has been filled.'):s)
 assert.equal(result.length,1);assert.notEqual(result[0].jobId,item.id);assert.equal(result.nativeCollectionEvidence.held.length,1);assert.match(result.nativeCollectionEvidence.held[0].reason,/closed/)
})
