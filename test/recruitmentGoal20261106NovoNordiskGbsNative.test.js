import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,createNovoNordiskGBSScraper} from '../scraper/novonordiskgbs/script.js'
import {readPublisher,readListing,readRole,makeJob,countryProof,roleDeadline} from '../scraper/novonordiskgbs/nativeModels.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/novonordiskgbs-native-quality.json.gz',import.meta.url))))
const sha=b=>createHash('sha256').update(b).digest('hex')
const packets=fixture.packets,india=packets[1].requestedURL,roles=packets.slice(2).map(q=>q.requestedURL),now='2026-11-05T22:40:00.000Z'
const replay=async (t,mutate=()=>{},options={})=>{
 const calls=[],audits=[],counts=new Map()
 const fetchImpl=async(url,init)=>{calls.push({url,init});const q=structuredClone(packets.find(q=>q.requestedURL===url));assert.ok(q,'Only publisher-declared public URLs may be read');const n=(counts.get(url)||0)+1;counts.set(url,n);mutate(q,n);const response=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response}
 const {registered=false,...settings}=options
 let jobs,error;try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='novonordiskgbs')).run:run)({now,minIntervalMs:0,fetchImpl,onAudit:a=>audits.push(a),...settings})}catch(e){error=e}
 return {jobs,error,calls,audits}
}
const change=(q,from,to)=>{const old=q.bodyText;q.bodyText=q.bodyText.replace(from,to);assert.notEqual(old,q.bodyText,'Mutation must change the actual original body')}
test('Novo current company paragraphs recover GBS roles while retaining unknown countries and expired roles separately',async t=>{
 const {jobs,error,calls,audits}=await replay(t);assert.ifError(error)
 assert.equal(calls.length,46);assert.equal(jobs.length,14)
 assert.equal(jobs.filter(j=>j.country==='India'&&j.sourceDetailComplete).length,9)
 assert.equal(jobs.filter(j=>j.country===null&&!j.sourceDetailComplete).length,5)
 assert.equal(audits[0].nativeRecords,21)
 assert.equal(audits[0].heldNativeRows.filter(r=>r.reason==='outside-gbs-scope').length,4)
 assert.equal(audits[0].heldNativeRows.filter(r=>r.reason==='published-application-deadline-passed').length,3)
})
test('Novo body-only transports cannot provide native HTTP proof',async t=>{
 let count=0;await assert.rejects(run({fetchText:async()=>{count++;return packets[1].bodyText}}),/HTTP response metadata/);assert.equal(count,0)
})
const listing=readListing(packets[1].bodyText,india),publisher=readPublisher(packets[0].bodyText)
const rowFor=id=>listing.rows.find(r=>r.sourceUrl.endsWith('/'+id+'/'))
const rolePacket=id=>packets.find(q=>q.requestedURL.endsWith('/'+id+'/'))
const own=(id,mutate=html=>html)=>readRole(mutate(rolePacket(id).bodyText),rowFor(id))
const activeID='1451048733'
test('Novo current public research fixture retains all 23 original successful bodies',()=>{
 assert.equal(packets.length,23);for(const q of packets){assert.equal(q.status,200);assert.equal(q.replayed,false);assert.equal(q.bodySHA256,sha(q.bodyText));assert.equal(Buffer.byteLength(q.bodyText),q.bodyBytes)}
})
test('Novo whole descriptions retain later requirements and the complete own native region',()=>{
 for(const row of listing.rows){const role=own(row.sourceUrl.match(/\/(\d+)\/$/)[1]);assert.ok(role.criteriaText.includes(role.fields.description));assert.ok(role.fields.description.length>3000);assert.ok(role.region)}
 const role=own(activeID)
 assert.ok(role.criteriaText.includes('What you can expect here'));assert.ok(role.criteriaText.includes('equality of opportunity'))
})
test('Novo later own mandatory paragraphs outside the description field survive extraction',()=>{
 const role=own(activeID,h=>h.replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope"><p>Additional professional certification is mandatory.</p>'))
 assert.ok(role.criteriaText.includes('Additional professional certification is mandatory.'))
})
test('Novo company witnesses belong to its own GBS role instead of a parent-company default',()=>{
 assert.equal(own(activeID).gbs,true);assert.equal(own('1429202133').gbs,false);assert.equal(own('1451609033').gbs,false)
 const role=own('1454075933',h=>h.replace('Company: Novo Global Business Services (GBS), Bangalore','Company: Another affiliate, Bangalore'));assert.equal(role.gbs,false)
})
test('Novo unknown country cannot be filled from the India search, Bangalore city or IN suffix',()=>{
 for(const id of ['1454075933','1451605833','1418525533','1450270733','1439124333']){const role=own(id),job=makeJob(rowFor(id),role,publisher,[listing],now);assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.state,null);assert.equal(job.location,null);assert.equal(job.sourceWorksiteCountryProof,null)}
 const role=own(activeID,h=>h.replaceAll('Bengaluru, India','Bengaluru'));assert.equal(countryProof(role).country,null)
})
test('Novo GBS unit country proof keeps Denmark headquarters and partner context intact',()=>{
 for(const id of ['1452261133','1452268133','1427688633']){const role=own(id);assert.equal(countryProof(role).country,'India');assert.ok(role.criteriaText.includes('GBS unit'));assert.ok(role.criteriaText.includes('India'))}
 const role=own('1427688633');assert.ok(role.criteriaText.includes('headquarters in Denmark'))
})
test('Novo role country proof cannot be an unrelated India office or partnership reference',()=>{
 const role=own('1439124333');assert.ok(role.criteriaText.includes('India–Denmark partnership'));assert.equal(countryProof(role).country,null)
})
test('Novo added mandatory foreign or city-only alternative workplaces cannot inherit India',()=>{
 for(const text of ['This role will be based in Toronto.','Location: Paris, France.','You must relocate to Denmark.','Location: Bangalore, India or Toronto, Canada.']){const role=own(activeID,h=>h.replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope"><p>'+text+'</p>'));assert.equal(countryProof(role).country,null,text);assert.ok(role.criteriaText.includes(text))}
})
test('Novo public page IDs cannot become native requisitions, posting dates, legal employers or seat counts',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);for(const j of jobs){assert.equal(j.jobId,null);assert.equal(j.requisitionId,null);assert.equal(j.legalEmployer,null);assert.equal(j.numberOfOpenings,null);assert.equal(j.postingDate,null);assert.equal(j.postedAt,null);assert.equal(j.publicationTimezone,null);assert.equal(j.firstEverPublication,null);assert.match(j.nativePublicPageID,/^\d+$/);assert.ok(j.nativeListingPublishedLabel)}
})
test('Novo published deadlines include abbreviated months, ordinals and dotted role titles',()=>{
 assert.equal(roleDeadline(own('1453363633'),now).calendar,'2026-11-16');assert.equal(roleDeadline(own('1441081133'),now).calendar,'2026-11-07')
 for(const id of ['1447229333','1444134433','1440002233'])assert.equal(roleDeadline(own(id),now).expired,true)
 assert.equal(roleDeadline(own('1439124333'),now).calendar,null)
})
test('Novo a listing and apply link cannot override a passed own application deadline',async t=>{
 const {jobs,error,audits}=await replay(t,q=>{if(q.requestedURL.endsWith('/'+activeID+'/'))change(q,'by 9 Nov 2026','by 1 Nov 2026')});assert.ifError(error);assert.equal(jobs.length,13);assert.ok(!jobs.some(j=>j.nativePublicPageID===activeID));assert.equal(audits[0].heldNativeRows.filter(r=>r.reason==='published-application-deadline-passed').length,4)
})
test('Novo malformed or competing published deadlines require review',()=>{
 assert.throws(()=>roleDeadline(own('1427688633',h=>h.replace('Deadline','Deadline no longer supplied:')),now),/unreadable/)
 assert.throws(()=>roleDeadline(own(activeID,h=>h.replace('by 9 Nov 2026','by 32 Nov 2026')),now),/deadline calendar|Invalid time value/)
 assert.throws(()=>roleDeadline(own(activeID,h=>h.replace('by 9 Nov 2026','by 9 Nov 2026. Deadline 10 Nov 2026')),now),/ambiguous published deadlines/)
})
test('Novo opening and closing whole models and original byte hashes reconcile',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.deepEqual(calls.map(c=>c.url),[...packets,...packets].map(q=>q.requestedURL))
 for(const j of jobs){assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord);for(const prefix of ['source','sourceClosing']){for(const key of ['Publisher','Role'])assert.equal(sha(j[prefix+'RawNative'+key]),j[prefix+'RawNative'+key+'SHA256']);for(const q of j[prefix+'RawNativeListings'])assert.equal(sha(q.rawText),q.bodySHA256)}}
})
for(const addition of ['<p hidden>A mandatory extra certificate is required.</p>','<iframe src="https://unreviewed.example/criteria"></iframe>'])test('Novo hidden or delegated requirements require review '+addition.slice(0,14),()=>{
 assert.throws(()=>own(activeID,h=>h.replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope">'+addition)),/hidden|delegated|inactive/)
})
test('Novo CSS-hidden mandatory criteria cannot silently disappear',()=>{
 assert.throws(()=>own(activeID,h=>h.replace('</head>','<style>.new-requirement {display:none}</style></head>').replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope"><p class="new-requirement">A mandatory extra certificate is required.</p>')),/stylesheet-hidden/)
})
test('Novo newly published country or structured metadata requires review',()=>{
 for(const markup of ['<meta name="jobLocation" content="Paris, France">','<script type="application/LD+JSON ">{"@type":"JobPosting","jobLocation":{"addressCountry":"FR"}}</script>'])assert.throws(()=>own(activeID,h=>h.replace('</head>',markup+'</head>')),/structured|geographic/)
})
test('Novo original anti-framing program is reviewed as data and any change requires review',()=>{
 const role=own(activeID);assert.equal(role.visibilityContract.publisherCodeExecuted,false);assert.equal(role.visibilityContract.otherHidingRulesIgnored,false)
 assert.throws(()=>own(activeID,h=>h.replace('if (self === top)','if (self !== top)')),/anti-framing/)
})
test('Novo duplicate native canonical rows and unobserved pagination are not hidden',()=>{
 assert.throws(()=>readListing(packets[1].bodyText.replaceAll(rowFor('1454075933').sourceUrl.replace('https://careers.novonordisk.com',''),rowFor(activeID).sourceUrl.replace('https://careers.novonordisk.com','')),india),/duplicate canonical/)
 const changed=packets[1].bodyText.replace(/(of\s*(?:<[^>]+>\s*)*)21(?=\s*<)/g,'$122');assert.notEqual(changed,packets[1].bodyText,'Actual published pagination total must change');assert.throws(()=>readListing(changed,india),/count|summary/)
})
test('Novo current published metadata and whole country context must agree with its own listing',()=>{
 assert.throws(()=>own(activeID,h=>{const changed=h.replace(/(class="jobGeoLocation">)Bangalore/,'$1Paris');assert.notEqual(changed,h,'Actual native location must change');return changed}),/metadata disagree/)
})
test('Novo changed closing complete criteria are withheld before a later failed read',async t=>{
 const {jobs,error,audits,calls}=await replay(t,(q,n)=>{if(q.requestedURL===roles[0]&&n===2)change(q,'Company: Novo Global Business Services (GBS), Bangalore','Company: Different company');if(q.requestedURL===roles[1]&&n===2)q.status=403});assert.ifError(error);assert.equal(jobs.length,13);assert.ok(!jobs.some(j=>j.sourceUrl===roles[0]));assert.ok(jobs.every(j=>!j.sourceDetailComplete));assert.ok(audits[0].heldNativeRows.some(r=>r.reason==='closing whole role model changed'));assert.equal(calls.length,27)
})
test('Novo changed closing whole listing withholds every stale vacancy',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===india&&n===2)change(q,'4 Nov 2026','5 Nov 2026')});assert.ok(!jobs);assert.ok(error);assert.equal(audits[0].heldNativeRows.length,21)
})
test('Novo registered normalization preserves nine verified India roles and five unknown observations',async t=>{
 const {jobs,error}=await replay(t,()=>{},{registered:true});assert.ifError(error);assert.equal(jobs.length,14);assert.equal(jobs.filter(j=>j.country==='India'&&j.sourceDetailComplete).length,9);assert.equal(jobs.filter(j=>j.country===null&&j.city===null&&j.location===null).length,5)
})
test('Novo source coverage and lifecycle cleanup remain unqualified',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.ok(jobs.every(j=>!j.sourceScopeComplete&&!j.sourceListingComplete&&!j.lifecycleCleanupAllowed))
})
test('Novo every HTTP request is anonymous GET and applications remain unvisited',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.credentials==='omit'&&c.init.redirect==='manual'&&!c.init.body&&!c.url.includes('/apply/')));assert.ok(jobs.every(j=>!j.applicationVisited&&!j.applicationFormSubmitted&&!j.activeApplyVerified&&j.nativeApplicationsOpen===null))
})
for(const status of [202,403,429])test('Novo first HTTP '+status+' stops without retries or empty success',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{q.status=status});assert.ok(!jobs);assert.equal(error.status,status);assert.equal(calls.length,1)
})
test('Novo a later failed read returns earlier criteria as partial and stops immediately',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[1])q.status=403});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(calls.length,4)
})
test('Novo factory/run overrides, zero caps and pre-abort honor caller controls',async t=>{
 const z=await replay(t,()=>{},{maxJobs:0});assert.ifError(z.error);assert.equal(z.calls.length,0);assert.equal(z.jobs.length,0)
 const reason=Error('Cancel Novo before reads'),r=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
 const scraper=createNovoNordiskGBSScraper({fetchImpl:()=>{throw Error('Must not read')},maxJobs:1});const zero=await scraper.run({maxJobs:0});assert.equal(zero.length,0)
 for(const opts of [{maxJobs:-1},{maxPages:1},{fetchJson:async()=>({})}]){const r=await replay(t,()=>{},opts);assert.ok(r.error);assert.equal(r.calls.length,0)}
})
test('Novo positive result cap reconciles all 21 roles before slicing',async t=>{
 const {jobs,error,calls,audits}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,46);assert.equal(audits[0].nativeRecords,21)
})
test('Novo original UTF-8 BOM survives body retention',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])q.bodyText='\ufeff'+q.bodyText});assert.ifError(error);assert.equal(jobs[0].sourceRawNativeRole.charCodeAt(0),65279);assert.equal(sha(jobs[0].sourceRawNativeRole),jobs[0].sourceRawNativeRoleSHA256)
})
test('Novo advertised oversized responses and HTTP URL drift stop before further reads',async t=>{
 for(const mutate of [q=>{q.headers['content-length']='5000000'},q=>{q.finalURL=q.requestedURL+'?unknown=1'}]){const {jobs,error,calls}=await replay(t,mutate);assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,1)}
})
test('Novo exact cancellation interrupts a pending uncooperative HTTP transport',async t=>{
 const c=new AbortController(),reason=Error('Cancel pending Novo read'),timer=setTimeout(()=>c.abort(reason),15);try{const r=await replay(t,()=>{},{signal:c.signal,fetchImpl:()=>new Promise(()=>{})});assert.equal(r.error,reason)}finally{clearTimeout(timer)}
})
test('Novo exact cancellation interrupts a pending audit callback',async t=>{
 const c=new AbortController(),reason=Error('Cancel Novo audit');const r=await replay(t,()=>{},{signal:c.signal,maxJobs:0,onAudit:async()=>{setTimeout(()=>c.abort(reason),10);await new Promise(()=>{})}});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('Novo a conflicting application deadline elsewhere in the full own shell requires review',()=>{
 const role=own(activeID,h=>h.replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope"><p>Application deadline: 1 November 2026.</p>'));assert.ok(role.criteriaText.includes('Application deadline: 1 November 2026.'));assert.throws(()=>roleDeadline(role,now),/ambiguous published deadlines/)
})
test('Novo an explicit foreign work-country clause conflicts with own India proof',()=>{
 const role=own(activeID,h=>h.replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope"><p>Work country: Canada.</p>'));assert.ok(role.criteriaText.includes('Work country: Canada.'));assert.equal(countryProof(role).country,null)
})
test('Novo a newly declared native data-job-country cannot be silently ignored',()=>{
 const role=own(activeID,h=>h.replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope" data-job-country="Canada">'));assert.equal(countryProof(role).country,null)
})
test('Novo visible readonly control criteria cannot disappear from a qualified description',()=>{
 assert.throws(()=>own(activeID,h=>h.replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope"><textarea readonly>Additional professional certification is mandatory.</textarea>')),/delegated|inactive|unreviewed/)
})
test('Novo a contradictory own affiliate company declaration invalidates positive GBS witnesses',()=>{
 const role=own(activeID,h=>h.replace('<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope"><p>Company: Novo Nordisk India Pvt. Ltd (Affiliate Office). This position belongs to the Affiliate Office rather than Global Business Services.</p>'));assert.equal(role.gbs,false)
})
test('Novo reviewed whole-shell contradictions cannot return an India-complete record end to end',async t=>{
 const additions=['<p>Application deadline: 1 November 2026.</p>','<p>Work country: Canada.</p>','<textarea readonly>Additional professional certification is mandatory.</textarea>','<p>Company: Novo Nordisk India Pvt. Ltd (Affiliate Office). This position belongs to the Affiliate Office rather than Global Business Services.</p>']
 for(const addition of additions){const {jobs,error}=await replay(t,q=>{if(q.requestedURL.endsWith('/'+activeID+'/'))change(q,'<div class="jobDisplayShell" itemscope="itemscope">','<div class="jobDisplayShell" itemscope="itemscope">'+addition)});assert.ifError(error);assert.ok(!jobs.some(j=>j.nativePublicPageID===activeID&&j.country==='India'&&j.sourceDetailComplete),addition)}
})
