import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const SOURCE='petrustechnologiespvtltd',HOME='https://www.petrustechnologies.com/',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url))),MODULE=profile.documents[1].url,holds=['current-product-SPA-and-complete-declared-module-not-employer-hiring-inventory','no-reviewed-native-employment-route-role-country-criteria-or-application-model','runtime-rendering-marketing-route-dependencies-and-company-inventory-scope-unqualified']
export async function runCurrentPetrus(options={}){
 const io=createCurrentReader(options,[[HOME,'html'],[MODULE,'js']],{maxReads:4})
 try{
  const acquire=async()=>{const home=await io.read(HOME),doc=readNativeDocument(home.text);need(home.sha256===profile.documents[0].sha256&&isDeepStrictEqual(activeHead(home.text).titles,['Petrus | Transform Manufacturing with Industrial Intelligence'])&&!doc.nodes(n=>n.tag==='base').length,'current whole product publisher shell changed');const modules=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src).map(n=>new URL(n.attrs.src,HOME).href);need(isDeepStrictEqual(modules,[MODULE]),'current complete declared product module cohort changed');const programme=await io.read(MODULE);need(programme.sha256===profile.documents[1].sha256,'complete reviewed product/native route module changed');return{home:{url:HOME,body:home.text},programme:{url:MODULE,body:programme.text}}}
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'whole raw product publisher/module closing changed');io.check()
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:HOME,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:holds.join('; ')})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,observedEmployerVacancyCount:null,companyGlobalTotal:null,companyIndiaTotal:null,fullNativeClosingEqual:true,originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true});io.check();return jobs
 }finally{io.close()}
}
