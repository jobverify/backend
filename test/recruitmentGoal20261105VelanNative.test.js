import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/velaninfoservices/script.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/velan-native-quality.json.gz',import.meta.url))))
const careers='https://www.velaninfo.com/careers',index='https://www.velaninfo.com/jobs',contact='https://www.velaninfo.com/contact'
const lookup=url=>fixture.packets.find(q=>q.requestedURL===url),sha=v=>createHash('sha256').update(v).digest('hex')
const roles=fixture.packets.filter(q=>q.requestedURL.includes('/jobs/')).map(q=>q.requestedURL),order=[careers,index,contact,...roles,careers,index,contact,...roles]
async function replay(t,edit=()=>{},options={},registered=false){
 const calls=[],counts=new Map(),audits=[],fetchImpl=async(url,init={})=>{
  url=String(url);calls.push({url,init});const packet=lookup(url)||fixture.historicalDeclaredCanonicalRedirect
  assert.equal(packet.requestedURL,url,'Uncaptured Velan URL: '+url)
  const q=structuredClone(packet),n=(counts.get(url)||0)+1;counts.set(url,n);edit(q,n)
  if(q.error)throw Object.assign(Error(q.error),{abortRetries:true})
  const response=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const settings={fetchImpl,minIntervalMs:0,now:()=> '2026-11-05T18:00:00.000Z',...options,onAudit:async a=>{audits.push(a);await options.onAudit?.(a)}}
 let jobs,error
 try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='velaninfoservices')).run(settings):source.createVelanInfoServicesScraper(settings).run())}catch(e){error=e}
 return {jobs,error,calls,audits}
}
test('Velan quality fixture retains fifteen current original successes and the declared canonical redirect',()=>{
 assert.equal(fixture.packets.length,15);assert.equal(new Set(fixture.packets.map(q=>q.requestedURL)).size,15)
 for(const q of [...fixture.packets,fixture.historicalDeclaredCanonicalRedirect]){assert.equal(q.replayed,false);assert.equal(sha(Buffer.from(q.bodyText)),q.bodySHA256);assert.equal(Buffer.byteLength(q.bodyText),q.bodyBytes)}
 assert.equal(fixture.historicalDeclaredCanonicalRedirect.status,301);assert.equal(fixture.historicalDeclaredCanonicalRedirect.headers.location,careers)
})
test('Velan listing observations preserve native job IDs without fabricated country, requisitions, employment or complete descriptions',()=>{
 const rows=source.extractJobs(lookup(index).bodyText);assert.equal(rows.length,12)
 for(const j of rows){assert.equal(j.country,null);assert.equal(j.city,null);assert.equal(j.state,null);assert.equal(j.location,null);assert.equal(j.requisitionId,null);assert.equal(j.employmentType,null)
  assert.equal(j.jobDescription,null);assert.equal(j.nativeLocation,'Coimbatore');assert.ok(j.sourceUrl.includes('/jobs/'))}
})
test('Velan reconciles twelve complete own roles and publisher delivery-center context using thirty exact reads',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.equal(jobs.length,12);assert.deepEqual(calls.map(c=>c.url),order)
 assert.equal(jobs.reduce((n,j)=>n+j.numberOfOpenings,0),22)
 for(const j of jobs){assert.equal(j.country,'India');assert.equal(j.location,'Coimbatore');assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true)
  assert.ok(j.nativeSourceRecord);assert.ok(j.nativeClosingRecord);assert.equal(j.sourceCountryScopeUnresolved,false)}
})
test('Velan full responsibilities, candidate profile and benefits survive without application questions becoming job qualifications',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs.find(j=>j.jobId==='102026-62053')
 assert.match(j.sourceDescription,/Roles and Responsibilities:/);assert.match(j.sourceDescription,/Candidate Profile:/);assert.match(j.sourceDescription,/Why Should You Join Velan\?/)
 assert.ok(j.sourceDescription.includes('Bachelor\u2019s degree in accounting'))
 assert.ok(j.sourceDescription.includes('Familiarity with AI tools is preferred'));assert.ok(!j.sourceDescription.includes('Full Name *'))
 assert.ok(!j.sourceDescription.includes('Educational Qualification *'));assert.equal(j.minimumQualification,null)
 assert.match(jobs.find(j=>j.jobId==='102026-62052').sourceDescription,/Key Competencies|Working style/)
 assert.ok(jobs.every(j=>j.sourceDescription===j.jobDescription&&j.sourceDescription.length>700))
})
test('Velan literal India delivery-center addresses bind all matching native worksites without an exact-campus or company-name inference',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const j of jobs){const p=j.sourceWorksiteCountryProof;assert.equal(p.method,'role-location-to-publisher-delivery-center-country');assert.equal(p.contextualBinding,true)
  assert.equal(p.literalRoleCountry,false);assert.equal(p.exactCampusEstablished,false);assert.equal(p.nativeRoleLocation,'Coimbatore');assert.equal(p.contactURL,contact)
  assert.equal(p.matchingWorksites.length,2);assert.ok(p.matchingWorksites.every(s=>s.address.endsWith('INDIA')));assert.equal(j.city,null);assert.equal(j.state,null)}
})
test('Velan posted calendar labels remain publication dates with native job IDs distinct from undisclosed requisitions',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs.find(j=>j.jobId==='102026-62053')
 assert.equal(j.postingDate,'2026-10-15');assert.equal(j.sourcePostingDateLabel,'15-10-2026');assert.equal(j.sourceDatePrecision,'calendar-date')
 for(const key of ['requisitionId','legalEmployer','employmentType','closingDate','firstEverPublication','publicationTimezone'])assert.equal(j[key],null,key)
 assert.notEqual(jobs.find(j=>j.jobId==='082026-62036').sourceUrl,jobs.find(j=>j.jobId==='072026-62029').sourceUrl)
 assert.notEqual(jobs.find(j=>j.jobId==='082026-62036').jobId,jobs.find(j=>j.jobId==='072026-62029').jobId)
})
test('Velan public detail pages remain distinct from unperformed application interactions and submission endpoints',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error)
 for(const j of jobs){assert.equal(j.nativeApplicationHandoff.kind,'public-role-page-with-inline-form');assert.equal(j.nativeApplicationHandoff.publicRolePageRead,true)
  assert.equal(j.nativeApplicationHandoff.formInteractedWith,false);assert.equal(j.applicationFormSubmitted,false);assert.equal(j.activeApplyVerified,false)}
 assert.ok(calls.every(c=>!c.url.includes('captcha')&&!c.url.includes('submit')&&!c.init.body))
})
test('Velan retains original careers, jobs, offices and own-role opening and closing bodies',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs[0]
 for(const [key,url]of [['sourceRawNativeHTML',j.sourceUrl],['sourceClosingRawNativeHTML',j.sourceUrl],['sourceRawNativeCareersHTML',careers],
  ['sourceClosingRawNativeCareersHTML',careers],['sourceRawNativeIndexHTML',index],['sourceClosingRawNativeIndexHTML',index],
  ['sourceRawNativeOfficeHTML',contact],['sourceClosingRawNativeOfficeHTML',contact]]){
  assert.equal(j[key],lookup(url).bodyText);assert.equal(j[key+'SHA256'],lookup(url).bodySHA256)}
 assert.equal(j.sourceNativeCollectionAudit.responses.length,30)
})
test('Velan registered route retains incomplete company/listing and cleanup authority',async t=>{
 const {jobs,error}=await replay(t,()=>{},{},true);assert.ifError(error);assert.equal(jobs.length,12)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('Velan company spelling and own interview location cannot replace a missing worksite country',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===contact)q.bodyText=q.bodyText.replace(/641 015 INDIA/g,'641 015 UNREVIEWED')})
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(jobs.every(j=>j.country===null&&j.sourceDetailComplete===false))
})
test('Velan a foreign matching worksite and an ungrouped competing city address remain unresolved',async t=>{
 for(const edit of [html=>html.replace(/641 015 INDIA/g,'641 015 FRANCE'),html=>html.replace('<h3 class="grey-title">Delivery Center</h3>',
  '<div class="unreviewed-office"><p>Coimbatore, France</p></div><h3 class="grey-title">Delivery Center</h3>')]){
  const r=await replay(t,q=>{if(q.requestedURL===contact)q.bodyText=edit(q.bodyText)});assert.ifError(r.error);assert.ok(r.jobs.every(j=>j.country===null&&j.sourceDetailComplete===false))
 }
})
test('Velan ordinary foreign role workplace wording overrides country inferred from the original listing city',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0]){const before=q.bodyText;q.bodyText=q.bodyText.replace('Roles and Responsibilities:</h3>','Roles and Responsibilities:</h3><p>Location: Paris, France.</p>');assert.notEqual(q.bodyText,before)}})
 assert.ifError(error);const j=jobs.find(j=>j.jobId==='102026-62053');assert.equal(j.country,null);assert.equal(j.sourceDetailComplete,false)
})
test('Velan changed closing criteria are held with both original models',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===roles[0]&&n===2)q.bodyText=q.bodyText.replace('Maintain accurate books','Maintain different books')})
 assert.ifError(error);assert.equal(jobs.length,11);assert.ok(!jobs.some(j=>j.jobId==='102026-62053'))
 const held=audits[0].heldNativeRows[0];assert.ok(held.opening.rawHTML.includes('Maintain accurate books'));assert.ok(held.closing.rawHTML.includes('Maintain different books'))
})
test('Velan changed closing office country stops qualification before further role reads',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===contact&&n===2)q.bodyText=q.bodyText.replace(/641 015 INDIA/g,'641 015 FRANCE')})
 assert.ifError(error);assert.equal(jobs.length,0);assert.equal(calls.length,18);assert.equal(audits[0].heldNativeRows.length,12)
})
test('Velan changed closing listing role is held before its next own-detail read',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===index&&n===2){const before=q.bodyText;q.bodyText=q.bodyText.replace(/Accountant\s+\(JOB ID: 102026-62053\)/,'Changed title (JOB ID: 102026-62053)');assert.notEqual(q.bodyText,before)}})
 assert.ifError(error);assert.equal(jobs.length,11);assert.equal(calls.length,29);assert.equal(audits[0].heldNativeRows.length,1)
})
test('Velan zero cap and exact pre-cancellation perform no public reads',async t=>{
 const zero=await replay(t,()=>{},{maxJobs:0});assert.ifError(zero.error);assert.equal(zero.jobs.length,0);assert.equal(zero.calls.length,0)
 const reason=Error('Cancel Velan before reads'),r=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('Velan positive caller cap still reconciles all native observations',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,30);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('Velan body-only transports and unsupported page caps are rejected before reads',async t=>{
 for(const options of [{fetchText:async()=>lookup(careers).bodyText},{fetchPage:async()=>({html:lookup(careers).bodyText})},{maxPages:1}]){
  const {jobs,error,calls}=await replay(t,()=>{},options);assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,0)}
})
for(const status of [202,401,403,429,451])test('Velan first HTTP '+status+' stops the source without empty success',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===careers)q.status=status});assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,1);assert.equal(calls[0].url,careers);assert.equal(error.status,status)
})
test('Velan first later denial retains earlier full criteria as partial and stops the source',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[1])q.status=403});assert.ifError(error);assert.equal(calls.length,5);assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'102026-62053');assert.ok(jobs[0].sourceDescription.length>700);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].nativeRoleClosingReconciled,false)
})
test('Velan hidden, delegated or newly typed job criteria require review',async t=>{
 for(const addition of ['<span style="display:none">Country: France; added eligibility</span>','<iframe src="https://www.velaninfo.com/extra-criteria"></iframe>',
  '<script type="application/LD+JSON">{"@type":"https://schema.org/JobPosting","jobLocation":{"address":{"addressCountry":"FR"}}}</script>']){
  const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[0])q.bodyText=q.bodyText.replace('Roles and Responsibilities:',addition+'Roles and Responsibilities:')})
  assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,4)
 }
})
test('Velan exact anonymous GETs use credentials omit and manual redirects',async t=>{
 const {error,calls}=await replay(t);assert.ifError(error);for(const {init}of calls){assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.ok(!init.body)}
})
test('Velan audit callbacks are awaited and preserve exact caller cancellation',async t=>{
 const controller=new AbortController(),reason=Error('Cancel Velan in audit')
 const {jobs,error}=await replay(t,()=>{},{signal:controller.signal,onAudit:async()=>{await Promise.resolve();controller.abort(reason)}});assert.ok(!jobs);assert.equal(error,reason)
})
test('Velan changing anonymous form tokens preserves both originals without changing complete role facts',async t=>{
 const {jobs,error}=await replay(t,(q,n)=>{if(n===2)q.bodyText=q.bodyText.replace(/(name="_token"\s+value=")[A-Za-z0-9]{40}("[^>]*>)/g,'$1'+'a'.repeat(40)+'$2')})
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(jobs.every(j=>j.sourceDetailComplete===true))
 assert.notDeepEqual(jobs[0].nativeSourceRecord,jobs[0].nativeClosingRecord);assert.notEqual(jobs[0].sourceRawNativeHTML,jobs[0].sourceClosingRawNativeHTML)
})
test('Velan an unsafe published position count cannot silently round or disappear',()=>{
 const html=lookup(index).bodyText.replace(/(JOB ID: 102026-62053\)[\s\S]{0,40}<span>\s*)2(\s*<span>)/,'$1'+'99999999999999999'+'$2')
 assert.notEqual(html,lookup(index).bodyText);assert.throws(()=>source.extractJobs(html),/count|position|opening/i)
})
test('Velan invalid published calendar dates cannot roll into another month',()=>{
 const html=lookup(index).bodyText.replace('15-10-2026','31-02-2026');assert.throws(()=>source.extractJobs(html),/date|calendar/i)
})
test('Velan hidden eligibility outside the original criterion column cannot qualify as complete visible criteria',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[0]){const before=q.bodyText;q.bodyText=q.bodyText.replace('<section class="employee-criteria-section">',
  '<section class="employee-criteria-section"><p style="display:none">Additional compulsory professional certification required.</p>');assert.notEqual(q.bodyText,before)}})
 assert.ok(!jobs);assert.match(error?.message||'',/hidden|unreviewed/);assert.equal(calls.length,4)
})
test('Velan a failing audit callback is delivered once after a changed closing careers declaration',async t=>{
 let callbacks=0;const reason=Error('Velan caller audit failure')
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(q.requestedURL===careers&&n===2){const before=q.bodyText;q.bodyText=q.bodyText.replace('id="fixed-current-openings"','id="changed-current-openings"');assert.notEqual(q.bodyText,before)}},
  {onAudit:async()=>{callbacks++;throw reason}})
 assert.ok(!jobs);assert.equal(error,reason);assert.equal(callbacks,1);assert.equal(calls.length,16)
})
test('Velan an additional native job-criteria section cannot silently disappear from a complete description',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[0]){const before=q.bodyText;q.bodyText=q.bodyText.replace('<section class="walk-in-section">',
  '<section class="additional-job-requirements"><h3>Additional eligibility</h3><p>Advanced professional certification is compulsory.</p></section><section class="walk-in-section">');assert.notEqual(q.bodyText,before)}})
 assert.ok(!jobs);assert.match(error?.message||'',/unreviewed|scope|section/);assert.equal(calls.length,4)
})
test('Velan explicit job workplace fields elsewhere in the own role cannot be replaced by delivery-center country',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0]){const before=q.bodyText;q.bodyText=q.bodyText.replace(/(<h3>Walk-in interview\s*<\/h3>)/,
  '$1<p>Job Location: Paris, France.</p>');assert.notEqual(q.bodyText,before)}})
 assert.ifError(error);const j=jobs.find(j=>j.jobId==='102026-62053');assert.equal(j.country,null);assert.equal(j.sourceDetailComplete,false)
})
test('Velan typed own-page geographic metadata cannot be ignored by the office-country join',async t=>{
 for(const edit of [html=>html.replace('</head>','<meta name="jobLocation" content="Paris, France"></head>'),
  html=>html.replace('<section class="job-detail-section">','<section class="job-detail-section" data-country="France">')]){
  const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0]){const before=q.bodyText;q.bodyText=edit(q.bodyText);assert.notEqual(q.bodyText,before)}})
  assert.ifError(error);const j=jobs.find(j=>j.jobId==='102026-62053');assert.equal(j.country,null);assert.equal(j.sourceDetailComplete,false)
 }
})
for(const surface of ['listing','role-metadata','assigned-office'])test('Velan labelled country without punctuation remains unreviewed in '+surface,async t=>{
 const {jobs,error}=await replay(t,q=>{
  const target=surface==='listing'?index:surface==='assigned-office'?contact:roles[0]
  if(q.requestedURL!==target)return;const before=q.bodyText
  if(surface==='listing')q.bodyText=q.bodyText.replace('<b>Experience:</b>','<b>Country</b> France</li><li><b>Experience:</b>')
  else if(surface==='role-metadata')q.bodyText=q.bodyText.replace('<span>Experience:</span>','<span>Country</span> France</p><p><span>Experience:</span>')
  else q.bodyText=q.bodyText.replace('A1, Harsha Garden','<strong>Country</strong> France<br>A1, Harsha Garden')
  assert.notEqual(q.bodyText,before)
 })
 assert.ifError(error);assert.equal(jobs.length,12)
 if(surface==='assigned-office')assert.ok(jobs.every(j=>j.country===null&&j.sourceDetailComplete===false))
 else{const j=jobs.find(j=>j.jobId==='102026-62053');assert.equal(j.country,null);assert.equal(j.sourceDetailComplete,false)}
})
test('Velan malformed closing own-role identity retains both originals and older partial facts before stopping',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===roles[0]&&n===2)q.bodyText=q.bodyText.replace('Velan | Accountant job in Coimbatore','Unrelated job publisher')})
 assert.ifError(error);assert.equal(jobs.length,11);assert.equal(calls.length,19);assert.ok(jobs.every(j=>j.sourceDetailComplete===false&&j.sourceDescription.length>700))
 const held=audits[0].heldNativeRows[0];assert.ok(held.opening.nativeRecord.role.criteria);assert.ok(held.opening.rawHTML.includes('Velan | Accountant job in Coimbatore'))
 assert.ok(held.closing.rawHTML.includes('Unrelated job publisher'))
})
test('Velan malformed closing native index holds every opening role before another office or detail read',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===index&&n===2){const before=q.bodyText;q.bodyText=q.bodyText.replace(/Velan \| Current Openings \| IT &(?:amp;)? BPO Job Opportunites at Velan/,'Unrelated native index');assert.notEqual(q.bodyText,before)}})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,17);const a=audits[0]||error.recruitmentObservations
 assert.equal(a.heldNativeRows.length,12);assert.ok(a.heldNativeRows[0].opening.nativeRecord.role.criteria);assert.ok(a.heldNativeRows[0].closing.rawHTML.includes('Unrelated native index'))
})
test('Velan registered normalization cannot supply India or employment for unresolved worksite country',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===contact)q.bodyText=q.bodyText.replace(/641 015 INDIA/g,'641 015 UNREVIEWED')},{},true)
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(jobs.every(j=>j.country===null&&j.city===null&&j.employmentType===null&&j.sourceDetailComplete===false&&j.sourceCountryScopeUnresolved===true))
})
test('Velan noncooperative transport cannot delay exact caller cancellation',async()=>{
 const controller=new AbortController(),reason=Error('Cancel noncooperative Velan transport');let release
 const pending=source.createVelanInfoServicesScraper({minIntervalMs:0,signal:controller.signal,fetchImpl:()=>new Promise(resolve=>{release=resolve})}).run()
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const outcome=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 const q=lookup(careers),response=new Response(q.bodyText,{headers:q.headers});Object.defineProperty(response,'url',{value:careers});release?.(response)
 await pending.catch(()=>{});assert.equal(outcome.error,reason)
})
test('Velan noncooperative body cleanup cannot delay exact caller cancellation',async()=>{
 const controller=new AbortController(),reason=Error('Cancel noncooperative Velan body');let ready,streamController
 const started=new Promise(resolve=>{ready=resolve}),fetchImpl=async()=>{
  const stream=new ReadableStream({start(c){streamController=c;ready()},cancel(){return new Promise(()=>{})}})
  const response=new Response(stream,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:careers});return response
 }
 const pending=source.createVelanInfoServicesScraper({fetchImpl,minIntervalMs:0,signal:controller.signal}).run()
 await started;await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const outcome=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 try{streamController.close()}catch{}await pending.catch(()=>{});assert.equal(outcome.error,reason)
})
for(const heading of ['Former Delivery Center','Interview Venue'])test('Velan '+heading+' does not establish a current worksite country',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===contact){const before=q.bodyText;q.bodyText=q.bodyText.replace(/>Delivery Center<\/h3>/g,'>'+heading+'</h3>');assert.notEqual(q.bodyText,before)}})
 assert.ifError(error);assert.equal(jobs.length,12);assert.ok(jobs.every(j=>j.country===null&&j.sourceDetailComplete===false))
})
for(const position of ['before-criteria','inside-form'])test('Velan new mandatory eligibility '+position+' cannot disappear from a complete role',async t=>{
 const requirement='Advanced professional certification is compulsory for this position.'
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL!==roles[0])return;const before=q.bodyText
  q.bodyText=position==='before-criteria'?q.bodyText.replace('<section class="employee-criteria-section">','<div class="additional-job-eligibility">'+requirement+'</div><section class="employee-criteria-section">'):
   q.bodyText.replace('<form class="careerForm" id="careerForm">','<form class="careerForm" id="careerForm"><p>'+requirement+'</p>')
  assert.notEqual(q.bodyText,before)
 })
 const j=jobs?.find(j=>j.jobId==='102026-62053')
 assert.ok(error||!j||!j.sourceDetailComplete||j.sourceDescription.includes(requirement),'Mandatory native eligibility was omitted while the role qualified')
})
test('Velan a closing comparison error holds the contradicted own-role model before stopping',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===roles[0]&&n===2)q.bodyText=q.bodyText.replace('Maintain accurate books','Maintain changed books').replace(/(name="_token"\s+value=")[A-Za-z0-9]{40}/,'$1bad')})
 assert.ifError(error);assert.equal(calls.length,19);assert.equal(jobs.length,11);assert.ok(!jobs.some(j=>j.jobId==='102026-62053'))
 const held=audits[0].heldNativeRows[0];assert.ok(held.opening.nativeRecord.role.criteria);assert.ok(held.closing.nativeRecord.role.criteria)
 assert.ok(held.closing.rawHTML.includes('Maintain changed books'));assert.ok(jobs.every(j=>j.sourceDetailComplete===false))
})
test('Velan a closing office comparison error holds every contradicted opening before stopping',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===contact&&n===2)q.bodyText=q.bodyText.replace(/641 015 INDIA/g,'641 015 FRANCE').replace(/(name="_token"\s+value=")[A-Za-z0-9]{40}/,'$1bad')})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,18);const a=audits[0]||error.recruitmentObservations
 assert.equal(a.heldNativeRows.length,12);assert.ok(a.heldNativeRows[0].closing.nativeRecord.candidates)
})
test('Velan cancellation settles while an audit callback remains pending',async()=>{
 const controller=new AbortController(),reason=Error('Cancel Velan pending audit');let ready,release,callbacks=0
 const started=new Promise(resolve=>{ready=resolve}),pending=source.createVelanInfoServicesScraper({maxJobs:0,signal:controller.signal,
  onAudit:()=>{callbacks++;ready();return new Promise(resolve=>{release=resolve})}}).run()
 await started;controller.abort(reason)
 const outcome=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 release?.();await pending.catch(()=>{});assert.equal(outcome.error,reason);assert.equal(callbacks,1)
})
test('Velan delegated eligibility elsewhere in the full role region cannot be mistaken for the interview map',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[0])q.bodyText=q.bodyText.replace('<section class="employee-criteria-section">',
  '<div class="additional-job-eligibility"><iframe src="https://www.velaninfo.com/mandatory-criteria"></iframe></div><section class="employee-criteria-section">')})
 assert.ok(!jobs);assert.match(error?.message||'',/delegated|map|frame|review/);assert.equal(calls.length,4)
})
test('Velan inline frame content cannot hide mandatory criteria behind the known map URL',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[0]){const before=q.bodyText;q.bodyText=q.bodyText.replace(/<iframe\s+(?=src="https:\/\/www\.google\.com\/maps\/embed\?)/,
  '<iframe srcdoc="Advanced professional certification is compulsory" ');assert.ok(q.bodyText!==before,'Known interview frame mutation was applied')}})
 assert.ok(!jobs);assert.match(error?.message||'',/delegated|map|frame|review/);assert.equal(calls.length,4)
})
