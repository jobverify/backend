import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CORPORATE_CHAIN,BOARD,INDIA,CORPORATE_CLIENTS,NATIVE_CLIENTS,ROLE_BASE,SEARCH,need,json,readCorporate,readBoard,verifyClient,verifyIndiaRoute,searchURL} from './nativeDeclarations.js'
import {readIndiaFacet,readIndiaPage,readRole,reconcileModels,reconcileIndiaEnvelope,mapRole} from './nativeModels.js'
import {cap,transport} from './nativeTransport.js'

const ORIGINALS=Symbol.for('jobverify.verified-recruitment-observations')
export const readStantecOriginalResponses=jobs=>structuredClone(jobs?.[ORIGINALS]?.nativeOriginalResponses||[])
export async function runNativeStantec(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap')
 if(maxPages!==Infinity)throw RangeError('Stantec native finite page cap cannot certify complete channel evidence')
 const io=transport(options),{control}=io;let observed=0,vacancies=0,auditForResult=null
 const finish=jobs=>{
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:io.originals.filter(p=>p.requestedURL.startsWith(SEARCH+'?')).length,reason:maxJobs===0?'caller-zero-cap-no-inventory-proof':'native-india-channel-observations-not-company-inventory'})
  attachSourceObservationEvidence(jobs,{source:'stantec',recordKind:'mixed',observedRecordCount:observed,observedVacancyCount:vacancies,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(auditForResult)Object.defineProperty(jobs,'nativeCollectionEvidence',{value:structuredClone(auditForResult),configurable:true})
  const originals=io.originals.map(p=>Object.freeze({...p,headers:Object.freeze({...p.headers}),requestHeaders:Object.freeze({...p.requestHeaders})}))
  Object.defineProperty(jobs,ORIGINALS,{value:Object.freeze({source:'stantec',nativeOriginalResponses:Object.freeze(originals),sourceScopeComplete:false,lifecycleCleanupAllowed:false})})
  return jobs
 }
 try{
  control.check();if(maxJobs===0)return finish([])
  const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now
  control.check();const observedAt=new Date(clock).getTime();need(Number.isFinite(observedAt),'invalid observation clock');const at=new Date(observedAt).toISOString()
  const declarations=async()=>{
   let html
   for(const[index,url]of CORPORATE_CHAIN.entries()){
    io.allow(url);const status=[302,301,302,301,200][index],page=await io.read(url,'html',status)
    if(status!==200)need(typeof page.headers.location==='string'&&new URL(page.headers.location,url).href===CORPORATE_CHAIN[index+1],'corporate redirect changed')
    else html=page.text
   }
   const corporate=readCorporate(html)
   for(const contract of CORPORATE_CLIENTS){io.allow(contract.url);verifyClient((await io.read(contract.url,'javascript')).bytes,contract)}
   io.allow(BOARD);const boardHTML=(await io.read(BOARD)).text,native=readBoard(boardHTML)
   verifyIndiaRoute(boardHTML)
   io.allow(INDIA);const countryView=readBoard((await io.read(INDIA)).text)
   need(JSON.stringify(native)===JSON.stringify(countryView),'board/country configuration differs')
   for(const contract of NATIVE_CLIENTS){io.allow(contract.url);verifyClient((await io.read(contract.url,'javascript')).bytes,contract)}
   return{corporate,native,countryView,clientContracts:[...CORPORATE_CLIENTS,...NATIVE_CLIENTS].map(c=>({...c})),programsExecuted:false}
  }
  const openingDeclaration=await declarations(),globalURL=searchURL(1,false);io.allow(globalURL)
  const openingGlobal=json((await io.read(globalURL,'json')).text),total=readIndiaFacet(openingGlobal).value
  const listings=async()=>{
   const rows=[],models=[],ids=new Set()
   for(let page=1;page<=Math.ceil(total/50);page++){
    const url=searchURL(page);io.allow(url);const model=json((await io.read(url,'json')).text)
    for(const row of readIndiaPage(model,page,total)){need(!ids.has(row.guid),'duplicate GUID across India pages');ids.add(row.guid);rows.push(row)}
    models.push(model)
   }
   need(rows.length===total,'incomplete native India listing');return{rows,models}
  }
  const openingListing=await listings()
  const details=async rows=>{
   const result=Array(rows.length);let next=0
   const work=async()=>{
    while(next<rows.length){control.check();const i=next++,row=rows[i],url=ROLE_BASE+row.guid+'.json';io.allow(url)
     try{result[i]=readRole(json((await io.read(url,'json')).text),row,observedAt)}catch(error){throw control.fail(error)}
    }
   }
   const settled=await Promise.allSettled(Array.from({length:Math.min(4,rows.length)},work));control.check();for(const r of settled)if(r.status==='rejected')throw r.reason;return result
  }
  const opening=await details(openingListing.rows),closingDeclaration=await declarations()
  need(JSON.stringify(openingDeclaration)===JSON.stringify(closingDeclaration),'closing complete publisher declaration changed')
  const closingGlobal=json((await io.read(globalURL,'json')).text);need(readIndiaFacet(closingGlobal).value===total,'closing India facet changed')
  const closingListing=await listings(),closingByID=new Map(closingListing.rows.map(row=>[row.guid,row]))
  for(let i=0;i<openingListing.models.length;i++)reconcileIndiaEnvelope(openingListing.models[i],closingListing.models[i])
  for(const row of openingListing.rows){need(closingByID.has(row.guid),'closing role identity changed');reconcileModels(row,closingByID.get(row.guid),'listing')}
  const closing=await details(openingListing.rows.map(row=>closingByID.get(row.guid)))
  for(let i=0;i<opening.length;i++)reconcileModels(opening[i].model,closing[i].model,'role')
  const records=[],held=[]
  for(let i=0;i<opening.length;i++){
   const role=opening[i]
   if(role.eligible)records.push(mapRole(openingListing.rows[i],role,closing[i],closingByID.get(role.model.guid),openingDeclaration,at))
   else held.push({reason:role.heldReason,model:role.model,closingModel:closing[i].model,listing:openingListing.rows[i],closingListing:closingByID.get(role.model.guid),description:role.description,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  }
  need(records.length>0,'no individually qualified vacancies; zero cannot certify an employer')
  observed=opening.length;vacancies=records.length
  const audit={source:'stantec',records,heldRecords:held,originalResponses:io.originals,openingListingModels:openingListing.models,closingListingModels:closingListing.models,openingGlobalModel:openingGlobal,closingGlobalModel:closingGlobal,openingDeclaration,closingDeclaration,nativeIndiaRecords:observed,qualifiedVacancies:vacancies,sourceScopeComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0}
  if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone(audit)))
  if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(records)))
  control.check();auditForResult={source:'stantec',nativeIndiaRecords:observed,qualifiedVacancies:vacancies,heldRecords:held,sourceScopeComplete:false,lifecycleCleanupAllowed:false,records}
  return finish(records.slice(0,maxJobs))
 }catch(error){const reason=control.fail(error);io.attachFailure(reason);throw reason}finally{control.dispose()}
}
