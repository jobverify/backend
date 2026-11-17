import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const HOME='https://d2c.in/',PUBLISHER='https://ai.miravlabs.com/',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url)))
const holds=['no-current-publisher-declared-recruitment-inventory','Mirav-marketing-redirect-not-per-role-D2C-legal-employer-proof','country-full-criteria-application-and-company-wide-scope-unknown']
export async function runCurrentD2c(options={}){
 const io=createCurrentReader(options,[[HOME,'html'],[PUBLISHER,'html']],{maxReads:4,redirects:{[HOME]:PUBLISHER}})
 try{
  const acquire=async()=>{
   const redirect=await io.read(HOME);need(redirect.status===301&&redirect.location===PUBLISHER,'exact current301 publisher handoff changed');need(redirect.sha256===profile.redirects[0].sha256,'exact root redirect entity profile changed')
   const page=await io.read(PUBLISHER),doc=readNativeDocument(page.text)
   need(page.sha256===profile.documents[0].sha256,'reviewed current marketing publisher profile changed')
   need(isDeepStrictEqual(activeHead(page.text).titles,['Mirav Labs — Production AI for Modern Enterprise'])&&!doc.nodes(n=>n.tag==='base').length,'current Mirav publisher identity/base changed')
   need(!doc.nodes(n=>n.tag==='a'&&/career|recruit|vacanc|\/jobs?(?:[/?#]|$)/i.test(n.attrs.href??'')).length,'new declared recruitment handoff requires review')
   return {redirect:{status:redirect.status,location:redirect.location,body:redirect.text},publisher:page.text}
  }
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'whole original publisher/redirect closing changed')
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:PUBLISHER,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:holds.join('; ')})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'d2c',publisherBrand:'Mirav Labs',sourceTargetCompany:'D2C',sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,employerWideScopeQualified:false,fullPublisherClosingEqual:true,originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true})
  return jobs
 }finally{io.close()}
}
