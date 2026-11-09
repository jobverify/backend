import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'
const sha=b=>createHash('sha256').update(b).digest('hex')
function fixture(){
 const b=readFileSync(new URL('../test-data/recruitmentGoal20261107/ferrero-current.json.gz',import.meta.url));assert.equal(sha(b),'b4bddd46dcf27740c1021b5c9805d581f7a49de9939658f6089f5841cc0c4461')
 const f=JSON.parse(gunzipSync(b));assert.equal(f.source,'ferrero');assert.equal(f.profile,'genuine-registered-default-20261107-28reads-10-full-India-native-expiry-holds-no-active-jobs');assert.equal(f.requests.length,28)
 for(const[hash,value]of Object.entries(f.entities))assert.equal(sha(Buffer.from(value,'base64')),hash)
 for(const r of f.requests){const b=Buffer.from(f.entities[r.bodySHA256],'base64');assert.equal(b.length,r.bodyBytes);assert.equal(sha(b),r.bodySHA256);assert.equal(r.status,200)}
 return f
}
export async function assertFerreroCurrentLifecycleHolds(t,provider){
 assert.equal(provider.source,'ferrero');const f=fixture(),calls=[],RealDate=globalThis.Date
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const r=f.requests[calls.length];assert.ok(r,'Ferrero NETWORK TRIPWIRE extra request');assert.equal(String(url),r.url);assert.equal(init.method,r.method);assert.equal(init.redirect,r.redirect);assert.equal(init.credentials,r.credentials);assert.equal(init.body??null,r.requestBody);assert.deepEqual(Object.fromEntries(new Headers(init.headers)),r.headers);assert.equal(new Headers(init.headers).has('authorization'),false);assert.equal(new Headers(init.headers).has('cookie'),false)
  calls.push({url:String(url),bodySHA256:r.bodySHA256});const response=new Response(Buffer.from(f.entities[r.bodySHA256],'base64'),{status:r.status,headers:r.responseHeaders});Object.defineProperty(response,'url',{value:r.finalURL});return response
 })
 // Pin only collection clocks; every native date and every original model,
 // receipt, full criterion and publication conflict stays exact.
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[f.observedAt]))}static now(){return RealDate.parse(f.observedAt)}}
 let jobs;try{jobs=await createCatalogScraper(provider).run()}finally{globalThis.Date=RealDate}
 assert.equal(calls.length,28);assert.deepEqual(calls.map(r=>r.bodySHA256),f.requests.map(r=>r.bodySHA256));assert.deepEqual([...jobs],f.expected.jobs);assert.equal(jobs.length,0,'Actual native expiry conflicts must never become a synthetic active India positive')
 const audit=jobs.nativeCollectionEvidence;assert.deepEqual(audit,f.expected.nativeAudit);assert.equal(Object.hasOwn(jobs,'sourceAudit'),false,'Registry exposes the complete nativeCollectionEvidence rather than generic sourceAudit')
 assert.deepEqual(readInventoryEvidence(jobs),f.expected.inventory);assert.deepEqual(readSourceObservationEvidence(jobs,'ferrero'),f.expected.observations);assert.equal(readSourceObservationEvidence(jobs,'ferrero').observedVacancyCount,10)
 assert.deepEqual(audit.openingRoles.map(r=>r.id),f.independentOracle.ids);assert.equal(audit.openingRoles.length,10);assert.equal(audit.closingRoles.length,10);assert.equal(audit.heldRoles.length,10)
 for(const r of audit.openingRoles){assert.equal(r.modelComplete,true);assert.equal(r.country,'India');assert.equal(r.nativeCountry,'IN');assert.equal(r.schema.hiringOrganization.name,'Ferrero');assert.equal(r.legalEmployer,null);assert.equal(r.criteriaText,r.schema.description);assert.ok(r.criteriaText.length>=2500);assert.ok(r.fullCriteriaHTML.length>r.criteriaText.length);assert.equal(r.schema.datePosted,r.schema.validThrough);assert.ok(Date.parse(r.schema.validThrough)<Date.parse(f.observedAt));assert.deepEqual(r.issues,['native-validThrough-is-past']);assert.equal(r.schemaIdentifierIsCategory,true);assert.notEqual(r.id,r.schema.identifier);assert.equal(r.applicationVisited,false);assert.equal(r.activeApplyVerified,false)}
 for(const r of audit.heldRoles){assert.equal(r.reason,'native-validThrough-is-past');assert.equal(r.opening.modelComplete,true);assert.deepEqual(r.opening,r.closing)}
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.externalClientRuntimeReviewed,false);assert.equal(audit.publisherProgramsExecuted,false);assert.equal(audit.applicationInteractions,0)
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
 return{jobs,calls,fullNativeIndiaModels:10,rawLifecycleHolds:10,qualifiedActiveIndia:0,companyIndiaZeroProven:false}
}
export async function assertFerreroPrimaryDenial(t,provider){
 assert.equal(provider.source,'ferrero');let calls=0
 t.mock.method(globalThis,'fetch',async(url,init)=>{calls++;assert.equal(String(url),'https://www.ferrero.com/');assert.equal(init.method,'GET');assert.equal(init.redirect,'follow');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);assert.deepEqual(Object.fromEntries(new Headers(init.headers)),{accept:'text/html','user-agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'});const response=new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(url)});return response})
 await assert.rejects(createCatalogScraper(provider).run(),e=>{assert.equal(e.status,403);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.upstreamOutage,true);assert.equal(e.softFailure,true);assert.equal(e.abortRetries,true);assert.match(e.message,/HTTP 403/);assert.deepEqual(classifyScraperError(e),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'});const a=e.recruitmentObservations;assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(a.companyIndiaZeroProven,false);assert.equal(a.receipts.length,1);assert.equal(a.receipts[0].status,403);assert.equal(a.receipts[0].bodySHA256,sha('Forbidden'));assert.equal(Buffer.from(a.receipts[0].bodyBase64,'base64').toString(),'Forbidden');return true})
 assert.equal(calls,1,'Primary denial authorizes no retry/fallback or empty-inventory certificate')
}
