import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
function currentFixture(){
 const bytes=readFileSync(new URL('../test-data/recruitmentGoal20261107/bilt-current.json.gz',import.meta.url))
 assert.equal(sha(bytes),'1b2b473be00b1c6d8f789b8c2639e6d6359b0c92b4d0a9e48095cc34118019b8')
 const fixture=JSON.parse(gunzipSync(bytes));assert.equal(fixture.source,'bilt');assert.equal(fixture.profile,'genuine-current-20261107-default18-four-complete-US-models-no-India-certificate');assert.equal(fixture.requests.length,18)
 for(const[hash,encoded]of Object.entries(fixture.entities))assert.equal(sha(Buffer.from(encoded,'base64')),hash)
 for(const p of fixture.requests){const b=Buffer.from(fixture.entities[p.bodySHA256],'base64');assert.equal(b.length,p.bodyBytes);assert.equal(sha(b),p.bodySHA256);assert.equal(p.bodyComplete,true)}
 return fixture
}
export async function assertBiltCurrentForeignExtraction(t,provider){
 assert.equal(provider.source,'bilt');const f=currentFixture(),calls=[],RealDate=globalThis.Date;let clock=0
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const p=f.requests[calls.length];assert.ok(p,'Bilt NETWORK TRIPWIRE extra request');assert.equal(String(input),p.url);assert.deepEqual({method:init.method,redirect:init.redirect,credentials:init.credentials,cache:init.cache},p.requestInit);assert.equal(init.body,undefined);assert.deepEqual(Object.fromEntries(new Headers(init.headers)),p.requestHeaders);assert.equal(new Headers(init.headers).has('authorization'),false);assert.equal(new Headers(init.headers).has('cookie'),false)
  calls.push({url:String(input),method:init.method,bodySHA256:p.bodySHA256});const response=new Response(Buffer.from(f.entities[p.bodySHA256],'base64'),{status:p.status,headers:p.responseHeaders});Object.defineProperty(response,'url',{value:p.finalURL});return response
 })
 // Replay only the actual source's zero-argument execution clocks. Native
 // publication dates and all original models/receipts stay byte-exact.
 globalThis.Date=new Proxy(RealDate,{construct(target,args){if(!args.length&&new Error().stack.includes('jobverify-backend')){assert.ok(clock<f.originalSourceClocks.length,'unexpected Bilt source clock');return new RealDate(f.originalSourceClocks[clock++])}return Reflect.construct(target,args)}})
 let jobs;try{jobs=await createCatalogScraper(provider).run()}finally{globalThis.Date=RealDate}
 assert.equal(clock,37);assert.equal(clock,f.originalSourceClocks.length);assert.equal(calls.length,18);assert.deepEqual(calls.map(r=>r.bodySHA256),f.requests.map(r=>r.bodySHA256));assert.deepEqual(jobs,f.expectedJobs);assert.equal(jobs.length,0,'Actual current capture has four foreign roles; no India-positive fixture is invented')
 assert.deepEqual(readInventoryEvidence(jobs),f.expectedInventory);assert.deepEqual(readSourceObservationEvidence(jobs,'bilt'),f.expectedObservations);assert.equal(Object.isFrozen(readSourceObservationEvidence(jobs,'bilt')),true)
 const audit=jobs.nativeCollectionEvidence;assert.deepEqual(audit,f.expectedAudit);assert.equal(audit.observations.length,4);assert.equal(audit.openingRoles.length,4);assert.equal(audit.closingRoles.length,4);assert.equal(audit.heldRoles.length,0);assert.equal(audit.fullServerPublishedNativeModels,4);assert.equal(audit.returnedIndiaJobs,0);assert.equal(audit.listingOpeningClosingStable,true);assert.equal(audit.allRoleModelsOpeningClosingStable,true);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.applicationInteractions,0);assert.equal(audit.publisherProgramsExecuted,false);assert.equal(audit.externalClientRuntimeReviewed,false)
 assert.deepEqual(audit.observations.map(r=>r.id),f.independentOracle.ids)
 for(const role of audit.observations){const expected=f.independentOracle.roles.find(r=>r.id===role.id);assert.equal(role.country,'United States');assert.equal(role.countryLiteral,expected.countryLiteral);assert.equal(role.countryBasis,expected.countryBasis);assert.equal(role.title,expected.title);assert.equal(role.postingDate,expected.postedDate);assert.deepEqual(role.publication,expected.publication);assert.equal(sha(role.fullCriteriaHTML),expected.fullCriteriaSHA256);assert.equal(role.declaredCanonical,expected.canonical);assert.deepEqual(role.sourceNativeEmployer,expected.sourceNativeEmployer);assert.equal(role.legalEmployerVerified,expected.legalEmployerVerified);assert.equal(role.complete,true);assert.equal(role.sourceScopeComplete,false);assert.equal(role.lifecycleCleanupAllowed,false);assert.equal(role.applicationAcceptanceVerified,false)}
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.notEqual(inventory.status,'verified-empty')
 return{jobs,calls,completeForeignModels:4,qualifiedIndia:0,companyIndiaZeroProven:false}
}
export async function assertBiltPrimaryDenial(t,provider){
 assert.equal(provider.source,'bilt');let calls=0
 t.mock.method(globalThis,'fetch',async(input,init={})=>{calls++;assert.equal(String(input),'https://bilt.ai/');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');const response=new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(input)});return response})
 await assert.rejects(createCatalogScraper(provider).run(),error=>{assert.equal(error.status,403);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.softFailure,true);assert.equal(error.upstreamOutage,true);assert.equal(error.abortRetries,true);assert.match(error.message,/HTTP.*403/);assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'});const audit=error.recruitmentObservations;assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.receipts.length,1);assert.equal(audit.receipts[0].status,403);assert.equal(audit.receipts[0].sha256,sha('Forbidden'));assert.equal(Buffer.from(audit.receipts[0].bodyBase64,'base64').toString(),'Forbidden');return true})
 assert.equal(calls,1,'No fallback, retry or invented empty inventory after primary denial')
}
