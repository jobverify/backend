import {isDeepStrictEqual} from 'node:util'
import {createSaalCrawlReader} from './currentTransport20261117.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='saalai',COMPANY_NAME='Saal AI',HOMEPAGE_URL='https://www.saal.ai/en/',COMPANY_URL=HOMEPAGE_URL+'company/',ROBOTS_URL='https://www.saal.ai/robots.txt',SITEMAP_URL='https://www.saal.ai/sitemap.xml'
const HANDOFF='https://www.linkedin.com/company/saal-ai/jobs/',need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]}
const jobType=v=>Array.isArray(v)?v.some(jobType):typeof v==='string'&&/(?:^|[/#:])JobPosting$/i.test(v),hasJob=v=>!!v&&typeof v==='object'&&(jobType(v['@type'])||Object.values(v).some(hasJob))
export function readCurrentSaalPage(html,url){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'document title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href
 need(title===(url===HOMEPAGE_URL?'Saal.ai | Enterprise AI, Data Intelligence and Sovereign AI':'About Saal.ai: Sovereign AI Company, Part of ADCG')&&canonical===url&&!doc.nodes(n=>n.tag==='base').length,'Current own Saal publisher title/canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'Current authoritative JobPosting requires native vacancy review')
 const declarations=doc.nodes(n=>n.tag==='a'&&/(?:careers?|jobs?|darwinbox|ashbyhq)/i.test(n.attrs.href??'')).map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}))
 let career
 if(url===COMPANY_URL){
  need(declarations.length===1&&declarations[0].attrs.href===HANDOFF&&declarations[0].text==='Explore our open positions','Current native employer hiring handoff changed')
  career=one(doc.nodes(n=>n.tag==='section'&&doc.nodes(h=>h.tag==='h2'&&doc.text(h)==='Build the future of AI with Saal.ai',n).length===1),'whole authored career section')
  need(doc.text(career).includes('Working at Saal.ai means being part of a diverse team'),'Current authored Saal hiring identity changed')
 }else need(declarations.length===0,'Current home now declares an unreviewed hiring path')
 return {url,title,canonical,structured,structuredEmployerIdentityQualified:false,nativeHandoffs:declarations,wholeCareerDOM:career?structuredClone(career):null,careerText:career?doc.text(career):null,
  wholeAuthoredSections:doc.nodes(n=>n.tag==='section').map(n=>structuredClone(n)),programDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),wholeOriginalHTML:html,
  browserVisibilityQualified:false,corporateUAEIsRoleCountry:false,nativeInventoryQualified:false}
}
export function readCurrentSaalSitemap(xml){
 need(!/<!DOCTYPE|<!ENTITY/i.test(xml),'Unreviewed native XML declaration');const doc=readNativeDocument(xml),root=one(doc.nodes(n=>n.tag==='urlset'),'sitemap root')
 need(root.attrs.xmlns==='http://www.sitemaps.org/schemas/sitemap/0.9','Current own sitemap namespace changed')
 const locations=doc.nodes(n=>n.tag==='loc',root).map(n=>doc.text(n));need(locations.length>0&&locations.length<=1000&&new Set(locations).size===locations.length&&locations.every(value=>{try{const u=new URL(value);return u.href===value&&u.origin==='https://www.saal.ai'&&!u.search&&!u.hash&&!u.username&&!u.password}catch{return false}}),'Current whole native sitemap URL model changed')
 need(locations.includes(HOMEPAGE_URL)&&locations.includes(COMPANY_URL),'Current sitemap Company declaration changed')
 need(!locations.some(u=>/\/(?:careers?|jobs?|openings?|join-us|work-with-us)(?:\/|$)/i.test(new URL(u).pathname)),'New sitemap hiring route requires native vacancy acquisition review')
 return {url:SITEMAP_URL,wholeOriginalXML:xml,wholeNativeSitemap:structuredClone(root),locations,companyInventoryQualified:false}
}
export async function runCurrentSaal(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output bound; unknown inventory cannot be truncated')
 const reader=createSaalCrawlReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[ROBOTS_URL,'text'],[SITEMAP_URL,'xml']],learnedURL:(url,kind)=>url===COMPANY_URL&&kind==='html'});let opening,closing
 async function authority(){
  const home=readCurrentSaalPage((await reader.read(HOMEPAGE_URL)).body,HOMEPAGE_URL),robots=(await reader.read(ROBOTS_URL)).body,sitemaps=[...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gmi)].map(m=>m[1]);need(sitemaps.length===1&&sitemaps[0]===SITEMAP_URL,'Current own robots sitemap declaration changed')
  const sitemap=readCurrentSaalSitemap((await reader.read(SITEMAP_URL)).body);reader.allow(COMPANY_URL,'html');const company=readCurrentSaalPage((await reader.read(COMPANY_URL)).body,COMPANY_URL)
  return {home,robots:{url:ROBOTS_URL,wholeOriginalText:robots,sitemaps},sitemap,company}
 }
 const semantic=m=>({home:{title:m.home.title,canonical:m.home.canonical,structured:m.home.structured,wholeAuthoredSections:m.home.wholeAuthoredSections,nativeHandoffs:m.home.nativeHandoffs},robots:m.robots,sitemap:m.sitemap,company:{title:m.company.title,canonical:m.company.canonical,structured:m.company.structured,wholeCareerDOM:m.company.wholeCareerDOM,nativeHandoffs:m.company.nativeHandoffs}})
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing whole authored hiring/crawl/publisher model changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:[{recordKind:'publisher-authored-hiring-handoff',nativeHandoff:opening.company.nativeHandoffs[0],wholeNativeCareerDOM:opening.company.wholeCareerDOM,country:null,roleId:null,criteria:null,applyUrl:null}],
   observedCareerAndCrawlClosingReconciled:true,entireDOMClosingReconciled:false,externalHandoffRequests:0,nativeBoardAcquisitionQualified:false,nativeInventoryQualified:false,publicApplicationEligibilityQualified:false,activeApplyVerified:false,
   lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,corporateUAEIsRoleCountry:false,staleDarwinboxRequests:0,applicationInteractions:0,programmesExecuted:false,
   sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds:['own-current-Company-career-section-publishes-an-unread-LinkedIn-company-jobs-handoff','legacy-Darwinbox-contract-not-revalidated-by-this-observed-native-chain','generic-hiring-invitation-publishes-no-individual-role-ID-work-country-full-role-criteria-or-application','corporate-UAE-and-ADCG-relationship-not-job-country-or-vacancy-authority','client-rendering-and-company-native-inventory-unknown']}
  need(Buffer.byteLength(JSON.stringify(audit))<=12*1024*1024,'Native output evidence byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:COMPANY_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-crawl-and-Company-hiring-handoff-retained;external-native-board-unread-and-role-country-criteria-application-and-company-inventory-unqualified'});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}options.signal?.throwIfAborted();throw error}
 finally{reader.close()}
}
