import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,PORTAL,BOARD,CLIENT,need,json,corporate,board,client,canonical,searchURL,detailURL,roleURL} from './nativeDeclarations.js'
import {readSearch,indiaCandidate,readRole,reconcile,mapRole} from './nativeModels.js'
import {cap,transport} from './nativeTransport.js'

const ORIGINALS=Symbol.for('jobverify.verified-recruitment-observations')
export const readCortevaOriginalResponses=jobs=>structuredClone(jobs?.[ORIGINALS]?.nativeOriginalResponses||[])
export async function runNativeCorteva(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap')
 if(maxPages!==Infinity)throw RangeError('Corteva native finite page cap cannot establish complete channel proof')
 const io=transport(options),{control}=io;let observed=0
 const finish=jobs=>{
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:io.originals.filter(p=>p.requestedURL.startsWith(PORTAL+'api/pcsx/search?')).length,reason:maxJobs===0?'caller-zero-cap-no-inventory-proof':'native-india-channel-observations-not-company-inventory'})
  attachSourceObservationEvidence(jobs,{source:'corteva',recordKind:'vacancy-rows',observedRecordCount:observed,observedVacancyCount:observed,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  const retained=io.originals.map(p=>Object.freeze({...p,headers:Object.freeze({...p.headers}),requestHeaders:Object.freeze({...p.requestHeaders})}))
  Object.defineProperty(jobs,ORIGINALS,{value:Object.freeze({source:'corteva',nativeOriginalResponses:Object.freeze(retained),sourceScopeComplete:false,lifecycleCleanupAllowed:false})})
  return jobs
 }
 try{
  control.check();if(maxJobs===0)return finish([])
  const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now
  control.check();const observedAt=new Date(clock).getTime();need(Number.isFinite(observedAt),'invalid observation clock');const at=new Date(observedAt).toISOString()
  const declarations=async()=>{
   const owner=corporate((await io.read(CAREERS)).text);io.allow(PORTAL)
   const redirect=await io.read(PORTAL,'html',302)
   need(new URL(redirect.headers.location,PORTAL).href===BOARD,'declared portal redirect differs');io.allow(BOARD)
   const tenant=board((await io.read(BOARD)).text);io.allow(CLIENT);client((await io.read(CLIENT,'javascript')).bytes)
   return{corporate:owner,tenant}
  }
  const openingDeclaration=await declarations()
  const listings=async expected=>{
   const rows=[],models=[],ids=new Set();let total=expected
   for(let start=0;start<(total??1);start+=10){
    const url=searchURL(start);io.allow(url);const model=json((await io.read(url,'json')).text),page=readSearch(model,start,total)
    total=page.total;models.push(model)
    for(const row of page.rows){need(!ids.has(row.id),'duplicate native role across search pages');ids.add(row.id);rows.push(row)}
   }
   need(rows.length===total,'incomplete worldwide search window')
   return{rows,models,total,india:rows.filter(indiaCandidate)}
  }
  const openingListing=await listings();need(openingListing.india.length>0,'no qualified India rows; zero does not certify company inventory')
  const details=async rows=>{
   const result=[]
   for(const row of rows){
    const api=detailURL(row.id),page=roleURL(row.id);io.allow(api);io.allow(page)
    const model=json((await io.read(api,'json')).text),role=readRole(model,row,observedAt),pageModel=canonical((await io.read(page)).text,row.id,role,observedAt)
    result.push({...role,canonical:pageModel})
   }
   return result
  }
  const opening=await details(openingListing.india),closingDeclaration=await declarations()
  reconcile(openingDeclaration,closingDeclaration,'publisher declaration')
  const closingListing=await listings(openingListing.total)
  reconcile(openingListing.models,closingListing.models,'whole worldwide search')
  const closing=await details(closingListing.india)
  need(opening.length===closing.length,'closing India count differs')
  for(let i=0;i<opening.length;i++){reconcile(opening[i].model,closing[i].model,'whole role');reconcile(opening[i].canonical,closing[i].canonical,'canonical page')}
  control.check()
  const all=opening.map((role,i)=>mapRole(openingListing.india[i],role,closing[i],role.canonical,openingDeclaration,at));observed=all.length
  if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone({source:'corteva',records:all,originalResponses:io.originals,openingListingModels:openingListing.models,closingListingModels:closingListing.models,openingDeclaration,closingDeclaration,reportedGlobalSearchCount:openingListing.total,IndiaObservations:all.length,sourceScopeComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0})))
  if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(all)))
  control.check();return finish(all.slice(0,maxJobs))
 }catch(error){const reason=control.fail(error);io.attachFailure(reason);throw reason}finally{control.dispose()}
}
