import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const SOURCE='pivotrics',HOME='https://www.pivotrics.com/',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url))),holds=['reviewed-current-corporate-sales-publisher-and-inline-programmes-not-employment-inventory','business-enquiry-mailto-form-and-India-office-or-service-market-not-role-country-or-vacancies','external-analytics-rendering-and-company-hiring-scope-unqualified']
export async function runCurrentPivotrics(options={}){
 const io=createCurrentReader(options,[[HOME,'html']],{maxReads:2})
 try{
  const acquire=async()=>{const page=await io.read(HOME),doc=readNativeDocument(page.text);need(page.sha256===profile.documents[0].sha256&&isDeepStrictEqual(activeHead(page.text).titles,['Welcome to Pivotrics | Software Product Engineering'])&&!doc.nodes(n=>n.tag==='base').length&&doc.nodes(n=>n.tag==='a'&&n.attrs.href==='mailto:contact@pivotrics.com').length>0,'complete current corporate publisher/programme profile changed');return{url:HOME,body:page.text}}
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'whole raw corporate publisher/inline-programme closing changed');io.check()
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:HOME,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:holds.join('; ')})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,observedEmployerVacancyCount:null,companyGlobalTotal:null,companyIndiaTotal:null,fullNativeClosingEqual:true,originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true});io.check();return jobs
 }finally{io.close()}
}
