import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='turso',COMPANY='Turso',HOMEPAGE_URL='https://turso.tech/',TERMS_OF_USE_URL=HOMEPAGE_URL+'terms-of-use',ABOUT_URL=HOMEPAGE_URL+'about',NEWS_URL=HOMEPAGE_URL+'blog/turso-is-joining-supabase'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]}
const titles=new Map([[HOMEPAGE_URL,'Turso - Millions of Databases. One Architecture.'],[TERMS_OF_USE_URL,'Turso Terms of Use'],[ABOUT_URL,'About Us'],[NEWS_URL,'Turso is joining Supabase to give every agent its own database']])
const jobType=v=>Array.isArray(v)?v.some(jobType):typeof v==='string'&&/(?:^|[/#:])JobPosting$/i.test(v),hasJob=v=>!!v&&typeof v==='object'&&(jobType(v['@type'])||Object.values(v).some(hasJob))
export function readCurrentTursoCorporate(html,url){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'publisher title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href
 need(title===titles.get(url)&&canonical===(url===HOMEPAGE_URL?'https://turso.tech':url)&&!doc.nodes(n=>n.tag==='base').length,'Current own Turso corporate title/canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'New authoritative native JobPosting requires vacancy review')
 const org=structured.filter(v=>v?.['@type']==='Organization');need(org.length===1&&org[0].name==='Turso'&&org[0].legalName==='Turso, Inc'&&org[0].url==='https://turso.tech','Current native structured Turso publisher changed')
 const body=one(doc.nodes(n=>n.tag==='body'),'complete authored body'),corporateText=doc.text(body),links=doc.nodes(n=>n.tag==='a').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}))
 const hiring=links.filter(n=>{try{return /\/(?:careers?|jobs?|openings?|join-us|work-with-us)(?:\/|$)/i.test(new URL(n.attrs.href??'',url).pathname)||/\b(?:job openings?|open positions?|join our team|apply now)\b/i.test(n.text)}catch{return false}})
 need(hiring.length===0,'New current authored hiring declaration requires native vacancy acquisition review')
 need(links.some(n=>n.attrs.href==='/about'&&n.text==='About')&&links.some(n=>n.attrs.href==='/blog/turso-is-joining-supabase'&&n.text.startsWith('Turso is joining Supabase')),'Current own corporate About/news declaration changed')
 if(url===TERMS_OF_USE_URL)need(corporateText.includes('CHISELSTRIKE INC.')&&corporateText.includes('support@turso.tech'),'Current native complete legal publisher model changed')
 if(url===NEWS_URL)need(corporateText.includes('is being acquired by Supabase')&&corporateText.includes('Glauber Costa joins Supabase'),'Current authored acquisition relationship model changed')
 return {url,title,canonical,structured,corporateText,wholeAuthoredBody:structuredClone(body),corporateLinks:links,nativeDateDeclarations:doc.nodes(n=>n.tag==='time').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)})),
  programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),wholeOriginalHTML:html,parentCompanyRelationshipIsVacancyAuthority:false,corporateCountryIsRoleCountry:false,nativeInventoryQualified:false}
}
export async function runCurrentTurso(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output bound; unknown inventory cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[...titles.keys()].map(url=>[url,'html'])});let opening,closing
 async function authority(){const result={};for(const [key,url] of [['home',HOMEPAGE_URL],['terms',TERMS_OF_USE_URL],['about',ABOUT_URL],['news',NEWS_URL]])result[key]=readCurrentTursoCorporate((await reader.read(url)).body,url);return result}
 const semantic=m=>Object.fromEntries(Object.entries(m).map(([key,v])=>[key,{url:v.url,title:v.title,canonical:v.canonical,structured:v.structured,corporateText:v.corporateText,corporateLinks:v.corporateLinks,nativeDateDeclarations:v.nativeDateDeclarations}]))
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing whole observed corporate/acquisition/legal publisher model changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:[],observedCorporateTextClosingReconciled:true,entireDOMClosingReconciled:false,nativeInventoryQualified:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,
   parentCompanyJobsAreTargetJobs:false,corporateCountryIsRoleCountry:false,publicApplicationEligibilityQualified:false,applicationInteractions:0,programmesExecuted:false,legacyAshbyTenantRequests:0,legacyCareerRedirectRequests:0,
   sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds:['current-own-corporate-About-and-acquisition-news-are-not-a-native-vacancy-inventory','neither-legacy-Ashby-tenant-is-authorized-by-an-observed-current-hiring-declaration','parent-acquisition-and-US-corporate-address-cannot-bind-target-jobs-or-job-work-country','unexecuted-programmes-and-company-native-inventory-unknown']}
  need(Buffer.byteLength(JSON.stringify(audit))<=12*1024*1024,'Native output evidence byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOMEPAGE_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-corporate-and-acquisition-models-retained;no-qualified-target-vacancy-country-criteria-application-or-company-inventory'});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}options.signal?.throwIfAborted();throw error}
 finally{reader.close()}
}
