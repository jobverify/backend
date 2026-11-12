import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {bindDocument} from './native.js'
import {CAREERS,need,failure,isFailure,readCareers,reconcile} from './currentDeclarations.js'
import {transport,cap} from './currentTransport.js'
const ORIGINALS=Symbol.for('jobverify.verified-recruitment-observations')
export async function runCurrentBtl(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap');for(const k of ['onAudit','onRecords'])if(options[k]!==undefined&&typeof options[k]!=='function')throw TypeError('BTL India native invalid '+k)
 const io=transport(options),{control}=io;let observed=0,eligible=0,collection
 const finish=jobs=>{
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:io.originals.length>0,listingComplete:false,pagesFetched:io.originals.length,reportedTotal:null,indiaFacetCount:null,reason:maxJobs===0||maxPages===0?'caller-zero-cap-no-inventory-proof':'whole-advertised-PDF-models-with-unqualified-country-posting-and-rendered-criteria'})
  attachSourceObservationEvidence(jobs,{source:'btlindia',recordKind:observed===eligible?'vacancy-rows':eligible?'mixed':'hiring-signals',observedRecordCount:observed,observedVacancyCount:eligible,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(collection){Object.defineProperty(jobs,'nativeCollectionEvidence',{value:structuredClone(collection)});if(jobs.length)jobs[0].nativeCollectionEvidence=structuredClone(collection)}
  Object.defineProperty(jobs,ORIGINALS,{value:Object.freeze({source:'btlindia',nativeOriginalResponses:Object.freeze(io.originals.map(p=>Object.freeze({...p,headers:Object.freeze({...p.headers}),requestHeaders:Object.freeze({...p.requestHeaders})}))),sourceScopeComplete:false,lifecycleCleanupAllowed:false})});return jobs
 }
 try{
  control.check();if(maxJobs===0||maxPages===0)return finish([])
  const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now;control.check();const time=new Date(clock).getTime();need(Number.isFinite(time),'invalid observation clock');const at=new Date(time).toISOString()
  const phase=async()=>{
   const careers=readCareers((await io.read(CAREERS)).text);need(careers.listingPages<=maxPages,'caller page limit prevents whole PDF closure');const models=Array(careers.roles.length);let cursor=0
   const worker=async()=>{while(cursor<models.length){control.check();const i=cursor++,role=careers.roles[i];try{
    io.allow(role.url);const original=await io.read(role.url,'pdf'),{decoded,bound}=await io.decode(async(checkPdf)=>{const {readCurrentBtlPdf}=await import('./currentPdf.js');checkPdf();const decoded=await readCurrentBtlPdf(original.bytes,{signal:control.signal}),bound=bindDocument({title:role.title,sourceUrl:role.url,rawNativeRoleEvidence:{}},decoded,original.bytes);return{decoded,bound}})
    models[i]={listing:role,publisherTitle:careers.publisherTitle,nativeContactEmail:careers.nativeContactEmail,nativePDFBinding:bound.rawNativeRoleEvidence,pdfModel:{...decoded,pageCount:decoded.pages},originalPDF:{url:role.url,bodyBytes:original.bytes.length,bodySHA256:original.sha256,bodyBase64:original.bytes.toString('base64')},nativeCountryQualified:false,nativePostingIdentityQualified:false,nativeCriteriaVisibilityQualified:false}
   }catch(e){if(options.signal?.aborted||control.signal.aborted||isFailure(e))throw control.fail(e);const wrapped=failure('native PDF model failed');Object.defineProperty(wrapped,'cause',{value:e});throw control.fail(wrapped)}}}
   const settled=await Promise.allSettled(Array.from({length:Math.min(2,models.length)},worker));control.check();for(const r of settled)if(r.status==='rejected')throw r.reason;return{careers,models}
  }
  const opening=await phase(),closing=await phase();reconcile(opening,closing);observed=opening.models.length
  const allRecords=opening.models.map((model,i)=>{
   const text=model.nativePDFBinding.identityQualified?model.pdfModel.text:null
   return{source:'btlindia',company:'BTL India Pvt. Ltd.',companyName:'BTL India Pvt. Ltd.',title:model.listing.title,jobId:null,requisitionId:null,canonicalRoleURL:null,nativeIdentity:{kind:'declared-PDF-role-observation',declaredURL:model.listing.url,publishedPostingId:null,formalRequisition:null,stablePostingIdentityQualified:false},sourceUrl:model.listing.url,jobUrl:null,applyUrl:null,link:model.listing.url,sharedApplicationEmail:model.nativeContactEmail,jobSpecificApplicationIdentityQualified:false,applicationVisited:false,activeApplyVerified:false,country:null,location:null,city:null,state:null,countryCode:null,nativeGeographyQualified:false,nativeCountryScopeUnresolved:true,sourceCountryScopeUnresolved:true,nativeHiringOrganization:null,legalEmployer:null,employmentType:null,remoteStatus:null,workplaceType:null,postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,jobDescription:text,description:text,sourceDescription:text,sourceDescriptionFormat:'PDF-extracted-text',fullNativeAuthoredRecordAvailable:true,fullNativeAuthoredDocumentAvailable:true,fullExtractedNativeTextAvailable:true,fullNativeAuthoredCriteriaAvailable:false,nativeCriteriaVisibilityQualified:false,nativeCriteriaComplete:false,sourceDetailComplete:false,sourceDetailFailureKind:model.nativePDFBinding.identityQualified?'native-PDF-country-posting-identity-and-rendered-criteria-unqualified':'native-PDF-role-association-unqualified',nativeModelClosingReconciled:true,nativeSourceRecord:structuredClone(model),nativeClosingRecord:structuredClone(closing.models[i]),sourceScopeComplete:false,sourceListingComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,scrapedAt:at,sourceCapturedAt:at}
  }),records=allRecords.filter((j,i)=>opening.models[i].listing.enabled);eligible=records.length
  const heldRecords=allRecords.map((j,i)=>({title:j.title,reason:j.sourceDetailFailureKind,sourceURL:j.sourceUrl,country:null,listingEnabled:opening.models[i].listing.enabled,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})),audit={source:'btlindia',records,heldRecords,opening,closing,originalResponses:io.originals,nativeObservedRecords:observed,qualifiedIndiaRecords:0,wholeNativeModelsClosingReconciled:true,sourceScopeComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0,verifiedAt:at}
  if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone(audit)));if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(records)))
  control.check();collection={source:'btlindia',nativeObservedRecords:observed,heldRecords,qualifiedIndiaRecords:0,wholeNativeModelsClosingReconciled:true,reportedTotal:null,indiaFacetCount:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false};return finish(records.slice(0,maxJobs))
 }catch(e){const reason=control.fail(e);io.attachFailure(reason);throw reason}finally{control.dispose()}
}
