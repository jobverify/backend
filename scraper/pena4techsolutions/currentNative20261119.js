import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {JOBS,SHORT,PORTAL,LIST,LABELS,corporateHandoff,portalConfiguration,headersFor,queryFor,ownDetailURL,parsePage} from './currentContract20261117.js'
import {CURRENT_PUBLIC_PROFILE,CURRENT_PUBLIC_PROGRAM,CURRENT_CITY_URL,nativePortalMetadataURL,parseCurrentPortalMetadata,nativeCityQuery,parseCurrentPublicCities,nativeCurrentApplicationURL,qualifyCurrentPublicRole,verifyCurrentPublicShell,publicQualificationModel,reconcilePublicQualification} from './currentPublicQualification20261119.js'
import {nativeJSON,parsePublicLabels,publicRole} from './currentPublicProjection20261119.js'
import {need,stable} from './currentPublicSupport20261119.js'
import {createCurrentReader} from './currentRead20261119.js'

const SOURCE='pena4techsolutions',same=(a,b)=>stable(a)===stable(b)
export async function runCurrentPena4Qualified(options={}){
 options.signal?.throwIfAborted()
 const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid caller output cap')
 const maximumPages=options.maxPages??20;need(Number.isSafeInteger(maximumPages)&&maximumPages>0&&maximumPages<=20,'invalid source page cap')
 let config=null;const portals=new Set(),applications=new Set(),openingModels=[],closingModels=[]
 const allowed=(value,kind,{method,headers,body})=>{
  try{
   const url=new URL(value);if(url.href!==value||url.username||url.password||url.hash)return false
   if(method==='POST'){
    if(kind!=='json'||!config||typeof body!=='string'||Buffer.byteLength(body)>1024)return false
    const query=nativeJSON(body)
    if(value===LIST)return Number.isSafeInteger(query.pagination?.pageNumber)&&query.pagination.pageNumber>0&&query.pagination.pageNumber<=maximumPages&&same(query,queryFor(config,query.pagination.pageNumber))
    return value===CURRENT_CITY_URL&&same(query,nativeCityQuery({cityLookupUsesCompanyCode:false},config))
   }
   if(method!=='GET'||body!==undefined)return false
   if(kind==='html')return [JOBS,SHORT].includes(value)||portals.has(value)||applications.has(value)
   if(kind==='javascript')return CURRENT_PUBLIC_PROGRAM.some(program=>PORTAL+program.path===value)
   if(kind!=='json'||!config)return false
   if(!['apiKey','domainCode','AccessMode'].every(key=>headers[key]===headersFor(config)[key]))return false
   return value===LABELS||value===nativePortalMetadataURL(config)||openingModels.some(row=>ownDetailURL(row,config)===value)
  }catch{return false}
 }
 const io=createCurrentReader(options,allowed),readJSON=async(url,phase,descriptor={})=>nativeJSON((await io.read(url,{kind:'json',phase,headers:headersFor(config),...descriptor})).text)
 const authority=async phase=>{
  const jobs=await io.read(JOBS,{phase:phase+'-corporate'});corporateHandoff(jobs.text)
  const short=await io.read(SHORT,{phase:phase+'-shortlink',allowRedirect:true});need(short.status===302,'own public shortlink stopped declaring its tenant')
  const declared=portalConfiguration(short.headers.location);portals.add(short.headers.location)
  const shell=await io.read(short.headers.location,{phase:phase+'-portal'});verifyCurrentPublicShell(shell.text)
  const scripts=readNativeDocument(shell.text).nodes(n=>n.tag==='script'&&!n.inert&&n.attrs.src).map(n=>new URL(n.attrs.src,PORTAL).href)
  need(CURRENT_PUBLIC_PROGRAM.slice(0,2).every(program=>scripts.includes(PORTAL+program.path)),'whole current declared main/runtime changed')
  const programs=[];for(const program of CURRENT_PUBLIC_PROGRAM){const page=await io.read(PORTAL+program.path,{kind:'javascript',phase:phase+'-'+program.label});need(page.sha256===program.sha256&&Buffer.byteLength(page.text)===program.bytes,'whole reviewed own public programme changed');programs.push({label:program.label,sha256:page.sha256})}
  return{config:declared,jobsSHA256:jobs.sha256,shortBodySHA256:short.sha256,portalURL:short.headers.location,portalSHA256:shell.sha256,programs}
 }
 const inventory=async phase=>{
  const rows=[],pages=[];for(let page=1;page<=maximumPages;page++){
   const parsed=parsePage(await readJSON(LIST,phase,{method:'POST',headers:{...headersFor(config),'Content-Type':'application/json'},body:JSON.stringify(queryFor(config,page))}));pages.push(parsed.rows)
   for(const row of parsed.rows){need(!rows.some(other=>other.positionId===row.positionId),'duplicate native integer position identity');rows.push(row)}
   need(rows.length<=200,'native unique position ceiling exceeded');if(parsed.terminal)return{rows,pages}
  }need(false,'native terminal page unavailable within source bound')
 }
 const qualification=async phase=>{
  const metadata=parseCurrentPortalMetadata(await readJSON(nativePortalMetadataURL(config),phase+'-metadata'),config)
  need(metadata.cityLookupUsesCompanyCode===false,'current own City query company-code branch changed')
  const cities=parseCurrentPublicCities(await readJSON(CURRENT_CITY_URL,phase+'-cities',{method:'POST',headers:{...headersFor(config),'Content-Type':'application/json'},body:JSON.stringify(nativeCityQuery(metadata,config))}))
  const url=openingModels.map(row=>nativeCurrentApplicationURL(row,config,metadata)).find(Boolean);need(url,'no native own application URL can be bound')
  applications.add(url);const shell=await io.read(url,{phase:phase+'-application'});verifyCurrentPublicShell(shell.text)
  return{metadata,cities,applicationShellSHA256:shell.sha256}
 }
 try{
  const openingAuthority=await authority('opening');config=openingAuthority.config
  const labels=parsePublicLabels((await io.read(LABELS,{kind:'json',phase:'opening-labels',headers:headersFor(config)})).text)
  const openingInventory=await inventory('opening-inventory');openingModels.push(...openingInventory.rows)
  const openingQualification=await qualification('opening-public'),opening=[]
  for(const row of openingModels)opening.push(qualifyCurrentPublicRole(publicRole(row,await readJSON(ownDetailURL(row,config),'opening-details'),labels,{now:observedAt}),row,openingQualification,config))
  for(const row of openingModels)closingModels.push(qualifyCurrentPublicRole(publicRole(row,await readJSON(ownDetailURL(row,config),'closing-details'),labels,{now:observedAt}),row,openingQualification,config))
  need(same(opening,closingModels),'whole public native own-role criteria/status/employer/application changed at closing')
  const closingAuthority=await authority('closing');need(same(openingAuthority,closingAuthority),'whole native publisher/tenant/program configuration changed at closing')
  const closingLabels=parsePublicLabels((await io.read(LABELS,{kind:'json',phase:'closing-labels',headers:headersFor(config)})).text);need(same(labels,closingLabels),'whole public labels changed at closing')
  const closingInventory=await inventory('closing-inventory');need(same(openingInventory,closingInventory),'whole native ordered position inventory changed at closing')
  const closingQualification=await qualification('closing-public');reconcilePublicQualification(openingQualification,closingQualification)
  const qualified=opening.filter(job=>job.sourceQualification.qualified),jobs=options.maxJobs==null?qualified:qualified.slice(0,options.maxJobs)
  const audit={source:SOURCE,recordKind:'vacancy-rows',nativeObservedRecords:openingModels.length,qualifiedIndiaRecords:qualified.length,fullCriteriaRecords:qualified.filter(job=>job.sourceDetailComplete).length,partialCriteriaRecords:qualified.filter(job=>!job.sourceDetailComplete).length,heldRecords:opening.filter(job=>!job.sourceQualification.qualified),records:opening,closingRecords:closingModels,
   openingAuthority,closingAuthority,openingInventory,closingInventory,publicQualification:{opening:publicQualificationModel(openingQualification),closing:publicQualificationModel(closingQualification)},publicLabels:labels,
   wholePublicNativeModelsClosingReconciled:true,rawPrivateStaffDTOEqualityClaimed:false,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,companyZeroProven:false,lifecycleCleanupAllowed:false,applicationInteractions:0,backendSubmissionVerified:false,programmeProfile:CURRENT_PUBLIC_PROFILE.qualificationProfile,reader:io.stats()}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:openingModels.length,observedVacancyCount:openingModels.length,sourceScopeComplete:false})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:JOBS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.reader.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'native-own-published-positions-current-city-code-country-and-role-application-qualified;full-public-model-closing-reconciled;explicit-partial-criteria-and-company-scope-held'})
  await options.onAudit?.(structuredClone(audit));io.check();return jobs
 }catch(error){io.check();try{Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,openingModels,closingModels,reader:io.stats(),lifecycleCleanupAllowed:false},enumerable:true})}catch{/* Preserve exact opaque caller reason. */}throw error}
 finally{io.close()}
}
