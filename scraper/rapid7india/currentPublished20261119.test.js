import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
import{extractJobCardsFromSearchPage}from'./script.js'
import{rapidPublishedRole}from'./currentPublished20261119.js'
import{document}from'../../scraper-support/shared/rmkNativePairHtml.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const enrichment=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-publication-enrichment-20261119.json.gz',import.meta.url))))
const independent=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-independent-publication-20261119.json.gz',import.meta.url))))
const observed=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-observed-partial-20261119.json.gz',import.meta.url))))
const text=r=>Buffer.from(r.bodyBase64,'base64').toString(),observedAt='2026-11-19T18:00:00Z'
function replay(change,extra={},original=enrichment){const reads=[],counts=new Map(),{failRead,...options}=extra;return{reads,result:run({requestIntervalMs:0,now:()=>observedAt,...options,fetchImpl:async(u,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');reads.push(u);const n=counts.get(u)||0;counts.set(u,n+1)
 const packet=original.responses.filter(r=>r.requestedUrl===u)[n];assert.ok(packet,'Only current actually declared own GET '+u)
 if(failRead)failRead(u,n)
 const response=new Response(change?change(text(packet),u,n):text(packet),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
}})}}
test('Rapid7 retains a fully opening-and-closing qualified own India publication when a later independent role returns an actual AWS202',async()=>{
 const{result,reads}=replay(),jobs=await result;assert.equal(jobs.length,5);const job=jobs.find(j=>j.jobId==='R12622')
 assert.equal(job.jobId,'R12622');assert.equal(job.company,'Rapid7');assert.equal(job.country,'India');assert.equal(job.city,'Pune');assert.equal(job.nativeLegalEmployer,null)
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailStatus,'partial');assert.equal(job.sourceClosingQualified,true);assert.equal(job.postingDate,'2026-11-16T09:03:13Z');assert.equal(job.closingDate,'2027-02-17T17:34:32Z')
 assert.equal(job.sourceNativeJobPosting.identifier.value,'d1621f73bcc50d11b229231333403b4d');assert.match(job.sourceDescription,/Rapid7/);assert.equal(job.sourceNativeApplication.submitted,false);assert.equal(job.sourceNativeApplication.activationVerified,false)
 assert.equal(reads.length,9);assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.length,49);assert.equal(jobs.nativeCollectionEvidence.held.length,0);assert.equal(jobs.nativeCollectionEvidence.optionalEnrichmentUnavailable.length,4);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.ok(jobs.filter(j=>j.jobId!=='R12622').every(j=>j.sourceNativeJobPosting===null&&j.postingDate===null&&j.sourceDescription===null&&j.sourceNativeApplication.activationVerified===false))
})
const changeSchema=patch=>(html,url)=>url===fixture.responses[2].requestedUrl?html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(_all,open,body,close)=>open+JSON.stringify({...JSON.parse(body),...patch})+close):html
test('Rapid7 qualifies expiry, explicit country/employer and role availability independently of partial criteria',async()=>{
 for(const patch of[{validThrough:'2020-01-01'},{isClosed:true},{hiringOrganization:{name:'Other Employer'}},{applicantLocationRequirements:{'@type':'Country',name:'United States'}},{jobLocation:[{'@type':'Place',address:{addressCountry:'US',addressLocality:'Pune'}}]},{description:'<p>This position has been filled.</p>'}]){const jobs=await replay(changeSchema(patch)).result;assert.equal(jobs.length,4,JSON.stringify(patch));assert.ok(jobs.nativeCollectionEvidence.held.some(h=>h.id==='R12622'))}
 const jobs=await replay(changeSchema({description:null})).result,job=jobs.find(j=>j.jobId==='R12622');assert.equal(jobs.length,5);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceNativeJobPosting.description,null);assert.match(job.sourceDescription,/Rapid7/)
})
test('Rapid7 refuses wrong-job or disabled application forms and scoped closure notices without submitting',async()=>{
 for(const edit of[
  s=>s.replace('job_id=d1621f73bcc50d11b229231333403b4d','job_id=00000000000000000000000000000000'),
  s=>s.replace(/(<button[^>]*name="next_step"[^>]*)(>)/,'$1 disabled$2'),
  s=>s.replace('</form>','<p>This position has been filled.</p></form>')
 ]){const jobs=await replay((s,u)=>u===fixture.responses[3].requestedUrl?edit(s):s).result;assert.equal(jobs.length,4);assert.ok(jobs.nativeCollectionEvidence.held.some(h=>h.id==='R12622'))}
})
test('Rapid7 holds closing criteria drift and rejects metadata-free positive legacy records while preserving exact caller cancellation',async()=>{
 const jobs=await replay((s,u,n)=>n===1?changeSchema({description:'<p>New unreviewed mandatory authored criteria.</p>'})(s,u):s).result;assert.equal(jobs.length,5);const partial=jobs.find(j=>j.jobId==='R12622');assert.match(partial.sourceDescription,/New unreviewed mandatory/);assert.equal(partial.detailClosingQualified,false);assert.equal(partial.sourceNativeDetailObservations.length,2);assert.match(partial.sourceOptionalEnrichmentUnavailable,/closing/)
 await assert.rejects(run({fetchText:async()=>text(fixture.responses[0])}),/metadata/)
 const c=new AbortController(),reason={cancel:'caller'};c.abort(reason);await assert.rejects(run({signal:c.signal}),e=>e===reason)
})
test('Rapid7 caller cancellation settles an audit observer that never resolves',async()=>{
 const c=new AbortController(),reason={cancel:'audit'};let observed=false
 const pending=replay(undefined,{signal:c.signal,onAudit:()=>{observed=true;queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})}}).result
 await assert.rejects(pending,e=>e===reason);assert.equal(observed,true)
})
const currentHTML=text(fixture.responses[2]),currentForm=text(fixture.responses[3]),currentCard=fixture.responses.slice(0,2).flatMap(r=>extractJobCardsFromSearchPage(text(r))).find(c=>c.requisitionId==='R12622')
const replaceVisible=contents=>{const d=document(currentHTML),node=d.nodes(n=>d.hasClass(n,'job-description'))[0];return currentHTML.slice(0,node.openEnd)+contents(d.inner(node))+currentHTML.slice(node.closeStart)}
test('Rapid7 holds plain unwrapped closure text inside the actual native whole role description',()=>{
 assert.throws(()=>rapidPublishedRole(replaceVisible(()=>'This position has been filled.'),currentForm,currentCard,{observedAt}),/closed/)
})
test('Rapid7 qualifies an explicit authored closing date in the native role description before partial acceptance',()=>{
 assert.throws(()=>rapidPublishedRole(replaceVisible(s=>s+'<p>Closing Date: 2020-01-01</p>'),currentForm,currentCard,{observedAt}),/expired/)
 const job=rapidPublishedRole(replaceVisible(s=>s+'<p>Closing Date: 2027-01-01</p>'),currentForm,currentCard,{observedAt});assert.equal(job.sourceDetailComplete,false);assert.deepEqual(job.sourceNativeDates.authoredDates,[{kind:'closing',label:'Closing Date',value:'2027-01-01'}]);assert.equal(job.sourceNativeDates.datePosted,'2026-11-16T09:03:13Z')
})
test('Rapid7 holds an explicit authored future publication date inside actual role criteria',()=>{
 assert.throws(()=>rapidPublishedRole(replaceVisible(s=>s+'<p>Date Posted: 2099-01-01</p>'),currentForm,currentCard,{observedAt}),/future/)
})
test('Rapid7 closes independently published first-page India rows before optional denied pagination without inventing criteria or GUIDs',async()=>{
 const{result,reads}=replay(undefined,{},independent),jobs=await result;assert.equal(jobs.length,2);assert.equal(reads.length,3);assert.equal(reads[0],reads[1]);assert.equal(reads.at(-1),'https://careers.rapid7.com/jobs/search?page=2')
 assert.deepEqual(jobs.map(j=>j.jobId),['R12622','R12625']);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceClosingQualified&&j.sourceNativeJobPosting===null&&j.sourceDescription===null&&j.postingDate===null&&j.closingDate===null&&j.sourceDetailComplete===false))
 assert.equal(jobs.nativeCollectionEvidence.listingOpeningPaginationComplete,false);assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.length,30);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})
