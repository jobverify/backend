import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {hasOfficialNoticeDetailSignal,extractNoticePdfUrl,extractPortalNotices,createGardenReachShipbuildersScraper,extractNoticeDetailsFromPdf} from './script.js'
import {corporateDelegates} from './currentNotice20261110.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261110.json.gz',import.meta.url))))
const body=n=>Buffer.from(fixture.packets[n-1].bodyBase64,'base64').toString('utf8')
test('genuine current2026/05 own detail accepts actual reviewed handoff wording and exact native notification',()=>assert.equal(hasOfficialNoticeDetailSignal(body(3),{notificationId:'2026/05(J&OP)'}),true))
test('genuine current detail selects detailed advertisement rather than abridged/FAQ',()=>assert.equal(extractNoticePdfUrl(body(3),{detailUrl:fixture.packets[2].finalURL}),'https://jobapply.in/GRSE2026Journeyman/adv_eng.pdf'))
test('genuine malformed2025 portal retains eleven separate native notice observations without merging titles',()=>{
 const rows=extractPortalNotices(body(4),{portalIndexUrl:fixture.packets[3].finalURL});assert.equal(rows.length,11);assert.equal(rows[0].notificationId,'2026/01(E)');assert.equal(rows[0].closingDate,'2026-01-30T00:00:00.000Z');assert.ok(rows.every(r=>!r.title.includes('Last date')))
})
test('genuine current corporate section binds complete own notice despite repeated historical CJO id',()=>assert.equal(corporateDelegates(body(1)).notificationId,'2026/05(J&OP)'))
for(const tag of ['template','blockquote','q','pre','code','div hidden','div aria-hidden="true"']){
 test('inert/quoted corporate declaration cannot delegate: '+tag,()=>assert.throws(()=>corporateDelegates('<'+tag+'>'+body(1)+'</'+tag.split(' ')[0]+'>')))
 test('inert/quoted own detail is not a positive notice: '+tag,()=>assert.equal(hasOfficialNoticeDetailSignal('<'+tag+'>'+body(3)+'</'+tag.split(' ')[0]+'>',{notificationId:'2026/05(J&OP)'}),false))
}
test('native detail exact identity cannot be supplied by another notice or a stale comment',()=>{
 assert.equal(hasOfficialNoticeDetailSignal(body(3).replaceAll('2026/05','2026/06')+'<!-- Employment Notification No. :2026/05(J&OP) -->',{notificationId:'2026/05(J&OP)'}),false)
})
for(const href of ['https://foreign.example/adv_eng.pdf','https://jobapply.in/OtherNotice/adv_eng.pdf','adv_eng_abridged.pdf?fake=detailed','FAQ.pdf#detailed'])test('unreviewed foreign/other-notice/query PDF handoff held: '+href,()=>assert.equal(extractNoticePdfUrl(body(3).replace('href="adv_eng.pdf"','href="'+href+'"'),{detailUrl:fixture.packets[2].finalURL}),null))
test('detailed advertisement ambiguity is held rather than selecting abridged or first arbitrary URL',()=>assert.equal(extractNoticePdfUrl(body(3).replace('</body>','<a href="second.pdf">View Detailed Advertisement</a></body>'),{detailUrl:fixture.packets[2].finalURL}),null))
test('native index retains all four current-year notices with no formal job IDs or neighboring criteria',()=>{
 const rows=extractPortalNotices(body(2),{portalIndexUrl:fixture.packets[1].finalURL});assert.equal(rows.length,4);assert.ok(rows.every(r=>r.nativeJobId===null&&r.nativeRequisitionId===null));assert.equal(rows[0].notificationId,'2026/05(J&OP)');assert.equal(rows[0].closingDate,'2026-11-28T00:00:00.000Z')
})
test('invalid calendar date cannot roll into another month',()=>assert.throws(()=>extractPortalNotices(body(2).replace('28-Nov-2026','31-Nov-2026'),{portalIndexUrl:fixture.packets[1].finalURL})))
test('current original PDF is retained as a group document, never as one/58 India jobs or a formal requisition',()=>{
 const observation=extractNoticeDetailsFromPdf(fixture.localExtractedPDF.text,{notificationId:'2026/05(J&OP)',listingTitle:'JOURNEYMAN & DRIVER (VEHICLE)'})
 assert.equal(observation.recordKind,'native-recruitment-document-observation');assert.equal(observation.notificationId,'2026/05(J&OP)');assert.equal(observation.nativeRequisitionId,null);assert.equal(observation.nativeJobId,null);assert.equal(observation.country,null);assert.equal(observation.sourceCountryScopeUnresolved,true);assert.equal(observation.individualVacancyCount,null);assert.equal(observation.individualRoleRecordsParsed,false);assert.equal(observation.jobDescription,null);assert.equal(observation.rawNoticePDFText,fixture.localExtractedPDF.text);assert.equal(observation.rawNoticePDFTextSHA256,fixture.localExtractedPDF.textSHA256);assert.equal(observation.postingDate,'2026-10-30T00:00:00.000Z');assert.equal(observation.closingDate,'2026-11-28T00:00:00.000Z')
})
for(const change of [s=>s.replaceAll('2026/05','2026/06'),s=>s.replaceAll('GARDEN REACH SHIPBUILDERS & ENGINEERS LIMITED','Different Employer Limited'),s=>s.replace('30 Oct 2026','31 Nov 2026')])test('PDF own notification/employer/date identity drift held',()=>assert.throws(()=>extractNoticeDetailsFromPdf(change(fixture.localExtractedPDF.text),{notificationId:'2026/05(J&OP)'})))
const response=(p,bytes=Buffer.from(p.bodyBase64,'base64'),status=p.status,headers=p.headers,finalURL=p.finalURL)=>{const r=new Response(bytes,{status,headers});Object.defineProperty(r,'url',{value:finalURL});return r}
const replay=()=>{const remaining=new Map(fixture.packets.map(p=>[p.requestedURL,[p]])),calls=[];return {calls,fetchImpl:async(target,init)=>{calls.push(target);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');const p=remaining.get(target)?.shift();assert.ok(p,'unexpected/duplicate read: '+target);return response(p)}}}
test('actual current five originals reach PDF/role-country hold with one active native notice and complete raw observations',async()=>{
 const r=replay();await assert.rejects(createGardenReachShipbuildersScraper({asOfDate:'2026-11-10'}).run(r),error=>{
  const n=error.nativeEvidence;assert.equal(n.observedListingCount,1);assert.equal(n.indexNoticeObservations[0].notices.length,4);assert.equal(n.indexNoticeObservations[1].notices.length,11);assert.equal(n.transportPackets.length,5);assert.equal(n.retainedResponses.length,5);assert.equal(n.candidateListingRecords[0].notificationId,'2026/05(J&OP)');assert.equal(n.candidateListingRecords[0].nativeRequisitionId,null);assert.equal(n.jobs.length,0);assert.equal(n.inventoryComplete,false);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.companyIndiaTotal,null);assert.equal(n.sourceScopeComplete,false);return true
 });assert.equal(r.calls.length,5)
})
for(const status of [403,429])test('native denial'+status+' stops exact origin after first response and retains standard blocked evidence',async()=>{
 let calls=0;await assert.rejects(createGardenReachShipbuildersScraper().run({fetchImpl:async url=>{calls++;return response({finalURL:url},Buffer.from('Forbidden native public response'),status,{'content-type':'text/html'})}}),e=>{assert.equal(e.status,status);assert.equal(e.abortRetries,true);assert.equal(extractionFailureDetails(e).failureKind,'blocked_or_access_denied');assert.equal(e.nativeEvidence.retainedResponses.length,1);assert.equal(e.nativeEvidence.observedListingCount,null);return true});assert.equal(calls,1)
})
test('legacy callbacks are rejected without falling through to real network or accepting plain PDF text',async()=>{let calls=0;await assert.rejects(createGardenReachShipbuildersScraper().run({fetchText:async()=>body(2),fetchDocumentText:async()=>fixture.localExtractedPDF.text,fetchImpl:()=>{calls++;throw Error('unexpected')}}),/unverified legacy/);assert.equal(calls,0)})
test('pre-cancelled caller preserves exact reason and does no work',async()=>{const c=new AbortController(),reason=Error('stop before GRSE');c.abort(reason);let calls=0;await assert.rejects(createGardenReachShipbuildersScraper().run({signal:c.signal,fetchImpl:()=>{calls++}}),e=>e===reason);assert.equal(calls,0)})
test('active caller abort bounds a transport ignoring its signal',async()=>{const c=new AbortController(),reason=Error('stop GRSE');const pending=createGardenReachShipbuildersScraper().run({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});setTimeout(()=>c.abort(reason),5);await assert.rejects(pending,e=>e===reason)})
for(const result of ['resolve','reject'])test('synchronous '+result+' cannot bypass elapsed source/request deadline',async()=>{
 await assert.rejects(createGardenReachShipbuildersScraper().run({sourceTimeoutMs:1000,requestTimeoutMs:1,fetchImpl:()=>{const end=performance.now()+10;while(performance.now()<end){/* Simulate synchronous transport work. */}if(result==='reject')throw Error('late transport');return response(fixture.packets[0])}}),{name:'TimeoutError'})
})
test('future date with no active notice is an explicit hold, never a verified empty inventory',async()=>{const r=replay();await assert.rejects(createGardenReachShipbuildersScraper({asOfDate:'2027-01-01'}).run(r),e=>{assert.equal(e.nativeEvidence.observedListingCount,0);assert.equal(e.nativeEvidence.inventoryComplete,false);return true});assert.equal(r.calls.length,3)})
for(const kind of ['MIME','finalURL','redirect','body-size'])test('bounded own listing transport '+kind+' change cannot qualify',async()=>assert.rejects(createGardenReachShipbuildersScraper().run({fetchImpl:async target=>response(fixture.packets[0],kind==='body-size'?Buffer.alloc(4000001,65):Buffer.from(fixture.packets[0].bodyBase64,'base64'),kind==='redirect'?302:200,kind==='MIME'?{'content-type':'application/json'}:fixture.packets[0].headers,kind==='finalURL'?'https://foreign.example/':target)})))
test('PDF origin denial preserves the already observed notice and stops without document retry',async()=>{
 const r=replay();let pdfCalls=0;await assert.rejects(createGardenReachShipbuildersScraper({asOfDate:'2026-11-10'}).run({fetchImpl:async(target,init)=>{if(target.endsWith('/adv_eng.pdf')){pdfCalls++;return response({finalURL:target},Buffer.from('Forbidden'),403,{'content-type':'text/html'})}return r.fetchImpl(target,init)}}),e=>{assert.equal(e.status,403);assert.equal(e.nativeEvidence.observedListingCount,1);assert.equal(e.nativeEvidence.candidateListingRecords.length,1);assert.equal(e.nativeEvidence.failures[0].stage,'native-pdf-transport');assert.equal(extractionFailureDetails(e).failureKind,'blocked_or_access_denied');return true});assert.equal(pdfCalls,1)
})
test('source deadline binds synchronous work even below the individual request cap',async()=>assert.rejects(createGardenReachShipbuildersScraper().run({sourceTimeoutMs:1,fetchImpl:()=>{const end=performance.now()+10;while(performance.now()<end){/* Simulate synchronous source work. */}return response(fixture.packets[0])}}),{name:'TimeoutError'}))
test('active caller cancellation releases a late ignored-signal response body',async()=>{
 const c=new AbortController(),reason=Error('cancel before late response');let release,cancels=0
 const pending=createGardenReachShipbuildersScraper().run({signal:c.signal,fetchImpl:()=>new Promise(resolve=>{release=resolve})});setTimeout(()=>c.abort(reason),5);await assert.rejects(pending,e=>e===reason)
 release(response(fixture.packets[0],new ReadableStream({cancel(){cancels++}})));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancels,1)
})
test('corporate parent/name/nationality cannot turn notice text into explicit India role geography',()=>{
 const observation=extractNoticeDetailsFromPdf(fixture.localExtractedPDF.text+' All Indian Nationals are invited; Government of India company; Corporate Office Kolkata.',{notificationId:'2026/05(J&OP)'})
 assert.equal(observation.country,null);assert.equal(observation.sourceCountryScopeUnresolved,true);assert.equal(observation.individualRoleRecordsParsed,false);assert.equal(observation.jobDescription,null)
})
for(const length of [2*1024*1024+1,16*1024*1024+1])test('oversized actual denial preserves status without unbounded original-body retention: '+length,async()=>{
 let calls=0;await assert.rejects(createGardenReachShipbuildersScraper().run({fetchImpl:async target=>{calls++;return response({finalURL:target},Buffer.alloc(length,65),403,{'content-type':'text/html'})}}),e=>{assert.equal(e.status,403);assert.equal(extractionFailureDetails(e).failureKind,'blocked_or_access_denied');assert.equal(e.nativeEvidence.retainedResponses.length,0);assert.equal(e.nativeEvidence.transportPackets[0].status,403);return true});assert.equal(calls,1)
})
for(const injection of ['<base href="https://foreign.example/">','<div hidden><base href="https://foreign.example/"></div>','<blockquote><base href="https://foreign.example/"></blockquote>','<base href="https://jobapply.in/OtherNotice/">'])test('document-level base authority cannot change literal own PDF handoff: '+injection,()=>{
 const mutated=body(3).replace('</head>',injection+'</head>');assert.equal(hasOfficialNoticeDetailSignal(mutated,{notificationId:'2026/05(J&OP)'}),false);assert.equal(extractNoticePdfUrl(mutated,{detailUrl:fixture.packets[2].finalURL}),null)
})
for(const injection of ['<!-- <base href="https://foreign.example/"> -->','<template><base href="https://foreign.example/"></template>','<noscript><base href="https://foreign.example/"></noscript>'])test('inert commented/template/noscript base is not document authority: '+injection,()=>{
 const mutated=body(3).replace('</head>',injection+'</head>');assert.equal(hasOfficialNoticeDetailSignal(mutated,{notificationId:'2026/05(J&OP)'}),true);assert.equal(extractNoticePdfUrl(mutated,{detailUrl:fixture.packets[2].finalURL}),'https://jobapply.in/GRSE2026Journeyman/adv_eng.pdf')
})
