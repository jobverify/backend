import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createLemonadeReader,HOME,CAREER,CLIENT,need} from './nativeTransport20261121.js'
import {nativeHTMLModel,readUIOnlyClient,requireReviewedHTML,qualifyProtectedHomeContact} from './publicationsContract20261121.js'

const profile=JSON.parse(readFileSync(new URL('./reviewedPublications20261121.json',import.meta.url)))
const holds=['configured-public-page-authored-empty-cohort-only','company-global-and-India-membership-unverified','no-rendered-or-application-execution-claim','protected-public-contact-comparison-only-no-current-decoder-byte-claim','lifecycle-cleanup-forbidden']

export async function collectCurrentPublications(provider,options={}){
 options.signal?.throwIfAborted()
 need(provider?.source==='lemonade'&&provider.officialHomepageUrl===HOME&&provider.companyCareerPage===CAREER,'configured own publisher URL binding changed')
 const io=createLemonadeReader(options)
 let jobs,primaryError,failed=false
 try{
  const acquire=async()=>{
   const home=await io.read(HOME),homeModel=nativeHTMLModel(home.text,HOME)
   const contact=qualifyProtectedHomeContact(home.text,homeModel,profile.home)
   const career=await io.read(CAREER),careerModel=nativeHTMLModel(career.text,CAREER)
   requireReviewedHTML(careerModel,profile.career)
   const client=await io.read(CLIENT),clientModel=readUIOnlyClient(client.text)
   io.check()
   const original={home,career,client,homeModel,careerModel,clientModel}
   return{original,comparison:{...original,home:{...home,text:contact.projectedText,sha256:contact.projectedSHA256},homeModel:contact.comparisonModel},contact:contact.evidence}
  }
  const opening=await acquire(),closing=await acquire()
  need(isDeepStrictEqual(opening.comparison,closing.comparison),'whole current public publication/client closing model changed')
  const rawWholeEntitiesEqual=isDeepStrictEqual(opening.original,closing.original)
  io.check()
  jobs=attachInventoryEvidence([],{status:'discovery-only',surface:CAREER,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),lifecycleCleanupAllowed:false,reason:holds.join('; ')})
  attachSourceObservationEvidence(jobs,{source:'lemonade',recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{source:'lemonade',recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,configuredPublicCohortEmpty:true,configuredCohort:'authored-Open-Roles-section-on-own-careers-page',configuredCohortClosingComplete:true,wholeModelClosingEqual:rawWholeEntitiesEqual,rawWholeEntitiesEqual,contactProjectionClosingEqual:true,closingComparisonScope:'entire-original-model-and-raw-documents-except-one-qualified-footer-contact-representation',sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,nativeCountry:null,renderedVerified:false,activeApplyVerified:false,holds,contactRepresentations:{opening:opening.contact,closing:closing.contact},originalModels:{opening:opening.original,closing:closing.original},acquisition:io.stats()}})
  io.check()
 }catch(error){
  primaryError=error;failed=true
 }finally{
  try{const lateFailure=await io.close();if(lateFailure){primaryError=lateFailure;failed=true}}catch(error){primaryError=error;failed=true}
  // close() aborts the source controller; request listeners can synchronously
  // abort the caller. Check the caller again after all disposal and audit work.
 }
 options.signal?.throwIfAborted()
 if(failed){
  if(primaryError&&typeof primaryError==='object'&&Object.isExtensible(primaryError))try{Object.defineProperty(primaryError,'nativeCollectionEvidence',{configurable:true,value:{source:'lemonade',sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,originalDocuments:io.documents(),acquisition:io.stats(),holds:['current-publication-contract-or-acquisition-unqualified']}})}catch{/* Keep the actual primary failure. */}
  options.signal?.throwIfAborted();throw primaryError
 }
 options.signal?.throwIfAborted();return jobs
}
