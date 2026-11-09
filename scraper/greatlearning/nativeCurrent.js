import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {HOME,CAREERS,readPublisher,reconcilePublisher,readIndex,CSS_CONTRACT,verifyCSS,need} from './currentDeclarations.js'
import {readRole,reconcile,mapRole} from './currentModels.js'
import {cap,transport} from './currentTransport.js'
const ORIGINALS=Symbol.for('jobverify.verified-recruitment-observations')
export const readGreatLearningOriginalResponses=jobs=>structuredClone(jobs?.[ORIGINALS]?.nativeOriginalResponses||[])
export async function runNativeGreatLearning(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap');if(maxPages!==Infinity)throw RangeError('Great Learning native finite page cap cannot certify channel closure')
 for(const key of ['onAudit','onRecords'])if(options[key]!==undefined&&typeof options[key]!=='function')throw TypeError('Great Learning native invalid '+key)
 const io=transport(options),{control}=io;let observed=0,resultAudit
 const finish=jobs=>{
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:io.originals.length>0,listingComplete:false,pagesFetched:io.originals.length,reportedTotal:null,indiaFacetCount:null,reason:maxJobs===0?'caller-zero-cap-no-inventory-proof':'observed-current-native-role-channel-not-company-inventory'})
  attachSourceObservationEvidence(jobs,{source:'greatlearning',recordKind:'vacancy-rows',observedRecordCount:observed,observedVacancyCount:observed,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(resultAudit)Object.defineProperty(jobs,'nativeCollectionEvidence',{value:structuredClone(resultAudit),configurable:true})
  const originals=io.originals.map(p=>Object.freeze({...p,headers:Object.freeze({...p.headers}),requestHeaders:Object.freeze({...p.requestHeaders})}));Object.defineProperty(jobs,ORIGINALS,{value:Object.freeze({source:'greatlearning',nativeOriginalResponses:Object.freeze(originals),sourceScopeComplete:false,lifecycleCleanupAllowed:false})});return jobs
 }
 try{
  control.check();if(maxJobs===0)return finish([])
  const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now;control.check();const time=new Date(clock).getTime();need(Number.isFinite(time),'invalid observation clock');const at=new Date(time).toISOString()
  const declarations=async()=>{
   const home=readPublisher((await io.read(HOME)).text,HOME);io.allow(CAREERS);const text=(await io.read(CAREERS)).text,publisher=readPublisher(text,CAREERS);reconcilePublisher(home,publisher);const index=readIndex(text)
   io.allow(CSS_CONTRACT.url);verifyCSS((await io.read(CSS_CONTRACT.url,'css')).bytes);return{home,publisher,index,publisherProgramsExecuted:false}
  }
  const openingDeclaration=await declarations()
  const details=async declaration=>{
   const cards=declaration.index.cards,roles=Array(cards.length);let next=0
   const work=async()=>{while(next<cards.length){control.check();const i=next++,card=cards[i];io.allow(card.url);try{roles[i]=readRole((await io.read(card.url)).text,card,declaration.publisher,at)}catch(error){throw control.fail(error)}}}
   const settled=await Promise.allSettled(Array.from({length:Math.min(2,cards.length)},work));control.check();for(const r of settled)if(r.status==='rejected')throw r.reason;return roles
  }
  const opening=await details(openingDeclaration),closingDeclaration=await declarations();reconcile(openingDeclaration,closingDeclaration,'publisher, renderer and listing models');const closing=await details(closingDeclaration)
  for(let i=0;i<opening.length;i++)reconcile(opening[i],closing[i],'role models')
  const records=[],held=[]
  for(let i=0;i<opening.length;i++){const role=opening[i],card=openingDeclaration.index.cards[i];if(role.eligible)records.push(mapRole(card,role,closing[i],openingDeclaration.publisher,at));else held.push({source:'greatlearning',title:card.title,url:card.url,reason:role.heldReason,listing:card,model:role.model,closingModel:closing[i].model,country:role.geo.country,workCountryProof:role.geo.proof,publicationProof:role.dates,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
  observed=opening.length;const audit={source:'greatlearning',records,heldRecords:held,openingDeclaration,closingDeclaration,originalResponses:io.originals,nativeObservedRecords:observed,qualifiedIndiaRecords:records.length,sourceScopeComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0,verifiedAt:at}
  if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone(audit)));if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(records)))
  control.check();resultAudit={source:'greatlearning',records,heldRecords:held,nativeObservedRecords:observed,qualifiedIndiaRecords:records.length,sourceScopeComplete:false,lifecycleCleanupAllowed:false};return finish(records.slice(0,maxJobs))
 }catch(error){const reason=control.fail(error);io.attachFailure(reason);throw reason}finally{control.dispose()}
}
