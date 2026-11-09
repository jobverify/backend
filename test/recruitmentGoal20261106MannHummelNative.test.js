import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from '../scraper/mannhummel.workday/script.js'
import {readCorporate,readBoard,readListing,readRole,makeJob,utcInstant} from '../scraper/mannhummel.workday/nativeModels.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/mannhummel-native-quality.json.gz',import.meta.url))))
const packets=f.packets,roles=packets.slice(3).map(q=>q.requestedURL),now='2026-11-05T23:10:00.000Z',sha=v=>createHash('sha256').update(v).digest('hex')
const replay=async(t,mutate=()=>{},options={})=>{
 const {registered=false,fixturePackets=packets,...settings}=options
 const calls=[],audits=[],counts=new Map(),fetchImpl=async(url,init)=>{calls.push({url,init});const n=(counts.get(url)||0)+1;counts.set(url,n);const matches=fixturePackets.filter(q=>q.requestedURL===url),q=structuredClone(matches[n-1]??matches[0]);assert.ok(q,'Only current publisher-declared URLs may be read: '+url);mutate(q,n);const r=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r}
 t.mock.method(globalThis,'fetch',fetchImpl)
 let jobs,error;try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='mannhummel')).run:run)({now:()=>now,minIntervalMs:0,fetchImpl,onAudit:a=>audits.push(a),...settings})}catch(e){error=e}return {jobs,error,calls,audits}
}
test('Mann+Hummel current native Country/Region tiles and own country properties recover all 13 complete India roles',async t=>{
 const {jobs,error,calls,audits}=await replay(t);assert.ifError(error);assert.equal(jobs.length,13);assert.equal(calls.length,32);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.nativeRoleClosingReconciled));assert.equal(audits[0].nativeRecords,13);assert.deepEqual(calls.map(c=>c.url),[...packets,...packets].map(q=>q.requestedURL));assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('Mann+Hummel body-only transports cannot substitute for verified native HTTP metadata',async()=>{
 let calls=0;await assert.rejects(run({fetchText:async()=>{calls++;return packets[2].bodyText}}),/HTTP response metadata/);assert.equal(calls,0)
})
const corporate=readCorporate(packets[0].bodyText),board=readBoard(packets[1].bodyText),listing=readListing(packets[2].bodyText),row=listing.rows[0],roleHtml=packets[3].bodyText
const change=(q,from,to)=>{const before=q.bodyText;q.bodyText=q.bodyText.replace(from,to);assert.ok(q.bodyText!==before,'Mutation must alter actual original content')}
const additional=text=>{const h=roleHtml.replace('<div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">','<div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">'+text);assert.notEqual(h,roleHtml);const role=readRole(h,row);return makeJob(row,role,corporate,board,listing,now)}
test('Mann+Hummel a foreign alternative to the native city cannot inherit the India property',()=>{
 assert.equal(additional('<p>This role will be based in Bangalore or Toronto, Canada.</p>').country,null)
})
test('Mann+Hummel another typed workLocation inside the own role requires review',()=>{
 assert.equal(additional('<span itemprop="workLocation">Toronto, Canada</span>').country,null)
})
test('Mann+Hummel native country attributes outside the reviewed property cannot be ignored',()=>{
 assert.equal(additional('<div country="Canada">Mandatory country declaration.</div>').country,null)
})
test('Mann+Hummel a second employer declaration cannot hide after a valid brand prefix',()=>{
 assert.throws(()=>additional('<p>Company: Mann+Hummel GmbH Employer: Another company</p>'),/employer declaration/)
})
test('Mann+Hummel the current 16 original public bodies remain intact',()=>{
 assert.equal(packets.length,16);for(const q of packets){assert.equal(q.status,200);assert.equal(q.replayed,false);assert.equal(sha(q.bodyText),q.bodySHA256);assert.equal(Buffer.byteLength(q.bodyText),q.bodyBytes)}
})
test('Mann+Hummel entire criteria and every native original/closing model survive extraction',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);for(const j of jobs){assert.equal(j.sourceDescription,j.nativeSourceRecord.role.criteriaText);assert.ok(j.sourceDescription.includes(j.nativeJobDescription));assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord);for(const p of ['source','sourceClosing'])for(const k of ['Corporate','Board','Listing','Role'])assert.equal(sha(j[p+'RawNative'+k]),j[p+'RawNative'+k+'SHA256'])}
 assert.ok(jobs[0].sourceDescription.includes('Ability to travel 50%'));assert.ok(jobs[0].sourceDescription.includes('domestic and international'));assert.ok(jobs[1].sourceDescription.includes('deadlines'))
})
test('Mann+Hummel Native Country/Region meaning is separate from a free-form IN address or India keyword',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,/(data-careersite-propertyid="country"[^>]*>\s*)IN/,'$1')});assert.ifError(error);assert.equal(jobs[0].country,null);assert.equal(jobs[0].location,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceNativeCountryContext.nativeStreetAddress,'Bangalore, IN, 560022')
})
test('Mann+Hummel a contradictory own native country property cannot borrow the keyword search',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,/(data-careersite-propertyid="country"[^>]*>\s*)IN/,'$1US')});assert.ifError(error);assert.equal(jobs[0].country,null);assert.equal(jobs[0].city,null)
})
test('Mann+Hummel all responsive country fields must agree with the own role',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===packets[2].requestedURL)change(q,/(id="job-1444322133-[^"]+-section-country-value"[^>]*>\s*)IN/g,'$1US')});assert.ifError(error);assert.equal(jobs[0].country,null)
})
test('Mann+Hummel a mislabeled native country field cannot supply geographic proof',()=>{
 const q={bodyText:packets[2].bodyText};change(q,/(id="job-1444322133-desktop-section-country-label"[^>]*>\s*)Country\/Region/,'$1Sales Region');assert.throws(()=>readListing(q.bodyText),/semantics changed/)
})
test('Mann+Hummel public page IDs are not requisitions or seat counts',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);for(const j of jobs){assert.equal(j.jobId,null);assert.equal(j.requisitionId,null);assert.equal(j.numberOfOpenings,null);assert.equal(j.legalEmployer,null);assert.equal(j.firstEverPublication,null);assert.match(j.nativePublicPageID,/^\d+$/);assert.equal(j.nativeHiringOrganization.name,'Mann+Hummel GmbH');assert.equal(j.employmentType,null);assert.ok(['Unlimited','Limited'].includes(j.nativeContractDurationLabel))}
})
test('Mann+Hummel empty city, a region label and conflicting native title locations stay explicit',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const empty=jobs.find(j=>j.nativePublicPageID==='1451119933'),region=jobs.find(j=>j.nativePublicPageID==='1447599233'),multi=jobs.find(j=>j.nativePublicPageID==='1433806933');assert.equal(empty.city,null);assert.equal(empty.location,'India');assert.equal(region.city,null);assert.equal(region.nativeLocationLabel,'Haryana');assert.equal(region.location,'Haryana, India');assert.equal(multi.city,null);assert.equal(multi.location,'India');assert.equal(multi.nativeLocationLabel,'Bangalore');assert.equal(multi.nativeTitlePlacement,'Chennai/Vijayawada/Ernakulam')
})
test('Mann+Hummel original UTC publication/expiry precision is retained without first-ever claims',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(jobs[0].postedAt,'2026-11-03T02:00:00.000Z');assert.equal(jobs[0].closingDate,'2026-12-31T18:30:00.000Z');assert.ok(jobs.every(j=>j.publicationTimezone==='UTC'&&j.sourceDatePrecision==='second'&&j.firstEverPublication===null));assert.throws(()=>utcInstant('Wed Nov 03 02:00:00 UTC 2026'),/invalid native/)
})
test('Mann+Hummel explicit native expiry and future posting dates withhold unqualified vacancies',async t=>{
 for(const [from,to]of [['Thu Dec 31 18:30:00 UTC 2026','Wed Nov 04 18:30:00 UTC 2026'],['Tue Nov 03 02:00:00 UTC 2026','Fri Nov 06 02:00:00 UTC 2026']]){const {jobs,error,audits}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,from,to)});assert.ifError(error);assert.equal(jobs.length,12);assert.ok(!jobs.some(j=>j.sourceUrl===roles[0]));assert.equal(audits[0].heldNativeRows.length,1)}
})
test('Mann+Hummel a new application deadline elsewhere in the whole shell requires review',()=>{
 assert.throws(()=>additional('<p>Application deadline: 1 November 2026.</p>'),/deadline requires review/)
})
test('Mann+Hummel additional visible requirements outside the description field survive',()=>{
 const job=additional('<p>An additional professional certification is mandatory.</p>');assert.ok(job.sourceDescription.includes('An additional professional certification is mandatory.'))
})
test('Mann+Hummel hidden, delegated and readonly-control criteria require review',()=>{
 for(const markup of ['<p hidden>Mandatory additional certification.</p>','<iframe src="https://unreviewed.example/criteria"></iframe>','<textarea readonly>Mandatory additional certification.</textarea>'])assert.throws(()=>additional(markup),/hidden|delegated|inactive/)
})
test('Mann+Hummel CSS-hidden requirements and country values require review',()=>{
 const q={bodyText:roleHtml};change(q,'</head>','<style>.extra-required{display:none}</style></head>');change(q,'<div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">','<div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting"><p class="extra-required">Mandatory extra licence.</p>');assert.throws(()=>readRole(q.bodyText,row),/stylesheet-hidden/)
 const h=roleHtml.replace('</head>','<style>[data-careersite-propertyid="country"]{display:none}</style></head>');assert.throws(()=>readRole(h,row),/stylesheet-hidden/)
})
test('Mann+Hummel unknown renderer programs and changed JavaScript fallbacks require review',()=>{
 assert.throws(()=>readRole(roleHtml.replace('var values = [];','var values = ["New mandatory condition"];'),row),/renderer|program/)
 assert.throws(()=>readRole(roleHtml.replace('Please enable JavaScript','Mandatory extra licence'),row),/inactive|delegated/)
})
test('Mann+Hummel publisher code and embedded maps are never executed or visited',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.ok(calls.every(c=>!c.url.includes('jobs2web')&&!c.url.includes('/apply/')&&!c.url.includes('career5.')));assert.ok(jobs.every(j=>j.nativeSourceRecord.role.programs.every(p=>!p.executed)));assert.ok(jobs.every(j=>!j.applicationVisited&&!j.applicationFormSubmitted&&!j.activeApplyVerified&&j.nativeApplicationsOpen===null))
})
test('Mann+Hummel changed own employer or new structured job metadata cannot silently qualify',()=>{
 assert.throws(()=>readRole(roleHtml.replace('content="Mann+Hummel GmbH"','content="Another employer"'),row),/employer mismatch/)
 assert.throws(()=>readRole(roleHtml.replace('</head>','<script type="application/LD+JSON ">{"@type":"JobPosting","jobLocation":{"addressCountry":"CA"}}</script></head>'),row),/structured metadata/)
})
test('Mann+Hummel native job tokens and responsive fields cannot collapse duplicate roles',()=>{
 const q={bodyText:packets[2].bodyText};change(q,/1381104633/g,'1444322133');assert.throws(()=>readListing(q.bodyText),/duplicate canonical|ownership|identity|declarations/)
})
test('Mann+Hummel changed closing complete criteria are withheld before later failed reads',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===roles[0]&&n===2)change(q,'Role Summary','Role Summary: newly mandatory professional registration.');if(q.requestedURL===roles[1]&&n===2)q.status=403});assert.ifError(error);assert.equal(jobs.length,12);assert.ok(!jobs.some(j=>j.sourceUrl===roles[0]));assert.ok(jobs.every(j=>!j.sourceDetailComplete));assert.ok(audits[0].heldNativeRows.some(r=>r.reason==='closing whole role model changed'))
})
test('Mann+Hummel changed closing whole native tile model withholds all stale roles',async t=>{
 const {jobs,error,audits}=await replay(t,(q,n)=>{if(q.requestedURL===packets[2].requestedURL&&n===2)change(q,'data-row-index="1"','data-row-index="100"')});assert.ok(!jobs);assert.ok(error);assert.equal(audits[0].heldNativeRows.length,13)
})
test('Mann+Hummel registered normalization preserves all native record and country proofs',async t=>{
 const {jobs,error}=await replay(t,()=>{},{registered:true});assert.ifError(error);assert.equal(jobs.length,13);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.nativeRoleClosingReconciled&&j.nativeHiringOrganization.name==='Mann+Hummel GmbH'));const p=getScraperCatalog().find(p=>p.source==='mannhummel');assert.equal(p.companyName,'Mann+Hummel');assert.equal(p.companyDomain,'mann-hummel.com');assert.equal(p.countryFilter,'India')
})
test('Mann+Hummel full company inventory and cleanup remain unqualified',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.ok(jobs.every(j=>!j.sourceScopeComplete&&!j.sourceListingComplete&&!j.lifecycleCleanupAllowed))
})
for(const status of [202,403,429])test('Mann+Hummel first HTTP '+status+' stops immediately without retries or empty success',async t=>{const {jobs,error,calls}=await replay(t,q=>{q.status=status});assert.ok(!jobs);assert.equal(error.status,status);assert.equal(calls.length,1)})
test('Mann+Hummel a later failed read preserves earlier criteria as partial and stops',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===roles[1])q.status=403});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(calls.length,5)
})
test('Mann+Hummel reads are anonymous GET requests with original HTTP metadata',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.credentials==='omit'&&c.init.redirect==='manual'&&!c.init.body));assert.ok(jobs[0].sourceNativeCollectionAudit.responses.every(q=>q.httpMetadataVerified&&q.status===200&&q.bodySHA256))
})
test('Mann+Hummel caller zero caps, invalid controls and pre-abort make no reads',async t=>{
 const zero=await replay(t,()=>{},{maxJobs:0});assert.ifError(zero.error);assert.equal(zero.jobs.length,0);assert.equal(zero.calls.length,0);const reason=Error('Cancel Mann before reads'),cancelled=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(cancelled.error,reason);assert.equal(cancelled.calls.length,0);for(const options of [{maxJobs:-1},{maxPages:1},{fetchJson:async()=>({})}]){const r=await replay(t,()=>{},options);assert.ok(r.error);assert.equal(r.calls.length,0)}
})
test('Mann+Hummel positive result caps reconcile every declared role before slicing',async t=>{
 const {jobs,error,calls,audits}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,32);assert.equal(audits[0].nativeRecords,13)
})
test('Mann+Hummel original UTF-8 BOM bytes survive retention',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])q.bodyText='\ufeff'+q.bodyText});assert.ifError(error);assert.equal(jobs[0].sourceRawNativeRole.charCodeAt(0),65279);assert.equal(sha(jobs[0].sourceRawNativeRole),jobs[0].sourceRawNativeRoleSHA256)
})
test('Mann+Hummel oversized responses and HTTP URL drift stop before later reads',async t=>{
 for(const mutate of [q=>{q.headers['content-length']='5000000'},q=>{q.finalURL=q.requestedURL+'?unknown=1'}]){const {jobs,error,calls}=await replay(t,mutate);assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,1)}
})
test('Mann+Hummel exact cancellation interrupts an uncooperative HTTP read',async t=>{
 const c=new AbortController(),reason=Error('Cancel pending Mann read'),timer=setTimeout(()=>c.abort(reason),15);try{const r=await replay(t,()=>{},{signal:c.signal,fetchImpl:()=>new Promise(()=>{})});assert.equal(r.error,reason)}finally{clearTimeout(timer)}
})
test('Mann+Hummel exact cancellation interrupts an uncooperative audit callback',async t=>{
 const c=new AbortController(),reason=Error('Cancel Mann audit');const r=await replay(t,()=>{},{signal:c.signal,maxJobs:0,onAudit:async()=>{setTimeout(()=>c.abort(reason),10);await new Promise(()=>{})}});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('Mann+Hummel a foreign country in an own title placement conflicts with the native IN field',()=>{
 const old=listing.rows[1],title=old.title+' (Location - Toronto, Canada)',changedRow={...old,title},q={bodyText:packets[4].bodyText};change(q,new RegExp(old.title,'g'),title);const ownRole=readRole(q.bodyText,changedRow);assert.equal(makeJob(changedRow,ownRole,corporate,board,listing,now).country,null)
})

test('Mann+Hummel hidden criteria inside an original APPLY link prevent complete qualification',async t=>{
 const {jobs,error,calls,audits}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,/(<a\b[^>]*href="\/talentcommunity\/apply\/1444322133\/\?locale=en_US"[^>]*>)/,'$1<span hidden>Additional professional certification is mandatory.</span>')},{registered:true});assert.ok(!jobs);assert.match(error.message,/hidden native criteria/);assert.equal(calls.length,4);assert.equal(audits[0].failures.length,1)
})

