import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{industryRole,runIndustryNative}from'./currentNative20261119.js'
const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const body=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8'),api='https://careers.industrybuying.com/api/career/jobs'
const list=JSON.parse(body(f.responses.find(r=>r.requestedUrl.includes('?orgId=')))).data,row=list.find(r=>r.location==='Navi Mumbai'),detail=JSON.parse(body(f.responses.find(r=>r.requestedUrl===api+'?id='+row.id))).data
const execute=(mutate,extra={})=>{const counts=new Map();return runIndustryNative({...extra,requestIntervalMs:0,fetchImpl:async(u,init)=>{assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');const n=counts.get(u)||0;counts.set(u,n+1);const r=f.responses.filter(r=>r.requestedUrl===u)[n];assert.ok(r,'Unexpected public read '+u);const response=new Response(mutate?mutate(body(r),u,n):body(r),{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response}})}
test('Industrybuying qualifies the exact same-role municipal workplace and preserves every native identity, criterion and date',()=>{
 const job=industryRole(row,detail);assert.equal(job.country,'India');assert.equal(job.city,'Navi Mumbai');assert.equal(job.jobId,row.id);assert.equal(job.requisitionId,row.requisitionId);assert.equal(job.sourceNativeDetailRecord,detail);assert.match(job.sourceDescription,/Delhi\/Pune\/Bangalore/);assert.equal(job.postingDate,'2026-11-17');assert.equal(job.nativeLegalEmployer,null)
})

test('Industrybuying retains independently qualified own native roles with missing authored criteria as unpadded partial records',async()=>{
 const original={...detail,jobDescription:''},job=industryRole(row,original)
 assert.equal(job.sourceNativeDetailRecord,original);assert.equal(job.sourceDescription,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailStatus,'partial');assert.equal(job.sourceDetailFailureKind,'native-authored-criteria-unavailable')
 const jobs=await execute((s,u)=>{if(u!==api+'?id='+row.id)return s;const model=JSON.parse(s);model.data.jobDescription='';return JSON.stringify(model)})
 assert.equal(jobs.length,2);assert.ok(jobs.some(j=>j.jobId===row.id&&j.sourceDescription===null&&j.sourceDetailComplete===false))
})

test('Industrybuying respects expiry on either original model and retains an actual future deadline verbatim',()=>{
 const observed='2026-11-19T18:00:00.000Z'
 for(const field of['validThrough','closingDate','applicationDeadline','dateExpires']){
  assert.throws(()=>industryRole({...row,[field]:'2020-01-01'},detail,observed),/expir|clos/i)
  assert.throws(()=>industryRole(row,{...detail,[field]:'2020-01-01'},observed),/expir|clos/i)
 }
 const original={...detail,validThrough:'2026-12-31'},job=industryRole(row,original,observed)
 assert.equal(job.closingDate,'2026-12-31');assert.deepEqual(job.sourceNativeDates.recognizedExpiryFields,[{scope:'detail',field:'validThrough',value:'2026-12-31'}]);assert.equal(job.sourceNativeDetailRecord,original)
 assert.throws(()=>industryRole(row,{...detail,validThrough:'not a date'},observed),/expir|date/i)
})

test('Industrybuying holds newly explicit native availability, structured country and employer contradictions before accepting partial criteria',()=>{
 for(const patch of[{canApply:false},{isActive:false},{postingStatus:'Expired'},{jobLocation:{address:{addressCountry:'US'}}},{hiringOrganization:{name:'Other Employer'}},{employer:'Other Employer'}]){
  assert.throws(()=>industryRole(row,{...detail,...patch}),/availability|country|employer/i)
  assert.throws(()=>industryRole(row,{...detail,jobDescription:'',...patch}),/availability|country|employer/i)
  assert.throws(()=>industryRole({...row,...patch},{...detail,jobDescription:''}),/availability|country|employer/i)
 }
})
test('Industrybuying leaves office aliases unknown and rejects closed, foreign and other-employer records',()=>{
 for(const patch of[{location:'Delhi HO'},{location:'Navi Mumbai, United States'},{status:'Closed'},{openings:0},{orgId:'other-org'},{jobDescription:detail.jobDescription+'<p>Country: United States</p>'},{jobDescription:detail.jobDescription+'<p>This position has been filled.</p>'}])assert.throws(()=>industryRole({...row,...('location'in patch?{location:patch.location}:{})},{...detail,...patch}))
})
test('Industrybuying closes all six native detail/application reads, publishes only two exact municipality labels and retains all four office holds',async()=>{
 const jobs=await execute();assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.sourceClosingQualified&&j.country==='India'));const a=jobs.nativeCollectionEvidence;assert.equal(a.openingNativeRecords.length,6);assert.equal(a.openingDetailModels.length,6);assert.equal(a.closingDetailModels.length,6);assert.equal(a.held.length,4);assert.equal(a.companyIndiaTotal,null);assert.equal(a.sourceScopeComplete,false)
})
test('Industrybuying accepts the genuine same-role native application deployment with a passive Cloudflare beacon',async()=>{
 const jobs=await execute((s,u)=>u===f.alternateNativeApplicationWithPassiveBeacon.requestedUrl?body(f.alternateNativeApplicationWithPassiveBeacon):s);assert.equal(jobs.length,2)
})
test('Industrybuying refuses changed complete closing criteria or truncated native inventory',async()=>{
 await assert.rejects(execute((s,u,n)=>n===1&&u===api+'?id='+row.id?s.replace('excellent communication','changed communication'):s),/closing/)
 await assert.rejects(execute((s,u)=>u.includes('?orgId=')?JSON.stringify({...JSON.parse(s),total:20}):s),/pagination/)
})
test('Industrybuying preserves caller cancellation and refuses metadata-free callback injection',async()=>{
 const c=new AbortController();c.abort(Error('caller cancelled'));await assert.rejects(runIndustryNative({signal:c.signal}),/caller cancelled/);await assert.rejects(runIndustryNative({fetchText:async()=>''}),/metadata/)
})
