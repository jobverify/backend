import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{createHash}from'node:crypto'
import{document}from'../../scraper-support/shared/rmkNativePairHtml.js'
import{runCurrentPublications,publicationPage,publicationRole}from'./currentPublished20261119.js'
import{run}from'./script.js'
const source="providence",expected=71,fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-publications-20261119.json.gz',import.meta.url))))
const decode=p=>Buffer.from(p.bodyBase64,'base64').toString(),clock='2026-11-19T19:00:00Z',board=fixture.responses.find(r=>new URL(r.url).pathname==='/search'||new URL(r.url).pathname==='/search/'),firstRole=fixture.responses.find(r=>/\/job\//.test(r.url)),page=publicationPage(decode(board),board.url),row=page.rows[0]
function replay(change,extra={},entry=runCurrentPublications){const reads=[],counts=new Map(),{failRead,...options}=extra;return{reads,promise:entry({requestIntervalMs:0,now:()=>clock,...options,fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');const n=counts.get(url)||0;counts.set(url,n+1);reads.push(url);const p=fixture.responses.filter(p=>p.requestedUrl===url)[n];assert.ok(p,'Only current actually observed own GET '+url+' #'+n);if(failRead)failRead(url,n);const packet={...p,text:decode(p)};if(change)change(packet,url,n);const response=new Response(packet.nullBody?null:packet.text,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});Object.defineProperty(response,'redirected',{value:packet.redirected??false});return response
}})}}
function roleEdit(contents){const html=decode(firstRole),d=document(html),node=d.nodes(n=>n.attrs.itemprop==='description')[0];assert.ok(node);return html.slice(0,node.openEnd)+contents(d.inner(node))+html.slice(node.closeStart)}
function rowEdit(html,id,edit){const d=document(html),node=d.nodes(n=>source==='tataconsultingengineers'?n.tag==='li'&&d.hasClass(n,'job-id-'+id):n.tag==='tr'&&d.hasClass(n,'data-row')&&d.nodes(a=>a.tag==='a'&&a.attrs.href?.endsWith('/'+id+'/'),n).length>0)[0];assert.ok(node);return html.slice(0,node.start)+edit(d.outer(node))+html.slice(node.end)}
test(source+' publishes current independently closed own India native rows and retains every original model with company cleanup held',async()=>{
 const{promise,reads}=replay(),jobs=await promise;assert.equal(jobs.length,expected);assert.ok(reads.length<=104);assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.length,fixture.roles.length)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.requisitionId,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailStatus,'partial');assert.equal(job.publicationClosingQualified,true);assert.equal(job.sourceClosingQualified,true);assert.equal(job.lifecycleCleanupAllowed,false);assert.ok(job.sourceNativeRecord.originalTree);assert.equal(job.sourceNativeApplication.activationVerified,false);assert.equal(job.sourceNativeApplication.submitted,false)}
 const enriched=jobs.find(j=>j.jobId===row.id);assert.match(enriched.sourceDescription,/\w/);assert.ok(enriched.postingDate);assert.ok(enriched.sourceNativeDates.datePostedRaw);assert.ok(enriched.sourceNativeRoleModels.length===2);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
 assert.ok(jobs.some(j=>j.sourceDescription===null&&j.postingDate===null&&j.closingDate===null));assert.ok(jobs.every(j=>j.sourceNativeDates.listingDateSemantics==='unasserted-authored-Date-column'))
 if(source==='providence'){const held=jobs.nativeCollectionEvidence.held.find(h=>h.id==='19021344');assert.ok(held);assert.match(held.reason,/country|geograph|India/);assert.ok(!jobs.some(j=>j.jobId==='19021344'))}
})
test(source+' production wrapper uses this source-local current native reader',async()=>{assert.equal((await replay(undefined,{},run).promise).length,expected)})
test(source+' preserves independently published partial jobs after optional detail503 or missing criteria and retains observed dates on closing503',async()=>{
 const outage=await replay((p,u)=>{if(u===firstRole.url)p.status=503}).promise;assert.equal(outage.length,expected);assert.equal(outage.find(j=>j.jobId===row.id).sourceDescription,null)
 const missing=await replay((p,u)=>{if(u===firstRole.url)p.text=roleEdit(()=>'')}).promise;assert.equal(missing.length,expected);assert.equal(missing.find(j=>j.jobId===row.id).sourceDescription,null)
 const later=await replay((p,u,n)=>{if(u===firstRole.url&&n===1)p.status=503}).promise,known=later.find(j=>j.jobId===row.id);assert.equal(later.length,expected);assert.match(known.sourceDescription,/\w/);assert.ok(known.postingDate);assert.equal(known.detailClosingQualified,false);assert.equal(known.sourceNativeRoleModels.length,1)
})
test(source+' checks actual scoped role expiry, future posting, employer and explicit country before optional enrichment can publish',async()=>{
 const html=decode(firstRole),mutations=[s=>s.replace(/(itemprop="validThrough" content=")[^"]*(")/,'$12020-01-01$2'),s=>s.replace(/(itemprop="datePosted" content=")[^"]*(")/,'$12099-01-01$2'),s=>s.replace(/(itemprop="hiringOrganization" content=")[^"]*(")/,'$1Other Employer$2'),s=>s.replace(/(itemprop="addressCountry" content=")IN(")/,'$1US$2'),()=>roleEdit(()=>'This position has been filled.'),()=>roleEdit(s=>s+'<p>Closing Date: 2020-01-01</p>'),()=>roleEdit(s=>s+'<p>Country: United States</p>'),()=>roleEdit(s=>s+'<p>Employer: Other Employer</p>')]
 for(const mutate of mutations){const changed=mutate(html);assert.notEqual(changed,html);const jobs=await replay((p,u)=>{if(u===firstRole.url)p.text=changed}).promise;assert.equal(jobs.length,expected-1);assert.ok(!jobs.some(j=>j.jobId===row.id))}
})
test(source+' holds disabled or wrong-role native application declarations and scoped closure inside the actual role',async()=>{
 for(const edit of[s=>s.replaceAll('/talentcommunity/apply/'+row.id+'/','/talentcommunity/apply/999999999/'),s=>s.replaceAll('class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "','aria-disabled="true" class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "'),()=>roleEdit(s=>s+'<p>Applications are closed.</p>')]){const jobs=await replay((p,u)=>{if(u===firstRole.url)p.text=edit(p.text)}).promise;assert.equal(jobs.length,expected-1);assert.ok(!jobs.some(j=>j.jobId===row.id))}
})
test(source+' qualifies original published-row country/status/closure and exact closing model without borrowing other roles',async()=>{
 for(const edit of[s=>s.replace(/^(<\w+) /,'$1 data-country="US" '),s=>s.replace(/^(<\w+) /,'$1 data-is-closed="true" '),s=>s.replace(/(<\/(?:tr|li)>)$/,'<p>This position has been filled.</p>$1')]){const jobs=await replay((p,u)=>{if(u===board.url)p.text=rowEdit(p.text,row.id,edit)}).promise;assert.equal(jobs.length,expected-1);assert.ok(!jobs.some(j=>j.jobId===row.id))}
 const changed=await replay((p,u,n)=>{if(u===board.url&&n===1)p.text=rowEdit(p.text,row.id,s=>s.replaceAll(row.title,row.title+' revised'))}).promise;assert.equal(changed.length,expected-1)
})
test(source+' keeps actually observed changed criteria and hidden originals as partial without whole UI deployment pins',async()=>{
 const jobs=await replay((p,u,n)=>{if(u===firstRole.url&&n===1)p.text=roleEdit(s=>s+'<p>New mandatory closing criterion.</p><p hidden>Hidden mandatory criterion.</p>');else if(u===board.url)p.text=p.text.replace('</body>','<script>window.unrelatedAnalyticsDeployment="ordinary rotation";</script></body>')}).promise,job=jobs.find(j=>j.jobId===row.id)
 assert.equal(jobs.length,expected);assert.equal(job.sourceDetailComplete,false);assert.equal(job.detailClosingQualified,false);assert.match(job.sourceDescription,/New mandatory closing criterion/);assert.match(job.sourceRawDescriptionHtml,/Hidden mandatory criterion/);assert.equal(job.sourceNativeRoleModels.length,2)
})
test(source+' preserves closed first-page publications when a later own page is denied and makes no subsequent read to that origin',async()=>{
 const next=page.nextUrls[0];assert.ok(next);const{promise,reads}=replay((p,u)=>{if(u===next)p.status=202}),jobs=await promise;assert.equal(jobs.length,page.rows.filter(r=>r.country==='India').length);assert.ok(jobs.every(j=>j.sourceDescription===null&&j.sourceClosingQualified));const denied=reads.indexOf(next);assert.ok(!reads.slice(denied+1).some(u=>new URL(u).origin===new URL(next).origin));assert.equal(jobs.nativeCollectionEvidence.listingOpeningPaginationComplete,false)
})
test(source+' rejects metadata-free positives and propagates exact caller cancellation including a stalled audit observer',async()=>{
 await assert.rejects(runCurrentPublications({fetchText:async()=>decode(board)}),/metadata/);const c=new AbortController(),reason={cancel:'caller'};c.abort(reason);await assert.rejects(runCurrentPublications({signal:c.signal}),e=>e===reason)
 const audit=new AbortController(),why={cancel:'observer'};let observed=false;const pending=replay(undefined,{signal:audit.signal,onAudit:()=>{observed=true;queueMicrotask(()=>audit.abort(why));return new Promise(()=>{})}}).promise;await assert.rejects(pending,e=>e===why);assert.equal(observed,true)
})
test(source+' genuine fixture bytes and digests agree for all native responses',()=>{for(const p of fixture.responses){const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(bytes.length,p.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256)}})
test(source+' native role mapper independently preserves source-authored description and original date fields',()=>{const job=publicationRole(decode(firstRole),row,{observedAt:clock});assert.equal(job.country,'India');assert.ok(job.sourceNativeDates.datePostedRaw);assert.equal(job.sourceNativeApplication.kind,'same-role-published-native-application-link');assert.equal(job.sourceDetailComplete,false)})

test(source+' stops the native origin on an empty202 denial and keeps independently closed publications',async()=>{
 const{promise,reads}=replay((p,u)=>{if(u===firstRole.url){p.status=202;p.nullBody=true}}),jobs=await promise;assert.equal(jobs.length,expected);assert.equal(jobs.find(j=>j.jobId===row.id).sourceDescription,null);const blocked=reads.indexOf(firstRole.url);assert.ok(!reads.slice(blocked+1).some(u=>new URL(u).origin===new URL(firstRole.url).origin));assert.ok(jobs.nativeCollectionEvidence.originalResponses.some(p=>p.status===202&&p.bytes===0))
})
test(source+' a per-response byte cap preserves independent partial publications and cancels further optional reads',async()=>{
 const{promise,reads}=replay((p,u)=>{if(u===firstRole.url)p.text=' '.repeat(4000001)}),jobs=await promise;assert.equal(jobs.length,expected);assert.equal(jobs.find(j=>j.jobId===row.id).sourceDescription,null);const bounded=reads.indexOf(firstRole.url);assert.equal(reads.slice(bounded+1).filter(u=>new URL(u).origin===new URL(firstRole.url).origin).length,0)
})
test(source+' explicit foreign same-role applicant geography constrains the native India workplace',async()=>{
 const jobs=await replay((p,u)=>{if(u===firstRole.url)p.text=roleEdit(s=>s+'<div itemprop="applicantLocationRequirements" itemscope itemtype="http://schema.org/Country"><meta itemprop="name" content="United States"></div>')}).promise;assert.equal(jobs.length,expected-1);assert.ok(!jobs.some(j=>j.jobId===row.id))
})
test(source+' rechecks all actually observed authored expiry at final projection time',async()=>{
 let advanced=false;const fourth=[...new Set(fixture.responses.filter(r=>/\/job\//.test(r.url)).map(r=>r.url))][3],jobs=await replay((p,u,n)=>{if(u===firstRole.url)p.text=p.text.replace(/(itemprop="validThrough" content=")[^"]*(")/,'$12026-11-19T19:00:01Z$2');if(u===fourth&&n===1)advanced=true},{now:()=>advanced?'2026-11-19T19:00:05Z':clock}).promise;assert.equal(jobs.length,expected-1);assert.ok(!jobs.some(j=>j.jobId===row.id))
})

test(source+' actual imported catalog preserves current independent native observations',async()=>{const{getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js'),provider=getScraperCatalog().find(p=>p.source===source),scraper=createCatalogScraper(provider),jobs=await replay(undefined,{},scraper.run.bind(scraper)).promise;assert.equal(jobs.length,expected);assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.length,fixture.roles.length);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)})

test(source+' actual stream limits use intrinsic original chunk length and dispose the oversized response once',async()=>{
 const corporate=fixture.responses[0].requestedUrl,huge=new Uint8Array(4000001);Object.defineProperty(huge,'byteLength',{value:0});let count=0,canceled=0,released=0
 await assert.rejects(runCurrentPublications({requestIntervalMs:0,fetchImpl:async()=>({status:200,url:corporate,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read:async()=>++count===1?{done:false,value:huge}:{done:true},cancel(){canceled++},releaseLock(){released++}}}}})}),/byte budget/)
 assert.equal(canceled,1);assert.equal(released,1)
})
test(source+' source deadline and active stream cancellation settle exactly and dispose native bodies',async()=>{
 const started=performance.now();await assert.rejects(runCurrentPublications({timeoutMs:8,requestIntervalMs:0,fetchImpl:()=>new Promise(()=>{})}),/source deadline/);assert.ok(performance.now()-started<1000)
 const c=new AbortController(),reason=Object.freeze({opaque:'active'});let canceled=0,released=0
 await assert.rejects(runCurrentPublications({signal:c.signal,requestIntervalMs:0,fetchImpl:async(url)=>({status:200,url,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read(){setTimeout(()=>c.abort(reason),2);return new Promise(()=>{})},cancel(){canceled++},releaseLock(){released++}}}}})}),e=>e===reason)
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(canceled,1);assert.equal(released,1)
 const late=new AbortController(),why={opaque:'late'};let disposed=0
 await assert.rejects(runCurrentPublications({signal:late.signal,requestIntervalMs:0,fetchImpl:async()=>{setTimeout(()=>late.abort(why),2);await new Promise(resolve=>setTimeout(resolve,15));return{body:{cancel(){disposed++}}}}}),e=>e===why);await new Promise(resolve=>setTimeout(resolve,25));assert.equal(disposed,1)
})

for(const[name,authored]of[
 ['div employer','<p>Ordinary requirement.</p><div>Employer: Other Employer</div>'],
 ['div expiry','<p>Ordinary requirement.</p><div>Closing Date: 2020-01-01</div>'],
 ['div work country','<p>Ordinary requirement.</p><div>Work Country: Canada</div>'],
 ['section workplace','<p>Ordinary requirement.</p><section>Location: Toronto, Canada</section>'],
 ['table cell employer','<table><tr><td>Company: Other Employer</td></tr></table>'],
 ['definition expiry','<dl><dt>Availability</dt><dd>Closing Date: 2020-01-01</dd></dl>'],
 ['job status draft','<p>Employment Status: Permanent</p><p>Job Status: Draft</p>'],
 ['status draft','<div>Status: Draft</div>'],
 ['publication status draft','<section>Publication Status: Draft</section>'],
])test(source+' peer regression qualifies exact native '+name+' before partial publication',()=>{
 assert.throws(()=>publicationRole(roleEdit(s=>s+authored),row,{observedAt:clock}),/employer|expired|country|workplace|status|closed/)
})
test(source+' peer regression rejects originally redirected HTTP metadata despite the same final URL',async()=>{await assert.rejects(replay(p=>{p.redirected=true}).promise,/redirect/)})
test(source+' peer regression accepts the equivalent HTTPS JobPosting vocabulary without losing native facts',()=>{const job=publicationRole(decode(firstRole).replaceAll('http://schema.org/JobPosting','https://schema.org/JobPosting'),row,{observedAt:clock});assert.equal(job.jobId,row.id);assert.equal(job.country,'India');assert.match(job.sourceDescription,/\w/);assert.ok(job.postingDate);assert.equal(job.sourceDetailComplete,false)})
test(source+' employment status is retained separately from explicit publication status',()=>{const job=publicationRole(roleEdit(s=>s+'<div>Employment Status: Permanent</div>'),row,{observedAt:clock});assert.equal(job.country,'India');assert.match(job.sourceRawDescriptionHtml,/Employment Status: Permanent/);assert.equal(job.sourceDetailComplete,false)})
