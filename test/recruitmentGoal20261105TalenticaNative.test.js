import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/talenticasoftware/script.js'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/talentica-native-quality.json.gz',import.meta.url))))
const home=fixture.packets[0].requestedURL,first=fixture.packets[1].requestedURL,second=fixture.packets[2].requestedURL
const sha=v=>createHash('sha256').update(v).digest('hex'),now=()=> '2026-11-05T11:30:00.000Z'
const replay=async(t,edit=()=>{},options={})=>{
 const calls=[],fetchImpl=async(url,init={})=>{
  const original=fixture.packets.find(q=>q.requestedURL===String(url));assert.ok(original,'Undeclared native URL: '+url)
  assert.equal(sha(original.bodyText),original.bodySHA256)
  const occurrence=calls.filter(q=>q.url===String(url)).length;calls.push({url:String(url),init,occurrence})
  const q=structuredClone(original);edit(q,occurrence,calls)
  const response=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const {registered,...runOptions}=options,runner=registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='talenticasoftware')):source
 let jobs,error;try{jobs=await runner.run({fetchImpl,minIntervalMs:0,now,...runOptions})}catch(e){error=e}
 return {jobs,error,calls}
}
test('Talentica reads all13 own role pages and retains complete criteria instead of title cards',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.equal(jobs.length,13);assert.equal(calls.length,28)
 for(const job of jobs){assert.ok(job.jobDescription.length>1000);assert.ok(job.nativeRoleClosingReconciled);assert.equal(job.sourceNativeCriteriaContainerRetained,true)}
 assert.ok(jobs[0].jobDescription.includes('Applying research papers, emerging techniques'))
 assert.ok(jobs[0].jobDescription.includes('Must have'));assert.ok(jobs[0].jobDescription.includes('About Talentica'))
 assert.ok(jobs[0].jobDescription.includes("company's valuation"),'Native description entities must become the published text')
 assert.ok(!jobs[0].jobDescription.includes('company&#39;s valuation'))
 assert.ok(!jobs[0].jobDescription.includes('Upload CV'));assert.ok(!jobs[0].jobDescription.includes('Personal Information'))
 for(const call of calls){assert.equal(call.init.method,'GET');assert.equal(call.init.credentials,'omit');assert.equal(call.init.redirect,'manual')}
})
test('Talentica never borrows India from footer companies, awards, college criteria or application options',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 assert.ok(jobs.every(j=>j.country===null&&j.city===null&&j.state===null&&j.location===null&&j.sourceCountryScopeUnresolved===true))
 assert.ok(jobs.some(j=>j.jobDescription.includes('colleges in India')))
})
test('Talentica registered route preserves13 unknown-country native roles and incomplete inventory',async t=>{
 const {jobs,error}=await replay(t,()=>{},{registered:true});assert.ifError(error);assert.equal(jobs.length,13)
 assert.ok(jobs.every(j=>j.country===null&&j.sourceDetailComplete===false&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Talentica retains native form position codes separately from undisclosed requisitions and publication',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 assert.equal(jobs[0].sourceNativeApplicationPositionCode,'TEG-DS-DS-I2-804');assert.equal(jobs[1].sourceNativeApplicationPositionCode,'')
 assert.ok(jobs.every(j=>j.requisitionId===null&&j.postingDate===null&&j.postedAt===null&&j.closingDate===null&&j.firstEverPublication===null
  &&j.legalEmployer===null&&j.employmentType===null&&j.remoteStatus===null&&j.applicationVisited===false&&j.activeApplyVerified===false))
})
test('Talentica keeps original whole opening/closing role and index bytes and semantic models',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const j of jobs){const q=fixture.packets.find(q=>q.requestedURL===j.sourceUrl)
  assert.equal(j.sourceRawNativeHTML,q.bodyText);assert.equal(j.sourceRawNativeHTMLSHA256,q.bodySHA256)
  assert.equal(j.sourceClosingRawNativeHTML,q.bodyText);assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord)
  assert.equal(j.sourceDescription,j.jobDescription)
 }
 assert.equal(jobs[0].sourceNativeCollectionAudit.openingIndex.rawHTML,fixture.packets[0].bodyText)
 assert.equal(jobs[0].sourceNativeCollectionAudit.closingIndex.rawHTML,fixture.packets[0].bodyText)
})
test('Talentica zero cap and pre-abort perform no reads',async t=>{
 let r=await replay(t,()=>{},{maxJobs:0});assert.ifError(r.error);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0)
 const reason=Error('Stop Talentica before reads');r=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('Talentica positive cap follows complete paired observations',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,28)
 assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRecords,13)
})
for(const status of [202,401,403,429,451])test('Talentica stops at opening HTTP '+status+' without retries or empty credit',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===home)q.status=status})
 assert.ok(!jobs);assert.equal(error?.status,status);assert.equal(calls.length,1)
})
test('Talentica stops at its first declared role denial without emitting title-only cards',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===first)q.status=403})
 assert.ok(!jobs);assert.equal(error?.status,403);assert.equal(calls.length,2)
})
test('Talentica retains earlier partial facts after a closing denial and performs no later reads',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(n&&q.requestedURL===first)q.status=403})
 assert.ifError(error);assert.equal(jobs.length,13);assert.equal(calls.length,15)
 assert.ok(jobs.every(j=>j.nativeRoleClosingReconciled===false&&j.sourceScopeComplete===false))
})
test('Talentica excludes a changed closing criterion before a later denial',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{
  if(n&&q.requestedURL===first)q.bodyText=q.bodyText.replace('A strong foundation in Machine Learning','A changed foundation in Machine Learning')
  if(n&&q.requestedURL===second)q.status=403
 })
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(!jobs.some(j=>j.sourceUrl===first));assert.equal(calls.length,16)
 const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows.find(r=>r.sourceUrl===first)
 assert.match(held.closing.rawHTML,/A changed foundation/);assert.equal(held.opening.rawHTML,fixture.packets[1].bodyText)
})
test('Talentica extra native criterion sections are retained in full',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===first){assert.ok(q.bodyText.includes('<div class="career_form uiblock">'))
  q.bodyText=q.bodyText.replace('<div class="career_form uiblock">','<div><h3>Additional native criteria</h3><ul><li>Every newly published requirement must remain in the full role text.</li></ul></div><div class="career_form uiblock">')
 }})
 assert.ifError(error);assert.equal(jobs.length,13);assert.match(jobs[0].jobDescription,/Every newly published requirement/)
})
test('Talentica hidden fake cards cannot add openings',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===home)q.bodyText=q.bodyText.replace('</body>','<div hidden><div class="job-card"><h6 class="title">Fake role</h6><p><b>Experience:</b> 1 year</p><a class="anchor-absolute" href="https://www.talentica.com/jobdescription/fake-role/"></a></div></div></body>')})
 assert.ifError(error);assert.equal(jobs.length,13);assert.ok(!jobs.some(j=>j.title==='Fake role'))
})
test('Talentica contradictory duplicate listing observations hold the affected role',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===home){const before=q.bodyText
  q.bodyText=q.bodyText.replace(/(<section\b[^>]*class="link_card_16 uiblock"[^>]*>)/,'$1<div class="job-card"><h6 class="title">Software Engineer – Data Science</h6><p><b>Experience:</b> 99 years</p><a href="'+first+'" class="anchor-absolute"></a></div>')
  assert.notEqual(q.bodyText,before)
 }})
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(!jobs.some(j=>j.sourceUrl===first))
})
test('Talentica contradictory native application role identity cannot qualify a page',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===first)q.bodyText=q.bodyText.replace('value="Software Engineer – Data Science"','value="Another Employer Role"')})
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(!jobs.some(j=>j.sourceUrl===first))
})
test('Talentica a WebPage clock cannot become a job publication date',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===first)q.bodyText=q.bodyText.replace('</head>','<script type="application/ld+json">{"@type":"WebPage","url":"'+first+'","datePublished":"2026-11-05"}</script></head>')})
 assert.ifError(error);assert.equal(jobs.length,13);assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].postedAt,null)
 assert.equal(jobs[0].nativeSourceRecord.schemas[0].datePublished,'2026-11-05')
})
test('Talentica changed closing index cannot resurrect a changed own role',async t=>{
 const {jobs,error}=await replay(t,(q,n)=>{if(n&&q.requestedURL===home)q.bodyText=q.bodyText.replace('>Software Engineer – Data Science','>Changed Data Science')})
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(!jobs.some(j=>j.sourceUrl===first))
})
test('Talentica invalid closing index retains every evicted whole role model and original body',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(n&&q.requestedURL===home)q.bodyText=q.bodyText.replace('<title>Job Openings | Talentica.com</title>','<title>Changed publisher</title>')})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,28)
 const held=error.recruitmentObservations.heldNativeRows
 assert.equal(held.length,13,'Invalid closing index must retain every earlier role model as held evidence')
 for(const row of held){const q=fixture.packets.find(q=>q.requestedURL===row.sourceUrl)
  assert.equal(row.phase,'closing-index');assert.equal(row.opening.rawHTML,q.bodyText);assert.equal(row.closing.rawHTML,q.bodyText)
  assert.ok(row.opening.nativeRecord.criteriaTree);assert.deepEqual(row.opening.nativeRecord,row.closing.nativeRecord)
 }
})
test('Talentica an injected timeout stops without empty-success fallback',async()=>{
 let calls=0
 await assert.rejects(source.run({fetchText:async()=>{calls++;throw Error('Native Talentica timeout')},minIntervalMs:0}),/timeout/i)
 assert.equal(calls,1)
})
test('Talentica extra forms cannot hide native criteria inside the application wrapper',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===first)q.bodyText=q.bodyText.replace('<div class="career_form uiblock">',
  '<div class="career_form uiblock"><form id="native-extra-role-criteria"><p>Mandatory native criterion in another form.</p></form>')})
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(!jobs.some(j=>j.sourceUrl===first))
 assert.match(jobs[0].sourceNativeCollectionAudit.heldNativeRows[0].opening.rawHTML,/Mandatory native criterion/)
})
test('Talentica case-insensitive JSON-LD MIME cannot hide a new own JobPosting',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===first)q.bodyText=q.bodyText.replace('</head>',
  '<script type="application/LD+JSON">{"@type":"JobPosting","url":"'+first+'","jobLocation":{"address":{"addressCountry":"India"}}}</script></head>')})
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(!jobs.some(j=>j.sourceUrl===first))
 assert.match(jobs[0].sourceNativeCollectionAudit.heldNativeRows[0].reason,/JobPosting/)
})
test('Talentica preserves exact caller cancellation after an awaited audit callback',async t=>{
 const controller=new AbortController(),reason=Error('Cancel Talentica during audit callback')
 const {jobs,error,calls}=await replay(t,()=>{},{signal:controller.signal,onAudit:async()=>{controller.abort(reason)}})
 assert.ok(!jobs);assert.equal(error,reason);assert.equal(calls.length,28)
})
test('Talentica cancellation settles a noncooperative transport',async t=>{
 const controller=new AbortController(),reason=Error('Cancel native Talentica');let release
 const fetchImpl=()=>new Promise(resolve=>{release=resolve});t.mock.method(globalThis,'fetch',fetchImpl)
 const pending=source.run({fetchImpl,minIntervalMs:0,signal:controller.signal});await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const settled=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),150))])
 const response=new Response(fixture.packets[0].bodyText,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:home});release?.(response)
 t.mock.method(globalThis,'fetch',async()=>{throw reason});await pending.catch(()=>{});assert.equal(settled.error,reason)
})
