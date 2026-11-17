import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
export const SOURCE='macreq',COMPANY='Macreq Manufacturing Services Private Ltd',HOMEPAGE_URL='https://macreq.com/',CAREERS_URL=HOMEPAGE_URL+'careers/'
export async function runCurrentMacreq(options={}){
 options.signal?.throwIfAborted()
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html']]});let nativeOpening
 try{
  nativeOpening=await reader.read(HOMEPAGE_URL);reader.check()
  throw firstPartyFailure(SOURCE,'Current native root200 is unreviewed; employer, public hiring model and inventory require native qualification')
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null,observedRecordCount:null,observedVacancyCount:null,nativeInventoryQualified:false,legacyGuessedRouteRequests:0,holds:['actual-native-root-unavailable-or-employer-and-hiring-model-unqualified','no-company-or-India-zero-proof']},configurable:true})}catch{}options.signal?.throwIfAborted();throw error}
 finally{reader.close()}
}
