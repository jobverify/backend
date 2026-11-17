import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const HOMEPAGE_URL='https://archiesonline.com/'
export const ABOUT_URL=HOMEPAGE_URL+'pages/about'
const SOURCE='archies',need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},sha=value=>createHash('sha256').update(value).digest('hex')
const one=(nodes,name)=>{need(nodes.length===1,'Expected one own '+name);return nodes[0]}
const programs=doc=>doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??'',sha256:sha(n.raw??'')}))
function structuredJobPostings(models){
 const pending=[...models],found=[]
 while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue
  if(Array.isArray(value)){pending.push(...value);continue}
  const types=Array.isArray(value['@type'])?value['@type']:[value['@type']]
  if(types.some(type=>typeof type==='string'&&/^(?:https?:\/\/schema\.org\/)?JobPosting$/.test(type)))found.push(value)
  pending.push(...Object.values(value).filter(child=>child&&typeof child==='object'))
 }
 return found
}
export function readCurrentArchiesCorporate(html,url){
 const doc=readNativeDocument(html),head=activeHead(html),title=one(head.titles,'corporate document title'),structuredData=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value)
 need(title.endsWith('Archies Online')&&(url===HOMEPAGE_URL?title.startsWith('Buy Gifts, Greeting Cards, Cakes & Flowers Online | Archies'):title.startsWith('About Us')),'Current own branded corporate title changed')
 need(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'corporate canonical').attrs.href===url&&!doc.nodes(n=>n.tag==='base').length,'Current corporate canonical/base changed')
 const organization=structuredData.filter(v=>v?.['@type']==='Organization')
 need(organization.length===1&&organization[0].name==='Archies Online'&&organization[0].url==='https://archiesonline.com','Current structured employer identity changed')
 const pageLinks=doc.nodes(n=>n.tag==='a'&&/^\/pages\//.test(n.attrs.href??'')).map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)})),contacts=doc.nodes(n=>n.tag==='a'&&/^(?:mailto:helpdesk@archiesonline\.com|tel:)/.test(n.attrs.href??'')).map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}))
 const about=pageLinks.filter(n=>n.attrs.href==='/pages/about'&&n.text==='About Us');need(about.length===1,'Current active own About declaration changed')
 const main=url===ABOUT_URL?one(doc.nodes(n=>n.tag==='main'&&n.attrs.id==='MainContent'),'whole corporate About content'):null
 if(main)need(doc.text(main).includes('At Archies Online, we believe that gifting')&&doc.text(main).includes('Archies Limited'),'Current own complete About brand model changed')
 const recruitmentDeclarations=doc.nodes(n=>n.tag==='a').filter(n=>{try{return /\/(?:careers?|jobs?|openings?|join-us|work-with-us)(?:\/|$)/i.test(new URL(n.attrs.href??'',url).pathname)}catch{return false}}).map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}))
 const nativeJobPostingModels=structuredJobPostings(structuredData)
 need(nativeJobPostingModels.length===0,'New structured JobPosting model requires native review before vacancy observations')
 return {url,title,structuredData,pageLinks,contacts,nativeAboutDeclaration:about[0],wholeAboutContent:main?structuredClone(main):null,wholeAboutText:main?doc.text(main):null,
  recruitmentDeclarations,nativeJobPostingModels,programDeclarations:programs(doc),wholeOriginalHTML:html,
  nativeInventoryQualified:false,corporateCountryIsRoleCountry:false,storefrontATSStudioIsRecruitingATS:false}
}
export async function runCurrentArchies(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output bound; unknown inventory cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[ABOUT_URL,'html']]});let opening,closing
 async function authority(){const home=await reader.read(HOMEPAGE_URL),homeModel=readCurrentArchiesCorporate(home.body,HOMEPAGE_URL),about=await reader.read(ABOUT_URL),aboutModel=readCurrentArchiesCorporate(about.body,ABOUT_URL);return {home:homeModel,about:aboutModel,wholeOriginalHomeHTML:home.body,wholeOriginalAboutHTML:about.body}}
 const observed=model=>Object.fromEntries(['home','about'].map(key=>{const {url,title,structuredData,pageLinks,contacts,nativeAboutDeclaration,wholeAboutContent,wholeAboutText,recruitmentDeclarations,nativeJobPostingModels}=model[key];return [key,{url,title,structuredData,pageLinks,contacts,nativeAboutDeclaration,wholeAboutContent,wholeAboutText,recruitmentDeclarations,nativeJobPostingModels}]}))
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(observed(opening),observed(closing)),'Closing whole observed corporate About/navigation models changed');reader.check()
  const declarations=[...new Map([...opening.home.recruitmentDeclarations,...opening.about.recruitmentDeclarations].map(native=>[new URL(native.attrs.href,HOMEPAGE_URL).href,native])).values()],jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:declarations.length,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:declarations.map(native=>({nativeDeclaration:native,qualification:'unreviewed-hiring-link-only',country:null,roleId:null,criteria:null,applyUrl:null})),
   wholeObservedCorporateModelClosingReconciled:true,entireDocumentClosingReconciled:false,nativeVacancyCohortReconciled:false,nativeInventoryQualified:false,
   companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,sourceScopeComplete:false,activeApplyVerified:false,applicationInteractions:0,programmesExecuted:false,storefrontATSStudioIsRecruitingATS:false,
   sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,legacyGuessedCareerRouteRequests:0,
   holds:['observed-corporate-storefront-and-About-content-not-a-vacancy-inventory','public-job-identity-country-full-criteria-and-application-unqualified','unexecuted-storefront-programmes-and-crawl-scope-cannot-prove-empty-company-inventory']}
  need(Buffer.byteLength(JSON.stringify(audit))<=12*1024*1024,'Native observation output byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOMEPAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-storefront-and-declared-About-models-reconciled;no-qualified-vacancy-model-native-and-company-inventory-unknown'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}
 finally{reader.close()}
}
