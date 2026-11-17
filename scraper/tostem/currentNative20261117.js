import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='tostem',HOMEPAGE_URL='https://www.tostemindia.com/',CAREERS_URL='https://www.tostemindia.com/career/'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(rows,label)=>{need(rows.length===1,'Expected one current native '+label);return rows[0]}
const jobType=v=>Array.isArray(v)?v.some(jobType):typeof v==='string'&&/(?:^|[/#:])JobPosting$/i.test(v),hasJob=v=>!!v&&typeof v==='object'&&(jobType(v['@type'])||Object.values(v).some(hasJob))
const hiringLink=(link,url)=>{try{return !!link.attrs.href&&!link.attrs.href.startsWith('#')&&/\/(?:careers?|jobs?|vacancies|openings?|join-us)(?:\/|$)/i.test(new URL(link.attrs.href??'',url).pathname)||/\b(?:careers?|job openings?|current openings?|open positions?|vacancies|join our team|apply now)\b/i.test(link.text)}catch{return false}}
export function readCurrentPublisher(page){
 const doc=readNativeDocument(page.body),head=activeHead(page.body),title=one(head.titles,'publisher title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href,body=one(doc.nodes(n=>n.tag==='body'),'whole body')
 need(!doc.nodes(n=>n.tag==='base').length,'Unreviewed publisher base URL')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>{const literal=readLiteralModel(n.raw,{rawControls:true});return {attrs:structuredClone(n.attrs),raw:n.raw,value:literal.value,literalSyntax:{validJSON:literal.validJSON,rawControlCharacters:literal.rawControlCharacters,duplicateKeys:literal.duplicateKeys}}})
 need(!structured.some(n=>hasJob(n.value)),'New authoritative JobPosting requires complete native vacancy review')
 const links=doc.nodes(n=>n.tag==='a').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)})),hiringDeclarations=links.filter(n=>hiringLink(n,page.url))
 const model={url:page.url,title,canonical,wholeOriginalHTML:page.body,wholeObservedHead:head,wholeAuthoredBody:structuredClone(body),wholeAuthoredText:doc.text(body),structured,links,hiringDeclarations,wholeForms:doc.nodes(n=>n.tag==='form').map(n=>structuredClone(n)),nativeDates:doc.nodes(n=>n.tag==='time').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)})),programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),nativeInventoryQualified:false,corporateCountryIsRoleCountry:false,publicApplicationEligibilityQualified:false}
 need(canonical===page.url&&[HOMEPAGE_URL,CAREERS_URL].includes(page.url),'Current TOSTEM publisher canonical changed')
 need(title===(page.url===HOMEPAGE_URL?'Aluminium Windows & Doors Manufacturer in India | Tostem':'Tostem India Jobs Vacancy Recruitment, Career Portal for Fresher & Experienced Job Opening'),'Current TOSTEM publisher title changed')
 need(model.wholeAuthoredText.includes('LIXIL WINDOW SYSTEM')&&links.some(n=>n.attrs.href===CAREERS_URL&&n.text==='Career'),'Current own TOSTEM brand/career declaration changed')
 need(hiringDeclarations.every(n=>new URL(n.attrs.href??'',page.url).href===CAREERS_URL&&n.text==='Career'),'New authored hiring declaration requires complete native review')
 if(page.url===CAREERS_URL)need(doc.nodes(n=>n.tag==='h1').some(n=>doc.text(n)==='Career'),'Current native Career heading changed')
 model.nativePublisherBrand='TOSTEM';model.titleMetadataIsVacancyEvidence=false;model.customerAppointmentFormsAreApplicantCriteria=false
 return model
}
// Only this named authored text/identity/declaration model is reconciled. Full
// original DOM, opaque contacts/forms and unexecuted programmes remain retained
// and unqualified; no complete browser or company inventory is asserted.
const reviewedModel=m=>({url:m.url,title:m.title,canonical:m.canonical,wholeAuthoredText:m.wholeAuthoredText,structured:m.structured,hiringDeclarations:m.hiringDeclarations,nativeDates:m.nativeDates})
export async function runCurrentNative(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; native company inventory is unknown')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html']],learnedURL:(url,kind)=>kind==='html'&&url===CAREERS_URL});const unavailable=null;let opening,closing,lastNativeEntity
 async function currentModel(url){lastNativeEntity=await reader.read(url);return readCurrentPublisher(lastNativeEntity)}
 const summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null}
 const audit=()=>({...summary,observedRecordCount:opening?.home?1:null,observedVacancyCount:opening?.home?0:null,lastNativeEntity,nativeOpening:opening,nativeClosing:closing,observations:[{nativeDeclaration:opening?.home.hiringDeclarations,observedTargetURL:CAREERS_URL,recordKind:'hiring-signals',nativeRoleId:null,country:null,criteria:null,applicationUrl:null,isIndividualVacancy:false}],nativeHTTPFailure:unavailable?{httpStatus:unavailable.httpStatus,requestedUrl:unavailable.requestedUrl,responseUrl:unavailable.responseUrl,failureKind:unavailable.failureKind,message:unavailable.message}:null,reviewedAuthoredTextIdentityHiringClosingReconciled:!!closing,wholeRawPublisherOpeningClosingReconciled:false,entireDOMClosingReconciled:false,opaqueContactsAndFormsClosingQualified:false,nativeInventoryQualified:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,companyGlobalZeroProven:false,corporateCountryIsRoleCountry:false,publicApplicationEligibilityQualified:false,customerEnquiryFormsAreApplicantCriteria:false,applicationInteractions:0,programmesExecuted:false,guessedRouteRequests:0,retiredProgrammeRequests:0,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,titleMetadataIsVacancyEvidence:false,customerAppointmentFormsAreApplicantCriteria:false,holds:['current-own-Career-link-is-a-hiring-signal-without-individual-vacancy-country-or-criteria','SEO-title-corporate-country-and-customer-appointment-forms-are-not-job-eligibility','unexecuted-NitroPack-programmes-full-forms-and-company-inventory-remain-unknown']})
 try{
 async function authority(){const home=await currentModel(HOMEPAGE_URL);reader.allow(CAREERS_URL,'html');return {home,career:await currentModel(CAREERS_URL)}}
 opening=await authority();closing=await authority();need(isDeepStrictEqual(Object.values(opening).map(reviewedModel),Object.values(closing).map(reviewedModel)),'Closing reviewed publisher model changed')
 reader.check();const jobs=[];attachSourceObservationEvidence(jobs,summary);const evidence=audit();need(Buffer.byteLength(JSON.stringify(evidence))<=24*1024*1024,'Native output evidence byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
 const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOMEPAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-first-party-Career-handoff-retained;individual-vacancy-and-company-inventory-unknown'});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();const primary=unavailable&&error?.name==='TimeoutError'?unavailable:error;try{if(primary&&typeof primary==='object'){Object.defineProperty(primary,'recruitmentObservations',{value:audit(),configurable:true});Object.defineProperty(primary,'abortRetries',{value:true,configurable:true})}}catch{}options.signal?.throwIfAborted();throw primary}
 finally{reader.close();options.signal?.throwIfAborted()}
}

// Public helper shares the same original HTTP admission, body and deadline rules.
export async function defaultFetchPage(url,options={}){
 options.signal?.throwIfAborted();need([HOMEPAGE_URL,CAREERS_URL].includes(url),'Unbound native helper URL')
 const reader=createCurrentNativeReader({...options,requestTimeoutMs:options.requestTimeoutMs??options.timeoutMs??15000},{source:SOURCE,admitted:[[url,'html']]})
 try{const page=await reader.read(url);reader.check();return page}finally{reader.close();options.signal?.throwIfAborted()}
}
