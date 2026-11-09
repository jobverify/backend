import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,HOME,ABOUT,readHome,readCareers,readCountryContext,detailURL,verifyClient,need} from './currentDeclarations.js'
import {readRole,reconcile,mapRole} from './currentModels.js'
import {cap,transport} from './currentTransport.js'

const ORIGINALS=Symbol.for('jobverify.verified-recruitment-observations')
export const readFinacusOriginalResponses=jobs=>structuredClone(jobs?.[ORIGINALS]?.nativeOriginalResponses||[])
export async function runNativeFinacus(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap')
 if(maxPages!==Infinity)throw RangeError('Finacus native finite page cap cannot certify complete channel evidence')
 for(const key of ['onAudit','onRecords'])if(options[key]!==undefined&&typeof options[key]!=='function')throw TypeError('Finacus native invalid '+key)
 const io=transport(options),{control}=io;let observed=0,vacancies=0,auditForResult=null
 const finish=jobs=>{
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:io.originals.filter(p=>p.requestedURL===CAREERS).length,reason:maxJobs===0?'caller-zero-cap-no-inventory-proof':'native-role-observations-with-unresolved-work-country-and-unproven-company-inventory'})
  attachSourceObservationEvidence(jobs,{source:'finacussolutions',recordKind:'vacancy-rows',observedRecordCount:observed,observedVacancyCount:vacancies,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(auditForResult)Object.defineProperty(jobs,'nativeCollectionEvidence',{value:structuredClone(auditForResult),configurable:true})
  const originals=io.originals.map(p=>Object.freeze({...p,headers:Object.freeze({...p.headers}),requestHeaders:Object.freeze({...p.requestHeaders})}))
  Object.defineProperty(jobs,ORIGINALS,{value:Object.freeze({source:'finacussolutions',nativeOriginalResponses:Object.freeze(originals),sourceScopeComplete:false,lifecycleCleanupAllowed:false})});return jobs
 }
 try{
  control.check();if(maxJobs===0)return finish([])
  const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now;control.check()
  const observedAt=new Date(clock).getTime();need(Number.isFinite(observedAt),'invalid observation clock');const at=new Date(observedAt).toISOString()
  const declarations=async()=>{
   const home=readHome((await io.read(HOME)).text);io.allow(CAREERS);io.allow(ABOUT)
   const surface=readCareers((await io.read(CAREERS)).text),context=readCountryContext((await io.read(ABOUT)).text)
   for(const client of surface.clients){io.allow(client.url);verifyClient((await io.read(client.url,'javascript')).bytes,client)}
   return{home,surface,context,publisherProgramsExecuted:false}
  }
  const openingDeclaration=await declarations()
  const details=async(declaration)=>{
   const cards=declaration.surface.cards,result=Array(cards.length);let next=0
   const work=async()=>{while(next<cards.length){control.check();const i=next++,card=cards[i],url=detailURL(card.jobId);io.allow(url)
    try{result[i]=readRole((await io.read(url)).text,card,declaration.context)}catch(error){throw control.fail(error)}
   }}
   const settled=await Promise.allSettled(Array.from({length:Math.min(2,cards.length)},work));control.check();for(const r of settled)if(r.status==='rejected')throw r.reason;return result
  }
  const opening=await details(openingDeclaration),closingDeclaration=await declarations();reconcile(openingDeclaration,closingDeclaration,'publisher and card declaration')
  const closing=await details(closingDeclaration)
  for(let i=0;i<opening.length;i++)reconcile(opening[i],closing[i],'native role model')
  const records=[],held=[]
  for(let i=0;i<opening.length;i++){
   const role=opening[i],card=openingDeclaration.surface.cards[i]
   if(role.qualified)records.push(mapRole(card,role,closing[i],openingDeclaration.context,at))
   else held.push({source:'finacussolutions',jobId:card.jobId,title:card.title,reason:role.heldReason,model:role.model,closingModel:closing[i].model,listing:card,closingListing:closingDeclaration.surface.cards[i],country:null,sourceDetailComplete:false,sourceCountryScopeUnresolved:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  }
  need(records.length>0,'no individually qualified native vacancies; zero cannot certify an employer')
  observed=opening.length;vacancies=opening.length
  const audit={source:'finacussolutions',records,heldRecords:held,originalResponses:io.originals,openingDeclaration,closingDeclaration,nativeObservedRecords:observed,qualifiedIndiaRecords:records.length,heldCountryRecords:held.length,sourceScopeComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0,verifiedAt:at}
  if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone(audit)))
  if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(records)))
  control.check();auditForResult={source:'finacussolutions',nativeObservedRecords:observed,qualifiedIndiaRecords:records.length,heldCountryRecords:held.length,heldRecords:held,records,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  return finish(records.slice(0,maxJobs))
 }catch(error){const reason=control.fail(error);io.attachFailure(reason);throw reason}finally{control.dispose()}
}
