import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='netrack',COMPANY='Netrack',HOMEPAGE_URL='https://www.netrackindia.com/en',CONTACT_URL=HOMEPAGE_URL+'/contact',TEAM_URL=HOMEPAGE_URL+'/about-us/about-company/team',ABOUT_URL=HOMEPAGE_URL+'/about-us/about-company'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one own corporate '+label);return nodes[0]}
const titles=new Map([[HOMEPAGE_URL,'Netrack | Server Enclosures | Network Enclosures | Server Racks'],[CONTACT_URL,'Contact | Netrack | quiet server cabinet Manufacturers'],[TEAM_URL,'Netrack Team | Server enclosures manufacturers'],[ABOUT_URL,'About Us | Netrack | Network cable management']])
const jobType=v=>Array.isArray(v)?v.some(jobType):typeof v==='string'&&/(?:^|[/#:])JobPosting$/i.test(v),hasJob=v=>!!v&&typeof v==='object'&&(jobType(v['@type'])||Object.values(v).some(hasJob))
export function readCurrentNetrackCorporate(html,url){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href
 need(title===titles.get(url)&&canonical===url&&!doc.nodes(n=>n.tag==='base').length,'Current own Netrack corporate title/canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'New current native JobPosting requires vacancy review')
 const corporate=one(doc.nodes(n=>n.tag==='article'),'whole authored corporate article'),corporateText=doc.text(corporate),links=doc.nodes(n=>n.tag==='a').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}))
 const declarations=links.filter(n=>{try{return /\/(?:careers?|jobs?|openings?|join-us|work-with-us)(?:\/|$)/i.test(new URL(n.attrs.href??'',url).pathname)||/\b(?:careers?|job openings?|open positions?|join our team|apply now)\b/i.test(n.text)}catch{return false}})
 need(declarations.length===0,'New authored corporate hiring declaration requires native vacancy acquisition review')
 for(const [href,label] of [[CONTACT_URL,'Contact us'],[TEAM_URL,'Team'],[ABOUT_URL,'About Company']])need(links.some(n=>new URL(n.attrs.href??'',url).href===href&&n.text===label),'Current own corporate navigation declaration changed: '+label)
 if(url===HOMEPAGE_URL){const org=structured.flatMap(v=>v?.['@graph']??[v]).filter(v=>v?.['@type']==='Organization');need(org.length===1&&org[0].name==='Netrack India'&&org[0].url===HOMEPAGE_URL,'Current own native Netrack employer binding changed')}
 if(url===CONTACT_URL)need(corporateText.includes('NETRACK ENCLOSURES PRIVATE LIMITED')&&corporateText.includes('Enquiry'),'Current full corporate employer/contact model changed')
 const forms=doc.nodes(n=>n.tag==='form').map(n=>({wholeDOM:structuredClone(n),text:doc.text(n)}))
 return {url,title,canonical,structured,corporateText,wholeCorporateArticle:structuredClone(corporate),corporateNavigation:links,forms,programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),wholeOriginalHTML:html,
  corporateContactFormIsApplication:false,corporateIndiaIsRoleCountry:false,nativeInventoryQualified:false}
}
export async function runCurrentNetrack(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output bound; unknown inventory cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[...titles.keys()].map(url=>[url,'html'])});let opening,closing
 async function authority(){const result={};for(const [key,url] of [['home',HOMEPAGE_URL],['contact',CONTACT_URL],['team',TEAM_URL],['about',ABOUT_URL]])result[key]=readCurrentNetrackCorporate((await reader.read(url)).body,url);return result}
 const semantic=m=>Object.fromEntries(Object.entries(m).map(([key,v])=>[key,{url:v.url,title:v.title,canonical:v.canonical,structured:v.structured,corporateText:v.corporateText,wholeCorporateArticle:v.wholeCorporateArticle,corporateNavigation:v.corporateNavigation}]))
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing full observed corporate article/navigation/employer model changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:[],observedCorporateContentClosingReconciled:true,entireDOMClosingReconciled:false,nativeInventoryQualified:false,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,
   corporateIndiaIsRoleCountry:false,corporateContactFormIsApplication:false,publicApplicationEligibilityQualified:false,applicationInteractions:0,programmesExecuted:false,legacyGuessedMissingRouteRequests:0,
   sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds:['current-own-contact-navigation-replaces-obsolete-contact-0','observed-corporate-articles-team-and-business-enquiry-are-not-vacancy-or-application-authority','unexecuted-programmes-and-unknown-native-company-inventory-cannot-prove-empty-company-or-India-inventory']}
  need(Buffer.byteLength(JSON.stringify(audit))<=12*1024*1024,'Native evidence output byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOMEPAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-declared-corporate-models-reconciled;no-qualified-native-vacancy-and-company-inventory-unknown'});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}options.signal?.throwIfAborted();throw error}
 finally{reader.close()}
}
