import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/cdot/script.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/cdot-native-quality.json.gz',import.meta.url))))
const [indexPacket,pdfPacket]=fixture.packets,index=indexPacket.requestedURL,pdf=pdfPacket.requestedURL
const sha=v=>createHash('sha256').update(v).digest('hex')
async function replay(t,edit=()=>{},options={},registered=false){
 const calls=[],counts=new Map(),audits=[]
 const fetchImpl=async(url,init={})=>{
  const packet=fixture.packets.find(p=>p.requestedURL===String(url));assert.ok(packet,'Uncaptured C-DOT URL: '+url)
  const q=structuredClone(packet),n=(counts.get(q.requestedURL)||0)+1;counts.set(q.requestedURL,n);edit(q,n)
  calls.push({url:String(url),init});if(q.error)throw Object.assign(Error(q.error),{abortRetries:true})
  const bytes=q.bodyBase64?Buffer.from(q.bodyBase64,'base64'):q.bodyText
  const response=new Response(bytes,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const settings={fetchImpl,minIntervalMs:0,now:()=> '2026-11-05T12:30:00.000Z',onAudit:async audit=>{audits.push(audit);await options.onAudit?.(audit)},...options}
 // Keep the collection audit even when the caller also supplies a callback.
 settings.onAudit=async audit=>{audits.push(audit);await options.onAudit?.(audit)}
 let jobs,error
 try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='cdot')).run(settings):source.createCdotScraper(settings).run())}catch(e){error=e}
 return {jobs,error,calls,audits}
}
test('C-DOT quality fixture retains two original successful employer responses',()=>{
 assert.equal(fixture.packets.length,2)
 for(const q of fixture.packets){const bytes=q.bodyBase64?Buffer.from(q.bodyBase64,'base64'):Buffer.from(q.bodyText);assert.equal(q.status,200);assert.equal(q.replayed,false);assert.equal(sha(bytes),q.bodySHA256);assert.equal(bytes.length,q.bodyBytes)}
})
test('C-DOT listing helper does not turn application opening clocks into publication or city into country',()=>{
 const [job]=source.extractOpenings(indexPacket.bodyText)
 assert.equal(job.requisitionId,null);assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.location,null);assert.equal(job.postingDate,null)
 assert.equal(job.nativeApplicationAdvertisementID,'28');assert.equal(job.sourceApplicationOpeningLabel,'07-10-2026 09:00:00')
 assert.equal(job.sourceApplicationClosingLabel,'08-11-2026 17:00:00');assert.equal(job.closingDate,'2026-11-08')
 assert.equal(job.applicationDateTimezone,null);assert.equal(job.nativeCanonicalRoleURL,null)
})
test('C-DOT retains all seventeen PDF page models and complete primary English criteria including introduction',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(jobs.length,1)
 const j=jobs[0],native=j.nativeSourceRecord
 assert.equal(native.pdf.pages.length,17);assert.equal(native.pdf.sha256,pdfPacket.bodySHA256)
 assert.deepEqual(j.sourceDescriptionPages,[1,2,3,4,5,6,7]);assert.equal(j.jobDescription,j.sourceDescription)
 for(const text of ['Notification for the Post','C-DOT invites applications','continuous improvement of product architecture','Minimum Percentage 70%',
  'Python/Java/C++/JavaScript','English version will prevail','throughout the country','**End of Document**'])assert.ok(j.sourceDescription.replace(/\s+/g,' ').includes(text),text)
 assert.equal(j.numberOfOpenings,5);assert.equal(native.role.workplace,'Delhi');assert.equal(j.nativeRoleClosingReconciled,true)
})
test('C-DOT binds native Delhi to India through this advertisement’s national deployment terms while legal identity stays unknown',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs[0]
 for(const k of ['city','state','requisitionId','postingDate','postedAt','firstEverPublication','legalEmployer','nativeCanonicalRoleURL'])assert.equal(j[k],null,k)
 assert.equal(j.country,'India');assert.equal(j.location,'Delhi');assert.equal(j.nativeWorkplace,'Delhi')
 assert.equal(j.sourceCountryScopeUnresolved,false);assert.equal(j.sourceDetailComplete,true)
 assert.equal(j.sourceNativeCriteriaContainerRetained,true);assert.equal(j.sourceDetailFailureKind,null)
 assert.equal(j.sourceWorksiteCountryProof.method,'advertisement-national-deployment-context')
 assert.equal(j.sourceWorksiteCountryProof.contextualBinding,true);assert.equal(j.sourceWorksiteCountryProof.literalRoleCountry,false)
 assert.equal(j.sourceWorksiteCountryProof.documentSHA256,pdfPacket.bodySHA256)
 assert.match(j.nativeHiringOrganization.name,/C-DOT/);assert.match(j.sourceNativeCountryContext.domesticPostingClause,/throughout the country/)
})
test('C-DOT registered route qualifies the native India role without complete-company authority',async t=>{
 const {jobs,error}=await replay(t,()=>{},{},true);assert.ifError(error);assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,null);assert.equal(jobs[0].location,'Delhi');assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('C-DOT local advertisement key and five openings cannot become five requisitions or individual role URLs',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);assert.equal(jobs.length,1);const j=jobs[0]
 assert.equal(j.jobId,'cdot-28');assert.equal(j.nativeApplicationAdvertisementID,'28');assert.equal(j.requisitionId,null)
 assert.equal(j.numberOfOpenings,5);assert.equal(j.nativeCanonicalRoleURL,null);assert.equal(j.applicationUrlIsGeneric,true)
 assert.equal(j.sourceUrl,pdf);assert.equal(j.applyUrl,'https://cdotrecruitment.cdot.in/cdotrecruitmentportal/college_home.jsp?adv_id=28')
 assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)
})
test('C-DOT retains both original listing and PDF bytes with whole opening and closing native models',async t=>{
 const {jobs,error,calls}=await replay(t);assert.ifError(error);assert.deepEqual(calls.map(c=>c.url),[index,pdf,index,pdf])
 const j=jobs[0];assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord)
 assert.equal(j.sourceRawNativeHTML,indexPacket.bodyText);assert.equal(j.sourceClosingRawNativeHTML,indexPacket.bodyText)
 assert.equal(j.sourceRawNativePDFBase64,pdfPacket.bodyBase64);assert.equal(j.sourceClosingRawNativePDFBase64,pdfPacket.bodyBase64)
 const audit=j.sourceNativeCollectionAudit;assert.equal(audit.responses.length,4);assert.equal(audit.nativeRecords,1);assert.equal(audit.nativePositions,5)
 assert.equal(audit.unknownCountryRoles.length,0);assert.equal(audit.failures.length,0)
})
test('C-DOT application local dates remain distinct from undisclosed publication instants and timezone',async t=>{
 const {jobs,error}=await replay(t);assert.ifError(error);const j=jobs[0]
 assert.equal(j.sourceApplicationOpeningLabel,'07-10-2026 09:00:00');assert.equal(j.applicationOpeningDate,'2026-10-07');assert.equal(j.applicationOpeningTimeLocal,'09:00:00')
 assert.equal(j.closingDate,'2026-11-08');assert.equal(j.applicationClosingTimeLocal,'17:00:00');assert.equal(j.applicationDateTimezone,null)
 assert.equal(j.postingDate,null);assert.equal(j.sourceDatePrecision,null)
})
test('C-DOT caller zero cap and exact pre-cancellation perform no reads',async t=>{
 const z=await replay(t,()=>{},{maxJobs:0});assert.ifError(z.error);assert.equal(z.jobs.length,0);assert.equal(z.calls.length,0)
 const reason=Error('Stop C-DOT before read'),a=await replay(t,()=>{},{signal:AbortSignal.abort(reason)});assert.equal(a.error,reason);assert.equal(a.calls.length,0)
})
test('C-DOT a positive caller cap follows every paired observation without cleanup authority',async t=>{
 const {jobs,error,calls}=await replay(t,()=>{},{maxJobs:1});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(calls.length,4)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(jobs[0].sourceListingComplete,false)
})
test('C-DOT rejects legacy body-only transports and unsupported page caps before public HTTP',async t=>{
 for(const options of [{fetchText:async()=>indexPacket.bodyText,fetchBinary:async()=>Buffer.from(pdfPacket.bodyBase64,'base64')},{maxPages:1}]){
  const {jobs,error,calls}=await replay(t,()=>{},options);assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,0)
 }
})
for(const status of [202,401,403,429,451])test('C-DOT first HTTP '+status+' stops the source without empty success',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(q.requestedURL===index&&n===1)q.status=status})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,1)
})
test('C-DOT every exact GET omits credentials and uses manual redirects',async t=>{
 const {error,calls}=await replay(t);assert.ifError(error)
 for(const {init}of calls){assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.ok(!init.body)}
})
test('C-DOT an unread advertisement leaves the native position count unknown rather than zero',async t=>{
 const {jobs,error,calls,audits}=await replay(t,q=>{if(q.requestedURL===pdf)q.status=403})
 assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,2)
 const audit=audits[0]||error.recruitmentObservations
 assert.equal(audit.nativeRecords,1);assert.equal(audit.nativePositions,null)
})
test('C-DOT rejects reversed application clocks on the same local calendar date',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===index){const before=q.bodyText
  q.bodyText=q.bodyText.replaceAll('07-10-2026 09:00:00','08-11-2026 20:00:00');assert.notEqual(q.bodyText,before)
 }})
 assert.ok(!jobs);assert.match(error?.message||'',/application window reversed/);assert.equal(calls.length,1)
})
test('C-DOT a closing index denial retains the earlier whole native role as partial and stops before PDF',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(q.requestedURL===index&&n===2)q.status=403})
 assert.ifError(error);assert.equal(calls.length,3);assert.equal(jobs.length,1);assert.ok(jobs[0].nativeSourceRecord.pdf.pages.length===17)
 assert.equal(jobs[0].nativeRoleClosingReconciled,false);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs[0].sourceNativeCollectionAudit.failures.length,1)
})
test('C-DOT invalid closing index retains the excluded whole opening model and original conflicting HTML',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===index&&n===2)q.bodyText=q.bodyText.replace('<title>Current Openings</title>','<title>Unrelated</title>')})
 assert.ok(!jobs||jobs.length===0);assert.equal(calls.length,3)
 const audit=audits[0]||error?.recruitmentObservations;assert.ok(audit?.heldNativeRows.length)
 assert.equal(audit.heldNativeRows[0].opening.nativeRecord.pdf.pages.length,17)
 assert.ok(audit.heldNativeRows[0].closing.rawHTML.includes('<title>Unrelated</title>'))
})
test('C-DOT changed closing advertised identity is held before another PDF read',async t=>{
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===index&&n===2)q.bodyText=q.bodyText.replaceAll('adv_id=28','adv_id=999')})
 assert.ok(!jobs||jobs.length===0);assert.equal(calls.length,3)
 const audit=audits[0]||error?.recruitmentObservations;assert.ok(audit?.heldNativeRows[0].opening.nativeRecord.pdf)
 assert.equal(audit.heldNativeRows[0].opening.nativeRecord.listing.nativeApplicationAdvertisementID,'28')
})
test('C-DOT a closing PDF denial stops after four reads and retains earlier partial native facts',async t=>{
 const {jobs,error,calls}=await replay(t,(q,n)=>{if(q.requestedURL===pdf&&n===2)q.status=403})
 assert.ifError(error);assert.equal(calls.length,4);assert.equal(jobs.length,1);assert.equal(jobs[0].nativeRoleClosingReconciled,false)
 assert.equal(jobs[0].sourceNativeCollectionAudit.failures.length,1);assert.equal(jobs[0].sourceDetailComplete,false)
})
test('C-DOT invalid closing PDF retains both original evidence and the malformed closing body',async t=>{
 const changed=Buffer.from('not the original C-DOT document').toString('base64')
 const {jobs,error,calls,audits}=await replay(t,(q,n)=>{if(q.requestedURL===pdf&&n===2){q.bodyBase64=changed;delete q.headers['content-length']}})
 assert.ok(!jobs||jobs.length===0);assert.equal(calls.length,4)
 const audit=audits[0]||error?.recruitmentObservations;assert.equal(audit?.heldNativeRows[0].opening.nativeRecord.pdf.pages.length,17)
 assert.equal(audit.heldNativeRows[0].closing.bodyBase64,changed)
})
test('C-DOT declared role schemas cannot bypass review through MIME casing or CSS',async t=>{
 const {jobs,error,calls}=await replay(t,q=>{if(q.requestedURL===index)q.bodyText=q.bodyText.replace('</head>',
  '<style>script[type="application/LD+JSON"]{display:none}</style><script type="application/LD+JSON">{"@type":"JobPosting","jobLocation":{"address":{"addressCountry":"US"}}}</script></head>')})
 assert.ok(!jobs);assert.match(error?.message||'',/JobPosting/);assert.equal(calls.length,1)
})
test('C-DOT caller cancellation remains exact after an awaited audit callback',async t=>{
 const controller=new AbortController(),reason=Error('Cancel C-DOT during audit')
 const {jobs,error}=await replay(t,()=>{},{signal:controller.signal,onAudit:async()=>{await Promise.resolve();controller.abort(reason)}})
 assert.ok(!jobs);assert.equal(error,reason)
})
test('C-DOT noncooperative transport settles on exact caller cancellation',async t=>{
 const controller=new AbortController(),reason=Error('Cancel noncooperative C-DOT read');let release
 let requests=0
 const fetchImpl=()=>++requests===1?new Promise(resolve=>{release=resolve}):Promise.reject(Object.assign(Error('C-DOT late test cleanup'),{abortRetries:true}))
 t.mock.method(globalThis,'fetch',fetchImpl)
 const pending=source.createCdotScraper({fetchImpl,minIntervalMs:0,signal:controller.signal}).run()
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 const result=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),150))])
 const response=new Response(indexPacket.bodyText,{headers:indexPacket.headers});Object.defineProperty(response,'url',{value:index});release?.(response)
 await pending.catch(()=>{});assert.equal(result.error,reason)
})
test('C-DOT noncooperative body cleanup cannot prevent exact caller cancellation',async t=>{
 const controller=new AbortController(),reason=Error('Cancel C-DOT body');let streamController,started
 const ready=new Promise(resolve=>{started=resolve})
 const fetchImpl=async()=>{
  const body=new ReadableStream({start(c){streamController=c;started()},cancel(){return new Promise(()=>{})}})
  const response=new Response(body,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:index});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const pending=source.createCdotScraper({fetchImpl,minIntervalMs:0,signal:controller.signal}).run()
 await ready;controller.abort(reason)
 const result=await Promise.race([pending.then(value=>({value}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),150))])
 try{streamController.close()}catch{}
 await pending.catch(()=>{});assert.equal(result.error,reason)
})
