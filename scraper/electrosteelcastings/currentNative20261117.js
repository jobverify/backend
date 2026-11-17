import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const HOMEPAGE_URL='https://www.electrosteel.com/'
export const CAREERS_URL=HOMEPAGE_URL+'career'
export const ENQUIRY_URL=HOMEPAGE_URL+'career/career-enquiry'
export const PROGRAM_URL=HOMEPAGE_URL+'_next/static/chunks/2l-qvh9n830gk.js'
const SOURCE='electrosteelcastings',PROGRAM_SHA='524eb1e3601b5772b0f7975d2d447fef7897d4525112f11351b048f269f69494'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]}
const children=node=>(node.children??[]).filter(c=>typeof c==='object'),all=(node,predicate)=>[...(predicate(node)?[node]:[]),...children(node).flatMap(n=>all(n,predicate))]
// This is original server-stream content observation, never active/visible JD proof.
const nativeText=node=>typeof node==='string'?decodeNativeEntities(node):['script','style'].includes(node.tag)?'':(node.children??[]).map(nativeText).join(' ').replace(/\s+/g,' ').trim()
const jobType=value=>Array.isArray(value)?value.some(jobType):typeof value==='string'&&/(?:^|[/#:])JobPosting$/i.test(value)
const hasJob=value=>!!value&&typeof value==='object'&&(jobType(value['@type'])||Object.values(value).some(hasJob))
export function readCurrentElectrosteel(html,url){
 const doc=readNativeDocument(html),head=activeHead(html),root=one(doc.nodes(n=>n.tag==='html'),'own document'),title=one(head.titles,'document title')
 need(title===(url===HOMEPAGE_URL?'Home | Electrosteel Castings Limited':'Electrosteel')&&one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href===(url===HOMEPAGE_URL?HOMEPAGE_URL.slice(0,-1):url)&&!doc.nodes(n=>n.tag==='base').length,'Current own Electrosteel title/canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'Current native JobPosting requires vacancy acquisition review')
 need(doc.text(root).includes('Electrosteel Castings Limited'),'Current own employer identity changed')
 const careerButtons=doc.nodes(n=>n.tag==='button'&&doc.text(n)==='CAREER').map(n=>structuredClone(n));need(careerButtons.length>0,'Current native corporate CAREER navigation changed')
 return {url,title,structured,careerButtons,root,programmeDeclarations:all(root,n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),wholeOriginalHTML:html}
}
export function readCurrentElectrosteelCareer(model){
 const heading=one(all(model.root,n=>n.tag==='h3'&&nativeText(n)==='Roles Offered Under Khoj'),'Khoj role-area heading'),parents=new Map()
 const index=node=>{for(const child of children(node)){parents.set(child,node);index(child)}};index(model.root)
 let context=parents.get(heading);while(context&&!all(context,n=>n.tag==='ul').length)context=parents.get(context)
 need(context,'Current bound Khoj role-area container unavailable')
 const list=one(all(context,n=>n.tag==='ul'),'whole Khoj role-area list'),items=children(list).filter(n=>n.tag==='li')
 need(items.length>0&&items.length<=100&&new Set(items.map(nativeText)).size===items.length,'Ambiguous or unavailable native programme role areas')
 const stream=one(all(model.root,n=>Object.hasOwn(n.attrs??{},'hidden')&&/^S:/.test(n.attrs.id??'')&&nativeText(n).includes('Build the Future with Electrosteel Castings Limited')),'original unactivated career stream')
 return {wholeNativeCareerStream:structuredClone(stream),wholeProgrammeRoleAreaContext:structuredClone(context),roleAreas:items.map(item=>({recordKind:'programme-role-area',label:nativeText(item),wholeNativeItem:structuredClone(item),country:null,jobId:null,criteriaQualified:false,streamActivationQualified:false})),streamActivationQualified:false,nativeVacancyCohortQualified:false}
}
export function readCurrentElectrosteelEnquiry(model){
 const section=one(all(model.root,n=>n.tag==='section'&&n.attrs.id==='career-enquiry'),'whole own general enquiry section'),form=one(all(section,n=>n.tag==='form'),'general candidate form')
 need(nativeText(section).includes('Reach Out to Our Talent Team')&&nativeText(section).includes('unsolicited application')&&nativeText(section).includes('Position Applied For'),'Current own general enquiry context changed')
 const declarations=model.programmeDeclarations.filter(p=>p.attrs.src==='/_next/static/chunks/2l-qvh9n830gk.js');need(declarations.length===1,'Current own enquiry programme declaration changed')
 return {wholeNativeEnquirySection:structuredClone(section),wholeNativeForm:structuredClone(form),nativeFields:all(form,n=>['input','select','textarea'].includes(n.tag)).map(n=>structuredClone(n)),nativeDocumentURL:HOMEPAGE_URL+'api/career-enquiry-document',nativeDocumentRead:false,streamActivationQualified:false,publicApplicationEligibilityQualified:false,roleSpecificBindingQualified:false}
}
export async function runCurrentElectrosteel(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; native observations cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[CAREERS_URL,'html'],[ENQUIRY_URL,'html'],[PROGRAM_URL,'javascript']]});let opening,closing
 async function authority(){
  const home=readCurrentElectrosteel((await reader.read(HOMEPAGE_URL)).body,HOMEPAGE_URL),career=readCurrentElectrosteel((await reader.read(CAREERS_URL)).body,CAREERS_URL),enquiry=readCurrentElectrosteel((await reader.read(ENQUIRY_URL)).body,ENQUIRY_URL),programme=await reader.read(PROGRAM_URL)
  need(programme.sha256===PROGRAM_SHA&&programme.body.includes('fetch("/api/career-enquiry-document",{cache:"no-store"})'),'Whole native enquiry client/validation/document contract changed')
  return {home,career,enquiry,programme:{url:PROGRAM_URL,body:programme.body,sha256:programme.sha256},nativeCareer:readCurrentElectrosteelCareer(career),nativeEnquiry:readCurrentElectrosteelEnquiry(enquiry)}
 }
 const semantic=model=>({home:{title:model.home.title,structured:model.home.structured,careerButtons:model.home.careerButtons},nativeCareer:model.nativeCareer,nativeEnquiry:model.nativeEnquiry,programme:model.programme})
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing whole programme-role-area/general-intake/client models changed');reader.check()
  const observations=[...opening.nativeCareer.roleAreas,{recordKind:'general-candidate-enquiry',nativeForm:opening.nativeEnquiry.wholeNativeForm,country:null,jobId:null,criteriaQualified:false,roleSpecificBindingQualified:false}],jobs=[],summary={source:SOURCE,recordKind:'mixed',observedRecordCount:observations.length,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations,wholeObservedNativeProgrammeAndEnquiryClosingMatch:true,wholeCompanyInventoryQualified:false,streamActivationQualified:false,currentClientNavigationRouteBindingQualified:false,legacyRedirectChainQualified:false,
   publicApplicationEligibilityQualified:false,programmeDependencyClosureQualified:false,nativeEmploymentDocumentRead:false,nativeInventoryQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,activeApplyVerified:false,applicationInteractions:0,
   sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds:['campus-programme-role-areas-not-individual-vacancies','original-Next-stream-content-not-active-visible-role-criteria-proof','general-unsolicited-enquiry-has-free-text-position-not-a-native-vacancy-ID','employment-document-and-client-dependency-semantics-unqualified','explicit-native-role-country-and-company-inventory-unknown']}
  need(Buffer.byteLength(JSON.stringify(audit))<=10*1024*1024,'Native programme observation output byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-native-campus-role-areas-and-general-enquiry-models-retained;stream-country-vacancy-criteria-application-and-company-inventory-unqualified'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}
 finally{reader.close()}
}
