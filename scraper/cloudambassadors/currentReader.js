import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {HOME,CAREERS,need,readHome,readCareers,reconcile} from './currentDeclarations.js'
import {readData,roleModels,mapRole} from './currentData.js'
import {transport,cap} from './currentTransport.js'
const ORIGINALS=Symbol.for('jobverify.verified-recruitment-observations')
export const readCloudAmbassadorsOriginalResponses=jobs=>structuredClone(jobs?.[ORIGINALS]?.nativeOriginalResponses||[])
export async function runCurrentCloudAmbassadors(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap');for(const k of ['onAudit','onRecords'])if(options[k]!==undefined&&typeof options[k]!=='function')throw TypeError('Cloud Ambassadors native invalid '+k)
 const io=transport(options),{control}=io;let observed=0,eligible=0,collection
 const finish=jobs=>{
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:io.originals.length>0,listingComplete:false,pagesFetched:io.originals.length,reportedTotal:null,indiaFacetCount:null,reason:maxJobs===0||maxPages===0?'caller-zero-cap-no-inventory-proof':'complete-native-authored-models-with-unqualified-role-identity-country-hiring-and-rendered-criteria'})
  attachSourceObservationEvidence(jobs,{source:'cloudambassadors',recordKind:eligible===observed?'vacancy-rows':eligible?'mixed':'hiring-signals',observedRecordCount:observed,observedVacancyCount:eligible,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(collection)Object.defineProperty(jobs,'nativeCollectionEvidence',{value:structuredClone(collection)})
  Object.defineProperty(jobs,ORIGINALS,{value:Object.freeze({source:'cloudambassadors',nativeOriginalResponses:Object.freeze(io.originals.map(p=>Object.freeze({...p,headers:Object.freeze({...p.headers}),requestHeaders:Object.freeze({...p.requestHeaders})}))),sourceScopeComplete:false,lifecycleCleanupAllowed:false})});return jobs
 }
 try{
  control.check();if(maxJobs===0||maxPages===0)return finish([])
  const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now;control.check();const time=new Date(clock).getTime();need(Number.isFinite(time),'invalid observation clock');const at=new Date(time).toISOString()
  const phase=async()=>{
   const home=readHome((await io.read(HOME)).text);io.allow(CAREERS);const careers=readCareers((await io.read(CAREERS)).text);need(careers.listingPages<=maxPages,'caller page limit prevents full native closure')
   const assets=Array(careers.assets.length);let cursor=0
   const worker=async()=>{while(cursor<assets.length){control.check();const i=cursor++,asset=careers.assets[i];try{io.allow(asset.url);const result=await io.read(asset.url,asset.kind);assets[i]={...asset,text:result.text,bodySHA256:result.sha256,bodyBytes:result.bytes.length}}catch(e){throw control.fail(e)}}}
   const settled=await Promise.allSettled(Array.from({length:Math.min(2,assets.length)},worker));control.check();for(const result of settled)if(result.status==='rejected')throw result.reason
   const data=readData(assets,careers.cards.map(c=>c.title)),declaration={home,careers,assets};return{...declaration,dataModel:data.dataModel,dataCandidates:data.dataCandidates,nativeDataBindingEvidence:data.binding,renderer:data.renderer,models:roleModels(declaration,data)}
  }
  const opening=await phase(),closing=await phase();reconcile(opening,closing,'homepage, listing, every original asset and native role models')
  observed=opening.models.length;const allRecords=opening.models.map((m,i)=>mapRole(m,closing.models[i],at)),records=allRecords.filter((j,i)=>opening.models[i].buttonEnabled);eligible=records.length
  const heldRecords=allRecords.map((j,i)=>({title:j.title,reason:j.sourceDetailFailureKind,country:null,buttonEnabled:opening.models[i].buttonEnabled,nativeRole:j.nativeSourceRecord.nativeRole,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})),audit={source:'cloudambassadors',records,heldRecords,opening,closing,originalResponses:io.originals,nativeObservedRecords:observed,qualifiedIndiaRecords:0,wholeNativeModelsClosingReconciled:true,sourceScopeComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0,verifiedAt:at}
  if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone(audit)));if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(records)))
  control.check();collection={source:audit.source,nativeObservedRecords:observed,qualifiedIndiaRecords:0,heldRecords,wholeNativeModelsClosingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false};return finish(records.slice(0,maxJobs))
 }catch(e){const reason=control.fail(e);io.attachFailure(reason);throw reason}finally{control.dispose()}
}
