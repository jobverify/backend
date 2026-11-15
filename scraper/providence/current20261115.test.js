import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import{readProvidenceAuthorityHTML,createProvidenceScraper,PROVIDENCE_INDIA_BOARD_URL}from'./currentIndia20261108.js'
import{createHash}from'node:crypto'
import{getScraperCatalog,createCatalogScraper}from'../../scraper-support/providers/index.js'
import{readSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261115/current-authority.json.gz',import.meta.url))))
const packet=fixture.responses.find(row=>row.requestedURL===PROVIDENCE_INDIA_BOARD_URL)
test('current genuine native board permits its already-known exact unexecuted GA4 program at the former tracking UUID site',()=>{
 const result=readProvidenceAuthorityHTML(packet.body,PROVIDENCE_INDIA_BOARD_URL)
 assert.ok(result)
 assert.equal(result.bodySHA256,packet.bodySHA256)
})
for(const[name,change]of[
 ['new native criterion in the analytics program',html=>html.replace("gtag('config', 'G-NPN6JP6PHM');","gtag('config', 'G-NPN6JP6PHM'); window.requiredCertification='new mandatory criterion';")],
 ['unknown analytics account declaration',html=>html.replaceAll('G-NPN6JP6PHM','G-UNREVIEWED')],
 ['unreviewed active script attribute',html=>html.replace('var ga4script = function () {',"var ga4script = function () { window.location='/closed';")],
])test(name+' still holds complete native authority',()=>{const changed=change(packet.body);assert.notEqual(changed,packet.body);assert.throws(()=>readProvidenceAuthorityHTML(changed,PROVIDENCE_INDIA_BOARD_URL),/Providence India/)})

const cohort=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261115/current-native-cohort.json.gz',import.meta.url))))
function replayCurrent(change=()=>{},options={},scraper=createProvidenceScraper()){
 const counts=new Map(),calls=[],mutations=[]
 const fetchImpl=async(value,init)=>{const url=String(value),index=counts.get(url)||0;counts.set(url,index+1);const original=cohort.packets.filter(packet=>packet.requestedURL===url)[index]
  assert.ok(original,'Finite reviewed native detail budget breached;uninspected roles must remain held: '+url)
  const current={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString('utf8')};change(current,url,index)
  if(current.body!==Buffer.from(original.bodyBase64,'base64').toString('utf8')||JSON.stringify(current.headers)!==JSON.stringify(original.headers))mutations.push({url,index})
  calls.push({url,init});const response=new Response(current.body,{status:current.status,headers:current.headers});Object.defineProperty(response,'url',{value:current.url});return response}
 return{calls,mutations,promise:scraper.run({...options,fetchImpl,now:options.now??(()=>cohort.capturedAt)})}
}
test('current native cohort recovers two complete India roles and retains all69rows with67detail holds inside18GETs',async()=>{
 const replay=replayCurrent(),jobs=await replay.promise;assert.equal(jobs.length,2);assert.equal(replay.calls.length,18)
 assert.deepEqual(jobs.map(job=>job.nativePublicJobId),['57209344','57209144']);assert.deepEqual(jobs.map(job=>job.jobDescription.length),[3334,3284])
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceNativeCountryEvidence.rawCountry,'IN');assert.equal(job.nativeEmployerLabel,'Providence');assert.equal(job.requisitionId,null);assert.equal(job.legalEmployer,null);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.nativeOpeningClosingMatched,true)}
 assert.equal(jobs.sourceAudit.nativeObservedRows,69);assert.equal(jobs.sourceAudit.openingRoles.length,2);assert.equal(jobs.sourceAudit.held.length,67);assert.equal(jobs.sourceAudit.currentReadOnlyMetadataSubset,true)
 assert.ok(replay.calls.every(call=>call.init.method==='GET'&&call.init.credentials==='omit'&&call.init.redirect==='manual'))
})
test('a visible native closure outside the JobPosting still holds that current role',async()=>{
 const replay=replayCurrent((packet,url)=>{if(url.endsWith('/57209344/'))packet.body=packet.body.replace('</body>','<p>This position has been filled.</p></body>')},{maxDetails:2})
 let jobs
 try{jobs=await replay.promise}catch(error){assert.equal(error.source,'providence');assert.match(error.message,/Providence India/);return}
 assert.equal(replay.mutations.length,2)
 assert.ok(!jobs.some(job=>job.nativePublicJobId==='57209344'),'An affirmative active native closure cannot be ignored outside the description field')
})
test('the complete current native cohort matches every original body digest and byte count',()=>{
 assert.equal(cohort.packets.length,18)
 for(const packet of cohort.packets){const body=Buffer.from(packet.bodyBase64,'base64');assert.equal(body.length,packet.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),packet.sha256)}
})
const firstRole=url=>url.endsWith('/57209344/')
for(const[name,change]of[
 ['foreign typed native country',(html)=>html.replace('itemprop="addressCountry" content="IN"','itemprop="addressCountry" content="PK"')],
 ['untyped native country',(html)=>html.replace('itemprop="addressCountry" content="IN"','itemprop="addressCountry" content=""')],
 ['a separate native foreign-country alternative',(html)=>html.replace('</body>','<div itemprop="jobLocation" itemscope itemtype="http://schema.org/Place"><div itemprop="address" itemscope itemtype="http://schema.org/PostalAddress"><meta itemprop="addressCountry" content="US"></div></div></body>')],
 ['a foreign native hiring organization',(html)=>html.replace('itemprop="hiringOrganization" content="Providence"','itemprop="hiringOrganization" content="Unrelated Employer"')],
 ['an unmatched native application identity',(html)=>html.replaceAll('/talentcommunity/apply/57209344/','/talentcommunity/apply/57209345/')],
 ['a second application locale',(html)=>html.replaceAll('/talentcommunity/apply/57209344/?locale=en_US','/talentcommunity/apply/57209344/?locale=en_US&amp;locale=en_GB')],
 ['new active criteria outside the entire bound native description',(html)=>html.replace('</body>','<div itemprop="experienceRequirements">Additional mandatory independent criterion.</div></body>')],
 ['hidden added full-description criteria',(html)=>html.replace('<span class="jobdescription">','<span class="jobdescription"><p hidden>Additional mandatory criterion.</p>')],
 ['an unknown native metadata property',(html)=>html.replace('</body>','<meta itemprop="unreviewedEmployment" content="conditional"></body>')],
 ['a new executable carrier',(html)=>html.replace('</body>','<script>window.requiredCertification="new condition";</script></body>')],
 ['a script-bearing application declaration',(html)=>html.replace('class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "','onclick="window.location=\'/closed\'" class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "')],
])test(name+' cannot qualify the current role',async()=>{
 const replay=replayCurrent((packet,url)=>{if(firstRole(url))packet.body=change(packet.body)},{maxDetails:2})
 let jobs
 try{jobs=await replay.promise}catch(error){assert.equal(error.source,'providence');assert.match(error.message,/Providence India/);assert.ok(replay.mutations.length>0);return}
 assert.equal(replay.mutations.length,2,'Both original native detail bodies must actually be changed')
 assert.ok(!jobs.some(job=>job.nativePublicJobId==='57209344'))
})
test('a new consistent authored mandatory criterion survives in the complete current description',async()=>{
 const added='Additional mandatory criterion: current native storage certification is required.'
 const replay=replayCurrent((packet,url)=>{if(firstRole(url))packet.body=packet.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>'+added+'</p>')})
 const jobs=await replay.promise,job=jobs.find(job=>job.nativePublicJobId==='57209344')
 assert.equal(replay.mutations.length,2);assert.ok(job);assert.ok(job.sourceDescription.includes(added));assert.ok(job.sourceNativeCriteriaEvidence.fullText.includes(added));assert.ok(job.nativeDescriptionHTML.includes(added));assert.ok(job.sourceDescription.includes('Required Skills'));assert.ok(job.sourceDescription.includes('Nice-to-Have'));assert.equal(job.sourceDescription,job.jobDescription)
})
test('a closing-only full-description change holds the complete current run',async()=>{
 const replay=replayCurrent((packet,url,index)=>{if(firstRole(url)&&index===1)packet.body=packet.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>Additional closing-only mandatory criterion.</p>')})
 await assert.rejects(replay.promise,error=>error.source==='providence'&&/Native whole role changed during closing/.test(error.message));assert.equal(replay.mutations.length,1)
})
test('native role and listing evidence remain complete under an explicit one-detail read budget',async()=>{
 const replay=replayCurrent(()=>{},{maxDetails:1}),jobs=await replay.promise
 assert.equal(jobs.length,1);assert.equal(replay.calls.length,16);assert.equal(jobs.sourceAudit.nativeObservedRows,69);assert.equal(jobs.sourceAudit.held.length,68);assert.equal(jobs.sourceAudit.uninspectedNativeRows.length,68);assert.equal(jobs.sourceAudit.sourceScopeComplete,false);assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed,false)
})
for(const[name,change]of[
 ['a current native tracking UUID rotation',html=>html.replace(/(var ctid\s*=\s*')[0-9a-f-]{36}(')/g,'$111111111-2222-4333-8444-555555555555$2')],
 ['the exact declared unexecuted override resource cache key',html=>html.replace(/(\/js\/override\.js\?locale=en_US(?:&amp;|&)i=)[1-9]\d{0,9}/g,'$1123456')],
])test(name+' preserves full native role models without requesting program bodies',async()=>{
 const replay=replayCurrent((packet)=>{packet.body=change(packet.body)}),jobs=await replay.promise
 assert.equal(jobs.length,2);assert.ok(replay.mutations.length>0);assert.equal(replay.calls.length,18);assert.ok(!replay.calls.some(call=>/\.(?:js|css)(?:\?|$)/.test(call.url)));assert.deepEqual(jobs.map(job=>job.sourceDescription.length),[3334,3284])
})
async function expectCurrentRoleHeld(change){
 const replay=replayCurrent(change,{maxDetails:2})
 let jobs
 try{jobs=await replay.promise}catch(error){assert.equal(error.source,'providence');assert.equal(error.softFailure,true);assert.ok(replay.mutations.length>0);return}
 assert.ok(replay.mutations.length>0);assert.ok(!jobs.some(job=>job.nativePublicJobId==='57209344'))
}
for(const notice of ['This job is not available.','This position is currently unavailable.','This position has now been filled.','Hiring for this role has ended.','Applications are closed.'])for(const closingOnly of [false,true])test('affirmative native closure inside full criteria is held: '+notice+(closingOnly?' closing-only':' both reads'),async()=>{
 await expectCurrentRoleHeld((packet,url,index)=>{if(firstRole(url)&&(!closingOnly||index===1))packet.body=packet.body.replace('<span class="jobdescription">','<span class="jobdescription"><p>'+notice+'</p>')})
})
for(const closingOnly of [false,true])test('explicit independent role criteria outside JobPosting is held'+(closingOnly?' at closing':' on both reads'),async()=>{
 await expectCurrentRoleHeld((packet,url,index)=>{if(firstRole(url)&&(!closingOnly||index===1))packet.body=packet.body.replace('</body>','<section><h2>Additional mandatory criteria for job 57209344</h2><p>A native security certification is required.</p></section></body>')})
})
test('hidden required-qualification value outside JobPosting cannot be omitted',async()=>{
 await expectCurrentRoleHeld((packet,url)=>{if(firstRole(url))packet.body=packet.body.replace('</body>','<input type="hidden" name="requiredQualification" value="Mandatory native clearance"></body>')})
})
for(const[name,value]of[['content-type','text/html; charset=iso-8859-1'],['refresh','0;url=https://foreign.invalid/closed'],['content-disposition','attachment; filename="role.html"'],['content-security-policy',"default-src 'none'"],['link','<https://foreign.invalid/role>; rel="canonical"']])for(const closingOnly of [false,true])test('native effective '+name+' change is held'+(closingOnly?' at closing':' on both reads'),async()=>{
 await expectCurrentRoleHeld((packet,url,index)=>{if(firstRole(url)&&(!closingOnly||index===1))packet.headers[name]=value})
})
for(const fallback of ['<div hidden>This job is not available.</div>','<template><p>Applications are closed.</p></template>'])test('isolated inert plain closure fallback remains non-authoritative: '+fallback.split('>')[0],async()=>{
 const replay=replayCurrent((packet,url)=>{if(firstRole(url))packet.body=packet.body.replace('</body>',fallback+'</body>')}),jobs=await replay.promise
 assert.equal(jobs.length,2);assert.equal(replay.mutations.length,2);assert.deepEqual(jobs.map(job=>job.sourceDescription.length),[3334,3284]);assert.equal(jobs.sourceAudit.openingRoles[0].passiveDataEvidence.passiveInactiveClosureFallbacks.length,1)
})
test('an inert closure container with separate required qualification is still held',async()=>{
 await expectCurrentRoleHeld((packet,url)=>{if(firstRole(url))packet.body=packet.body.replace('</body>','<div hidden>This job is not available.<input name="requiredQualification" value="Mandatory licence"></div></body>')})
})
test('only paired native notification-frequency IDs may rotate outside the owner',async()=>{
 const replay=replayCurrent((packet,url)=>{if(firstRole(url)){const ids=[...packet.body.matchAll(/<input id="(j_idt\d+)"[^>]*name="frequency"/g)].map(match=>match[1]);assert.equal(ids.length,2);for(const[index,id]of ids.entries())packet.body=packet.body.replaceAll(id,'j_idt'+(70000+index))}}),jobs=await replay.promise
 assert.equal(jobs.length,2);assert.equal(replay.mutations.length,2);assert.equal(jobs.sourceAudit.openingRoles[0].passiveDataEvidence.outsideOwnerFrameSHA256,jobs.sourceAudit.closingRoles[0].passiveDataEvidence.outsideOwnerFrameSHA256)
})
for(const[name,change]of[
 ['a frequency control renamed as required qualification',html=>html.replace('name="frequency"','name="requiredQualification"')],
 ['changed notification control program',html=>html.replace('j2w.Agent.setValidFrequency(this)','window.requiredLicence="new condition"')],
 ['a native passive ID with an unbound extra use',html=>{const id=html.match(/<input id="(j_idt\d+)"[^>]*name="frequency"/)[1];return html.replace('</body>','<span data-required-control="'+id+'"></span></body>')}],
])test(name+' is not covered by notification ID projection',async()=>{await expectCurrentRoleHeld((packet,url)=>{if(firstRole(url))packet.body=change(packet.body)})})
test('equivalent explicit UTF8 MIME spelling preserves the original complete native criteria',async()=>{
 const replay=replayCurrent((packet,url)=>{if(firstRole(url))packet.headers['content-type']='TEXT/HTML; charset="utf-8"'}),jobs=await replay.promise
 assert.equal(jobs.length,2);assert.equal(replay.mutations.length,2);assert.deepEqual(jobs.map(job=>job.sourceDescription.length),[3334,3284])
})
test('removing the native corporate Link header cannot bypass current authority header validation',async()=>{
 await expectCurrentRoleHeld((packet,url)=>{if(url==='https://www.providence.in/experienced-professionals/')delete packet.headers.link})
})
test('an unknown corporate CSP remains held when its native Link header is also removed',async()=>{
 await expectCurrentRoleHeld((packet,url)=>{if(url==='https://www.providence.in/experienced-professionals/'){delete packet.headers.link;packet.headers['content-security-policy']="default-src 'none'"}})
})
test('the actual catalog preserves full current Providence models and all observed/held evidence',async()=>{
 const entry=getScraperCatalog().find(entry=>entry.source==='providence');assert.ok(entry)
 const replay=replayCurrent(()=>{},{},createCatalogScraper(entry)),jobs=await replay.promise
 assert.equal(jobs.length,2);assert.equal(replay.calls.length,18);assert.deepEqual(jobs.map(job=>job.sourceDescription.length),[3334,3284])
 const observed=readSourceObservationEvidence(jobs,'providence'),audit=jobs.nativeCollectionEvidence
 assert.ok(observed);assert.equal(observed.observedRecordCount,69);assert.equal(observed.observedVacancyCount,69);assert.equal(observed.sourceScopeComplete,false)
 assert.ok(audit);assert.equal(audit.openingRoles.length,2);assert.equal(audit.closingRoles.length,2);assert.equal(audit.held.length,67);assert.equal(audit.receipts.length,18);assert.equal(audit.lifecycleCleanupAllowed,false)
})
