import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/unosecur/script.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/unosecur-native-quality.json.gz',import.meta.url))))
const careers='https://www.unosecur.com/careers',client='https://app.reczee.com/react-static/static/js/main.b8a26f81.chunk.js'
const roles=f.packets.filter(q=>q.requestedURL.startsWith('https://jobs.reczee.com/')).map(q=>q.requestedURL)
const api=url=>'https://app.reczee.com/api/v1/requisitions/from-slug/'+new URL(url).pathname.split('/')[2]+'?company_slug=unosecur'
const phase=[careers,roles[0],client,api(roles[0]),roles[1],api(roles[1]),roles[2],api(roles[2])],sha=v=>createHash('sha256').update(v).digest('hex')
async function replay(t,edit=()=>{},options={},registered=false){
 const calls=[],counts=new Map(),audits=[],fetchImpl=async(url,init={})=>{
  url=String(url);calls.push({url,init});const found=[...f.packets,...f.historicalLegacyDiscoveryPackets].find(q=>q.requestedURL===url)
  if(!found)throw Object.assign(Error('Uncaptured Unosecur URL: '+url),{abortRetries:true})
  const q=structuredClone(found),n=(counts.get(url)||0)+1;counts.set(url,n);edit(q,n)
  const r=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const settings={fetchImpl,minIntervalMs:0,now:()=> '2026-11-05T20:00:00.000Z',...options,onAudit:async a=>{audits.push(a);await options.onAudit?.(a)}}
 let jobs,error;try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='unosecur')).run(settings):source.run(settings))}catch(e){error=e}
 return {jobs,error,calls,audits}
}
const changeJSON=(q,mutate)=>{const value=JSON.parse(q.bodyText);mutate(value);q.bodyText=JSON.stringify(value)}
test('Unosecur fixture retains eight current original successes and two historical legacy-only discovery packets',()=>{
 assert.equal(f.packets.length,8);assert.equal(f.historicalLegacyDiscoveryPackets.length,2)
 for(const q of [...f.packets,...f.historicalLegacyDiscoveryPackets]){assert.equal(q.replayed,false);assert.equal(Buffer.byteLength(q.bodyText),q.bodyBytes);assert.equal(sha(q.bodyText),q.bodySHA256)}
})
test('Unosecur registered route reconciles three declared India roles through current native API data rather than rejecting a shell',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{},true);assert.ifError(error);assert.equal(jobs.length,3);assert.deepEqual(calls.map(c=>c.url),[...phase,...phase])
 assert.deepEqual(jobs.map(j=>j.jobId),['3140','3099','3056']);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete===true&&j.nativeRoleClosingReconciled===true))
})
test('Unosecur retains complete native criteria and distinct corporate, public and internal title observations',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(jobs.length,3)
 assert.equal(jobs[0].title,'Software Development Engineer II');assert.equal(jobs[0].nativeInternalRequisitionTitle,'UI Developer')
 assert.equal(jobs[1].nativeCorporateTitle,'Solutions Engineer (Sales)');assert.equal(jobs[1].title,'Solution Engineer Sales')
 for(const j of jobs){assert.equal(j.sourceDescription,j.nativeSourceRecord.api.data.requisition.job_description);assert.equal(j.jobDescription,j.sourceDescription);assert.ok(j.sourceDescription.length>2500)}
})
test('Unosecur preserves native posting timestamps and employment without inventing formal requisitions or first-ever publication',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 assert.equal(jobs[0].postingDate,'2026-10-06T10:44:34.000Z');assert.equal(jobs[0].postedAt,jobs[0].postingDate);assert.equal(jobs[0].publicationTimezone,'UTC')
 for(const j of jobs){assert.equal(j.employmentType,'Full-time');assert.equal(j.requisitionId,null);assert.equal(j.firstEverPublication,null);assert.equal(j.legalEmployer,null);assert.equal(j.closingDate,null)}
})
test('Unosecur mandatory video and screening context remain separate from job qualifications and unknown application availability',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error)
 assert.equal(jobs[0].nativeApplicationRequirements.videoApplicationMode,'required');assert.equal(jobs[0].nativeApplicationRequirements.screeningQuestions.length,2)
 assert.equal(jobs[2].nativeApplicationRequirements.screeningQuestions.length,8)
 for(const j of jobs){assert.equal(j.nativeApplicationsOpen,null);assert.equal(j.activeApplyVerified,false);assert.equal(j.applicationFormSubmitted,false);assert.equal(j.applicationVisited,false)
  assert.equal(j.nativeApplicationHandoff.publicRolePageRead,true);assert.equal(j.nativeApplicationHandoff.formInteractedWith,false);assert.equal(j.minimumQualification,null)}
 assert.ok(calls.every(c=>!c.url.includes('submit')&&!c.url.includes('upload')&&!c.init.body))
})
test('Unosecur literal own role and native API countries agree without company-name or city-dictionary inference',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const j of jobs){assert.equal(j.city,'Bengaluru');assert.equal(j.state,null);assert.equal(j.sourceWorksiteCountryProof.literalRoleCountry,true)
  assert.equal(j.sourceWorksiteCountryProof.method,'declared-reczee-jobposting-and-native-api-location');assert.equal(j.sourceWorksiteCountryProof.exactCampusEstablished,false)}
})
test('Unosecur unknown or conflicting native country keeps complete criteria partial',async t=>{
 for(const country of ['France','UNKNOWN']){
  const {jobs,error}=await replay(t,q=>{if(q.requestedURL===api(roles[0]))changeJSON(q,v=>{v.data.requisition.locations[0].country=country;v.data.requisition.locations[0].country_code=country==='France'?'FR':'XX'})})
  assert.ifError(error);assert.equal(jobs.length,3);assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceCountryScopeUnresolved,true);assert.ok(jobs[0].sourceDescription.length>2500)
 }
})
test('Unosecur another publisher, posting identity or unpublished native role cannot qualify',async t=>{
 for(const mutate of [v=>{v.data.company_details.slug='different-publisher'},v=>{v.data.requisition.id=999999},v=>{v.data.requisition.open_for_careers_page=false}]){
  const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===api(roles[0]))changeJSON(q,mutate)})
  assert.ok(error||!jobs?.length);assert.equal(calls.length,4)
 }
})
test('Unosecur changed closing whole native API criteria are held with both original models',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===api(roles[0])&&n===2)changeJSON(q,v=>{v.data.requisition.job_description+='<p>Additional compulsory certification required.</p>'})})
 assert.ifError(error);assert.equal(jobs.length,2);assert.ok(!jobs.some(j=>j.jobId==='3140'))
 assert.equal(audits[0].heldNativeRows.length,1);assert.ok(audits[0].heldNativeRows[0].opening.nativeRecord.api);assert.ok(audits[0].heldNativeRows[0].closing.rawAPIJSON.includes('Additional compulsory certification'))
})
test('Unosecur changed closing publisher cards hold their affected observations',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===careers&&n===2){const before=q.bodyText;q.bodyText=q.bodyText.replace('fs-cmsfilter-field="location" class="hide-2">Bangalore, India','fs-cmsfilter-field="location" class="hide-2">Paris, France');assert.ok(q.bodyText!==before,'Actual corporate role location was changed')}})
 assert.ok(error||!jobs?.some(j=>j.jobId==='3140'));assert.ok(audits[0]?.heldNativeRows.length>0);assert.ok(calls.length<=16)
})
test('Unosecur changed declared client requires review before further public role-data reads',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===client)q.bodyText=q.bodyText.replace('requisitions/from-slug/','requisitions/unreviewed-contract/')})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,3)
})
test('Unosecur source identity, own metadata and native API descriptions must reconcile',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===api(roles[0]))changeJSON(q,v=>{v.data.requisition.designation='Unrelated role'})})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,4)
})
test('Unosecur hidden or delegated native criteria require review',async t=>{
 for(const addition of ['<p hidden>Unreviewed compulsory eligibility</p>','<iframe src="https://unreviewed.example/criteria"></iframe>']){
  const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===api(roles[0]))changeJSON(q,v=>{v.data.requisition.job_description+=addition})})
  assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,4)
 }
})
test('Unosecur original publisher, client, role and API opening/closing bodies are retained',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const j of jobs)for(const key of ['sourceRawNativeHTML','sourceClosingRawNativeHTML','sourceRawNativeCareersHTML','sourceClosingRawNativeCareersHTML','sourceRawNativeClientJS','sourceClosingRawNativeClientJS','sourceRawNativeAPIJSON','sourceClosingRawNativeAPIJSON'])assert.equal(sha(j[key]),j[key+'SHA256'])
 assert.equal(jobs[0].sourceNativeCollectionAudit.responses.length,16)
})
test('Unosecur source/listing totals and lifecycle cleanup remain unqualified',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.ok(jobs.every(j=>!j.sourceScopeComplete&&!j.sourceListingComplete&&!j.lifecycleCleanupAllowed))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('Unosecur zero cap and exact pre-cancellation make no public requests',async t=>{
 const z=await replay(t,()=>{},{maxJobs:0});assert.ifError(z.error);assert.equal(z.calls.length,0);assert.equal(z.jobs.length,0)
 const reason=Error('Cancel Unosecur before reads'),c=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(c.error,reason);assert.equal(c.calls.length,0)
})
test('Unosecur positive cap still reconciles all native observations',async t=>{
 const {jobs,error,calls,audits}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,16);assert.equal(audits[0].nativeRecords,3)
})
for(const status of [202,403,429])test('Unosecur first HTTP '+status+' stops without retry or empty success',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===careers)q.status=status});assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,1);assert.equal(error.status,status)
})
test('Unosecur a later denial retains older complete criteria as partial and stops immediately',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[1])q.status=403});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,5)
 assert.equal(jobs[0].sourceDetailComplete,false);assert.ok(jobs[0].sourceDescription.length>2500)
})
test('Unosecur body-only transports and unsupported page caps are rejected before reads',async t=>{
 for(const options of [{fetchText:async()=>f.packets[0].bodyText},{maxPages:1}]){const {jobs,error,calls}=await replay(t,()=>{},options);assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,0)}
})
test('Unosecur a pending audit callback honors exact cancellation once',async t=>{
 const c=new AbortController(),reason=Error('Cancel Unosecur pending audit');let started,release,callbacks=0
 const ready=new Promise(resolve=>{started=resolve}),pending=source.run({maxJobs:0,signal:c.signal,onAudit:()=>{callbacks++;started();return new Promise(resolve=>{release=resolve})}})
 await ready;c.abort(reason);const outcome=await Promise.race([pending.then(jobs=>({jobs}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 release?.();await pending.catch(()=>{});assert.equal(outcome.error,reason);assert.equal(callbacks,1)
})
test('Unosecur an explicit conflicting corporate job country cannot be ignored at opening',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===careers){const before=q.bodyText;q.bodyText=q.bodyText.replace('fs-cmsfilter-field="location" class="hide-2">Bangalore, India','fs-cmsfilter-field="location" class="hide-2">Paris, France');assert.ok(q.bodyText!==before)}})
 assert.ifError(error);assert.equal(jobs.length,3);assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceDetailComplete,false)
 assert.ok(jobs[0].nativeSourceRecord.listing.card)
})
for(const workplace of ['Job Location: Paris, France.','This role will be based in Paris, France.','This position is based in Bengaluru to work from Germany.','This role will be working in Germany.'])test('Unosecur explicit competing workplace cannot hide behind a matching native city: '+workplace,async t=>{
 const addition='<p>'+workplace+'</p>'
 const {jobs,error}=await replay(t,q=>{
  if(q.requestedURL===api(roles[0]))changeJSON(q,v=>{v.data.requisition.job_description+=addition})
  if(q.requestedURL===roles[0])q.bodyText=q.bodyText.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const p=JSON.parse(b);p.description+=addition;return a+JSON.stringify(p)+c})
 })
 assert.ifError(error);assert.equal(jobs.length,3);assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceDetailComplete,false)
})
for(const surface of ['corporate-summary','required-screening-question'])test('Unosecur conflicting workplace in '+surface+' prevents country qualification',async t=>{
 const {jobs,error}=await replay(t,q=>{
  if(surface==='corporate-summary'&&q.requestedURL===careers){const before=q.bodyText;q.bodyText=q.bodyText.replace('UI Developer based in Bengaluru','UI Developer based in Paris, France');assert.ok(q.bodyText!==before)}
  if(surface==='required-screening-question'&&q.requestedURL===api(roles[0]))changeJSON(q,v=>{v.data.screening_questions.push({id:999001,field_type:'yes_no',meta_data:{},referral_question:false,required:true,title:'This job is based in Berlin, Germany. Do you accept this assignment?'})})
 })
 assert.ifError(error);assert.equal(jobs.length,3);assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceCountryScopeUnresolved,true)
})
test('Unosecur blank HTML cannot qualify as complete native criteria',async t=>{
 const blank='<div>'+' '.repeat(200)+'</div>'
 const {jobs,error,calls}=await replay(t,q=>{
  if(q.requestedURL===api(roles[0]))changeJSON(q,v=>{v.data.requisition.job_description=blank})
  if(q.requestedURL===roles[0])q.bodyText=q.bodyText.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const p=JSON.parse(b);p.description=blank;return a+JSON.stringify(p)+c})
 })
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,4)
})
test('Unosecur conflicting roles sharing a native posting ID are both held before further reads',async t=>{
 const {jobs,error,calls,audits}=await replay(t,q=>{
  if(q.requestedURL===api(roles[1]))changeJSON(q,v=>{v.data.requisition.id=3140})
  if(q.requestedURL===roles[1])q.bodyText=q.bodyText.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const p=JSON.parse(b);p.identifier.value=3140;return a+JSON.stringify(p)+c})
 })
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,6);const audit=audits[0]||error.recruitmentObservations
 assert.equal(audit.heldNativeRows.length,2);assert.ok(audit.heldNativeRows.every(r=>r.opening.nativeRecord.api.data.requisition.id===3140))
})
for(const deniedRole of [0,1])test('Unosecur known closing role contradiction is held before '+(deniedRole===0?'its unneeded':'a later')+' API denial',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{
  if(q.requestedURL===roles[0]&&n===2)q.bodyText=q.bodyText.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const p=JSON.parse(b);p.jobLocation[0].address.addressCountry='France';return a+JSON.stringify(p)+c})
  if(q.requestedURL===api(roles[deniedRole])&&n===2)q.status=403
 })
 assert.ifError(error);assert.ok(!jobs.some(j=>j.jobId==='3140'));assert.equal(audits[0].heldNativeRows.length,1)
 assert.equal(audits[0].heldNativeRows[0].closing.nativeRecord.role.jobPosting.jobLocation[0].address.addressCountry,'France')
 const ownClosingAPICalls=calls.filter(c=>c.url===api(roles[0]));assert.equal(ownClosingAPICalls.length,1)
 if(deniedRole===1){assert.equal(calls.length,13);assert.ok(jobs.every(j=>j.sourceDetailComplete===false));assert.equal(calls.at(-1).url,api(roles[1]))}
})
