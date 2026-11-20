import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{document}from'../../scraper-support/shared/rmkNativePairHtml.js'
import{readCurrentAsipListings}from'./currentNative.js'
import{asipQualifiedDetail,runAsipQualified}from'./currentQualified20261119.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url)))),body=r=>Buffer.from(r.bodyBase64,'base64').toString(),rows=readCurrentAsipListings(body(fixture.responses[0])),row=rows[0],html=body(fixture.responses[1]),now='2026-11-19T18:00:00Z'
const schema=(html,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,a,b,c)=>{const record=JSON.parse(b);return record['@type']==='JobPosting'?a+JSON.stringify(change(record))+c:all})
function replay(change,extra={}){const counts=new Map();return runAsipQualified({now:()=>now,requestIntervalMs:0,...extra,fetchImpl:async(u,init)=>{assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');const n=counts.get(u)||0;counts.set(u,n+1);const r=fixture.responses.filter(r=>r.requestedUrl===u)[n];assert.ok(r,'Only declared native URL '+u);const response=new Response(change?change(body(r),u,n):body(r),{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response}})}
test('ASIP preserves current whole Hyderabad fields without choosing India over Pakistan and retains actual numeric application identity and dates',()=>{
 const job=asipQualifiedDetail(html,row,{observedAt:now});assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.jobId,'326');assert.equal(job.requisitionId,null);assert.equal(job.postingDate,'2025-02-27T16:27:38+00:00');assert.equal(job.sourceNativeApplication.jobId,'326');assert.equal(job.sourceNativeApplication.activationVerified,false);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceDetailComplete,true)
})
test('ASIP requires a same-role explicit country to disambiguate Hyderabad rather than borrowing the footer address',()=>{
 const typed=schema(html,p=>({...p,jobLocation:{'@type':'Place',address:{addressLocality:'Hyderabad',addressCountry:'IN'}}})),job=asipQualifiedDetail(typed,row,{observedAt:now});assert.equal(job.country,'India');assert.equal(job.sourceCountryScopeUnresolved,false)
})
test('ASIP preserves missing or differing authored criteria as explicit partial records with both original descriptions',()=>{
 const doc=document(html),content=doc.nodes(n=>doc.hasClass(n,'awsm-job-entry-content'))[0],original=doc.inner(content)
 const missing=schema(html.replace(original,''),p=>({...p,description:''})),job=asipQualifiedDetail(missing,row,{observedAt:now})
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailStatus,'partial');assert.equal(job.sourceDescription,null)
 const mismatch=asipQualifiedDetail(schema(html,p=>({...p,description:'<p>Different authored criteria</p>'})),row,{observedAt:now});assert.equal(mismatch.sourceDetailComplete,false);assert.equal(mismatch.sourceCriteriaConflict,true);assert.match(mismatch.sourceNativeSchemaDescription,/Different/);assert.equal(mismatch.sourceNativeDescriptionHTML,original)
})
test('ASIP preserves identical hidden mandatory criteria as unreviewed partial instead of claiming all source criteria are complete',()=>{
 const hidden='<p hidden>Mandatory qualification: concealed native criterion.</p>',doc=document(html),raw=doc.inner(doc.nodes(n=>doc.hasClass(n,'awsm-job-entry-content'))[0]),changed=schema(html.replace(raw,raw+hidden),p=>({...p,description:p.description+hidden})),job=asipQualifiedDetail(changed,row,{observedAt:now})
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceCriteriaVisibilityUnreviewed,true);assert.match(job.sourceNativeDescriptionHTML,/concealed/);assert.match(job.sourceNativeSchemaDescription,/concealed/)
})
test('ASIP holds office aliases, foreign/other-employer/expired/closed records and drifting same-role forms',()=>{
 for(const change of[p=>({...p,jobLocation:{'@type':'Place',address:'Hyderabad Office'}}),p=>({...p,jobLocation:{'@type':'Place',address:{addressLocality:'Hyderabad',addressCountry:'US'}}}),p=>({...p,hiringOrganization:{...p.hiringOrganization,name:'Other Employer'}}),p=>({...p,validThrough:'2020-01-01'}),p=>({...p,canApply:false}),p=>({...p,description:p.description+'<p>Country: Canada</p>'})])assert.throws(()=>asipQualifiedDetail(schema(html,change),row,{observedAt:now}))
 assert.throws(()=>asipQualifiedDetail(html.replace('name="awsm_job_id" value="326"','name="awsm_job_id" value="999"'),row,{observedAt:now}),/application|identity/i)
 assert.throws(()=>asipQualifiedDetail(html.replace('action="awsm_applicant_form_submission"','action="other_submission"').replace('value="awsm_applicant_form_submission"','value="other_submission"'),row,{observedAt:now}),/application/i)
})
test('ASIP closes every current full role/form and keeps company coverage and cleanup unqualified',async()=>{
 const jobs=await replay();assert.equal(jobs.length,0);const a=jobs.nativeCollectionEvidence;assert.equal(a.observations.length,4);assert.ok(a.observations.every(j=>j.sourceClosingQualified&&j.country===null));assert.equal(a.held.length,4);assert.equal(a.openingRecords.length,4);assert.equal(a.closingRecords.length,4);assert.equal(a.originalResponses.length,10);assert.equal(a.companyIndiaTotal,null);assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false)
})
test('ASIP holds only changed closing criteria and refuses unknown inventory or metadata-free transport',async()=>{
 const jobs=await replay((s,u,n)=>u.includes('/career/')?schema(s,p=>({...p,jobLocation:{'@type':'Place',address:{addressLocality:'Hyderabad',addressCountry:'IN'}},...(u===row.sourceUrl&&n===1?{description:p.description.replace('Production Management','Changed Production Management')}: {})})):s);assert.equal(jobs.length,3);assert.ok(!jobs.some(j=>j.jobId===row.jobId));assert.equal(jobs.nativeCollectionEvidence.held.length,1)
 await assert.rejects(runAsipQualified({fetchText:async()=>html}),/metadata/)
 const c=new AbortController(),reason={cancel:'caller'};c.abort(reason);await assert.rejects(runAsipQualified({signal:c.signal}),e=>e===reason)
})
test('ASIP holds disabled public applications and explicit job-scoped closure banners independently of missing criteria',()=>{
 for(const changed of[html.replace('name="form_sub"','disabled name="form_sub"'),html.replace('<form id="awsm-application-form"','<form aria-disabled="true" id="awsm-application-form"'),html.replace('<div class="awsm-job-container">','<div class="awsm-job-container"><p>This position has been filled.</p>')])assert.throws(()=>asipQualifiedDetail(changed,row,{observedAt:now}),/application|closed/i)
})
test('ASIP caller cancellation settles an audit observer that never resolves',async()=>{
 const controller=new AbortController(),reason={cancel:'observer'},pending=replay(undefined,{timeoutMs:200,signal:controller.signal,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})
 const outcome=await Promise.race([pending.then(()=>null,e=>e),new Promise(resolve=>setTimeout(()=>resolve('still pending'),250))]);assert.equal(outcome,reason)
})
