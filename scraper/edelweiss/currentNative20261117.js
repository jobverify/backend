import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const ROOT_URL='https://www.edelweissfin.com/'
export const CAREERS_URL=ROOT_URL+'edelweisscareers/'
const SOURCE='edelweiss',need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]}
const jobType=value=>Array.isArray(value)?value.some(jobType):typeof value==='string'&&/(?:^|[/#:])JobPosting$/i.test(value)
const hasJob=value=>!!value&&typeof value==='object'&&(jobType(value['@type'])||Object.values(value).some(hasJob))
export function readCurrentEdelweiss(html,url){
 const doc=readNativeDocument(html),head=activeHead(html),title=one(head.titles,'document title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href
 need(canonical===url&&!doc.nodes(n=>n.tag==='base').length&&title===(url===ROOT_URL?'EdelweissFin – Top Finance Company In India':'Careers – EdelweissFin'),'Current own Edelweiss title/canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'Current native JobPosting model requires vacancy acquisition review')
 const handoffs=doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/edelweisscareers'&&doc.text(n)==='Careers');need(handoffs.length===1,'Current active own careers declaration changed')
 const article=url===CAREERS_URL?one(doc.nodes(n=>n.tag==='article'&&n.attrs.id==='fl-post-487'),'whole careers article'):null
 let invitation,contact
 if(article){
  need(doc.text(article).includes('A professional environment that nurtures your personal and professional aspirations')&&doc.text(article).includes('LIFE AT EDELWEISS')&&doc.text(article).includes('EDELITES SPEAK'),'Current full own career information changed')
  invitation=one(doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&doc.text(n).startsWith('Want to join the Edelweiss family?'),article),'general CV invitation');contact=one(doc.nodes(n=>n.tag==='a'&&/^mailto:/.test(n.attrs.href??''),invitation),'published recruitment contact')
 }
 return {url,title,canonical,structured,ownCareerDeclaration:structuredClone(handoffs[0]),wholeCareerArticle:article?structuredClone(article):null,careerText:article?doc.text(article):null,
  nativeInvitation:invitation?structuredClone(invitation):null,nativeContact:contact?structuredClone(contact):null,nativeContactObservedHref:contact?.attrs.href??null,
  programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),wholeOriginalHTML:html,
  contactAddressQualified:false,protectedContactDecoded:false,plaintextHistoricalEmailUsed:false,employeeTestimonialsAreVacancies:false,nativeInventoryQualified:false}
}
export async function runCurrentEdelweiss(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; unknown inventory cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[ROOT_URL,'html'],[CAREERS_URL,'html']]});let opening,closing
 async function authority(){const home=await reader.read(ROOT_URL),career=await reader.read(CAREERS_URL);return {home:readCurrentEdelweiss(home.body,ROOT_URL),career:readCurrentEdelweiss(career.body,CAREERS_URL)}}
 const semantic=model=>({home:{title:model.home.title,canonical:model.home.canonical,handoff:model.home.ownCareerDeclaration,structured:model.home.structured},career:{title:model.career.title,canonical:model.career.canonical,text:model.career.careerText,contactHref:model.career.nativeContactObservedHref,structured:model.career.structured}})
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing own career text/employer/hiring declaration changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:[{recordKind:'general-cv-invitation',wholeNativeInvitation:opening.career.nativeInvitation,nativeContact:opening.career.nativeContact,country:null,jobId:null,criteria:null,applyUrl:null}],
   observedCareerTextClosingMatch:true,wholeCareerDOMClosingQualified:false,opaqueContactClosingQualified:false,careersRedirectChainQualified:false,nativeInventoryQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,
   publicApplicationEligibilityQualified:false,activeApplyVerified:false,applicationInteractions:0,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,
   holds:['general-CV-invitation-without-native-vacancy-identity-country-or-full-role-criteria','masked-protected-contact-not-an-application-URL','opaque-contact-and-browser-programme-semantics-unqualified','observed-own-canonical-careers-target-not-a-whole-company-inventory-proof']}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-careers-general-CV-invitation-reconciled;masked-contact-vacancy-country-criteria-and-company-inventory-unqualified'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}
 finally{reader.close()}
}
