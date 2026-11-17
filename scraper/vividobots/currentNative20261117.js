import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='vividobots',HOMEPAGE_URL='https://www.vividobots.com/',CAREERS_URL='https://www.vividobots.com/careers'
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
 need(page.url===HOMEPAGE_URL&&title==='Vividobots | Construction robotics from Chennai'&&canonical==='https://vividobots.com/'&&model.wholeAuthoredText.includes('Reimagining how the world builds.')&&model.wholeAuthoredText.includes('Vividobots Private Limited'),'Current Vividobots publisher identity changed')
 need(hiringDeclarations.length>0&&hiringDeclarations.every(n=>new URL(n.attrs.href??'',page.url).href===CAREERS_URL&&n.text==='Careers'),'Current own Careers declaration changed or new role declaration requires review')
 const contacts=links.filter(n=>n.attrs.href==='mailto:hr@vividobots.com');need(contacts.length===1&&contacts[0].text==='hr@vividobots.com','Current own HR candidate contact changed');model.nativeCandidateContact=contacts[0];model.builtInIndiaIsRoleCountry=false
 return model
}
// Only this named authored text/identity/declaration model is reconciled. Full
// original DOM, opaque contacts/forms and unexecuted programmes remain retained
// and unqualified; no complete browser or company inventory is asserted.
const reviewedModel=m=>({url:m.url,title:m.title,canonical:m.canonical,wholeAuthoredText:m.wholeAuthoredText,structured:m.structured,hiringDeclarations:m.hiringDeclarations,nativeDates:m.nativeDates})
export async function runCurrentNative(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; native company inventory is unknown')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html']],learnedURL:(url,kind)=>kind==='html'&&url===CAREERS_URL});let opening,closing,unavailable,lastNativeEntity
 async function currentModel(url){lastNativeEntity=await reader.read(url);return readCurrentPublisher(lastNativeEntity)}
 const summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null}
 const audit=()=>({...summary,observedRecordCount:opening?.home?1:null,observedVacancyCount:opening?.home?0:null,lastNativeEntity,nativeOpening:opening,nativeClosing:closing,observations:[{nativeDeclaration:opening?.home.hiringDeclarations,nativeCandidateContact:opening?.home.nativeCandidateContact,observedTargetURL:CAREERS_URL,recordKind:'hiring-signals',nativeRoleId:null,country:null,criteria:null,applicationUrl:null,isIndividualVacancy:false}],nativeHTTPFailure:unavailable?{httpStatus:unavailable.httpStatus,requestedUrl:unavailable.requestedUrl,responseUrl:unavailable.responseUrl,failureKind:unavailable.failureKind,message:unavailable.message}:null,reviewedAuthoredTextIdentityHiringClosingReconciled:!!closing,wholeRawPublisherOpeningClosingReconciled:false,entireDOMClosingReconciled:false,opaqueContactsAndFormsClosingQualified:false,nativeInventoryQualified:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,companyGlobalZeroProven:false,corporateCountryIsRoleCountry:false,publicApplicationEligibilityQualified:false,customerEnquiryFormsAreApplicantCriteria:false,applicationInteractions:0,programmesExecuted:false,guessedRouteRequests:0,retiredProgrammeRequests:0,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,builtInIndiaIsRoleCountry:false,oldApplicationProgrammeRequests:0,holds:['current-own-HR-candidate-contact-and-Careers-link-are-one-general-hiring-signal-not-a-vacancy','declared-Careers-target-actual-HTTP404-remains-an-explicit-coverage-gap','manufacturing-India-and-Chennai-address-are-not-role-country','unexecuted-client-programmes-customer-forms-and-company-inventory-remain-unknown']})
 try{
 opening={home:await currentModel(HOMEPAGE_URL)};reader.allow(CAREERS_URL,'html')
 try{const page=await reader.read(CAREERS_URL);lastNativeEntity=page;opening.currentCareer={url:page.url,wholeOriginalHTML:page.body,wholeObservedDOM:structuredClone(readNativeDocument(page.body).nodes(()=>true))};need(false,'Current declared Careers page now responds; complete native vacancy review required')}
 catch(error){if(error?.httpStatus===404&&error.requestedUrl===CAREERS_URL&&error.responseUrl===CAREERS_URL){unavailable=error;opening.currentCareerUnavailable={httpStatus:404,requestedUrl:error.requestedUrl,responseUrl:error.responseUrl,entityReadBySource:false}}else throw error}
 closing={home:await currentModel(HOMEPAGE_URL)};need(isDeepStrictEqual(reviewedModel(opening.home),reviewedModel(closing.home)),'Closing reviewed publisher model changed')
 reader.check();const jobs=[];attachSourceObservationEvidence(jobs,summary);const evidence=audit();need(Buffer.byteLength(JSON.stringify(evidence))<=24*1024*1024,'Native output evidence byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
 const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOMEPAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-general-candidate-contact-retained;declared-Careers-target-HTTP404-and-company-inventory-unknown'});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();const primary=unavailable&&error?.name==='TimeoutError'?unavailable:error;try{if(primary&&typeof primary==='object'){Object.defineProperty(primary,'recruitmentObservations',{value:audit(),configurable:true});Object.defineProperty(primary,'abortRetries',{value:true,configurable:true})}}catch{}options.signal?.throwIfAborted();throw primary}
 finally{reader.close();options.signal?.throwIfAborted()}
}
