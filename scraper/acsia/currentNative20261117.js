import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const CAREER_PAGE_URL='https://www.acsiatech.com/careers/'
const SOURCE='acsia',COMPANY='Acsia Technologies',APPLY=CAREER_PAGE_URL+'#apply-form',sha=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const elements=node=>(node.children??[]).filter(child=>typeof child==='object')
const wholeNodes=(node,predicate)=>[...(predicate(node)?[node]:[]),...elements(node).flatMap(child=>wholeNodes(child,predicate))]
export function readCurrentAcsiaModel(html){
 const doc=readNativeDocument(html),head=activeHead(html),canonicals=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 need(isDeepStrictEqual(head.titles,['Careers at Acsia I Jobs in Automotive Technology'])&&canonicals.length===1&&canonicals[0].attrs.href===CAREER_PAGE_URL&&!doc.nodes(n=>n.tag==='base').length,'Current own employer careers identity/canonical/base changed')
 const containers=doc.nodes(n=>elements(n).some(child=>doc.hasClass(child,'accordion-title-wrapper'))&&elements(n).some(child=>doc.hasClass(child,'accordion-content-wrapper')))
 const rows=[],seen=new Set()
 for(const container of containers){
  const titles=elements(container).filter(n=>doc.hasClass(n,'accordion-title-wrapper')),contents=elements(container).filter(n=>doc.hasClass(n,'accordion-content-wrapper'))
  const actions=contents.flatMap(content=>doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Apply',content))
  if(!actions.length)continue // Navigation accordions do not advertise vacancies.
  need(titles.length===1&&contents.length===1&&actions.length===1&&actions[0].attrs.href==='/careers/#apply-form','One exact own role/content/application link required')
  const title=doc.text(titles[0]),criteria=elements(contents[0]).filter(n=>doc.hasClass(n,'brxe-text'))
  need(title&&criteria.length===1&&doc.text(criteria[0]),'Own complete published role content unavailable')
  const key=JSON.stringify([title,doc.text(criteria[0]),actions[0].attrs.href])
  need(!seen.has(key),'Duplicate ambiguous native card cannot establish distinct vacancies');seen.add(key)
  const paragraphs=doc.nodes(n=>n.tag==='p',criteria[0]).map(n=>doc.text(n)),field=pattern=>{const values=paragraphs.map(text=>text.match(pattern)?.[1]?.trim()).filter(Boolean);return values.length===1?values[0]:null}
  const location=field(/^Location\s*[:\u2013\u2014-]\s*(.+)$/i),experience=field(/^(?:Experience|Exp band|Years of experience)\s*[:\u2013\u2014-]\s*(.+)$/i)
  rows.push({source:SOURCE,title,company:COMPANY,sourceListingPosition:rows.length+1,jobId:null,requisitionId:null,sourceUrl:CAREER_PAGE_URL,applyUrl:APPLY,
   location,city:null,country:null,remoteStatus:null,experienceRequired:experience,noticePeriod:field(/^Notice Period\s*[:\u2013\u2014-]\s*(.+)$/i),
   jobDescription:doc.text(criteria[0]),requiredSkills:doc.nodes(n=>n.tag==='li',criteria[0]).map(n=>doc.text(n)),nativeParagraphs:paragraphs,
   nativeContent:structuredClone(criteria[0]),wholeNativeCard:structuredClone(container),nativeApplicationDeclaration:structuredClone(actions[0]),
   nativeRoleIdPublished:false,nativeCriteriaModelRetained:true,sourceCountryScopeUnresolved:true,sourceDetailComplete:false,fullOwnRoleCriteriaQualified:false,publicApplicationEligibilityQualified:false,
   browserActivationQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
 }
 const applyAnchors=doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/#apply-form'),targets=doc.nodes(n=>n.attrs.id==='apply-form')
 need(rows.length>0&&applyAnchors.length===rows.length&&targets.length===1,'Whole advertised native accordion/apply cohort or intake target changed; inventory remains unknown')
 const forms=doc.nodes(n=>n.tag==='form',targets[0])
 need(forms.length===1&&forms[0].attrs.method==='post','One own native intake form required')
 // Retain every native field, including hidden/honeypot controls; none is
 // promoted to visible applicant eligibility without the native client proof.
 const applicationForm=structuredClone(forms[0]),nativeApplicationFields=wholeNodes(forms[0],n=>['input','select','textarea'].includes(n.tag)).map(n=>structuredClone(n))
 const programDeclarations=doc.nodes(n=>n.tag==='script').map(n=>({attributes:structuredClone(n.attrs),body:n.raw??'',bodySHA256:sha(n.raw??'')})),stylesheetDeclarations=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>structuredClone(n.attrs))
 return {employerAuthority:{title:head.titles[0],canonical:canonicals[0].attrs.href},rows,applicationForm,nativeApplicationFields,programDeclarations,stylesheetDeclarations,
  nativeApplicationFieldModelRetained:true,applicantFieldVisibilityAndValidationUnverified:true,roleSpecificApplicationBindingQualified:false,
  browserActivationQualified:false,publicApplicationEligibilityQualified:false,wholeCompanyInventoryQualified:false}
}
export async function runCurrentAcsia(options={}){
 options.signal?.throwIfAborted()
 if(options.maxJobs!==undefined)need(Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; native observations cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[CAREER_PAGE_URL,'html']]});let opening,closing,openingHTML,closingHTML
 try{
  openingHTML=(await reader.read(CAREER_PAGE_URL)).body;opening=readCurrentAcsiaModel(openingHTML)
  closingHTML=(await reader.read(CAREER_PAGE_URL)).body;closing=readCurrentAcsiaModel(closingHTML)
  need(isDeepStrictEqual(opening,closing),'Closing whole native cards/criteria/intake/program declarations changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,wholeOriginalOpeningHTML:openingHTML,wholeOriginalClosingHTML:closingHTML,
   observations:opening.rows.map(row=>({...row,holdReasons:['explicit-native-work-country-unqualified','browser-activation-and-public-full-criteria-unqualified','shared-general-intake-role-binding-and-application-eligibility-unqualified']})),
   wholeObservedNativeCareerModelClosingReconciled:true,entireDocumentClosingReconciled:false,nativeRoleCohortFrozen:false,nativeApplicationFieldModelRetained:true,
   publicApplicationEligibilityQualified:false,browserActivationQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,
   originalResponses:reader.stats().receipts,legacyCityCountryInferenceUsed:false,legacyOnsiteDefaultUsed:false,applicationSubmissions:0}
  need(Buffer.byteLength(JSON.stringify(audit))<=8*1024*1024,'Native observation output byte ceiling exceeded')
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:audit})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-native-accordion-cards-full-criteria-intake-and-program-declarations-reconciled;country-browser-activation-application-and-company-scope-unqualified'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{configurable:true,value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null}})}catch{}throw error}
 finally{reader.close()}
}
