import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {withAnnapurnaPublicRead,need,stable} from './publicRead.js'
import {HOME,CAREERS,SHORT,PORTAL,LIST,LABELS,programsFor,verifyCorporateHandoff,portalConfiguration,verifyProgram,headersFor,queryFor,ownDetailUrl,parsePage,parsePublicLabels,publicRole,publicObservation,nativeJSON} from './nativeContract.js'
import {CURRENT_PUBLIC_PROFILE_NAME,CURRENT_CITY_URL,nativePortalMetadataURL,parseCurrentPortalMetadata,nativeCityQuery,parseCurrentPublicCities,nativeCurrentApplicationURL,qualifyCurrentPublicRole,verifyCurrentPublicShell,publicQualificationModel,reconcilePublicQualification} from './currentPublicQualification20261119.js'

export async function runCurrentAnnapurna(options={}){
 const cap=options.maxJobs==null||options.maxJobs===0?Infinity:options.maxJobs
 need(cap===Infinity||Number.isSafeInteger(cap)&&cap>0,'invalid caller job cap')
 const clock=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof clock==='string'&&Number.isFinite(Date.parse(clock)),'invalid observation clock')
 const now=new Date(clock).toISOString()
 return withAnnapurnaPublicRead(options,async ctx=>{
  let rows=[],pages=0,terminal=false,labels=[],details=new Map(),ownDetailPasses=0,closingReconciled=false,callerCapApplied=false,qualification=null,closingQualification=null
  const evidence=()=>({status:qualification?'discovery-only':'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:ctx.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:!closingReconciled?'native-read-or-closing-reconciliation-incomplete':qualification?'current-native-city-country-and-own-application-qualification;explicit-partial-criteria-retained;country-employer-or-application-unresolved-roles-held;company-inventory-and-posting-dates-unqualified':'native-work-country-and-posting-date-unpublished;per-role-URLs-require-public-runtime-configuration'})
  const report=async(failed=false)=>ctx.observe({verifiedAt:now,observedNativePositions:rows.length,nativePagination:{pages,terminal},ownDetailPasses,closingReconciled,finalInventoryAfterClosingDetails:closingReconciled,callerCapApplied,publicJobLabels:labels,observations:rows.map(r=>details.get(r.positionId)??publicObservation(r)),inventoryEvidence:evidence(),sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false},{afterFailure:failed})
  const portal=async phase=>{
   const home=await ctx.read(HOME,{label:'corporate-home',phase}),careers=await ctx.read(CAREERS,{label:'corporate-careers',phase});verifyCorporateHandoff(home,careers)
   const redirect=await ctx.read(SHORT,{label:'published-portal-shortlink',phase,redirect:true});need(typeof redirect.location==='string','published portal shortlink no longer redirects')
   // Validate opaque public configuration before sending a request to it.
   const u=new URL(redirect.location);need(u.origin===PORTAL&&u.pathname==='/career-portal'&&!u.username&&!u.password&&!u.hash,'published portal redirect left declared origin')
   const html=await ctx.read(redirect.location,{label:'native-public-portal',phase})
   const config=portalConfiguration(redirect.location,html)
   if(config.publicProgrammeProfile===CURRENT_PUBLIC_PROFILE_NAME)need(/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(ctx.receipts.at(-1).contentType??''),'current public portal HTML MIME changed')
   return config
  }
  const inventory=async(config,phase)=>{
   const found=[],seen=new Set();let count=0
   for(let page=1;page<=100;page++){
    const text=await ctx.read(LIST,{label:'native-list-page-'+page,phase,method:'POST',headers:{...headersFor(config),'content-type':'application/json'},body:JSON.stringify(queryFor(config,page))}),parsed=parsePage(text,page);count++
    for(const row of parsed.rows){need(!seen.has(row.positionId),'duplicate or repeated native pagination position');seen.add(row.positionId);found.push(row)}
    if(parsed.terminal)return{rows:found,pages:count,terminal:true}
   }
   need(false,'native pagination reached page bound without a terminal response')
  }
  try{
   const config=await portal('opening')
   for(const p of programsFor(config))verifyProgram(p.label,await ctx.read(PORTAL+p.path,{label:'published-'+p.label,phase:'public-program',mime:config.publicProgrammeProfile?'javascript':null}),config)
   labels=parsePublicLabels(await ctx.read(LABELS,{label:'native-public-labels',headers:headersFor(config)}))
   const opening=await inventory(config,'opening-inventory');rows=opening.rows;pages=opening.pages;terminal=opening.terminal;callerCapApplied=cap<rows.length
   const publicQualification=async phase=>{
    const metadata=parseCurrentPortalMetadata(nativeJSON(await ctx.read(nativePortalMetadataURL(config),{label:'native-public-employer-url-configuration',phase,headers:headersFor(config),mime:'json'})),config)
    const cities=parseCurrentPublicCities(nativeJSON(await ctx.read(CURRENT_CITY_URL,{label:'native-public-workplace-country-lookup',phase,method:'POST',headers:{...headersFor(config),'content-type':'application/json'},body:JSON.stringify(nativeCityQuery(metadata,config)),mime:'json'})))
    let applicationShellSHA256=null
    const url=rows.map(row=>nativeCurrentApplicationURL(row,config,metadata)).find(Boolean)
    if(url){const shell=await ctx.read(url,{label:'native-representative-own-application-shell',phase,mime:'html'});verifyCurrentPublicShell(shell);applicationShellSHA256=ctx.receipts.at(-1).sha256}
    return {metadata,cities,applicationShellSHA256}
   }
   if(config.publicProgrammeProfile===CURRENT_PUBLIC_PROFILE_NAME)qualification=await publicQualification('opening-public-qualification')
   await report()
   const selected=rows.slice(0,cap),hydrate=async phase=>{
    const result=new Map()
    for(let i=0;i<selected.length;i+=2)await Promise.all(selected.slice(i,i+2).map(async row=>{
     const body=await ctx.read(ownDetailUrl(row,config),{label:'native-own-role-'+row.positionId,phase,headers:headersFor(config),mime:qualification?'json':null}),publicJob=publicRole(row,nativeJSON(body),labels,{now}),job=qualification?qualifyCurrentPublicRole(publicJob,row,qualification,config):publicJob
     result.set(row.positionId,job);if(phase==='opening-detail')details.set(row.positionId,job)
    }))
    return result
   }
   details=await hydrate('opening-detail');ownDetailPasses=1;await report()
   const closing=await hydrate('closing-detail');ownDetailPasses=2
   const ordered=map=>[...map].sort(([a],[b])=>a-b)
   need(stable(ordered(details))===stable(ordered(closing)),'closing own-role criteria changed')
   const closingConfig=await portal('closing-handoff');need(stable(config)===stable(closingConfig),'closing public tenant configuration changed')
   if(qualification){for(const p of programsFor(config))verifyProgram(p.label,await ctx.read(PORTAL+p.path,{label:'published-'+p.label,phase:'closing-public-program',mime:'javascript'}),config);closingQualification=await publicQualification('closing-public-qualification');reconcilePublicQualification(qualification,closingQualification)}
   const closingLabels=parsePublicLabels(await ctx.read(LABELS,{label:'native-public-labels',phase:'closing-labels',headers:headersFor(config)}));need(stable(labels)===stable(closingLabels),'closing public criteria labels changed')
   const final=await inventory(config,'final-inventory')
   const orderedRows=value=>value.slice().sort((a,b)=>a.positionId-b.positionId)
   need(stable(orderedRows(rows))===stable(orderedRows(final.rows)),'closing native position inventory changed')
   closingReconciled=true;await report()
   const records=[...details.values()],qualified=qualification?records.filter(job=>job.sourceQualification.qualified):records,jobs=attachInventoryEvidence(qualified,evidence())
   attachSourceObservationEvidence(jobs,{source:'annapurnafinance',recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false})
   if(qualification)Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'annapurnafinance',recordKind:'vacancy-rows',nativeObservedRecords:rows.length,qualifiedIndiaRecords:qualified.length,qualifiedIndiaFullCriteriaRecords:qualified.filter(job=>job.sourceDetailComplete===true).length,qualifiedIndiaPartialCriteriaRecords:qualified.filter(job=>job.sourceDetailComplete!==true).length,heldRecords:records.filter(job=>!job.sourceQualification.qualified),records,publicQualification:{opening:publicQualificationModel(qualification),closing:publicQualificationModel(closingQualification)},nativePagination:{pages,terminal},callerCapApplied,wholeNativeModelsClosingReconciled:closingReconciled,ownDetailPasses,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,companyZeroProven:false,lifecycleCleanupAllowed:false,applicationInteractions:0,backendSubmissionVerified:false,programmeProfile:CURRENT_PUBLIC_PROFILE_NAME}})
   return jobs
  }catch(error){
   if(!options.signal?.aborted)await report(true)
   throw error
  }
 })
}
