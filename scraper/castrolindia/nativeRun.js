import {CORPORATE,BOARD,API,parseCastrolBoard,validateCastrolInventory,validateCastrolDetail} from './nativeContract.js'
import {runApiPortalScraper} from '../../scraper-support/apiPortal/engine.js'
import {expandApiPortalProviderTemplate} from '../../scraper-support/providers/apiPortalTemplates.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {publicRead,bounded,stable} from '../alohatechnology/publicRead.js'
import {qualifyCurrentCastrolCriteria} from './currentCriteria.js'
const check=(ok,message)=>{if(!ok)throw new Error('Castrol native inventory: '+message)}
const REGIONAL_GATE='https://www.castrol.com/content/dam/infrastructure/nav-apps/castrol/castrol-geolocation-redirect/landing-page.html'
const regionalReader=options=>{
 const load=options.fetchPage||options.fetchText||options.fetchImpl||fetch
 return async(url,init)=>{
  const response=await load(url,init)
  if(url===CORPORATE){
   let target
   if([301,302,303,307,308].includes(response?.status))try{target=new URL(response.headers?.get?.('location')??response.location,url).href}catch{}
   if(target===REGIONAL_GATE||response?.url===REGIONAL_GATE){
    // The public regional gate is not the reviewed hiring handoff. Do not
    // accept consent, fetch a different board, or turn this response into zero.
    try{Promise.resolve(response.body?.cancel()).catch(()=>{})}catch{}
    throw Object.assign(new Error('Castrol India native: corporate hiring handoff requires regional consent'),{
     code:'CASTROL_REGIONAL_CONSENT_REQUIRED',status:response.status,abortRetries:true,failureKind:'public_access_denied',softFailure:true,upstreamOutage:true,
     inventoryEvidence:{status:'coverage-gap',surface:CORPORATE,firstParty:false,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null},
     nativeEvidence:{source:'castrolindia',stage:'official-corporate',requestedURL:CORPORATE,regionalGateURL:REGIONAL_GATE,responseURL:response.url??null,status:response.status,sourceScopeComplete:false,lifecycleCleanupAllowed:false},
    })
   }
  }
  return response
 }
}
const publicKeys=['id','internal_job_id','requisition_id','title','company_name','absolute_url','location','offices','departments','first_published','application_deadline','content','metadata']
const publicRow=row=>({native:Object.fromEntries(Object.entries(row.raw).filter(([key])=>publicKeys.includes(key)||/^(?:country|country_?code|addresscountry)$/i.test(key))),location:row.location,nativeLocation:row.nativeLocation,nativeOffices:row.nativeOffices,unresolvedLocations:row.unresolvedLocations,scopeComplete:row.scopeComplete,configuredCountryMembershipComplete:row.configuredCountryMembershipComplete,india:row.india})
export async function runNativeCastrol(options={}){
 const timeoutMs=options.timeoutMs??120000,cap=options.maxJobs??Infinity
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid bounded deadline');check(cap===Infinity||Number.isInteger(cap)&&cap>=0,'Invalid cap')
 return publicRead({source:'castrolindia',company:'Castrol India'},{...options,fetchPage:regionalReader(options),collectionBudgetMs:timeoutMs},async({read,stamp,audit,signals,publicPages})=>{
  const now=stamp(),corporate=await read(CORPORATE),boardHtml=await read(BOARD),board=parseCastrolBoard(corporate,boardHtml),payload=JSON.parse(await read(API,{kind:'json'})),inventory=validateCastrolInventory(payload,board,{now}),details=new Map()
  const detailPass=async phase=>{
   const result=new Map()
   for(let i=0;i<inventory.india.length;i+=2)await Promise.all(inventory.india.slice(i,i+2).map(async row=>{const html=await read(row.raw.absolute_url,{phase});result.set(row.raw.id,qualifyCurrentCastrolCriteria(html,validateCastrolDetail(html,row,{now})))}))
   return result
  }
  for(const [id,detail]of await detailPass('opening-detail'))details.set(id,detail)
  const closingDetails=await detailPass('closing-detail')
  check(stable([...details].sort(([a],[b])=>a-b))===stable([...closingDetails].sort(([a],[b])=>a-b)),'Closing own-role criteria, identity, dates or workplace changed')
  const finalCorporate=await read(CORPORATE,{phase:'final-inventory'}),finalBoardHtml=await read(BOARD,{phase:'final-inventory'}),finalBoard=parseCastrolBoard(finalCorporate,finalBoardHtml),lastPayload=JSON.parse(await read(API,{kind:'json',phase:'final-inventory'})),last=validateCastrolInventory(lastPayload,finalBoard,{now})
  check(stable(inventory.rows.map(publicRow))===stable(last.rows.map(publicRow)),'Native full public inventory or country membership drift')
  const provider=expandApiPortalProviderTemplate({source:'castrolindia',companyName:'Castrol India',companyCareerPage:CORPORATE,countryFilter:'India',template:'greenhouse',templateOptions:{boardToken:'castrol',locationPattern:'\\bIndia\\b'}})
  provider.config.mapping.location='verifiedNativeLocation';provider.config.mapping.jobDescription='verifiedNativeDescription';provider.config.mapping.postingDate='first_published'
  const prepared={...payload,jobs:inventory.rows.map(row=>({...row.raw,verifiedNativeLocation:row.india?row.location:row.nativeLocation,verifiedNativeDescription:details.has(row.raw.id)?details.get(row.raw.id).jobDescription:row.raw.content}))}
  const mapped=await bounded(()=>runApiPortalScraper({provider,fetchJson:async()=>prepared}),signals),inner=readInventoryEvidence(mapped)
  check(mapped.length===details.size&&new Set(mapped.map(j=>String(j.jobId))).size===details.size,'Shared mapper lost/duplicated verified India roles')
  const complete=inventory.configuredCountryMembershipComplete&&[...details.values()].every(j=>j.sourceDetailComplete)&&cap>=details.size&&inner?.listingComplete===true
  const jobs=mapped.map(job=>{
   const detail=details.get(Number(job.jobId)),row=inventory.rows.find(row=>String(row.raw.id)===String(job.jobId));check(detail&&row,'Shared mapper produced unverified identity')
   return{...job,...detail,sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceListingComplete:complete,sourceConfiguredCountryScopeComplete:row.configuredCountryMembershipComplete,sourceNativeGlobalGeographyComplete:row.scopeComplete}
  })
  const evidence={status:complete?(payload.jobs.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:API,firstParty:publicPages.every(p=>p.status===200&&p.responseIdentity==='validated-public-response'),listingComplete:complete,pagesFetched:publicPages.length,reportedTotal:payload.meta.total,indiaFacetCount:inventory.configuredCountryMembershipComplete?inventory.india.length:null,verifiedAt:now,reason:!inventory.configuredCountryMembershipComplete?'native-configured-India-membership-unresolved':jobs.some(j=>!j.sourceDetailComplete)?'native-full-description-missing':cap<jobs.length?'caller-cap':inner?.listingComplete!==true?'shared-native-inventory-incomplete':'current-complete-native-configured-India-membership-and-two-own-detail-passes;global-geography-and-company-scope-remain-separate'}
  const byId=new Map(jobs.map(job=>[job.jobId,job])),observations=inventory.rows.map(row=>byId.get(String(row.raw.id))??{source:'castrolindia',company:'Castrol',jobId:String(row.raw.id),title:row.raw.title,sourceUrl:row.raw.absolute_url,jobDescription:row.raw.content,country:null,nativeLocation:row.nativeLocation,nativeOffices:row.nativeOffices,nativeUnresolvedLocations:row.unresolvedLocations,sourceConfiguredCountryScopeComplete:row.configuredCountryMembershipComplete,sourceNativeGlobalGeographyComplete:row.scopeComplete,sourceIndiaMembership:row.configuredCountryMembershipComplete?'explicitly-excluded':'unresolved',sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  await audit({verifiedAt:now,observations,nativeListedTotal:inventory.rows.length,nativeIndiaTotal:inventory.india.length,configuredCountryMembershipComplete:inventory.configuredCountryMembershipComplete,nativeGlobalGeographyComplete:inventory.scopeComplete,globalGeographyGaps:inventory.rows.filter(row=>!row.scopeComplete).map(row=>({jobId:String(row.raw.id),nativeLocation:row.nativeLocation,nativeOffices:row.nativeOffices,unresolvedLocations:row.unresolvedLocations,indiaMembership:row.india?'explicitly-included':'unresolved'})),ownDetailPasses:2,closingReconciled:true,finalInventoriesAfterClosingDetails:true,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,inventoryEvidence:evidence})
  const selected=attachInventoryEvidence(jobs.slice(0,cap),evidence)
  return attachSourceObservationEvidence(selected,{source:'castrolindia',recordKind:'vacancy-rows',observedRecordCount:inventory.rows.length,observedVacancyCount:inventory.rows.length,sourceScopeComplete:false})
 })
}
