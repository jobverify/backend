import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const HOME='https://www.hanosoftwaresolutions.com/',LANDER=HOME+'lander',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url))),holds=['configured-domain-now-declares-generic-parking-carrier','employer-and-recruitment-identity-unqualified','declared-third-party-parking-programmes-not-employment-authority','country-full-criteria-application-and-company-inventory-unknown']
export async function runCurrentHano(options={}){
 const io=createCurrentReader(options,[[HOME,'html'],[LANDER,'html']],{maxReads:4})
 try{
  const acquire=async()=>{
   const root=await io.read(HOME),doc=readNativeDocument(root.text),scripts=doc.nodes(n=>n.tag==='script')
   need(root.sha256===profile.documents[0].sha256&&scripts.length===1&&scripts[0].raw==='window.onload=function(){window.location.href="/lander"}','current complete literal root redirect carrier changed')
   const lander=await io.read(LANDER);need(lander.sha256===profile.documents[1].sha256,'current complete declared parking carrier changed')
   return {root:{status:root.status,url:HOME,body:root.text},lander:{status:lander.status,url:LANDER,body:lander.text}}
  }
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'whole current parking carrier closing changed');io.check()
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:HOME,firstParty:false,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:holds.join('; ')})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'hanosoftwaresolutions',publisherEmployerIdentityQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,fullNativeClosingEqual:true,originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true});io.check();return jobs
 }finally{io.close()}
}
