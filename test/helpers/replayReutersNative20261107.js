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
 const bytes=readFileSync(new URL('../test-data/recruitmentGoal20261107/reuters-current.json.gz',import.meta.url));assert.equal(sha(bytes),'f47b9eb1a164c3d3f43c324bb2a3a3231eb0c43bd5dd76184bbe3ef0cb9e2230')
 const f=JSON.parse(gunzipSync(bytes));assert.equal(f.source,'reuters');assert.equal(f.profile,'genuine-no-options-default03-20261107-31responses-sixReuters-eightfull-twoParentHolds-28observations');assert.equal(f.actualRegisteredNoOptions,true);assert.equal(f.requests.length,31);assert.equal(f.sourceClocks.length,63)
 for(const[hash,encoded]of Object.entries(f.entities))assert.equal(sha(Buffer.from(encoded,'base64')),hash)
 for(const p of f.requests){const body=Buffer.from(f.entities[p.bodySHA256],'base64');assert.equal(body.length,p.bodyBytes);assert.equal(sha(body),p.bodySHA256);assert.equal(p.status,200)}
 return f
}
export async function assertReutersCurrentExtraction(t,provider){
 assert.equal(provider.source,'reuters');const f=fixture(),calls=[],RealDate=globalThis.Date;let clockCursor=0
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const p=f.requests[calls.length];assert.ok(p,'Reuters NETWORK TRIPWIRE extra request');assert.equal(String(input),p.url);assert.equal(init.method??'GET',p.method);assert.equal(init.redirect,p.redirect);assert.equal(init.credentials,p.credentials);assert.deepEqual(Object.fromEntries(new Headers(init.headers)),p.sourceHeaders);const body=Buffer.from(init.body??'');assert.equal(body.toString('base64'),p.requestBodyBase64);assert.equal(body.length,p.requestBodyBytes);assert.equal(sha(body),p.requestBodySHA256)
  for(const name of ['authorization','cookie','x-calypso-csrf-token'])assert.equal(new Headers(init.headers).has(name),false)
  calls.push({url:String(input),method:init.method??'GET',bodySHA256:p.bodySHA256});const response=new Response(Buffer.from(f.entities[p.bodySHA256],'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalURL});return response
 })
 // Only actual zero-argument source/transport collection clocks are replayed.
 // All original native date text, criteria, programs, tokens and bodies stay exact.
 globalThis.Date=new Proxy(RealDate,{construct(Target,args,newTarget){if(args.length===0&&/scraper[\\/]reuters\.workday[\\/]/.test(new Error().stack)){assert.ok(clockCursor<f.sourceClocks.length,'Reuters unrecorded collection clock');return Reflect.construct(Target,[f.sourceClocks[clockCursor++]],newTarget)}return Reflect.construct(Target,args,newTarget)}})
 let jobs;try{jobs=await createCatalogScraper(provider).run()}finally{globalThis.Date=RealDate}
 assert.equal(calls.length,31);assert.equal(clockCursor,63);assert.deepEqual(calls.map(p=>p.bodySHA256),f.requests.map(p=>p.bodySHA256));assert.equal(jobs.length,6);assert.deepEqual(jobs.map(j=>j.jobId),f.selectedIds)
 const audit=jobs.nativeCollectionEvidence,actual={jobs,inventory:readInventoryEvidence(jobs),observations:readSourceObservationEvidence(jobs,'reuters'),nativeEvidence:audit,error:null};assert.deepEqual(JSON.parse(JSON.stringify(actual)),f.expected)
 assert.equal(audit.openingDetails.length,8);assert.equal(audit.closingDetails.length,8);assert.equal(audit.heldRoles.length,2);assert.deepEqual(audit.heldRoles.map(r=>r.id),f.heldIds);assert.deepEqual(audit.openingDetails.map(r=>r.nativeModel),audit.closingDetails.map(r=>r.nativeModel))
 assert.equal(audit.rawOpeningListingRowReads,28);assert.equal(audit.facetDiscovery.rows.length,20);assert.equal(audit.selectedNativeRecords,8);assert.equal(new Set([...audit.facetDiscovery.rows,...audit.opening.rows].map(r=>r.externalPath)).size,28);assert.equal(actual.observations.observedVacancyCount,28);assert.equal(Object.isFrozen(actual.observations),true);assert.equal(audit.sharedBoardFacetDiscoveryRowsNotReutersCompanyInventory,true);assert.equal(audit.unfilteredFacetDiscoveryClosingReconciled,false)
 for(const oracle of f.independentOracle){const role=audit.openingDetails.find(r=>r.id===oracle.id);assert.equal(role.nativeModel.jobPostingInfo.title,oracle.title);assert.equal(role.nativeLegalEmployer,oracle.rawLegalEmployer);assert.equal(role.postingDate,oracle.startDate);assert.equal(role.closingDate,oracle.endDate);assert.equal(sha(role.criteriaHTML),oracle.criteriaHTMLSHA256);assert.deepEqual(role.nativeModel.jobPostingInfo.country,oracle.rawCountry);assert.deepEqual(role.nativeModel.jobPostingInfo.jobRequisitionLocation.country,oracle.rawRequisitionCountry);assert.equal(role.nativeModel.jobPostingInfo.timeLeftToApply,oracle.rawRemainingDaysLabel);assert.equal(role.complete,oracle.expectedQualified)}
 for(const job of jobs){assert.equal(job.company,'Reuters');assert.equal(job.country,'India');assert.equal(job.city,null);assert.equal(job.state,null);assert.equal(job.nativePublicationBrand,'Reuters');assert.equal(job.nativeLegalEmployer,'IND003 Thomson Reuters India Private Ltd');assert.equal(job.nativeHiringOrganization.name,job.nativeLegalEmployer);assert.equal(job.legalEmployerAlias,false);assert.equal(job.nativeHiringOrganization.url,'');assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.applicationVisited,false);assert.equal(job.applicationAcceptanceVerified,false);assert.equal(job.applyUrl,job.sourceUrl)}
 for(const held of audit.heldRoles){assert.ok(held.reasons.includes('role-owned-Reuters-publication-brand-unproven'));assert.equal(held.opening.nativeLegalEmployer,'IND002 Thomson Reuters International Services Private Limited');assert.equal(held.opening.nativePublicationBrand,null);assert.ok(held.opening.criteriaHTML.length>6000);assert.deepEqual(held.opening.nativeModel,held.closing.nativeModel)}
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.agencyBrowserVisibilityCertified,false);assert.equal(audit.publisherProgramsExecuted,false);assert.equal(audit.applicationInteractions,0);assert.equal(audit.semanticAgencyRoutingCannotQualifyCriteriaOrApplication,true)
 assert.equal(actual.inventory.status,'coverage-gap');assert.equal(actual.inventory.listingComplete,false);assert.equal(actual.inventory.reportedTotal,null);assert.equal(actual.inventory.indiaFacetCount,null)
 return{jobs,calls,fullModels:8,parentHolds:2,normalizedObservations:28,sourceClocks:clockCursor}
}
export async function assertReutersPrimaryDenial(t,provider){
 assert.equal(provider.source,'reuters');let calls=0
 t.mock.method(globalThis,'fetch',async(input,init)=>{calls++;assert.equal(String(input),'https://www.thomsonreuters.com/');assert.equal(init.method,'GET');assert.equal(init.redirect,'follow');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);assert.deepEqual(Object.fromEntries(new Headers(init.headers)),{accept:'text/html','user-agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'});const response=new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.thomsonreuters.com/en'});return response})
 await assert.rejects(createCatalogScraper(provider).run(),e=>{assert.equal(e.status,403);assert.equal(e.requestUrl,'https://www.thomsonreuters.com/');assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.softFailure,true);assert.equal(e.upstreamOutage,true);assert.equal(e.abortRetries,true);assert.equal(e.lifecycleCleanupAllowed,false);assert.deepEqual(classifyScraperError(e),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'});const a=e.recruitmentObservations;assert.equal(a.sourceScopeComplete,false);assert.equal(a.companyGlobalTotal,null);assert.equal(a.companyIndiaTotal,null);assert.equal(a.companyIndiaZeroProven,false);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(a.receipts.length,1);assert.equal(a.receipts[0].status,403);assert.equal(a.receipts[0].bodySHA256,sha('Forbidden'));assert.equal(a.receipts[0].body,'Forbidden');assert.equal(a.failures[0].status,403);assert.equal(a.failures[0].requestUrl,'https://www.thomsonreuters.com/');return true})
 assert.equal(calls,1,'Primary denial permits no retry, fallback or empty-inventory certification')
}