test('Rapid7 retains independent current publications when optional native role enrichment has a real fetch failure',async()=>{
 const jobs=await replay(undefined,{failRead:u=>{if(u===fixture.responses[2].requestedUrl)throw new TypeError('fetch failed',{cause:{code:'ECONNRESET'}})}}).result
 assert.equal(jobs.length,5);const job=jobs.find(j=>j.jobId==='R12622');assert.equal(job.sourceNativeJobPosting,null);assert.equal(job.postingDate,null);assert.match(job.sourceOptionalEnrichmentUnavailable,/fetch failed/)
})
test('Rapid7 holds exact scoped published-row closure/country conflicts and changed closing rows while preserving the other independent India row',async()=>{
 const mutate=(html,contents)=>{const d=document(html),node=d.nodes(n=>n.tag==='tr'&&n.attrs['data-job-url']===currentCard.sourceUrl)[0];return html.slice(0,node.start)+contents(d.outer(node))+html.slice(node.end)}
 for(const update of[s=>s.replace('</tr>','<td><p>This position has been filled.</p></td></tr>'),s=>s.replace('<tr ','<tr data-country="US" ')]){const jobs=await replay((s,u)=>u===fixture.responses[0].requestedUrl?mutate(s,update):s,{},independent).result;assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'R12625')}
 const jobs=await replay((s,u,n)=>u===fixture.responses[0].requestedUrl&&n===1?mutate(s,r=>r.replace('Hybrid','Remote')):s,{},independent).result;assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'R12625')
})
test('Rapid7 retains valid actually observed criteria and original dates when optional closing detail is denied',async()=>{
 const{result,reads}=replay(undefined,{},observed),jobs=await result,job=jobs.find(j=>j.jobId==='R12622');assert.equal(jobs.length,5);assert.equal(reads.length,7)
 assert.match(job.sourceDescription,/Rapid7/);assert.equal(job.postingDate,'2026-11-16T09:03:13Z');assert.equal(job.closingDate,'2027-02-17T17:34:32Z');assert.equal(job.sourceNativeSchemaIdentifier,'d1621f73bcc50d11b229231333403b4d')
 assert.equal(job.sourceClosingQualified,true);assert.equal(job.publicationClosingQualified,true);assert.equal(job.detailClosingQualified,false);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceNativeApplication.closingQualified,false);assert.ok(job.sourceNativeApplication.originalModel);assert.equal(job.sourceNativeDetailObservations.length,1)
 assert.ok(jobs.filter(j=>j.jobId!=='R12622').every(j=>j.sourceDescription===null&&j.postingDate===null&&j.sourceNativeSchemaIdentifier===null))
})
test('Rapid7 qualifies actually observed closure/expiry/future publication before an optional opening form outage',async()=>{
 for(const patch of[{validThrough:'2020-01-01'},{isClosed:true},{description:'<p>This position has been filled.</p>'},{datePosted:'2099-01-01'}]){const jobs=await replay(changeSchema(patch),{failRead:u=>{if(u===fixture.responses[3].requestedUrl)throw Object.assign(Error('Optional form access challenge'),{httpStatus:202})}}).result;assert.equal(jobs.some(j=>j.jobId==='R12622'),false,JSON.stringify(patch));assert.equal(jobs.length,4)}
})
test('Rapid7 qualifies a newly observed closing expiry before optional closing application availability',async()=>{
 const jobs=await replay((s,u,n)=>n===1?changeSchema({validThrough:'2020-01-01'})(s,u):s,{failRead:(u,n)=>{if(u===fixture.responses[3].requestedUrl&&n===1)throw Object.assign(Error('Optional form access challenge'),{httpStatus:202})}}).result
 assert.equal(jobs.some(j=>j.jobId==='R12622'),false);assert.equal(jobs.length,4)
})
