import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
function currentFixture(){
 const bytes=readFileSync(new URL('../test-data/recruitmentGoal20261107/ikea-current.json.gz',import.meta.url))
 assert.equal(sha(bytes),'8fa8fca2a3684bcc1a5b671c296e2411f6930a4216f86b0ccf593f00a27297c6')
 const fixture=JSON.parse(gunzipSync(bytes));assert.equal(fixture.source,'ikea');assert.equal(fixture.profile,'genuine-current-20261107-default104-with-complete-original-headers-body-models-and-closing');assert.equal(fixture.requests.length,104)
 for(const [hash,encoded]of Object.entries(fixture.entities))assert.equal(sha(Buffer.from(encoded,'base64')),hash)
 for(const p of fixture.requests){const raw=Buffer.from(fixture.entities[p.bodySHA256],'base64');assert.equal(sha(raw),p.bodySHA256);assert.equal(raw.length,p.bodyBytes);assert.equal(p.bodyComplete,true)}
 return fixture
}
export async function assertIkeaCurrentExtraction(t,provider){
 assert.equal(provider.source,'ikea');const fixture=currentFixture(),calls=[]
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const p=fixture.requests[calls.length];assert.ok(p,'IKEA NETWORK TRIPWIRE extra request');assert.equal(String(input),p.url);assert.equal(init.method||'GET',p.method);assert.equal(init.body??null,p.requestBody);assert.equal(init.redirect,p.redirect);assert.equal(init.credentials,p.credentials);assert.deepEqual(Object.fromEntries(new Headers(init.headers)),p.requestHeaders);const h=new Headers(init.headers);assert.equal(h.has('authorization'),false);assert.equal(h.has('cookie'),false)
  calls.push({url:String(input),method:init.method||'GET',bodySHA256:p.bodySHA256});const response=new Response(Buffer.from(fixture.entities[p.bodySHA256],'base64'),{status:p.status,headers:{'content-type':p.contentType}});Object.defineProperty(response,'url',{value:p.finalURL});return response
 })
 const jobs=await createCatalogScraper(provider).run({now:()=>fixture.observedAt})
 assert.equal(calls.length,104);assert.deepEqual(calls.map(p=>p.bodySHA256),fixture.requests.map(p=>p.bodySHA256));assert.deepEqual(jobs,fixture.expectedJobs);assert.deepEqual(jobs.nativeCollectionEvidence,fixture.expectedAudit);assert.deepEqual(readInventoryEvidence(jobs),fixture.expectedInventory);assert.deepEqual(readSourceObservationEvidence(jobs,'ikea'),fixture.expectedObservations);assert.equal(Object.isFrozen(readSourceObservationEvidence(jobs,'ikea')),true)
 const audit=jobs.nativeCollectionEvidence;assert.equal(jobs.length,34);assert.equal(audit.opening.rows.length,42);assert.equal(audit.openingDetails.length,42);assert.equal(audit.closingDetails.length,42);assert.deepEqual(audit.opening.rows,audit.closing.rows);assert.deepEqual(audit.heldIndiaRoles.map(h=>({id:h.id,reasons:h.reasons})),fixture.independentOracle.held);assert.equal(audit.heldIndiaRoles.length,8);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.selectedScope,'keywordIndia+typedcountryIndia-only');assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
 for(const job of jobs){const oracle=fixture.independentOracle.descriptions.find(r=>r.reference===job.jobId);assert.equal(sha(job.sourceDescription),oracle.SHA256);assert.equal(job.postingDate,oracle.postedDate);assert.equal(job.applyUrl,oracle.applyUrl);assert.equal(job.country,'India');assert.equal(job.nativeEmployerBrand,'IKEA External');assert.equal(job.nativePublicationChannel,'Ingka External');assert.equal(job.nativeLegalEmployer,null);assert.equal(job.nativeHiringOrganization.name,'Ingka External');assert.equal(job.sourceDescription,job.sourceNativeRecord.nativeModel.Job.DescriptionHtml);assert.equal(job.sourceDescription,job.sourceNativeClosingRecord.nativeModel.Job.DescriptionHtml);assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.applicationVisited,false);assert.ok(job.workplaceLocations.every(l=>l.country==='India'&&l.nativeCountryCode==='IN'))}
 return{jobs,calls}
}
export async function assertIkeaCurrentDenial(t,provider){
 assert.equal(provider.source,'ikea');let calls=0
 t.mock.method(globalThis,'fetch',async(input,init={})=>{calls++;assert.equal(String(input),'https://www.ikea.com/global/en/jobs/');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const response=new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(input)});return response})
 await assert.rejects(createCatalogScraper(provider).run(),error=>{assert.equal(error.status,403);assert.equal(error.cause.status,403);assert.equal(error.cause.requestUrl,'https://www.ikea.com/global/en/jobs/');assert.match(error.message,/HTTP.*403/);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.softFailure,true);assert.equal(error.upstreamOutage,true);assert.equal(error.abortRetries,true);assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.recruitmentObservations.companyIndiaZeroProven,false);assert.equal(error.recruitmentObservations.sourceScopeComplete,false);assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false);assert.equal(error.recruitmentObservations.receipts.length,1);assert.equal(error.recruitmentObservations.receipts[0].status,403);assert.equal(error.recruitmentObservations.receipts[0].bodySHA256,sha('Forbidden'));return true})
 assert.equal(calls,1)
}
