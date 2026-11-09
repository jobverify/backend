import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/lakechemicalspvtltd/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {generateFingerprint} from '../scraper-support/utils/applicationIdentity.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/lake-native-quality.json.gz',import.meta.url))))
const home='https://lakechemicals.com/',board='https://lakechemicals.com/job-search',sha=v=>createHash('sha256').update(v).digest('hex')
const replay=async(t,edit=()=>{},options={})=>{
 const calls=[],audits=[],fetchImpl=async(url,init={})=>{
  const original=fixture.packets.find(q=>q.requestedURL===String(url));assert.ok(original,'Unreviewed Lake URL: '+url)
  assert.equal(sha(original.bodyText),original.bodySHA256)
  const occurrence=calls.filter(q=>q.url===String(url)).length;calls.push({url:String(url),init,occurrence})
  const q=structuredClone(original);edit(q,occurrence,calls)
  const response=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const {registered,...runOptions}=options
 const runner=registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='lakechemicalspvtltd')):
  source.createLakeChemicalsPvtLtdScraper({fetchImpl,minIntervalMs:0})
 let jobs,error;try{jobs=await runner.run({now:()=> '2026-11-05T12:00:00.000Z',onAudit:a=>audits.push(a),...(registered?{fetchImpl,minIntervalMs:0}:{}),...runOptions})}catch(e){error=e}
 return {jobs,error,calls,audits}
}
test('Lake body-only helper exposes partial native observations without fake anchors or requisitions',()=>{
 const jobs=source.extractPublicJobs(fixture.packets[1].bodyText)
 assert.equal(jobs.length,6)
 assert.ok(jobs.every(j=>j.country===null&&j.requisitionId===null&&j.nativeCanonicalRoleURL===null&&j.sourceUrl===board
  &&j.applicationUrlIsGeneric===true&&j.sourceDetailComplete===false))
})
test('Lake verifies six whole native role/worksite models without inventing company completeness',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.equal(jobs.length,6);assert.equal(calls.length,4)
 for(const j of jobs){assert.equal(j.country,'India');assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true)
  assert.equal(j.sourceListingComplete,false);assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)
  assert.equal(j.nativeSourceRecord.card.title,j.title);assert.equal(j.nativeSourceRecord.card.criteriaText,j.sourceDescription)
 }
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})
test('Lake registered route retains exact native India evidence while all source completeness stays false',async t=>{
 const {jobs,error}=await replay(t,()=>{},{registered:true});assert.ifError(error);assert.equal(jobs.length,6)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Lake keeps local title keys separate from undisclosed requisitions, dates, legal employer and role URLs',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 assert.ok(jobs.every(j=>j.requisitionId===null&&j.nativeCanonicalRoleURL===null&&j.legalEmployer===null&&j.postingDate===null&&j.postedAt===null
  &&j.closingDate===null&&j.firstEverPublication===null&&j.employmentType===null&&j.remoteStatus===null))
})
test('Lake shared application page retains six distinct production identities without invented requisitions',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 assert.ok(jobs.every(j=>j.applyUrl===board&&j.applicationUrlIsGeneric===true&&j.applicationVisited===false&&j.activeApplyVerified===false))
 assert.equal(new Set(jobs.map(generateFingerprint)).size,6,'A shared application URL must not collapse the six native role identities')
})
test('Lake original company/board bytes and whole opening/closing native models remain inspectable',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 for(const j of jobs){assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord)
  assert.equal(j.sourceRawNativeHTML,fixture.packets[1].bodyText);assert.equal(j.sourceClosingRawNativeHTML,fixture.packets[1].bodyText)
  assert.equal(j.sourceRawNativeEmployerHTML,fixture.packets[0].bodyText);assert.equal(j.sourceClosingRawNativeEmployerHTML,fixture.packets[0].bodyText)
  assert.equal(j.sourceRawNativeHTMLSHA256,fixture.packets[1].bodySHA256);assert.equal(j.sourceRawNativeEmployerHTMLSHA256,fixture.packets[0].bodySHA256)
 }
 assert.equal(jobs[0].sourceNativeCollectionAudit.responses.length,4)
})
test('Lake factory and head-office assignments bind only their own explicit current addresses',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error)
 assert.equal(jobs.filter(j=>j.sourceWorksiteCountryProof.roleLocation==='Attibele (Factory)').length,5)
 assert.equal(jobs.filter(j=>j.sourceWorksiteCountryProof.roleLocation==='Shivajinagar (Head Office)').length,1)
 assert.ok(jobs.every(j=>j.sourceWorksiteCountryProof.country==='India'&&j.sourceWorksiteCountryProof.nativeAddress.includes('(India)')))
 assert.ok(jobs.every(j=>j.nativeSourceRecord.worksite.address.text===j.sourceWorksiteCountryProof.nativeAddress&&j.nativeHiringOrganization.name==='Lake Chemicals'))
})
test('Lake caller zero cap and pre-abort perform no reads',async t=>{
 let r=await replay(t,()=>{},{maxJobs:0});assert.ifError(r.error);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0)
 const reason=Error('Stop Lake before reads');r=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('Lake positive cap follows every paired observation and keeps source scope incomplete',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,4)
 assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRecords,6);assert.equal(jobs[0].sourceListingComplete,false)
})
for(const status of [202,401,403,429,451])test('Lake first HTTP '+status+' stops the whole source without empty credit',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===home)q.status=status})
 assert.ok(!jobs);assert.equal(error?.status,status);assert.equal(calls.length,1)
})
test('Lake HTTP reads are anonymous exact GETs with manual redirects',async t=>{
 const {error,calls}=await replay(t);assert.ifError(error)
 for(const {init}of calls){assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')}
})
test('Lake a closing homepage denial retains earlier facts as partial and stops before the board',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(q.requestedURL===home&&n)q.status=403})
 assert.ifError(error);assert.equal(jobs.length,6);assert.equal(calls.length,3)
 assert.ok(jobs.every(j=>j.sourceDetailComplete===false&&j.nativeRoleClosingReconciled===false&&j.lifecycleCleanupAllowed===false))
})
test('Lake a changed closing assigned worksite is excluded before a later board denial',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{
  if(q.requestedURL===home&&n)q.bodyText=q.bodyText.replace('Karnataka (India).','Karnataka (United States).')
  if(q.requestedURL===board&&n)q.status=403
 })
 assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].title,'Marketing Executive');assert.equal(calls.length,4)
 assert.equal(jobs[0].sourceDetailComplete,false)
 const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows
 assert.equal(held.length,5);assert.ok(held.every(r=>r.phase==='closing-worksite'&&r.opening.nativeRecord&&r.closing.rawHTML.includes('Karnataka (United States).')))
})
test('Lake changed closing role criteria excludes only the contradicted role and retains its models',async t=>{
 const {jobs,error}=await replay(t,(q,n)=>{if(q.requestedURL===board&&n)q.bodyText=q.bodyText.replace('Experience in handling reactors','Changed native reactor experience')})
 assert.ifError(error);assert.equal(jobs.length,5);assert.ok(!jobs.some(j=>j.title==='Production Executive/ Senior Executive'))
 const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows[0]
 assert.equal(held.phase,'closing-board');assert.ok(held.opening.nativeRecord.card);assert.ok(held.closing.nativeRecord.card)
 assert.match(held.closing.rawHTML,/Changed native reactor experience/)
})
test('Lake invalid closing homepage retains all excluded original role models and bodies',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(q.requestedURL===home&&n){const before=q.bodyText;q.bodyText=q.bodyText.replace('<title>Home</title>','<title>Unrelated</title>');assert.notEqual(q.bodyText,before)}})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,3)
 assert.equal(error.recruitmentObservations.heldNativeRows.length,6)
 assert.ok(error.recruitmentObservations.heldNativeRows.every(r=>r.opening.nativeRecord.card&&r.closing.rawHTML.includes('<title>Unrelated</title>')))
})
test('Lake city-only assignments cannot borrow the headquarters country',async t=>{
 const {jobs,error,audits}=await replay(t,q=>{if(q.requestedURL===board)q.bodyText=q.bodyText.replaceAll('Attibele (Factory)','Bangalore')})
 assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].title,'Marketing Executive');assert.equal(audits[0].unknownCountryRoles.length,5)
})
test('Lake hidden worksite address cannot supply the role country',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===home)q.bodyText=q.bodyText.replace('</head>','<style>[data-aid="CONTACT_INFO_ADDRESS_REND"]{display:none}</style></head>')})
 assert.ifError(error);assert.equal(jobs.length,5);assert.ok(!jobs.some(j=>j.title==='Marketing Executive'))
})
test('Lake new native JobPosting data requires field review before role qualification',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===board)q.bodyText=q.bodyText.replace('</head>',
  '<script type="application/LD+JSON">{"@type":"JobPosting","title":"Production Executive/ Senior Executive","jobLocation":{"address":{"addressCountry":"US"}}}</script></head>')})
 assert.ok(error||jobs.every(j=>j.sourceDetailComplete===false));assert.ok(calls.length<=2)
})
test('Lake cancellation remains exact after an awaited audit callback',async t=>{
 const controller=new AbortController(),reason=Error('Cancel Lake during audit')
 const {jobs,error}=await replay(t,()=>{},{signal:controller.signal,onAudit:async()=>{await Promise.resolve();controller.abort(reason)}})
 assert.ok(!jobs);assert.equal(error,reason)
})
test('Lake a noncooperative transport settles promptly on caller cancellation',async t=>{
 const controller=new AbortController(),reason=Error('Cancel Lake transport');let release
 const fetchImpl=()=>new Promise(resolve=>{release=resolve});t.mock.method(globalThis,'fetch',fetchImpl)
 const pending=source.createLakeChemicalsPvtLtdScraper({fetchImpl,minIntervalMs:0}).run({signal:controller.signal})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const settled=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),150))])
 const response=new Response(fixture.packets[0].bodyText,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:home});release?.(response)
 await pending.catch(()=>{});assert.equal(settled.error,reason)
})
test('Lake geographic attributes on a named site heading prevent its country binding',async t=>{
 const {jobs,error,audits}=await replay(t,q=>{if(q.requestedURL===home){const before=q.bodyText
  q.bodyText=q.bodyText.replace('data-aid="CONTACT_INTRO_HEADING_REND"','data-country="US" data-aid="CONTACT_INTRO_HEADING_REND"');assert.notEqual(q.bodyText,before)
 }})
 assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].title,'Marketing Executive');assert.equal(audits[0].unknownCountryRoles.length,5)
})
test('Lake conflicting addresses anywhere in the named site box cannot be ignored',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===home){const before=q.bodyText
  q.bodyText=q.bodyText.replace(/(<h[2-6]\b[^>]*data-aid="CONTACT_INTRO_HEADING_REND"[^>]*>[\s\S]*?<\/h[2-6]>)/,
   '$1<p>Additional manufacturing address: United States, Attibele Industrial Area</p>');assert.notEqual(q.bodyText,before)
 }})
 assert.ifError(error);assert.equal(jobs.length,1);assert.equal(jobs[0].title,'Marketing Executive')
})
test('Lake added city/state fields remain unqualified without guessing their country',async t=>{
 const {jobs,error,audits}=await replay(t,q=>{if(q.requestedURL===board){const before=q.bodyText
  q.bodyText=q.bodyText.replace('data-ux="ContentCard"','data-city="Toronto" data-state="Ontario" data-ux="ContentCard"');assert.notEqual(q.bodyText,before)
 }})
 assert.ifError(error);assert.equal(jobs.length,5);assert.ok(!jobs.some(j=>j.title==='Production Executive/ Senior Executive'))
 assert.equal(audits[0].unknownCountryRoles.length,1)
})
test('Lake CSS-hidden JSON-LD still requires native schema field review',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===board)q.bodyText=q.bodyText.replace('</head>',
  '<style>script[type="application/ld+json"]{display:none}</style><script type="application/ld+json">{"@type":"JobPosting","title":"Production Executive/ Senior Executive","jobLocation":{"address":{"addressCountry":"US"}}}</script></head>')})
 assert.ok(!jobs);assert.match(error?.message||'',/JobPosting/);assert.equal(calls.length,2)
})
test('Lake conditional CSS cannot erase a native criterion while certifying full detail',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===board){const before=q.bodyText
  q.bodyText=q.bodyText.replace(/(Adherence to cGmp and safety practices[\s\S]*?<\/li>)/,
   '$1<li class="lake-conditional-native-criterion">Must retain conditional native criterion.</li>')
  assert.notEqual(q.bodyText,before)
  q.bodyText=q.bodyText.replace('</head>','<style>@media(max-width:1px){.lake-conditional-native-criterion{display:none}}</style></head>')
 }})
 assert.ifError(error);assert.equal(jobs.length,5);assert.ok(!jobs.some(j=>j.title==='Production Executive/ Senior Executive'))
 assert.ok(jobs[0].sourceNativeCollectionAudit.heldNativeRows.some(row=>JSON.stringify(row.rawCard).includes('Must retain conditional native criterion.')))
})

test('Lake hidden heading prose cannot conceal an additional native country declaration',async t=>{
 const {jobs,error}=await replay(t,q=>{if(q.requestedURL===board){const before=q.bodyText
  q.bodyText=q.bodyText.replace(/(<h4\b(?![^>]*data-aid)[^>]*data-ux="ContentCardHeading"[^>]*>)[^<]*(<\/h4>)/,'$1Country: United States$2')
  assert.notEqual(q.bodyText,before)
 }})
 assert.ifError(error);assert.equal(jobs.length,5);assert.ok(!jobs.some(j=>j.title==='Production Executive/ Senior Executive'))
 assert.ok(jobs[0].sourceNativeCollectionAudit.heldNativeRows.some(row=>JSON.stringify(row.rawCard).includes('Country: United States')))
})
