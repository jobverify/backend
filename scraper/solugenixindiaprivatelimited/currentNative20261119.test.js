import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {solugenixRole,solugenixStableModel,runSolugenixNative} from './currentNative20261119.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const body=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
const feed=JSON.parse(body(fixture.responses.find(r=>r.requestedUrl.endsWith('?page=1')))).results[0]
const details=fixture.responses.filter(r=>r.requestedUrl.includes('/'+feed.id+'/'))
const model=JSON.parse(body(details[0]))
const execute=(mutate,extra={})=>{const counts=new Map();return runSolugenixNative({...extra,requestIntervalMs:0,fetchImpl:async(u,init)=>{
 const n=counts.get(u)||0;counts.set(u,n+1);const row=fixture.responses.filter(r=>r.requestedUrl===u)[n];assert.ok(row,'Unexpected public read '+u)
 assert.equal(init.method,row.method);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
 const r=new Response(mutate?mutate(body(row),u,n):body(row),{status:row.status,headers:row.headers});Object.defineProperty(r,'url',{value:row.url});return r
}})}
test('Solugenix qualifies complete native descriptions and retains the publisher without inventing the configured regional legal entity',()=>{
 const job=solugenixRole(feed,model);assert.equal(job.country,'India');assert.equal(job.company,'Solugenix');assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceNativePortalProvider,'Solugenix Corporation');assert.equal(job.jobId,feed.id);assert.equal(job.requisitionId,feed.job_code);assert.ok(job.jobDescription.includes('Build and maintain AI-powered tools'));assert.ok(job.jobDescription.length>feed.public_job_desc.length);assert.equal(job.postingDate,null);assert.equal(job.sourceNativeDetailRecord,model)
})
test('Solugenix closing comparison retains complete models and normalizes only the three observed generated public application wrappers',()=>{
 assert.deepEqual(solugenixStableModel(model),solugenixStableModel(JSON.parse(body(details[1]))))
 const changed=structuredClone(model);changed.form_fields.standard_fields[0].is_required=0;assert.notDeepEqual(solugenixStableModel(model),solugenixStableModel(changed))
 assert.throws(()=>solugenixStableModel({...model,apply_job:'https://other.example/login/x/y'}),/application/)
})
test('Solugenix refuses country, employer, title, unavailable full descriptions and explicit closure conflicts',()=>{
 for(const patch of [{country:'United States'},{company_url:'other.example'},{public_job_title:'Other Role'},{public_job_desc:feed.public_job_desc},{public_job_desc:model.public_job_desc+'<p>This position has been filled.</p>'},{public_job_desc:model.public_job_desc+'<p>Country: United States</p>'},{public_job_desc:model.public_job_desc+'<p>Location: New York, United States</p>'}])assert.throws(()=>solugenixRole(feed,{...model,...patch}))
})
test('Solugenix fully paginates and closes every own India model, original foreign records and application form definition',async()=>{
 const jobs=await execute();assert.ok(jobs.length>=30);assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.sourceClosingQualified&&j.country==='India'))
 const e=jobs.nativeCollectionEvidence;assert.equal(e.openingNativeRecords.length,60);assert.equal(e.openingDetailModels.length,40);assert.equal(e.closingDetailModels.length,40);assert.equal(e.companyIndiaTotal,null);assert.equal(e.sourceScopeComplete,false);assert.equal(e.openingClosingMatch,true)
})
test('Solugenix rejects full closing criteria/form drift and truncated pagination rather than publishing partial inventory',async()=>{
 await assert.rejects(execute((s,u,n)=>n===1&&u.includes('/'+feed.id+'/')?s.replace('Build and maintain AI-powered tools','Build and maintain changed tools'):s),/closing/)
 await assert.rejects(execute((s,u)=>u.endsWith('?page=1')?JSON.stringify({...JSON.parse(s),num_pages:1}):s),/pagination/)
})
test('Solugenix propagates caller cancellation and rejects metadata-free old callback injection',async()=>{
 const c=new AbortController();c.abort(Error('caller cancelled'));await assert.rejects(runSolugenixNative({signal:c.signal}),/caller cancelled/)
 await assert.rejects(runSolugenixNative({fetchJson:async()=>({})}),/metadata/)
})
