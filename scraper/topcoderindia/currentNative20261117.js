import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='topcoderindia',HOMEPAGE_URL='https://www.topcoder.com/',CAREERS_URL='https://www.topcoder.com/community/tcgigs'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(rows,label)=>{need(rows.length===1,'Expected one current native '+label);return rows[0]}
const jobType=v=>Array.isArray(v)?v.some(jobType):typeof v==='string'&&/(?:^|[/#:])JobPosting$/i.test(v),hasJob=v=>!!v&&typeof v==='object'&&(jobType(v['@type'])||Object.values(v).some(hasJob))
const hiringLink=(link,url)=>{try{return !!link.attrs.href&&!link.attrs.href.startsWith('#')&&/\/(?:careers?|jobs?|vacancies|openings?|join-us)(?:\/|$)/i.test(new URL(link.attrs.href??'',url).pathname)||/\b(?:careers?|job openings?|current openings?|open positions?|vacancies|join our team|apply now)\b/i.test(link.text)}catch{return false}}
export function readCurrentPublisher(page){
 const doc=readNativeDocument(page.body),head=activeHead(page.body),title=one(head.titles,'publisher title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href,body=one(doc.nodes(n=>n.tag==='body'),'whole body')
 need(!doc.nodes(n=>n.tag==='base').length,'Unreviewed publisher base URL')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>({attrs:structuredClone(n.attrs),raw:n.raw,value:readLiteralModel(n.raw).value}))
 need(!structured.some(n=>hasJob(n.value)),'New authoritative JobPosting requires complete native vacancy review')
 const links=doc.nodes(n=>n.tag==='a').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)})),hiringDeclarations=links.filter(n=>hiringLink(n,page.url))
 const model={url:page.url,title,canonical,wholeOriginalHTML:page.body,wholeObservedHead:head,wholeAuthoredBody:structuredClone(body),wholeAuthoredText:doc.text(body),structured,links,hiringDeclarations,wholeForms:doc.nodes(n=>n.tag==='form').map(n=>structuredClone(n)),nativeDates:doc.nodes(n=>n.tag==='time').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)})),programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),nativeInventoryQualified:false,corporateCountryIsRoleCountry:false,publicApplicationEligibilityQualified:false}
 need(page.url===HOMEPAGE_URL&&title==='Home | Topcoder'&&new URL(canonical,page.url).href===HOMEPAGE_URL&&model.wholeAuthoredText.includes('Fueling Innovation, Delivery, and the Future of Work')&&model.wholeAuthoredText.includes('scalable human + AI talent'),'Current Topcoder publisher identity changed')
 need(hiringDeclarations.length===0,'New authored employer hiring declaration requires native review')
 model.marketplaceProfiles=doc.nodes(n=>n.tag==='h3'&&doc.hasClass(n,'name')).map(n=>({attrs:structuredClone(n.attrs),nativeName:doc.text(n),wholeNativeHeading:structuredClone(n)}))
 model.marketplaceProfilesAreEmployerVacancies=false;model.profileCountryIsJobCountry=false;model.customerHireTalentCTAIsEmployerVacancy=false;model.nativeTargetEmploymentQualified=false
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
 const summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null}
 const audit=()=>({...summary,observedRecordCount:opening?.home?0:null,observedVacancyCount:opening?.home?0:null,lastNativeEntity,nativeOpening:opening,nativeClosing:closing,observations:[],nativeHTTPFailure:unavailable?{httpStatus:unavailable.httpStatus,requestedUrl:unavailable.requestedUrl,responseUrl:unavailable.responseUrl,failureKind:unavailable.failureKind,message:unavailable.message}:null,reviewedAuthoredTextIdentityHiringClosingReconciled:!!closing,wholeRawPublisherOpeningClosingReconciled:false,entireDOMClosingReconciled:false,opaqueContactsAndFormsClosingQualified:false,nativeInventoryQualified:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,companyGlobalZeroProven:false,corporateCountryIsRoleCountry:false,publicApplicationEligibilityQualified:false,customerEnquiryFormsAreApplicantCriteria:false,applicationInteractions:0,programmesExecuted:false,guessedRouteRequests:0,retiredProgrammeRequests:0,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,marketplaceProfilesAreEmployerVacancies:false,profileCountryIsJobCountry:false,customerHireTalentCTAIsEmployerVacancy:false,nativeTargetEmploymentQualified:false,holds:['current-marketplace-expert-profiles-and-customer-hire-talent-CTA-are-not-employer-vacancies','retired-gig-route-is-not-currently-declared-and-is-not-requested','unexecuted-client-programmes-and-company-employment-inventory-remain-unknown']})
 try{
 opening={home:await currentModel(HOMEPAGE_URL)};closing={home:await currentModel(HOMEPAGE_URL)};need(isDeepStrictEqual(reviewedModel(opening.home),reviewedModel(closing.home)),'Closing reviewed publisher model changed')
 reader.check();const jobs=[];attachSourceObservationEvidence(jobs,summary);const evidence=audit();need(Buffer.byteLength(JSON.stringify(evidence))<=24*1024*1024,'Native output evidence byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
 const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOMEPAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-marketplace-publisher-retained;no-observed-employer-hiring-record-and-company-inventory-unknown'});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();const primary=unavailable&&error?.name==='TimeoutError'?unavailable:error;try{if(primary&&typeof primary==='object'){Object.defineProperty(primary,'recruitmentObservations',{value:audit(),configurable:true});Object.defineProperty(primary,'abortRetries',{value:true,configurable:true})}}catch{}options.signal?.throwIfAborted();throw primary}
 finally{reader.close();options.signal?.throwIfAborted()}
}
