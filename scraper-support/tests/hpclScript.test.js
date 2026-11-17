import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from '../../scraper/hpcl/script.js'
import {sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/hpcl/fixtures/native-20261117.json.gz',import.meta.url))))
const row=url=>fixture.responses.find(r=>(r.url??r.finalUrl)===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(edit=(r,text)=>text){const counts=new Map(),calls=[];return {calls,fetchImpl:async(url,init)=>{const r=row(url);assert.ok(r,'No actual source original for '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const n=(counts.get(url)??0)+1;counts.set(url,n);calls.push(url);return Object.defineProperty(new Response(edit(r,/^application\/pdf(?:;|$)/i.test(r.headers['content-type']??'')?Buffer.from(r.bodyBase64,'base64'):body(r),n),{status:r.status,headers:r.headers}),'url',{value:r.url??r.finalUrl})}}}
import {HOMEPAGE_URL,JOB_OPENINGS_URL,readCurrentHpcl,readCurrentHpclAnnouncements} from '../../scraper/hpcl/currentNative20261117.js'
const notices=()=>readCurrentHpclAnnouncements(readCurrentHpcl(body(row(JOB_OPENINGS_URL)),JOB_OPENINGS_URL))
test('HPCL current four full recruitment announcement models retain native PDFs dates and own application declarations without treating notices as India vacancies',()=>{
 const r=notices();assert.equal(r.observations.length,4);assert.ok(r.observations.some(n=>n.nativeText.includes('20th July 2026')));assert.ok(r.observations[0].nativeDeclarations.some(n=>n.resolvedURL.endsWith('.docx')))
 for(const n of r.observations){assert.equal(n.country,null);assert.equal(n.jobId,null);assert.equal(n.individualVacancyQualified,false);assert.equal(n.documentCriteriaQualified,false);assert.equal(n.loginIsVacancyAuthority,false);assert.ok(n.wholeNativeCard);assert.ok(n.nativeDeclarations.length>0)}
})
test('HPCL Job Updates general contact and document library are not vacancy records and collapsed card activation stays unqualified',()=>{
 const r=notices();assert.ok(r.observations.every(n=>!['Job Updates Form','Documents'].includes(n.title)));assert.equal(r.browserAccordionActivationQualified,false);assert.ok(r.observations.some(n=>n.nativeDeclarations.some(a=>a.resolvedURL==='https://pesb.gov.in/UserAccount/Login')))
})
test('HPCL future structured native vacancy declarations require qualification before a zero observed-vacancy announcement receipt',()=>{
 for(const model of [{'@type':'JobPosting'},{'@graph':[{'@type':'JobPosting'}]},[{'@type':['Thing','https://schema.org/JobPosting']}]])assert.throws(()=>readCurrentHpcl(body(row(JOB_OPENINGS_URL)).replace('</head>','<script type="application/ld+json">'+JSON.stringify(model)+'</script></head>'),JOB_OPENINGS_URL),/individual vacancy/)
})
test('HPCL own employer identity and whole closing announcement dates/document bindings remain mandatory',async()=>{
 assert.throws(()=>readCurrentHpcl(body(row(HOMEPAGE_URL)).replace('Hindustan Petroleum Corporation Ltd. | Oil and Gas Company in India | HPCL','Other Employer'),HOMEPAGE_URL),/title/)
 const {fetchImpl}=replay((r,text,n)=>r.url===JOB_OPENINGS_URL&&n===2?text.replaceAll('Detailed Advertisement (pdf attached)','Detailed Advertisement (pdf attached; changed criteria)'):text);await assert.rejects(run({fetchImpl}),/Closing whole native notification/)
})
test('HPCL actual current source reads declared job-openings page rather than empty old careers or application login and retains cleanup holds',async()=>{
 const r=replay(),jobs=await run(r);assert.equal(jobs.length,0);assert.equal(r.calls.length,16);assert.ok(r.calls.every(u=>u===HOMEPAGE_URL||u===JOB_OPENINGS_URL||u.startsWith(HOMEPAGE_URL+'documents/pdf/')));assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,4);assert.equal(jobs.nativeCollectionEvidence.nativeAdvertisementDocumentsRead,true);assert.equal(jobs.nativeCollectionEvidence.nativeOpening.documents.length,6);assert.equal(jobs.nativeCollectionEvidence.advertisementCriteriaQualified,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('HPCL original403 and202 WAF priority preserve native denial before any body read without alternate requests',async()=>{
 for(const status of [403,202]){let calls=0,reads=0;await assert.rejects(run({fetchImpl:async url=>{calls++;return {status,url,headers:new Headers(status===202?{'x-amzn-waf-action':'challenge'}:{}),body:{getReader(){reads++;assert.fail('No denied entity consumption')},cancel:async()=>{}}}}}),e=>e.httpStatus===status&&e.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)}
})
test('HPCL body-only callback cannot qualify native acquisition and fulfilled/rejected opaque caller abort keeps exact frozen owner reason',async()=>{
 let calls=0;await assert.rejects(run({fetchText:async()=>{calls++;assert.fail('Body-only callback must not run')}}),/Original HTTP metadata/);assert.equal(calls,0)
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'HPCL-'+mode});await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{controller.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'),'url',{value:url})}}),e=>e===reason)}
})
