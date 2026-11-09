import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/cyfuture/script.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/cyfuture-native-quality.json.gz',import.meta.url))))
const index='https://cyfuture.com/current-opportunities.html',contact='https://cyfuture.com/contact-us.html'
const lookup=url=>fixture.packets.find(q=>q.requestedURL===url),sha=v=>createHash('sha256').update(v).digest('hex')
const roleURLs=fixture.packets.filter(q=>q.requestedURL.includes('/apply-job/')).map(q=>q.requestedURL)
const fullOrder=[index,contact,...roleURLs,index,contact,...roleURLs]
async function replay(t,edit=()=>{},options={},registered=false){
 const calls=[],counts=new Map(),audits=[]
 const fetchImpl=async(url,init={})=>{
  url=String(url);calls.push({url,init});const packet=lookup(url)
  assert.ok(packet,'Uncaptured Cyfuture URL: '+url)
  const q=structuredClone(packet),n=(counts.get(url)||0)+1;counts.set(url,n);edit(q,n)
  if(q.error)throw Object.assign(Error(q.error),{abortRetries:true})
  const response=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const settings={fetchImpl,minIntervalMs:0,now:()=> '2026-11-05T15:00:00.000Z',...options,
  onAudit:async audit=>{audits.push(audit);await options.onAudit?.(audit)}}
 let jobs,error
 try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='cyfuture')).run(settings):source.createCyfutureScraper(settings).run())}catch(e){error=e}
 return {jobs,error,calls,audits}
}
test('Cyfuture quality fixture retains twelve distinct original successful public HTML responses',()=>{
 assert.equal(fixture.packets.length,12);assert.equal(new Set(fixture.packets.map(q=>q.requestedURL)).size,12)
 for(const q of fixture.packets){assert.equal(q.status,200);assert.equal(q.replayed,false);assert.equal(sha(Buffer.from(q.bodyText)),q.bodySHA256);assert.equal(Buffer.byteLength(q.bodyText),q.bodyBytes)}
})
test('Cyfuture listing helpers preserve native locations without a city-country dictionary or fabricated requisitions',()=>{
 const rows=source.extractCurrentOpportunities(lookup(index).bodyText);assert.equal(rows.length,10)
 for(const row of rows){assert.equal(row.country,null);assert.equal(row.city,null);assert.equal(row.state,null);assert.equal(row.location,null);assert.equal(row.requisitionId,null);assert.ok(row.nativeLocation)}
 assert.deepEqual(rows.map(r=>r.jobId),['146','143','116','91','126','101','98','70','94','93'])
})
test('Cyfuture detail helpers retain full native criteria and cannot inherit an unproven caller country',()=>{
 const url=roleURLs[0],job=source.extractJobDetail(lookup(url).bodyText,{jobId:'146',sourceUrl:url,country:'India',location:'Noida, India'})
 assert.equal(job.country,null);assert.equal(job.requisitionId,null);assert.equal(job.legalEmployer,null)
 assert.ok(job.nativeSourceRecord);assert.match(job.sourceDescription,/Recruiter Details/);assert.ok(job.sourceDescription.includes('years’ of relevant experience'))
})
test('Cyfuture reconciles ten whole roles and all native country-office context using twenty-four declared reads',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error)
 assert.deepEqual(jobs[0]?.sourceNativeCollectionAudit.failures,[],'Native collection failures: '+JSON.stringify(jobs[0]?.sourceNativeCollectionAudit.failures))
 assert.equal(jobs.length,10);assert.deepEqual(calls.map(c=>c.url),fullOrder)
 assert.deepEqual(jobs.map(j=>j.jobId),['146','143','116','91','126','101','98','70','94','93'])
 for(const j of jobs){assert.equal(j.country,'India');assert.equal(j.sourceCountryScopeUnresolved,false);assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true)
  assert.equal(j.sourceDescription,j.jobDescription);assert.ok(j.sourceDescription.length>500);assert.ok(j.nativeSourceRecord);assert.ok(j.nativeClosingRecord)
  assert.equal(j.sourceWorksiteCountryProof.method,'role-location-to-publisher-office-country-group');assert.equal(j.sourceWorksiteCountryProof.exactCampusEstablished,false)}
})
test('Cyfuture actual India office-tab membership supplies country without treating company spelling or HQ as country',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 const noida=jobs.find(j=>j.jobId==='146');assert.equal(noida.nativeLocation,'Noida');assert.equal(noida.location,'Noida');assert.equal(noida.city,null);assert.equal(noida.state,null)
 assert.equal(noida.sourceWorksiteCountryProof.countryLabel,'INDIA');assert.equal(noida.sourceWorksiteCountryProof.matchingOffices.length,2)
 assert.equal(noida.sourceWorksiteCountryProof.contactURL,contact);assert.equal(noida.sourceWorksiteCountryProof.contextualBinding,true)
})
test('Cyfuture full native recruiter and optional benefits sections survive without truncated qualification projections',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 const role=jobs.find(j=>j.jobId==='146');assert.match(role.sourceDescription,/Recruiter Details/);assert.match(role.sourceDescription,/Perks and Benefits/)
 assert.ok(role.sourceDescription.includes('years’ of relevant experience'));assert.equal(role.minimumQualification,null)
 for(const key of ['requisitionId','legalEmployer','postingDate','postedAt','closingDate','firstEverPublication'])assert.equal(role[key],null,key)
 assert.equal(role.applicationUrlIsGeneric,true);assert.equal(role.applicationVisited,false);assert.equal(role.activeApplyVerified,false)
 assert.notEqual(jobs.find(j=>j.jobId==='91').sourceUrl,jobs.find(j=>j.jobId==='70').sourceUrl)
})
test('Cyfuture preserves every original opening and closing index, office and role body with hashes',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs[0],packet=lookup(j.sourceUrl)
 for(const [key,q]of [['sourceRawNativeHTML',packet],['sourceClosingRawNativeHTML',packet],['sourceRawNativeIndexHTML',lookup(index)],
  ['sourceClosingRawNativeIndexHTML',lookup(index)],['sourceRawNativeOfficeHTML',lookup(contact)],['sourceClosingRawNativeOfficeHTML',lookup(contact)]]){
  assert.equal(j[key],q.bodyText);assert.equal(j[key+'SHA256'],q.bodySHA256)}
 assert.equal(j.sourceNativeCollectionAudit.responses.length,24)
})
test('Cyfuture registered route preserves own role identity and leaves company/listing/cleanup authority unqualified',async t=>{
 const {jobs,error}=await replay(t,()=>{},{},true);assert.ifError(error);assert.equal(jobs.length,10)
 for(const j of jobs){assert.equal(j.source,'cyfuture');assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)}
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRecords,10)
})
test('Cyfuture missing native India country label cannot be replaced by a company or provider default',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===contact)q.bodyText=q.bodyText.replace('>INDIA</span>','>UNREVIEWED</span>')})
 assert.ifError(error);assert.equal(jobs.length,10);assert.ok(jobs.every(j=>j.country===null&&j.sourceDetailComplete===false&&j.sourceCountryScopeUnresolved===true))
})
test('Cyfuture a changed closing office-country label withholds opening roles before further detail reads',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===contact&&n===2)q.bodyText=q.bodyText.replace('>INDIA</span>','>FRANCE</span>')})
 assert.ok(!jobs||jobs.length===0);assert.equal(calls.length,14)
 const audit=audits[0]||error?.recruitmentObservations;assert.equal(audit.heldNativeRows.length,10);assert.ok(audit.heldNativeRows[0].opening.nativeRecord)
})
test('Cyfuture a changed closing listed role is held before its next detail read',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===index&&n===2)q.bodyText=q.bodyText.replaceAll('SOCIAL MEDIA EXECUTIVE / Sr EXECUTIVE','Changed native post title')})
 assert.ifError(error);assert.equal(jobs.length,9);assert.equal(calls.length,23)
 const audit=audits[0];assert.equal(audit.heldNativeRows.length,1);assert.ok(audit.heldNativeRows[0].opening.nativeRecord)
})
test('Cyfuture changed closing full criteria cannot regain qualification through an unchanged listing',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===roleURLs[0]&&n===2)q.bodyText=q.bodyText.replace('social media strategies.','social media strategies with a changed requirement.')})
 assert.ifError(error);assert.equal(jobs.length,9);assert.ok(!jobs.some(j=>j.jobId==='146'));assert.equal(audits[0].heldNativeRows.length,1)
})
test('Cyfuture first later denial retains earlier whole native observations as partial and stops the source',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roleURLs[1])q.status=403})
 assert.ifError(error);assert.equal(calls.length,4);assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'146')
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].nativeRoleClosingReconciled,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
for(const status of [202,401,403,429,451])test('Cyfuture first HTTP '+status+' stops the whole source without empty success',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===index)q.status=status})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,1);assert.equal(calls[0].url,index)
})
test('Cyfuture zero caller cap and exact pre-cancellation perform no HTTP reads',async t=>{
 const zero=await replay(t,()=>{},{maxJobs:0});assert.ifError(zero.error);assert.equal(zero.jobs.length,0);assert.equal(zero.calls.length,0)
 const reason=Error('Cancel Cyfuture before reads'),a=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(a.error,reason);assert.equal(a.calls.length,0)
})
test('Cyfuture a positive cap still reconciles all source observations without cleanup permission',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,24);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('Cyfuture body-only legacy transports and unsupported page caps are rejected before reads',async t=>{
 for(const options of [{fetchPage:async()=>({status:200,url:index,html:lookup(index).bodyText})},{fetchText:async()=>lookup(index).bodyText},{maxPages:1}]){
  const r=await replay(t,()=>{},options);assert.ok(r.error);assert.equal(r.calls.length,0)}
})
test('Cyfuture exact anonymous GETs omit credentials and manually expose redirects',async t=>{
 const {error,calls}=await replay(t);assert.ifError(error)
 for(const {init}of calls){assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.ok(!init.body)}
})
test('Cyfuture awaited audit callbacks preserve exact caller cancellation',async t=>{
 const controller=new AbortController(),reason=Error('Cancel Cyfuture audit')
 const {jobs,error}=await replay(t,()=>{},{signal:controller.signal,onAudit:async()=>{await Promise.resolve();controller.abort(reason)}})
 assert.ok(!jobs);assert.equal(error,reason)
})
const rekey=hex=>{
 const b=Buffer.from(hex,'hex'),key=(b[0]+31)%256
 return Buffer.from([key,...b.subarray(1).map(v=>v^b[0]^key)]).toString('hex')
}
const emailEncoding=(text,edit)=>text.replace(/(data-cfemail=")([a-f0-9]+)(")/gi,(_,a,b,c)=>a+edit(b)+c)
 .replace(/(\/cdn-cgi\/l\/email-protection#)([a-f0-9]+)/gi,(_,a,b)=>a+edit(b))
test('Cyfuture hidden native criteria cannot silently qualify through a visible sibling',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roleURLs[0])q.bodyText=q.bodyText.replace('<h2>Skill Requirement</h2>',
  '<h2>Skill Requirement</h2><span style="display:none">Country: France; extra eligibility condition</span>')})
 assert.ok(!jobs);assert.match(error?.message||'',/hidden|unreviewed/);assert.equal(calls.length,3)
})
test('Cyfuture new native role schemas require review despite CSS, hidden attributes and MIME casing',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===index)q.bodyText=q.bodyText.replace('</head>',
  '<script hidden style="display:none" type="application/LD+JSON">{"@type":"JobPosting","jobLocation":{"address":{"addressCountry":"FR"}}}</script></head>')})
 assert.ok(!jobs);assert.match(error?.message||'',/JobPosting/);assert.equal(calls.length,1)
})
test('Cyfuture changing public email encodings preserves both actual models and compares the same public value',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(n===2&&q.requestedURL!==index)q.bodyText=emailEncoding(q.bodyText,rekey)})
 assert.ifError(error);assert.equal(jobs.length,10);assert.equal(calls.length,24);assert.ok(jobs.every(j=>j.sourceDetailComplete===true))
 assert.notDeepEqual(jobs[0].nativeSourceRecord,jobs[0].nativeClosingRecord)
 assert.notEqual(jobs[0].sourceRawNativeOfficeHTML,jobs[0].sourceClosingRawNativeOfficeHTML)
})
test('Cyfuture a changed underlying public contact value cannot hide behind an email encoding change',async t=>{
 const key=19,changed=Buffer.from([key,...Buffer.from('changed-public-contact@cyfuture.com').map(v=>v^key)]).toString('hex')
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===contact&&n===2)q.bodyText=q.bodyText.replace(/data-cfemail="[a-f0-9]+"/i,'data-cfemail="'+changed+'"')})
 assert.ifError(error);assert.equal(jobs.length,0);assert.equal(calls.length,14);assert.equal(audits[0].heldNativeRows.length,10)
})
test('Cyfuture a matching city office outside the India group prevents a headquarters country default',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===contact){const start=q.bodyText.indexOf('id="europe"'),marker='<div class="row locations-grid">'
  const at=q.bodyText.indexOf(marker,start);assert.ok(at>start)
  q.bodyText=q.bodyText.slice(0,at+marker.length)+'<div class="location-card"><p class="office-title">Noida Overseas Office</p><div class="address-info">Cyfuture India Pvt Ltd. Noida, France</div></div>'+q.bodyText.slice(at+marker.length)
 }})
 assert.ifError(error);assert.equal(jobs.length,10)
 assert.ok(jobs.filter(j=>j.nativeLocation==='Noida').every(j=>j.country===null&&j.sourceDetailComplete===false))
 assert.ok(jobs.filter(j=>j.nativeLocation!=='Noida').every(j=>j.country==='India'&&j.sourceDetailComplete===true))
})
test('Cyfuture an explicit foreign work assignment overrides the city-office country inference',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roleURLs[0])q.bodyText=q.bodyText.replace('<h2>Skill Requirement</h2>',
  '<h2>Skill Requirement</h2><p>This role operates in Paris, France.</p>')})
 assert.ifError(error);assert.equal(jobs.length,10)
 const j=jobs.find(j=>j.jobId==='146');assert.equal(j.country,null);assert.equal(j.sourceDetailComplete,false)
 assert.ok(j.sourceDescription.includes('This role operates in Paris, France.'))
})
test('Cyfuture malformed closing role retains the whole excluded opening model and conflicting original body',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===roleURLs[0]&&n===2)q.bodyText=q.bodyText.replace('<title>Apply for Job ID 146','<title>Unrelated post 146')})
 assert.ifError(error);assert.equal(jobs.length,9);assert.equal(calls.length,15);assert.ok(jobs.every(j=>j.sourceDetailComplete===false))
 const held=audits[0].heldNativeRows[0];assert.ok(held.opening.nativeRecord.role.tree);assert.ok(held.opening.rawHTML.includes('Apply for Job ID 146'))
 assert.ok(held.closing.rawHTML.includes('Unrelated post 146'))
})
test('Cyfuture malformed closing index retains every opening model and stops before further offices or roles',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===index&&n===2)q.bodyText=q.bodyText.replace('<title>Career Opportunities at Cyfuture</title>','<title>Unrelated</title>')})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,13)
 const audit=audits[0]||error.recruitmentObservations;assert.equal(audit.heldNativeRows.length,10);assert.ok(audit.heldNativeRows[0].opening.nativeRecord.role.tree)
 assert.ok(audit.heldNativeRows[0].closing.rawHTML.includes('<title>Unrelated</title>'))
})
test('Cyfuture noncooperative transport preserves exact cancellation without waiting for cleanup',async t=>{
 const controller=new AbortController(),reason=Error('Cancel noncooperative Cyfuture transport');let release,calls=0
 const fetchImpl=()=>++calls===1?new Promise(resolve=>{release=resolve}):Promise.reject(Object.assign(Error('Late test cleanup'),{abortRetries:true}))
 const pending=source.createCyfutureScraper({fetchImpl,minIntervalMs:0,signal:controller.signal}).run()
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const result=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 const response=new Response(lookup(index).bodyText,{headers:lookup(index).headers});Object.defineProperty(response,'url',{value:index});release?.(response)
 await pending.catch(()=>{});assert.equal(result.error,reason)
})
test('Cyfuture noncooperative body cancellation cannot block the exact caller reason',async()=>{
 const controller=new AbortController(),reason=Error('Cancel Cyfuture body');let streamController,ready
 const started=new Promise(resolve=>{ready=resolve})
 const fetchImpl=async()=>{const stream=new ReadableStream({start(c){streamController=c;ready()},cancel(){return new Promise(()=>{})}})
  const response=new Response(stream,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:index});return response}
 const pending=source.createCyfutureScraper({fetchImpl,minIntervalMs:0,signal:controller.signal}).run()
 await started;await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const result=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 try{streamController.close()}catch{}
 await pending.catch(()=>{});assert.equal(result.error,reason)
})
test('Cyfuture ordinary role location and future posting wording cannot contradict the office-country binding',async t=>{
 for(const statement of ['Location: Paris, France.','Worksite: Paris, France.','This position will be based at Paris, France.']){
  const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roleURLs[0])q.bodyText=q.bodyText.replace('<h2>Skill Requirement</h2>','<h2>Skill Requirement</h2><p>'+statement+'</p>')})
  assert.ifError(error);const j=jobs.find(j=>j.jobId==='146');assert.equal(j.country,null,statement);assert.equal(j.sourceDetailComplete,false,statement)
 }
})
test('Cyfuture conflicting country fields in native listing and assigned office data remain unqualified',async t=>{
 const listing=await replay(t,q=>{if(q.requestedURL===index)q.bodyText=q.bodyText.replace('<strong>Experience</strong>',
  '<strong>Country</strong><span>France</span></li><li><strong>Experience</strong>')})
 assert.ifError(listing.error);assert.equal(listing.jobs.find(j=>j.jobId==='146').country,null)
 const office=await replay(t,q=>{if(q.requestedURL===contact)q.bodyText=q.bodyText.replace('Plot No. 197-198','Country: France<br>Plot No. 197-198')})
 assert.ifError(office.error);assert.ok(office.jobs.filter(j=>j.nativeLocation==='Noida').every(j=>j.country===null&&j.sourceDetailComplete===false))
})
test('Cyfuture ungrouped native office cards cannot disappear from country consensus',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===contact)q.bodyText=q.bodyText.replace('<div class="container gl-locations gl-locations3">',
  '<div class="container gl-locations gl-locations3"><div class="location-card"><p class="office-title">Noida Ungrouped Office</p><div class="address-info">Country: France</div></div>')})
 assert.ifError(error);assert.equal(jobs.length,10);assert.ok(jobs.filter(j=>j.nativeLocation==='Noida').every(j=>j.country===null&&j.sourceDetailComplete===false))
})
test('Cyfuture fully qualified and prefixed native JobPosting types require field review',async t=>{
 for(const type of ['https://schema.org/JobPosting','http://schema.org/JobPosting','schema:JobPosting']){
  const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===index)q.bodyText=q.bodyText.replace('</head>',
   '<script type="application/ld+json">{"@type":"'+type+'","jobLocation":{"address":{"addressCountry":"FR"}}}</script></head>')})
  assert.ok(!jobs,type);assert.match(error?.message||'',/JobPosting|schema.*review/);assert.equal(calls.length,1)
 }
})
test('Cyfuture declared role criteria delegation cannot silently become complete native detail',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roleURLs[0])q.bodyText=q.bodyText.replace('<h2>Skill Requirement</h2>',
  '<h2>Skill Requirement</h2><iframe src="/additional-eligibility" title="Additional eligibility"></iframe>')})
 assert.ok(!jobs);assert.match(error?.message||'',/delegat|embedded|unreviewed/);assert.equal(calls.length,3)
})
test('Cyfuture native position counts cannot round an unsafe published integer',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===index)q.bodyText=q.bodyText.replace('1&nbsp; Opening','99999999999999999&nbsp; Opening')})
 assert.ok(!jobs);assert.match(error?.message||'',/position|count/);assert.equal(calls.length,1)
})
