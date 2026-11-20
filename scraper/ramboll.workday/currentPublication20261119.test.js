import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {projectRambollPublishedRole} from './currentPublication20261119.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-publication-20261119.json.gz',import.meta.url))))
const text=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8'),observedAt='2026-11-19T18:00:00Z'
const first=JSON.parse(text(fixture.responses.find(r=>r.url.includes('/api/jobsPosts?')))).jobsPosts.data.jobPosts[0]
function replay(change){const counts=new Map();return run({requestIntervalMs:0,now:()=>observedAt,fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
 const n=counts.get(url)||0;counts.set(url,n+1);const row=fixture.responses.filter(r=>r.requestedUrl===url)[n];assert.ok(row,'Only currently declared public native reads '+url)
 const changed=change?change(text(row),url,n):text(row),packet=typeof changed==='object'?changed:{body:changed,status:row.status}
 const response=new Response(packet.body,{status:packet.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
}})}
const changeRow=patch=>(body,url)=>{if(!url.includes('/api/jobsPosts?'))return body;const value=JSON.parse(body);value.jobsPosts.data.jobPosts=value.jobsPosts.data.jobPosts.map(row=>row.jobPostId===first.jobPostId?{...row,...patch}:row);return JSON.stringify(value)}
test('Ramboll reads all current native India pages twice, preserves actual posting identities and includes published graduate roles as partials',async()=>{
 const jobs=await replay();assert.equal(jobs.length,109);assert.equal(new Set(jobs.map(j=>j.jobId)).size,109)
 assert.equal(jobs[0].jobId,first.jobPostId);assert.equal(jobs[0].requisitionId,first.refId);assert.equal(jobs[0].postingDate,'2026-11-19');assert.equal(jobs[0].closingDate,null)
 assert.equal(jobs.filter(j=>j.sourceNativeRecord.isGraduateCareers==='Y').length,2)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete===false&&j.sourceClosingQualified&&j.nativeLegalEmployer===null&&!j.lifecycleCleanupAllowed))
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.openingNativeRecords.length,109);assert.equal(audit.closingNativeRecords.length,109);assert.equal(audit.originalResponses.length,48);assert.equal(audit.companyIndiaTotal,null)
 assert.match(jobs[0].sourceUrl,new RegExp('/careers/'+first.jobPostId+'$'));assert.equal(jobs[0].applyUrl,jobs[0].sourceNativeObservedRole.applyUrl);assert.equal(jobs[0].backendApplicationActivationVerified,false)
})
test('Ramboll rejects scoped native employer, country, workplace, closed-state and authored date contradictions without discarding other current publications',async()=>{
 for(const patch of[{company:'Other Company'},{country:'Canada'},{workplace:'Toronto, Canada'},{unpublishDateTime:'2020-01-01T00:00:00'},{isClosed:true},{postingStartDate:'2099-01-01T00:00:00'},{description:'<p>This position has been filled.</p>'},{description:'<p>Closing Date: 2020-01-01</p>'},{description:'<p>Location: Toronto, Canada</p>'}]){
  const jobs=await replay(changeRow(patch));assert.equal(jobs.length,108,JSON.stringify(patch));assert.ok(!jobs.some(j=>j.jobId===first.jobPostId))
 }
})
test('Ramboll preserves independent missing-criteria publications and every original native field as explicit partials',async()=>{
 const jobs=await replay(changeRow({description:null,teaser:null}));assert.equal(jobs.length,109);assert.equal(jobs[0].sourceNativeRecord.description,null);assert.equal(jobs[0].sourceDetailComplete,false)
 assert.ok(jobs[0].sourceNativeObservedRole,'Already observed own role criteria remain available without padding')
})
test('Ramboll withholds changed closing records, malformed page accounting and duplicate native posting identities',async()=>{
 const jobs=await replay((body,url,n)=>n===1?changeRow({description:'<p>Changed mandatory native criterion.</p>'})(body,url):body);assert.equal(jobs.length,108)
 await assert.rejects(replay((body,url)=>{if(!url.includes('/api/jobsPosts?'))return body;const value=JSON.parse(body);value.jobsPosts.pageNumber=200;return JSON.stringify(value)}),/page|pagination/)
 await assert.rejects(replay((body,url)=>{if(!url.includes('/api/jobsPosts?'))return body;const value=JSON.parse(body);value.jobsPosts.data.jobPosts[1]=value.jobsPosts.data.jobPosts[0];return JSON.stringify(value)}),/duplicate|identity/)
})
test('Ramboll requires the current own declared read protocol and native route instead of pinning a vacancy roster or guessing IDs',async()=>{
 await assert.rejects(replay((body,url)=>url.endsWith('.js')?body.replaceAll('/api/jobsPosts?locale=','/api/unreviewed?locale='):body),/declared|protocol|request|current/)
})
test('Ramboll refuses metadata-free callbacks and preserves opaque cancellation',async()=>{
 await assert.rejects(run({fetchText:async()=>''}),/metadata|transport/)
 const c=new AbortController(),reason={cancel:'caller'};c.abort(reason);await assert.rejects(run({signal:c.signal}),e=>e===reason)
})
test('Ramboll independently closes native publications before optional own-role enrichment and retains known criteria on a later outage',async()=>{
 const role='https://www.ramboll.com/careers/'+first.jobPostId
 const outage=await replay((body,url)=>url===role?{body:'Unavailable',status:503}:body);assert.equal(outage.length,109);assert.equal(outage.nativeCollectionEvidence.optionalRoleFailures[0].status,503)
 const missing=await replay((body,url)=>url===role?{body:'Gone',status:410}:body);assert.equal(missing.length,108)
 const closing=await replay((body,url,n)=>url===role&&n===1?{body:'Unavailable',status:503}:body);assert.equal(closing.length,109);assert.ok(closing[0].sourceNativeObservedRole);assert.equal(closing[0].sourceNativeRoleDetailClosingQualified,false);assert.ok(closing[0].sourceDescription)
})
test('Ramboll scopes native div labels, draft publication status and a changed application handoff independently of missing criteria',()=>{
 for(const patch of [{description:'<p>Work with us.</p><div>Closing Date: 2020-01-01</div>'},{description:'<p>Work with us.</p><div>Employer: Other Company</div>'},{description:'<p>Job Status: Draft</p>'},{applyUrl:'https://example.test/other-employer/apply'}])
  assert.throws(()=>projectRambollPublishedRole({...first,...patch},{route:'careers',observedAt}),undefined,JSON.stringify(patch))
})
test('Ramboll retains a typed India publication with an explicit additional India workplace alternative regardless of label order',()=>{
 for(const workplace of ['Toronto, Canada / Chennai, India','Chennai, India / Toronto, Canada']){
  const job=projectRambollPublishedRole({...first,workplace},{route:'careers',observedAt});assert.equal(job.country,'India');assert.equal(job.location,workplace);assert.deepEqual(job.sourceNativeWorkplaceCountries.slice().sort(),['Canada','India'])
 }
})
test('Ramboll native JSON object key order does not change the meaning of an otherwise identical closing publication',async()=>{
 const reverse=value=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reverse(v)])):value
 const jobs=await replay((body,url,n)=>url.includes('/api/jobsPosts?')&&n===1?JSON.stringify(reverse(JSON.parse(body))):body);assert.equal(jobs.length,109);assert.equal(jobs.nativeCollectionEvidence.held.length,0)
})