test('Mann+Hummel based-in foreign title placement cannot inherit the native India country',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===packets[2].requestedURL||q.requestedURL===roles[1])change(q,/OE sales Manager/g,'OE sales Manager (based in Toronto, Canada)')},{registered:true});assert.ifError(error);const j=jobs.find(j=>j.sourceUrl===roles[1]);assert.ok(j);assert.equal(j.country,null);assert.equal(j.sourceDetailComplete,false)
})

test('Mann+Hummel explicit USA placement conflicts even when it starts with the native city',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'<div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">','<div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting"><p>This role will be based in Bangalore, USA.</p>')},{registered:true});assert.ifError(error);const j=jobs.find(j=>j.sourceUrl===roles[0]);assert.ok(j);assert.equal(j.country,null);assert.equal(j.sourceDetailComplete,false)
})

test('Mann+Hummel a metadata name cannot mask its conflicting geographic property',async t=>{
 const {jobs,error,calls,audits}=await replay(t,q=>{if(q.requestedURL===roles[0])change(q,'</head>','<meta name="description" property="jobLocation" content="Toronto, Canada"></head>')},{registered:true});assert.ok(!jobs);assert.match(error.message,/outside typed\/geographic metadata/);assert.equal(calls.length,4);assert.equal(audits[0].failures.length,1)
})

const orderingFixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/mannhummel-native-ordering-quality.json.gz',import.meta.url))))
test('Mann+Hummel actual changing analytics IDs and tied result order retain both whole native observations',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{registered:true,fixturePackets:orderingFixture.packets});assert.ifError(error);assert.equal(jobs.length,13);assert.equal(calls.length,32);assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.nativeRoleClosingReconciled));assert.notDeepEqual(jobs[0].nativeSourceRecord.corporate,jobs[0].nativeClosingRecord.corporate);assert.notDeepEqual(jobs[0].nativeSourceRecord.indiaListing,jobs[0].nativeClosingRecord.indiaListing);assert.ok(jobs.every(j=>JSON.stringify(j.nativeSourceRecord.role)===JSON.stringify(j.nativeClosingRecord.role)))
})

test('Mann+Hummel real rank changes cannot mask changed whole native fields',async t=>{
 const {jobs,error}=await replay(t,(q,n)=>{if(q.requestedURL===packets[2].requestedURL&&n===2)change(q,/Development & Design/g,'A different mandatory job area')},{registered:true,fixturePackets:orderingFixture.packets});assert.ok(!jobs);assert.match(error.message,/context changed/)
})
