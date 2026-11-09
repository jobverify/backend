import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import * as source from '../scraper/adidas.workday/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/adidas-native-quality.json.gz',import.meta.url))))
const sha=v=>createHash('sha256').update(v).digest('hex')
async function replay(t,edit=()=>{},options={},registered=false){
 const calls=[],counts=new Map(),audits=[]
 const fetchImpl=async(url,init={})=>{url=String(url);calls.push({url,init});const original=f.packets.find(q=>q.requestedURL===url);if(!original)throw Object.assign(Error('Uncaptured Adidas URL '+url),{abortRetries:true})
  const q=structuredClone(original),n=(counts.get(url)||0)+1;counts.set(url,n);edit(q,n)
  const r=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r}
 t.mock.method(globalThis,'fetch',fetchImpl)
 const settings={fetchImpl,minIntervalMs:0,now:()=> '2026-11-05T21:20:00.000Z',...options,onAudit:async a=>{audits.push(a);await options.onAudit?.(a)}}
 let jobs,error;try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='adidas')).run(settings):source.run(settings))}catch(e){error=e}
 return {jobs,error,calls,audits}
}
test('Adidas original fixture retains all fourteen current successful public responses',()=>{
 assert.equal(f.packets.length,14);for(const q of f.packets){assert.equal(q.replayed,false);assert.equal(q.status,200);assert.equal(sha(q.bodyText),q.bodySHA256);assert.equal(Buffer.byteLength(q.bodyText),q.bodyBytes)}
})
test('Adidas registered reader qualifies nine complete own India vacancies and holds the talent pool',async t=>{
 const {jobs,error}=await replay(t,()=>{},{},true);assert.ifError(error);assert.equal(jobs.length,9)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete===true&&j.nativeRoleClosingReconciled===true))
 assert.ok(jobs.every(j=>!j.title.includes('Talent Pool')));assert.ok(jobs[0].sourceNativeCollectionAudit.heldNativeRows.some(r=>r.reason==='talent-pool'))
})
const roles=f.packets.slice(4).map(q=>q.requestedURL),india=f.packets[3].requestedURL
const change=(q,a,b)=>{const old=q.bodyText;q.bodyText=q.bodyText.replace(a,b);assert.notEqual(q.bodyText,old,'Mutation must change actual original content')}
test('Adidas entire native role criteria, benefits and brand paragraphs survive both observations',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.equal(calls.length,28)
 assert.deepEqual(calls.map(c=>c.url),[...f.packets,...f.packets].map(q=>q.requestedURL))
 for(const job of jobs){assert.equal(job.sourceDescription,job.nativeSourceRecord.role.criteriaText);assert.ok(job.sourceDescription.includes(job.nativeJobDescription));assert.ok(job.sourceDescription.includes('Culture Starts With People'));assert.deepEqual(job.nativeSourceRecord,job.nativeClosingRecord)}
 assert.ok(jobs.find(j=>j.nativeAdvertisementNumber==='548541').sourceDescription.includes('Flexibility and willingness to relocate at Company'))
})
test('Adidas page tokens, native Number labels, formal requisitions and seat counts remain distinct',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);for(const job of jobs){assert.equal(job.jobId,null);assert.equal(job.requisitionId,null);assert.equal(job.numberOfOpenings,null);assert.notEqual(job.nativePublicPageID,job.nativeAdvertisementNumber);assert.match(job.nativePublicPageID,/^\d+$/);assert.equal(job.legalEmployer,null);assert.equal(job.firstEverPublication,null);assert.equal(job.publicationTimezone,null);assert.equal(job.postedAt,null);assert.equal(job.sourceDatePrecision,'calendar-date');assert.equal(job.postingDate,null);assert.match(job.nativeDateCalendar,/^2026-10-\d{2}$/)}
})
test('Adidas native country-only India location cannot become a city or state',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const job=jobs.find(j=>j.nativeAdvertisementNumber==='548541');assert.equal(job.city,null);assert.equal(job.state,null);assert.equal(job.location,'India');assert.equal(job.nativeLocationLabel,'India');assert.equal(job.country,'India')
})
test('Adidas exact native state abbreviations and full-time labels are retained',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(jobs[0].city,'Noida');assert.equal(jobs[0].state,'UP');assert.ok(jobs.every(j=>j.employmentType==='Full time'));assert.equal(jobs[0].sourceWorksiteCountryProof.nativeCountryLabel,'IN');assert.equal(jobs[0].sourceWorksiteCountryProof.literalRoleCountry,true)
})
test('Adidas original opening and closing HTML and client bytes remain intact',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);for(const j of jobs)for(const p of ['source','sourceClosing'])for(const s of ['Publisher','Index','Client','Listing','Role'])assert.equal(sha(j[p+'RawNative'+s]),j[p+'RawNative'+s+'SHA256'])
})
test('Adidas current role application declarations are retained without any application visit',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.credentials==='omit'&&c.init.redirect==='manual'&&!c.init.body&&!/talentcommunity|login|apply\//i.test(c.url)));for(const j of jobs){assert.ok(j.applyUrl.includes('/talentcommunity/apply/'+j.nativePublicPageID+'/'));assert.equal(j.applicationVisited,false);assert.equal(j.applicationFormSubmitted,false);assert.equal(j.activeApplyVerified,false);assert.equal(j.nativeApplicationsOpen,null)}
})
test('Adidas employer proof is its own first-person employee statement without changing protected catalog identity',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.ok(jobs.every(j=>j.nativeHiringOrganization.name==='adidas'&&j.nativeHiringOrganization.employees.includes('our employees')));const p=getScraperCatalog().find(p=>p.source==='adidas');assert.equal(p.requireNativeEmployerName,true);assert.equal(p.companyDomain,'adidas-group.com');assert.ok(p.modulePath.endsWith('adidas.workday\\script.js')||p.modulePath.endsWith('adidas.workday/script.js'))
})
test('Adidas missing native brand evidence cannot borrow the catalog employer',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'At adidas, we strongly believe','At another company, we strongly believe')});assert.ok(!jobs);assert.match(error.message,/employer witness/)
})
for(const label of ['US','Unknown',''])test('Adidas native role country '+label+' cannot borrow the India search facet',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,/(data-careersite-propertyid="country"[^>]*>)IN/,'$1'+label)});assert.ifError(error);assert.equal(jobs[0].country,null);assert.equal(jobs[0].city,null);assert.equal(jobs[0].state,null);assert.equal(jobs[0].sourceDetailComplete,false)
})
test('Adidas visible native Country/Region label must actually label the country property',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'Country/Region:','Preferred sales market:')});assert.ok(error||jobs[0].country===null)
})
test('Adidas a second city-only workplace cannot be silently classified as India',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'<section class="box-diversity">','<section class="box-diversity"><p>This role will be based in Toronto.</p>')});assert.ifError(error);assert.equal(jobs[0].country,null);assert.ok(jobs[0].sourceDescription.includes('Toronto'))
})
test('Adidas additional visible criteria outside the native description property are retained',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'<section class="box-diversity">','<section class="box-diversity"><p>Mandatory professional registration is required.</p>')});assert.ifError(error);assert.ok(jobs[0].sourceDescription.includes('Mandatory professional registration'))
})
for(const addition of ['<p hidden>Mandatory extra qualification</p>','<iframe src="https://unknown.example/criteria"></iframe>'])test('Adidas hidden or delegated criteria require review: '+addition.slice(0,15),async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'<section class="box-diversity">','<section class="box-diversity">'+addition)});assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,5)
})
test('Adidas newly published structured job metadata requires review rather than conflicting silently',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'</head>','<script type="application/ld+json">{"@type":"JobPosting","jobLocation":{"addressCountry":"US"}}</script></head>')});assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,5)
})
test('Adidas duplicate canonical listing rows cannot be counted twice',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===india)change(q,roles[1].replaceAll('&','&amp;'),roles[0].replaceAll('&','&amp;'))});assert.ok(!jobs);assert.match(error.message,/duplicate canonical/);assert.equal(calls.length,4)
})
test('Adidas changed closing full criteria withholds the stale role before later failures',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===roles[0]&&n===2)change(q,'<section class="box-diversity">','<section class="box-diversity"><p>New mandatory certification.</p>');if(q.requestedURL===roles[1]&&n===2)q.status=403});assert.ifError(error);assert.equal(jobs.length,8);assert.ok(jobs.every(j=>!j.sourceUrl.includes('1452887433')));assert.ok(jobs.every(j=>j.sourceDetailComplete===false));assert.ok(audits[0].heldNativeRows.some(r=>r.reason==='closing whole role model changed'))
})
test('Adidas changed closing whole listing withholds all stale vacancies',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===india&&n===2)change(q,'October 30 2026 - 551532','October 31 2026 - 551532')});assert.ok(!jobs);assert.ok(error);assert.equal(audits[0].heldNativeRows.filter(r=>r.reason!=='talent-pool').length,9)
})
test('Adidas source scope and lifecycle cleanup remain unqualified',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.ok(jobs.every(j=>!j.sourceScopeComplete&&!j.sourceListingComplete&&!j.lifecycleCleanupAllowed));assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const status of [202,403,429])test('Adidas first HTTP '+status+' stops the source without retrying',async t=>{const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===f.packets[0].requestedURL)q.status=status});assert.ok(!jobs);assert.equal(error.status,status);assert.equal(calls.length,1)})
test('Adidas a later denied role returns earlier complete criteria as partial and stops immediately',async t=>{const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[1])q.status=403});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(calls.length,6)})
test('Adidas zero cap, pre-abort and unsupported transports make no requests',async t=>{
 const zero=await replay(t,()=>{},{maxJobs:0});assert.ifError(zero.error);assert.equal(zero.jobs.length,0);assert.equal(zero.calls.length,0)
 const reason=Error('Cancel Adidas'),cancelled=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(cancelled.error,reason);assert.equal(cancelled.calls.length,0)
 for(const o of [{fetchText:async()=>''},{maxPages:1},{maxJobs:-1}]){const r=await replay(t,()=>{},o);assert.ok(r.error);assert.equal(r.calls.length,0)}
})
test('Adidas positive result cap reconciles the whole declared surface before slicing',async t=>{const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,28)})
test('Adidas original UTF-8 BOM survives response byte retention',async t=>{const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])q.bodyText='\ufeff'+q.bodyText});assert.ifError(error);assert.equal(jobs[0].sourceRawNativeRole.charCodeAt(0),65279);assert.equal(sha(jobs[0].sourceRawNativeRole),jobs[0].sourceRawNativeRoleSHA256)})
test('Adidas advertised oversized responses stop before any next read',async t=>{const {jobs,error,calls}=await replay(t,q=>{q.headers['content-length']='5000000'});assert.ok(!jobs);assert.match(error.message,/response bound/);assert.equal(calls.length,1)})
test('Adidas exact cancellation interrupts a pending uncooperative transport',async t=>{const controller=new AbortController(),reason=Error('Cancel pending Adidas read'),timer=setTimeout(()=>controller.abort(reason),15);try{const r=await replay(t,()=>{},{signal:controller.signal,fetchImpl:()=>new Promise(()=>{})});assert.equal(r.error,reason)}finally{clearTimeout(timer)}})
test('Adidas exact cancellation interrupts a pending audit callback',async t=>{const controller=new AbortController(),reason=Error('Cancel Adidas audit');const r=await replay(t,()=>{},{signal:controller.signal,maxJobs:0,onAudit:async()=>{setTimeout(()=>controller.abort(reason),10);await new Promise(()=>{})}});assert.equal(r.error,reason);assert.equal(r.calls.length,0)})
test('Adidas stylesheet-hidden mandatory criteria require review',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0]){change(q,'</head>','<style>.extra-required { display:none }</style></head>');change(q,'<section class="box-diversity">','<section class="box-diversity"><p class="extra-required">Mandatory extra certification.</p>')}});assert.ok(!jobs);assert.ok(error)
})
test('Adidas a conflicting native listing country cannot bind the own India role',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===india)change(q,/(<p class="job-list__facts">\s*)Noida, India/,'$1Noida, France')});assert.ok(error||jobs[0].country===null)
})
test('Adidas added closing geographic head metadata withholds the stale role',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===roles[0]&&n===2)change(q,'</head>','<meta name="jobLocation" content="Paris, France"></head>')});assert.ifError(error);assert.equal(jobs.length,8);assert.ok(jobs.every(j=>!j.sourceUrl.includes('1452887433')));assert.ok(audits[0].heldNativeRows.some(r=>r.sourceUrl.includes('1452887433')))
})
test('Adidas mixed-case whitespace schema MIME declarations require review',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'</head>','<script type="application/LD+JSON ">{"@type":"JobPosting","jobLocation":{"addressCountry":"FR"}}</script></head>')});assert.ok(!jobs);assert.ok(error)
})
test('Adidas a commented country options declaration is not executable literal data',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===f.packets[1].requestedURL)change(q,/(var locationswithregion = \{[^\n]+\};)/,'/* $1 */')});assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,2)
})
test('Adidas disagreeing native calendar labels do not invent a publication date',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs.find(j=>j.nativeAdvertisementNumber==='548541');assert.equal(j.postingDate,null);assert.equal(j.nativeDateCalendar,'2026-10-15');assert.match(j.nativeSourceRecord.listing.numberDate,/August 18 2026/);assert.equal(j.nativeSourceRecord.role.fields.date,'Oct 15, 2026')
})
