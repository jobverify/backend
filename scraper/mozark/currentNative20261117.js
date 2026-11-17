import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const HOMEPAGE_URL='https://www.mozark.ai/'
export const PROGRAM_URL=HOMEPAGE_URL+'site/assets/index-COF7qz_J.js'
export const ABOUT_URL=HOMEPAGE_URL+'about'
const SOURCE='mozark',PROGRAM_SHA='838544485d7664c0761470a9da098e12a5d14197d24e4eb5b6184640ce440984',need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const one=(nodes,name)=>{need(nodes.length===1,'Expected one current native '+name);return nodes[0]}
export function readCurrentMozarkShell(html){
 const doc=readNativeDocument(html),head=activeHead(html)
 need(isDeepStrictEqual(head.titles,['Mozark | Same world. Different experiences.'])&&head.metas.some(m=>m.name==='description'&&m.content==='Mozark assures digital experience across users, applications and networks, tested on real devices, in real locations, on real networks.')&&!doc.nodes(n=>n.tag==='base').length,'Current Mozark own branded shell identity/base changed')
 const module=one(doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module'),'root native client declaration')
 need(module.attrs.src==='/site/assets/index-COF7qz_J.js'&&doc.nodes(n=>n.attrs.id==='root').length===1,'Current own root client mounting/declaration changed')
 return {title:head.titles[0],moduleDeclaration:structuredClone(module),wholeNativeDocument:structuredClone(one(doc.nodes(n=>n.tag==='html'),'root document')),wholeOriginalHTML:html,browserActivationQualified:false,nativeInventoryQualified:false}
}
export function readCurrentMozarkAbout(html){
 const doc=readNativeDocument(html),head=activeHead(html)
 need(isDeepStrictEqual(head.titles,['Mozark.ai'])&&!doc.nodes(n=>n.tag==='base').length&&doc.nodes(n=>n.tag==='img'&&n.attrs.alt==='Mozark').length>0,'Current own Mozark About identity/base changed')
 need(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Assuring your digital experience.').length===1&&doc.nodes(n=>n.tag==='a'&&n.attrs.href==='https://mozark.ai/about'&&doc.text(n)==='About Mozark').length===1,'Current complete own About declaration/content changed')
 return {title:head.titles[0],wholeNativeBody:structuredClone(one(doc.nodes(n=>n.tag==='body'),'About body')),wholeOriginalHTML:html,
  nativeProgrammeDeclaredAboutURL:'https://mozark.ai/about',admittedOwnAboutURL:ABOUT_URL,admissionProvenance:'Exact original HTTP308 Location https://mozark.ai/about to https://www.mozark.ai/about observed during source review',redirectReconciledInCurrentRun:false,
  corporateOfficesAreRoleCountries:false,genericContactOrDemoIsVacancy:false,nativeInventoryQualified:false}
}
export async function runCurrentMozark(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output bound; unknown inventory cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[PROGRAM_URL,'javascript'],[ABOUT_URL,'html']]});let opening,closing
 async function authority(){
  const home=await reader.read(HOMEPAGE_URL),shell=readCurrentMozarkShell(home.body),program=await reader.read(PROGRAM_URL)
  need(program.sha256===PROGRAM_SHA&&program.body.includes('Ls=`https://mozark.ai/about`')&&program.body.includes('href:Ls,className:Gc,children:`About Mozark`'),'Whole reviewed native root programme/About binding changed; native inventory unqualified')
  const about=await reader.read(ABOUT_URL)
  return {shell,program:{url:PROGRAM_URL,body:program.body,sha256:program.sha256,roleCohortFrozen:false},about:readCurrentMozarkAbout(about.body),wholeOriginalHomeHTML:home.body}
 }
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(opening,closing),'Closing whole own root/client/About native models changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:[],wholeObservedCorporateAndClientModelClosingReconciled:true,entireNativeInventoryReconciled:false,nativeInventoryQualified:false,
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,activeApplyVerified:false,applicationInteractions:0,programmesExecuted:false,legacyGuessedCareerRouteRequests:0,
   sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds:['current-own-client-and-About-content-not-a-qualified-vacancy-inventory','native-role-identity-country-full-criteria-application-and-company-scope-unqualified','About-redirect-observed-in-review-not-reconciled-in-current-run','source-programme-review-does-not-prove-global-or-India-zero']}
  need(Buffer.byteLength(JSON.stringify(audit))<=8*1024*1024,'Native observation output byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOMEPAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-root-entire-native-client-and-About-models-reconciled;public-vacancy-model-and-company-inventory-unknown'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}
 finally{reader.close()}
}
