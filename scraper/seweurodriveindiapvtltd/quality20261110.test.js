import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractOpenings,createSeweurodriveIndiaScraper} from './script.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {enrichJobsWithPublicExperience} from '../../scraper-support/utils/publicExperienceEnrichment.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/quality-20261110.json.gz',import.meta.url))))
const retained=JSON.parse(Buffer.from(fixture.retainedOutput.bodyBase64,'base64'))
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
// Synthetic HTML assembled from labelled retained outputs; never native bytes.
const cards=retained.jobs.map(j=>`<tr><td>1</td><td>${esc(j.title)}</td><td>${esc(j.city)}</td><td>${esc(j.department)}</td><td><a href="${esc(j.sourceUrl)}">PDF</a></td></tr>`).join('')
const html=`<main><h1>Your career at SEW-EURODRIVE</h1><p>Take a look at our current job opportunities.</p><h2>Job opportunities</h2><p>You can find a list of current job offers as below:</p><a href="https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html">application form</a><table><tr><th>Sr. No.</th><th>Job Position</th><th>Location</th><th>Vertical</th><th>Job Description</th></tr>${cards}</table></main>`
test('six labelled retained observations preserve internal IDs but do not invent formal IDs or own India country',()=>{
 const jobs=extractOpenings(html);assert.equal(jobs.length,6);assert.deepEqual(jobs.map(j=>j.jobId),retained.jobs.map(j=>j.jobId))
 for(const j of jobs){assert.equal(j.requisitionId,null);assert.equal(j.country,null);assert.equal(j.sourceCountryScopeUnresolved,true);assert.ok(!j.location.endsWith(', India'));assert.equal(j.nativeLegalEmployer,null)}
 assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,0)
 assert.equal(analyzePublishableJobs(jobs.map(j=>normalizeScrapedJob(j))).indiaJobs.length,0)
})
test('six authored summaries remain outside usable native descriptions and detail health is incomplete',async()=>{
 const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html})
 assert.equal(jobs.length,6);for(const j of jobs){assert.equal(j.jobDescription,null);assert.equal(j.sourceDescription,null);assert.equal(j.sourceDetailComplete,false);assert.ok(j.listingSummary.includes(j.title));assert.equal(j.skipPublicExperienceEnrichment,true);assert.equal(j.lifecycleCleanupAllowed,false)}
 const health=extractionDetailHealth(jobs);assert.equal(health.complete,false);assert.equal(health.missingDescriptions,6)
})
test('PDF callback errors cannot return generated summaries as successful criteria',async()=>{
 const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html,fetchDocumentText:async()=>{throw Error('HTTP403 native PDF unavailable')}})
 assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.jobDescription===null&&j.sourceDetailComplete===false));assert.ok(jobs.some(j=>j.sourceDetailFailureKind))
})
test('bare remote and foreign native worksite do not acquire India from company or source',()=>{
 for(const location of ['Remote','Toronto, Canada','Toronto (Canada)','Toronto - Canada','Mumbai / Toronto, Canada']){const jobs=extractOpenings(html.replaceAll('Mumbai',location));assert.notEqual(jobs[0].country,'India');assert.ok(!jobs[0].location.endsWith(', India'))}
})
for(const tag of ['template','blockquote','q','pre','code','div hidden','div aria-hidden="true"'])test('inert/quoted synthetic cards are not vacancy evidence: '+tag,()=>assert.throws(()=>extractOpenings('<'+tag+'>'+html+'</'+tag.split(' ')[0]+'>')))
test('an already cancelled caller preserves exact reason and performs no listing/PDF work',async()=>{const c=new AbortController(),reason=Error('cancel SEW');c.abort(reason);let reads=0;await assert.rejects(createSeweurodriveIndiaScraper().run({signal:c.signal,fetchText:async()=>{reads++;return html}}),e=>e===reason);assert.equal(reads,0)})
for(const location of ['SEW-Eurodrive India Pvt Ltd office','Mumbai (SEW-Eurodrive India Pvt Ltd)','Mumbai, India / Remote','Mumbai, India / Toronto, Canada','Mumbai, India / Toronto, USA'])test('company/office/partial worksite cannot supply complete India country: '+location,()=>assert.notEqual(extractOpenings(html.replaceAll('Mumbai',location))[0].country,'India'))
const response=(url,body,status=200,headers={'content-type':'text/html'})=>{const r=new Response(body,{status,headers});Object.defineProperty(r,'url',{value:url});return r}
test('original retained403 replays as a blocked source with one read and no fabricated current observations',async()=>{
 const p=fixture.accessDenial;let reads=0,pdfCalls=0
 await assert.rejects(createSeweurodriveIndiaScraper().run({fetchImpl:async(url,init)=>{reads++;assert.equal(url,p.requestedURL);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');return response(p.finalURL,Buffer.from(p.bodyBase64,'base64'),p.status,p.headers)},fetchDocumentText:()=>{pdfCalls++;throw Error('not reached')}}),error=>{
  assert.equal(error.status,403);assert.equal(error.abortRetries,true);assert.equal(extractionFailureDetails(error).failureKind,'blocked_or_access_denied');assert.equal(error.nativeEvidence.observedListingCount,null)
  assert.equal(error.nativeEvidence.retainedResponses[0].bodySHA256,p.bodySHA256);assert.equal(error.nativeEvidence.retainedResponses[0].rawBodyBase64,p.bodyBase64);return true
 });assert.equal(reads,1);assert.equal(pdfCalls,0)
})
test('default synthetic listing-only path performs no unreviewed PDF request',async()=>{
 let reads=0;const jobs=await createSeweurodriveIndiaScraper().run({fetchImpl:async url=>{reads++;return response(url,html)}})
 assert.equal(reads,1);assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.sourcePDFContractVerified===false&&j.jobDescription===null));assert.equal(readSourceObservationEvidence(jobs,'seweurodriveindiapvtltd').observedVacancyCount,6)
})
for(const location of ['Mumbai, India','Mumbai (India)','Mumbai - India','Country code: IN'])test('only explicit own written/typed country qualifies India: '+location,()=>{
 const jobs=extractOpenings(html.replaceAll('Mumbai',location));assert.equal(jobs[0].country,'India');assert.equal(jobs[0].location,location);assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].jobDescription,null)
})
for(const location of ['IN','CA','Country: ZZ','India Pvt Ltd Office','Remote','Mumbai, India / Unknown Office'])test('unresolved location grammar stays unresolved through real consumers: '+location,()=>{
 const jobs=extractOpenings(html.replaceAll('Mumbai',location)),normalized=jobs.map(j=>normalizeScrapedJob(j,{country:'India',locationCountry:'India'}));assert.equal(jobs[0].country,null);assert.equal(normalized[0].country,null);assert.equal(analyzePublishableJobs(normalized).indiaJobs.length,0)
})
for(const location of ['Country: US, India','Mumbai, Country code: CA, India','Country: ZZ, India','Mumbai, India, Country: US','Mumbai, India (Country code: ZZ)','Mumbai, India / Pune, Country: US, India','Country: IN, India / Country code: CA, India','Country: IN, Country: US, India'])test('every typed own-country declaration must agree through real consumers: '+location,()=>{
 const jobs=extractOpenings(html.replaceAll('Mumbai',location)),normalized=jobs.map(j=>normalizeScrapedJob(j,{country:'India',locationCountry:'India'}))
 assert.equal(jobs[0].location,location);assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceCountryScopeUnresolved,true);assert.equal(normalized[0].country,null);assert.equal(analyzePublishableJobs(normalized).indiaJobs.length,0)
 assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].jobDescription,null)
})
for(const location of ['Mumbai, Country code: IN, India','Mumbai, India, Country: IN','Mumbai, India / Pune, Country code: IN','Country: India, Country code: IN'])test('consistent typed own-country declaration preserves explicit India: '+location,()=>{
 const jobs=extractOpenings(html.replaceAll('Mumbai',location)),normalized=jobs.map(j=>normalizeScrapedJob(j))
 assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceCountryScopeUnresolved,false);assert.equal(normalized[0].country,'India');assert.equal(jobs[0].location,location)
})
for(const change of [body=>body.replace('Your career at SEW-EURODRIVE','Another Company'),body=>body.replaceAll('web_online_contact_form_career.html','foreign.html'),body=>body.replace('<table>','<template><table>').replace('</table>','</table></template>'),body=>body.replace('Job Description','Other column')])test('changed active publisher/handoff/table contracts fail closed',()=>assert.throws(()=>extractOpenings(change(html))))
test('metadata-free listing callbacks never claim first-party transport verification',async()=>{const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html});assert.equal(readInventoryEvidence(jobs).firstParty,false)})
test('maxJobs retains all six candidate identities/observations in scoped evidence',async()=>{const jobs=await createSeweurodriveIndiaScraper({maxJobs:2}).run({fetchText:async()=>html});assert.equal(jobs.length,2);assert.equal(readSourceObservationEvidence(jobs,'seweurodriveindiapvtltd').observedVacancyCount,6);assert.equal(jobs.nativeCollectionEvidence.candidateListingRecords.length,6);assert.equal(jobs.nativeCollectionEvidence.failures.length,6);assert.equal(extractionDetailHealth(jobs).complete,false)})
test('generic raw/browser enrichment cannot promote held PDF candidates',async()=>{const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html});let reads=0;const after=await enrichJobsWithPublicExperience(jobs,{fetchText:async()=>{reads++;return '<p>Borrowed criteria</p>'},fetchBrowserText:async()=>{reads++;return '<p>Borrowed criteria</p>'}});assert.equal(reads,0);assert.ok(after.every(j=>j.jobDescription===null&&j.requisitionId===null&&j.country===null))})
test('unverified callback text, even plausible matching PDF text, cannot establish native criteria/employer/country',async()=>{const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html,fetchDocumentText:async()=>retained.jobs[0].title+' Employer: SEW-Eurodrive India Pvt Ltd. Work Location: Mumbai, India. Responsibilities: Design and validate drive systems. Qualifications: Engineering experience.'.repeat(10)});assert.ok(jobs.every(j=>j.jobDescription===null&&j.sourceDetailComplete===false&&j.nativeLegalEmployer===null&&j.country===null))})
test('nested PDF callback failures are bounded, retained and never usable descriptions',async()=>{const cause=Object.assign(Error('x'.repeat(5000)),{code:'ENOTFOUND'}),error=Error('fetch failed',{cause});const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html,fetchDocumentText:async()=>{throw error}});assert.equal(jobs[0].sourceDetailFailure.cause.code,'ENOTFOUND');assert.ok(jobs[0].sourceDetailFailure.cause.message.length<=240);assert.equal(jobs[0].jobDescription,null)})
test('diagnostic PDF403 stops the declared origin while retaining all candidates',async()=>{let calls=0;const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html,fetchDocumentText:async()=>{calls++;throw Object.assign(Error('HTTP403 PDF denied'),{status:403})}});assert.equal(calls,1);assert.equal(jobs.length,6);assert.equal(jobs[1].sourceDetailFailureKind,'native-pdf-origin-denied')})
test('local PDF diagnostic cancellation is held, with original typed cause, rather than a summary success',async()=>{const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html,fetchDocumentText:async()=>{throw new DOMException('PDF cancelled','AbortError')}});assert.equal(jobs.length,6);assert.equal(jobs[0].sourceDetailFailure.name,'AbortError');assert.equal(jobs[0].jobDescription,null)})
test('active caller abort cancels a PDF diagnostic that ignores its signal and preserves exact reason',async()=>{const c=new AbortController(),reason=Error('stop PDF diagnostic');let calls=0;const pending=createSeweurodriveIndiaScraper().run({signal:c.signal,fetchText:async()=>html,fetchDocumentText:()=>{calls++;return new Promise(()=>{})}});setTimeout(()=>c.abort(reason),5);await assert.rejects(pending,e=>e===reason);assert.equal(calls,1)})
test('individual PDF diagnostic request deadlines bound ignored signals and retain six incomplete rows',async()=>{const jobs=await createSeweurodriveIndiaScraper().run({fetchText:async()=>html,requestTimeoutMs:5,fetchDocumentText:()=>new Promise(()=>{})});assert.equal(jobs.length,6);assert.equal(jobs[0].sourceDetailFailure.name,'TimeoutError');assert.equal(jobs[0].jobDescription,null)})
for(const kind of ['resolve','reject'])test('synchronous callback '+kind+' cannot bypass elapsed source deadline',async()=>assert.rejects(createSeweurodriveIndiaScraper().run({sourceTimeoutMs:1,fetchText:()=>{const end=performance.now()+10;while(performance.now()<end){/* synchronous callback simulation */}if(kind==='reject')throw Error('late failure');return html}}),{name:'TimeoutError'}))
test('synchronous callback work also respects individual request deadline',async()=>assert.rejects(createSeweurodriveIndiaScraper().run({sourceTimeoutMs:1000,requestTimeoutMs:1,fetchText:()=>{const end=performance.now()+10;while(performance.now()<end){/* synchronous callback simulation */}return html}}),{name:'TimeoutError'}))
test('physical request caller abort cancels late unread response without additional reads',async()=>{
 const c=new AbortController(),reason=Error('stop GET');let release,cancelled=0
 const pending=createSeweurodriveIndiaScraper().run({signal:c.signal,fetchImpl:()=>new Promise(resolve=>{release=resolve})});setTimeout(()=>c.abort(reason),5);await assert.rejects(pending,e=>e===reason)
 release(response('https://www.seweurodriveindia.com/career/your_career/your_career.html',new ReadableStream({cancel(){cancelled++}})))
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancelled,1)
})
for(const variant of ['mime','final-url','redirect','body-size'])test('physical listing '+variant+' boundary is held',async()=>assert.rejects(createSeweurodriveIndiaScraper().run({fetchImpl:async url=>response(variant==='final-url'?'https://foreign.example/':url,variant==='body-size'?'x'.repeat(4000001):html,variant==='redirect'?302:200,{'content-type':variant==='mime'?'application/json':'text/html'})})))
