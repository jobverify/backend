import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const HOMEPAGE_URL='https://erelego.com/'
export const CAREERS_URL=HOMEPAGE_URL+'career/'
const SOURCE='erelegotechnologies',need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]}
const jobType=value=>Array.isArray(value)?value.some(jobType):typeof value==='string'&&/(?:^|[/#:])JobPosting$/i.test(value)
const hasJob=value=>!!value&&typeof value==='object'&&(jobType(value['@type'])||Object.values(value).some(hasJob))
export function readCurrentErelego(html,url){
 const doc=readNativeDocument(html),head=activeHead(html),title=one(head.titles,'document title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href
 need(canonical===url&&!doc.nodes(n=>n.tag==='base').length&&(url===HOMEPAGE_URL?title.startsWith('ETPL')&&title.endsWith('Virtual Flair - Redefined for Digital Growth.'):title==='Careers at ETPL | Jobs & Growth Opportunities'),'Current own ETPL title/canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'Current native JobPosting model requires vacancy acquisition review')
 const organizations=structured.flatMap(v=>v?.['@graph']??[v]).filter(v=>v?.['@type']==='Organization');need(organizations.length===1&&organizations[0].name==='ETPL'&&organizations[0].url===HOMEPAGE_URL,'Current native ETPL employer authority changed')
 const careersLinks=doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/career/'&&/Careers/.test(doc.text(n))).map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}));need(careersLinks.length>0,'Current own active career declaration changed')
 const landing=url===CAREERS_URL?one(doc.nodes(n=>n.attrs['data-elementor-type']==='landing-page'&&n.attrs['data-elementor-id']==='4000'),'complete own career landing'):null
 let cv,apply
 if(landing){
  need(doc.nodes(n=>n.tag==='h2'&&doc.text(n)==='Work With Us: Find Your Place in Our Family',landing).length===1&&doc.nodes(n=>n.tag==='h3'&&doc.text(n)==='Jobs',landing).length===1,'Current whole own career context changed')
  cv=one(doc.nodes(n=>n.tag==='p'&&doc.text(n).startsWith('To apply, please send your CV to')&&doc.text(n).endsWith('with the respective Job ID'),landing),'general CV instruction');apply=one(doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Apply Now',landing),'general Apply Now declaration')
  need(!doc.nodes(n=>n.tag==='a'&&/^\/career\/.+/.test(n.attrs.href??'')).length,'Current career now declares unreviewed native role detail links')
 }
 return {url,title,canonical,structured,careersLinks,wholeCareerLanding:landing?structuredClone(landing):null,careerText:landing?doc.text(landing):null,nativeCVInstruction:cv?structuredClone(cv):null,
  nativeApplyDeclaration:apply?structuredClone(apply):null,programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),wholeOriginalHTML:html,
  employeeTestimonialsAreVacancies:false,protectedContactDecoded:false,publicApplicationEligibilityQualified:false,corporateIndiaIsRoleCountry:false,nativeInventoryQualified:false}
}
export async function runCurrentErelego(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; unknown inventory cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[CAREERS_URL,'html']]});let opening,closing
 async function authority(){const home=await reader.read(HOMEPAGE_URL),career=await reader.read(CAREERS_URL);return {home:readCurrentErelego(home.body,HOMEPAGE_URL),career:readCurrentErelego(career.body,CAREERS_URL)}}
 const semantic=model=>({home:{title:model.home.title,canonical:model.home.canonical,careersLinks:model.home.careersLinks,structured:model.home.structured},career:{title:model.career.title,canonical:model.career.canonical,structured:model.career.structured,text:model.career.careerText}})
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing full own career text/employer/declarations changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:[{recordKind:'general-recruitment-invitation',nativeCVInstruction:opening.career.nativeCVInstruction,nativeApplyDeclaration:opening.career.nativeApplyDeclaration,country:null,jobId:null,criteria:null,applyUrl:null}],
   observedCareerTextClosingMatch:true,wholeCareerDOMClosingQualified:false,opaqueContactClosingQualified:false,nativeInventoryQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,
   activeApplyVerified:false,applicationInteractions:0,publicApplicationEligibilityQualified:false,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,
   holds:['named-employees-and-testimonials-not-vacancies','generic-protected-CV-invitation-publishes-no-specific-native-job-ID-country-or-criteria','protected-contact-and-renderer-activation-unqualified','corporate-India-address-not-a-job-work-country','company-native-inventory-unknown']}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-career-testimonial-and-general-CV-models-retained;no-qualified-vacancy-country-criteria-application-or-company-inventory'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}
 finally{reader.close()}
}
