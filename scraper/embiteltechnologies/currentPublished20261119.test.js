import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{embitelPublishedRole,runEmbitelPublished}from'./currentPublished20261119.js'
const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const body=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8'),rows=JSON.parse(body(f.responses.find(r=>r.method==='POST'))).data,row=rows[0]
const execute=(mutate,extra={})=>{const counts=new Map();return runEmbitelPublished({...extra,requestIntervalMs:0,fetchImpl:async(u,init)=>{assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');const n=counts.get(u)||0;counts.set(u,n+1);const p=f.responses.filter(r=>r.requestedUrl===u)[n];assert.ok(p,'Unexpected native read '+u);assert.equal(init.method,p.method);const b=mutate?mutate(body(p),u,n):body(p);const r=new Response(b,{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.url});return r}})}
test('Embitel retains actual published designation, native posting identity, original partial criteria and unspecified timestamp semantics',()=>{
 const job=embitelPublishedRole(row);assert.equal(job.title,row.designation);assert.equal(job.jobId,row.jobpostingID);assert.equal(job.country,'India');assert.equal(job.sourceNativeRecord,row);assert.equal(job.postingDate,null);assert.equal(job.sourceNativeDates.timestamp,row.timestamp);assert.equal(job.sourceDetailComplete,false);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceNativeAvailability.delegatedATSCanApplyVerified,false)
})

test('Embitel retains independently qualified publications with missing authored criteria as explicit unpadded partial records',async()=>{
 const original={...row,jobdescription:''},job=embitelPublishedRole(original)
 assert.equal(job.sourceNativeRecord,original);assert.equal(job.sourceDescription,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailStatus,'partial');assert.equal(job.sourceCriteriaStatus,'missing')
 const jobs=await execute((s,u)=>{if(!u.endsWith('/admin-ajax.php'))return s;const model=JSON.parse(s);for(const r of model.data)if(r.jobpostingID===row.jobpostingID)r.jobdescription='';return JSON.stringify(model)})
 assert.ok(jobs.some(j=>j.jobId===row.jobpostingID&&j.sourceDescription===null&&j.sourceCriteriaStatus==='missing'))
})

test('Embitel respects authored expiry without inventing native timestamp semantics and retains future expiry values exactly',()=>{
 const observed='2026-11-19T18:00:00.000Z'
 for(const field of['validThrough','closingDate','applicationDeadline','dateExpires'])assert.throws(()=>embitelPublishedRole({...row,[field]:'2020-01-01'},observed),/expir|clos/i)
 const original={...row,validThrough:'2026-12-31'},job=embitelPublishedRole(original,observed)
 assert.equal(job.closingDate,'2026-12-31');assert.equal(job.postingDate,null);assert.equal(job.sourceNativeDates.timestamp,row.timestamp);assert.deepEqual(job.sourceNativeDates.recognizedExpiryFields,[{scope:'publication',field:'validThrough',value:'2026-12-31'}]);assert.equal(job.sourceNativeRecord,original)
 assert.throws(()=>embitelPublishedRole({...row,validThrough:'not a date'},observed),/expir|date/i)
})

test('Embitel holds newly explicit availability, structured workplace-country and employer contradictions even without criteria',()=>{
 for(const patch of[{canApply:false},{isActive:false},{status:'Closed'},{jobLocation:{address:{addressCountry:'US'}}},{hiringOrganization:{name:'Other Employer'}},{employer:'Other Employer'}]){
  assert.throws(()=>embitelPublishedRole({...row,...patch}),/availability|country|employer/i)
  assert.throws(()=>embitelPublishedRole({...row,jobdescription:'',...patch}),/availability|country|employer/i)
 }
})
test('Embitel does not infer a country from BLR office prefixes or permit foreign/unpublished/employer-route contradictions',()=>{
 for(const patch of[{location:'BLR-SJR-I Park Mobius Unit 2 (Floor 3)'},{location:'Bangalore, United States'},{posted:'N'},{job_url:row.job_url.replace('Embitel_Technologies','Other_Company')},{jobdescription:row.jobdescription+'<p>Country: Germany</p>'},{jobdescription:row.jobdescription+'<p>This position has been filled.</p>'}])assert.throws(()=>embitelPublishedRole({...row,...patch}))
})
test('Embitel closes the full own published model across all declared BU pages and retains duplicate application conflicts without inventing native ATS completion',async()=>{
 const jobs=await execute();assert.ok(jobs.length>300);assert.ok(jobs.every(j=>j.sourceClosingQualified&&j.country==='India'&&j.sourceDetailComplete===false));const a=jobs.nativeCollectionEvidence;assert.ok(a.openingNativeRecords.length>370);assert.deepEqual(a.openingNativeRecords,a.closingNativeRecords);assert.equal(a.publisherBoards.length,5);assert.ok(a.held.some(x=>x.reason.includes('duplicate')));assert.ok(a.held.some(x=>x.reason.includes('workplace')));assert.equal(a.companyIndiaTotal,null);assert.equal(a.sourceScopeComplete,false)
})
test('Embitel rejects changed closing full native criteria and never turns an unknown inventory into zero',async()=>{
 await assert.rejects(execute((s,u,n)=>n===1&&u.endsWith('/admin-ajax.php')?s.replace('Should have experience with Autosar','Changed experience with Autosar'):s),/closing/)
 await assert.rejects(execute((s,u)=>u.endsWith('/admin-ajax.php')?'{}':s),/inventory|handoff/)
})
test('Embitel propagates cancellation and refuses metadata-free positive transports',async()=>{
 const c=new AbortController();c.abort(Error('caller cancelled'));await assert.rejects(runEmbitelPublished({signal:c.signal}),/caller cancelled/);await assert.rejects(runEmbitelPublished({fetchJson:async()=>({})}),/metadata/)
})
