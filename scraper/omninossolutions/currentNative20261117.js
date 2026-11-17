import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const HOME='https://www.omninos.in/',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url))),holds=['configured-domain-serves-generic-unbranded-ComingSoon-carrier','publisher-employer-recruitment-and-company-inventory-authority-unqualified','country-full-criteria-application-and-company-scope-unknown']
export async function runCurrentOmninos(options={}){
 const io=createCurrentReader(options,[[HOME,'html']],{maxReads:2})
 try{
  const acquire=async()=>{const page=await io.read(HOME),doc=readNativeDocument(page.text);need(page.sha256===profile.documents[0].sha256,'current complete ComingSoon publisher profile changed');need(isDeepStrictEqual(activeHead(page.text).titles,['Coming Soon'])&&!doc.nodes(n=>n.tag==='base').length,'current generic publisher identity/base changed');return {url:HOME,body:page.text}}
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'whole current publisher closing changed');io.check()
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:HOME,firstParty:false,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:holds.join('; ')})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'omninossolutions',configuredDomain:'omninos.in',publisherEmployerIdentityQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,fullNativeClosingEqual:true,originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true});return jobs
 }finally{io.close()}
}
