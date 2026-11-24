import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'
import {CANONICAL_CITIES} from '../../scraper-support/utils/cities.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const CAREER_PAGE_URL='https://www.acsiatech.com/careers/'
const SOURCE='acsia',COMPANY='Acsia Technologies',APPLY=CAREER_PAGE_URL+'#apply-form',sha=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const elements=node=>(node.children??[]).filter(child=>typeof child==='object')
const wholeNodes=(node,predicate)=>[...(predicate(node)?[node]:[]),...elements(node).flatMap(child=>wholeNodes(child,predicate))]
// Use only authored role-location fields. Every alternative must itself name
// an allowlisted city; an unscoped Remote/foreign alternative remains a hold.
const roleCity=(location,country)=>{
 if(typeof location!=='string'||country&&country!=='India')return null
 const segments=location.split(/\s+(?:and|or)\s+|[;/|]/i).map(v=>v.trim().replace(/^Technopark,\s*/i,'').replace(/\s*\(Technopark\)$/i,''))
 if(!segments.length||segments.some(v=>!Object.hasOwn(CANONICAL_CITIES,v.toLowerCase())||CANONICAL_CITIES[v.toLowerCase()]==='Remote'))return null
 return getValidIndiaCityForJob({country,location})
}
const hasHiddenCriteria=node=>wholeNodes(node,n=>n.inert||['script','style','template','noscript','iframe','object'].includes(n.tag)||Object.hasOwn(n.attrs??{},'hidden')||Object.hasOwn(n.attrs??{},'inert')||n.attrs?.['aria-hidden']==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\b/i.test(n.attrs?.style??'')).length>0
export function readCurrentAcsiaModel(html){
 const doc=readNativeDocument(html),head=activeHead(html),canonicals=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 need(isDeepStrictEqual(head.titles,['Careers at Acsia I Jobs in Automotive Technology'])&&canonicals.length===1&&canonicals[0].attrs.href===CAREER_PAGE_URL&&!doc.nodes(n=>n.tag==='base').length,'Current own employer careers identity/canonical/base changed')
 const nativeSchemas=[];let authoritativeJobPosting=false
 const inspect=value=>{if(Array.isArray(value)){value.forEach(inspect);return}if(!value||typeof value!=='object')return;if([value['@type']].flat().some(t=>typeof t==='string'&&/(?:^|[\/#])JobPosting$/.test(t)))authoritativeJobPosting=true;Object.values(value).forEach(inspect)}
 for(const script of doc.nodes(n=>n.tag==='script'&&(n.attrs.type??'').split(';')[0].toLowerCase()==='application/ld+json')){let value;try{value=JSON.parse(script.raw)}catch{need(false,'Unreviewed authoritative native schema')};nativeSchemas.push(value);inspect(value)}
 need(!authoritativeJobPosting,'Unreviewed authoritative native JobPosting fields require source review; original dates and criteria cannot be omitted')
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
  const paragraphs=doc.nodes(n=>n.tag==='p',criteria[0]).map(n=>doc.text(n)),fields=pattern=>paragraphs.map(text=>text.match(pattern)?.[1]?.trim()).filter(Boolean),field=pattern=>{const values=fields(pattern);return values.length===1?values[0]:null}
  const nativeLocationLabel=field(/^Location\s*[:\u2013\u2014-]\s*(.+)$/i),location=nativeLocationLabel?.split(/\s+(?:(?:Years of )?Experience|Exp band)\s*[:\u2013\u2014-]/i)[0].trim()??null,experience=field(/^(?:Experience|Exp band|Years of experience)\s*[:\u2013\u2014-]\s*(.+)$/i)
  const nativeCountryLabels=fields(/^(?:(?:Work|Job)\s+)?Country\s*[:\u2013\u2014-]\s*(.+)$/i),nativeCountryLabel=nativeCountryLabels.length===1?nativeCountryLabels[0]:null,country=nativeCountryLabel?nativeCountryName(nativeCountryLabel):null,city=roleCity(location,country),locationQualified=Boolean(city)&&nativeCountryLabels.length<=1&&(!nativeCountryLabel||country==='India'),criteriaComplete=!hasHiddenCriteria(criteria[0]),nativeEmployerLabels=fields(/^(?:Employer|Legal Employer|Hiring Organization|Company)\s*[:\u2013\u2014-]\s*(.+)$/i),nativeEmployerLabel=nativeEmployerLabels.length===1?nativeEmployerLabels[0]:null,employerQualified=nativeEmployerLabels.length<=1&&(!nativeEmployerLabel||nativeEmployerLabel.toLowerCase()===COMPANY.toLowerCase()),nativeDateLabels=paragraphs.filter(text=>/^(?:Posted|Posting Date|Posted On|Date Posted|Closing Date|Application Deadline|Valid Through|Expiry Date)\s*[:\u2013\u2014-]/i.test(text)),roleHolds=[...(nativeCountryLabels.length>1?['ambiguous-native-role-country-labels']:[]),...(nativeEmployerLabels.length>1?['ambiguous-native-role-employer-labels']:[]),...(locationQualified?[]:['native-workplace-mixed-remote-foreign-or-unqualified']),...(criteriaComplete?[]:['native-authored-criteria-hidden-or-unreviewed']),...(employerQualified?[]:['native-role-employer-conflict']),...(nativeDateLabels.length?['unreviewed-native-role-publication-or-closing-date']:[])]
  rows.push({source:SOURCE,title,company:COMPANY,sourceListingPosition:rows.length+1,jobId:null,requisitionId:null,sourceUrl:CAREER_PAGE_URL,applyUrl:APPLY,
   location,city,country,postingDate:null,closingDate:null,sourceNativeDateLabels:nativeDateLabels,sourceNativeLocationLabel:nativeLocationLabel,sourceNativeCountryLabel:nativeCountryLabel,sourceNativeCountryLabels:nativeCountryLabels,sourceNativeEmployerLabels:nativeEmployerLabels,nativeEmployer:nativeEmployerLabels.length>1?null:nativeEmployerLabel??COMPANY,sourceNativeEmployerQualified:employerQualified,remoteStatus:null,experienceRequired:experience,noticePeriod:field(/^Notice Period\s*[:\u2013\u2014-]\s*(.+)$/i),
   jobDescription:doc.text(criteria[0]),requiredSkills:doc.nodes(n=>n.tag==='li',criteria[0]).map(n=>doc.text(n)),nativeParagraphs:paragraphs,
   nativeContent:structuredClone(criteria[0]),wholeNativeCard:structuredClone(container),nativeApplicationDeclaration:structuredClone(actions[0]),
   nativeRoleIdPublished:false,nativeCriteriaModelRetained:true,sourceCountryScopeUnresolved:country===null&&!locationQualified,sourceNativeCountryUnpublished:nativeCountryLabels.length===0,sourcePublicLocationQualified:locationQualified,sourcePublicLocationScopeEvidence:{policy:'publicJobLocationScope.getValidIndiaCityForJob',kind:'matched-native-role-city-label',rawNativeCountry:nativeCountryLabel,rawNativeCountryLabels:nativeCountryLabels,nativeRoleLabel:nativeLocationLabel,parsedNativeLocation:location,canonicalCity:city,derived:true,corporateAddressUsed:false},sourceDetailComplete:criteriaComplete,fullOwnRoleCriteriaQualified:criteriaComplete,sourceRoleQualified:roleHolds.length===0,roleQualificationHolds:roleHolds,roleSpecificApplicationBindingQualified:false,activeApplyVerified:false,publicApplicationEligibilityQualified:false,
   browserActivationQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
 }
 const applyAnchors=doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/#apply-form'),targets=doc.nodes(n=>n.attrs.id==='apply-form')
 need(rows.length>0&&applyAnchors.length===rows.length&&targets.length===1,'Whole advertised native accordion/apply cohort or intake target changed; inventory remains unknown')
 const forms=doc.nodes(n=>n.tag==='form',targets[0])
 need(forms.length===1&&forms[0].attrs.method==='post','One own native intake form required')
 const form=forms[0],target=new URL(form.attrs.action||CAREER_PAGE_URL,CAREER_PAGE_URL);target.hash=''
 need(target.href===CAREER_PAGE_URL&&!Object.hasOwn(form.attrs,'disabled')&&form.attrs['aria-disabled']!=='true'&&!wholeNodes(form,n=>n.tag==='fieldset'&&Object.hasOwn(n.attrs??{},'disabled')).length,'Native shared intake application unavailable or targets another publisher')
 need(wholeNodes(form,n=>(n.tag==='button'&&(!n.attrs.type||n.attrs.type==='submit')||n.tag==='input'&&n.attrs.type==='submit')&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true').length>0,'Native shared intake application submit unavailable')
 // Retain every native field, including hidden/honeypot controls; none is
 // promoted to visible applicant eligibility without the native client proof.
 const applicationForm=structuredClone(forms[0]),nativeApplicationFields=wholeNodes(forms[0],n=>['input','select','textarea'].includes(n.tag)).map(n=>structuredClone(n))
 const programDeclarations=doc.nodes(n=>n.tag==='script').map(n=>({attributes:structuredClone(n.attrs),body:n.raw??'',bodySHA256:sha(n.raw??'')})),stylesheetDeclarations=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>structuredClone(n.attrs))
 return {nativeSchemas,employerAuthority:{title:head.titles[0],canonical:canonicals[0].attrs.href},rows,applicationForm,nativeApplicationFields,programDeclarations,stylesheetDeclarations,
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
  const observations=opening.rows.map(row=>({...row,sourceClosingQualified:true,holdReasons:[...row.roleQualificationHolds,'shared-general-intake-not-job-specific']})),qualified=observations.filter(row=>row.sourceRoleQualified),jobs=options.maxJobs===undefined?qualified:qualified.slice(0,options.maxJobs),summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,wholeOriginalOpeningHTML:openingHTML,wholeOriginalClosingHTML:closingHTML,
   observations,
   wholeObservedNativeCareerModelClosingReconciled:true,entireDocumentClosingReconciled:false,nativeRoleCohortFrozen:false,nativeApplicationFieldModelRetained:true,
   publicApplicationEligibilityQualified:false,browserActivationQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,
   originalResponses:reader.stats().receipts,legacyCityCountryInferenceUsed:false,legacyOnsiteDefaultUsed:false,applicationSubmissions:0}
  need(Buffer.byteLength(JSON.stringify(audit))<=8*1024*1024,'Native observation output byte ceiling exceeded')
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:audit})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-native-accordion-full-authored-criteria-and-role-city-policy-qualified;native-countries-unpublished-mixed-remote-shared-intake-and-whole-company-inventory-held'})
  reader.check();options.signal?.throwIfAborted();return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{configurable:true,value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null}})}catch{}options.signal?.throwIfAborted();throw error}
 finally{reader.close();options.signal?.throwIfAborted()}
}
