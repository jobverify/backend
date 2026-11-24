import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead,activeIframeDeclarations} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='revature',COMPANY_NAME='Revature',CAREER_PAGE_URL='https://www.revature.com/'
const fail=message=>firstPartyFailure(SOURCE,message,{failureKind:'coverage_gap',sourceScopeComplete:false}),need=(ok,message)=>{if(!ok)throw fail(message)}
export function readCurrentRevatureHome(body){
 const doc=readNativeDocument(body),head=activeHead(body),anchors=doc.nodes(n=>n.tag==='a'&&/^Careers At Revature(?: |$)/.test(doc.text(n)))
 need(head.titles.length===1&&head.titles[0]==='AI-Native Talent Transformation Platform | Revature'&&!doc.nodes(n=>n.tag==='base').length,'Current own homepage identity/base changed')
 const urls=[...new Set(anchors.map(n=>new URL(n.attrs.href,CAREER_PAGE_URL).href))]
 need(urls.length===1,'One own active Careers At Revature declaration required')
 const u=new URL(urls[0]);need(u.origin===new URL(CAREER_PAGE_URL).origin&&!u.search&&!u.hash&&u.pathname!=='/','Careers declaration changed employer authority')
 return {title:head.titles[0],careersURL:u.href,nativeCareerAnchors:structuredClone(anchors),wholeObservedDOM:structuredClone(doc.nodes(()=>true)),wholeOriginalHTML:body}
}
export function readCurrentRevatureProgramme(body,url){
 const doc=readNativeDocument(body),head=activeHead(body),frames=activeIframeDeclarations(body),descriptions=doc.nodes(n=>n.tag==='meta'&&n.attrs.name==='description')
 need(!doc.nodes(n=>n.tag==='base').length&&head.titles.length===1&&head.titles[0].startsWith('Revature | ')&&/Candidature Confirmation Form$/i.test(head.titles[0]),'Own candidature programme identity changed; individual vacancies need review')
 need(frames.length===1&&descriptions.length===1,'One complete native programme description/intake declaration required')
 const iframe=new URL(frames[0].href);need(iframe.origin==='https://forms.cloud.microsoft'&&/^\/r\/[a-zA-Z0-9]+$/.test(iframe.pathname)&&iframe.search==='?embed=true','Public intake declaration changed authority/protocol')
 const schemas=doc.nodes(n=>n.tag==='script'&&/ld\+json/i.test(n.attrs.type??''));need(!schemas.some(n=>/JobPosting/.test(n.raw??'')),'New authoritative role schema needs review; programme is not a vacancy')
 return {source:SOURCE,recordKind:'hiring-signals',title:head.titles[0],description:descriptions[0].attrs.content,url,company:COMPANY_NAME,jobId:null,requisitionId:null,country:null,location:null,postingDate:null,closingDate:null,declaredIntakeURL:iframe.href,nativeIntakeDeclaration:structuredClone(frames[0]),fullOwnRoleCriteriaQualified:false,individualVacancyIdentityQualified:false,activeApplyVerified:false,wholeOriginalHTML:body,wholeObservedDOM:structuredClone(doc.nodes(()=>true)),holds:['candidate-intake-programme-is-not-an-individual-vacancy','individual-role-workplace-country-and-full-authored-criteria-unpublished','intake-does-not-establish-company-vacancy-inventory']}
}
const homeSemantic=h=>({title:h.title,careersURL:h.careersURL,nativeCareerAnchors:h.nativeCareerAnchors})
const programmeSemantic=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['wholeOriginalHTML','wholeObservedDOM'].includes(k)))
export async function run(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchPage&&!options.fetchJson&&!options.workdayRunner,'Current Revature requires original HTTP metadata via fetchImpl; obsolete body-only/Workday callbacks are not current authority')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[CAREER_PAGE_URL,'html']],learnedURL:(url,kind)=>kind==='html'&&new URL(url).origin===new URL(CAREER_PAGE_URL).origin});let opening,closing,reconciled=false
 const audit=()=>({source:SOURCE,nativeProgrammeCount:opening?.programme?1:0,observedRecordCount:opening?.programme?1:0,observedVacancyCount:0,recordKind:'hiring-signals',companyIndiaTotal:null,companyGlobalTotal:null,companyIndiaZeroProven:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,wholeRawPublisherOpeningClosingEqual:!!closing&&isDeepStrictEqual(opening,closing),nativeProgrammeSemanticClosingReconciled:reconciled,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceNativeRequests:reader.stats().requests,intakeInteractions:0,guessedWorkdayRequests:0,holds:['individual-native-role-criteria-country-and-vacancy-identity-unavailable','public-intake-form-is-not-a-company-inventory']})
 async function capture(target){target.home=readCurrentRevatureHome((await reader.read(CAREER_PAGE_URL)).body);reader.allow(target.home.careersURL,'html');target.programme=readCurrentRevatureProgramme((await reader.read(target.home.careersURL)).body,target.home.careersURL)}
 try{
  opening={};await capture(opening);closing={};await capture(closing);need(isDeepStrictEqual(homeSemantic(opening.home),homeSemantic(closing.home))&&isDeepStrictEqual(programmeSemantic(opening.programme),programmeSemantic(closing.programme)),'Own candidature programme closing declarations changed; full originals retained');reconciled=true
  const jobs=[];attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});attachInventoryEvidence(jobs,{status:'coverage-gap',surface:opening.home.careersURL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:4,reportedTotal:null,verifiedAt:new Date().toISOString(),reason:'own-candidate-intake-programme-without-individual-vacancy-criteria-or-country'})
  const evidence=audit();need(Buffer.byteLength(JSON.stringify(evidence))<=16*1024*1024,'Evidence byte budget exceeded');Object.defineProperty(jobs,'recruitmentObservations',{value:evidence,configurable:true});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true});reader.check();options.signal?.throwIfAborted();return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:audit(),configurable:true})}catch{};options.signal?.throwIfAborted();throw error}
 finally{reader.close();options.signal?.throwIfAborted()}
}
export const createRevatureScraper=(defaults={})=>({run:options=>run({...defaults,...options})})
