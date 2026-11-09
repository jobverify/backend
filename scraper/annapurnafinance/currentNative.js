import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {withAnnapurnaPublicRead,need,stable} from './publicRead.js'
import {HOME,CAREERS,SHORT,PORTAL,LIST,LABELS,PROGRAM,verifyCorporateHandoff,portalConfiguration,verifyProgram,headersFor,queryFor,ownDetailUrl,parsePage,parsePublicLabels,publicRole,publicObservation,nativeJSON} from './nativeContract.js'

export async function runCurrentAnnapurna(options={}){
 const cap=options.maxJobs==null||options.maxJobs===0?Infinity:options.maxJobs
 need(cap===Infinity||Number.isSafeInteger(cap)&&cap>0,'invalid caller job cap')
 const clock=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof clock==='string'&&Number.isFinite(Date.parse(clock)),'invalid observation clock')
 const now=new Date(clock).toISOString()
 return withAnnapurnaPublicRead(options,async ctx=>{
  let rows=[],pages=0,terminal=false,labels=[],details=new Map(),ownDetailPasses=0,closingReconciled=false,callerCapApplied=false
  const evidence=()=>({status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:!closingReconciled?'native-read-or-closing-reconciliation-incomplete':'native-work-country-and-posting-date-unpublished;per-role-URLs-require-public-runtime-configuration'})
  const report=async(failed=false)=>ctx.observe({verifiedAt:now,observedNativePositions:rows.length,nativePagination:{pages,terminal},ownDetailPasses,closingReconciled,finalInventoryAfterClosingDetails:closingReconciled,callerCapApplied,publicJobLabels:labels,observations:rows.map(r=>details.get(r.positionId)??publicObservation(r)),inventoryEvidence:evidence(),sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false},{afterFailure:failed})
  const portal=async phase=>{
   const home=await ctx.read(HOME,{label:'corporate-home',phase}),careers=await ctx.read(CAREERS,{label:'corporate-careers',phase});verifyCorporateHandoff(home,careers)
   const redirect=await ctx.read(SHORT,{label:'published-portal-shortlink',phase,redirect:true});need(typeof redirect.location==='string','published portal shortlink no longer redirects')
   // Validate opaque public configuration before sending a request to it.
   const u=new URL(redirect.location);need(u.origin===PORTAL&&u.pathname==='/career-portal'&&!u.username&&!u.password&&!u.hash,'published portal redirect left declared origin')
   const html=await ctx.read(redirect.location,{label:'native-public-portal',phase})
   return portalConfiguration(redirect.location,html)
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
   for(const p of PROGRAM)verifyProgram(p.label,await ctx.read(PORTAL+p.path,{label:'published-'+p.label,phase:'public-program'}))
   labels=parsePublicLabels(await ctx.read(LABELS,{label:'native-public-labels',headers:headersFor(config)}))
   const opening=await inventory(config,'opening-inventory');rows=opening.rows;pages=opening.pages;terminal=opening.terminal;callerCapApplied=cap<rows.length
   await report()
   const selected=rows.slice(0,cap),hydrate=async phase=>{
    const result=new Map()
    for(let i=0;i<selected.length;i+=2)await Promise.all(selected.slice(i,i+2).map(async row=>{
     const body=await ctx.read(ownDetailUrl(row,config),{label:'native-own-role-'+row.positionId,phase,headers:headersFor(config)}),job=publicRole(row,nativeJSON(body),labels,{now})
     result.set(row.positionId,job);if(phase==='opening-detail')details.set(row.positionId,job)
    }))
    return result
   }
   details=await hydrate('opening-detail');ownDetailPasses=1;await report()
   const closing=await hydrate('closing-detail');ownDetailPasses=2
   const ordered=map=>[...map].sort(([a],[b])=>a-b)
   need(stable(ordered(details))===stable(ordered(closing)),'closing own-role criteria changed')
   const closingConfig=await portal('closing-handoff');need(stable(config)===stable(closingConfig),'closing public tenant configuration changed')
   const closingLabels=parsePublicLabels(await ctx.read(LABELS,{label:'native-public-labels',phase:'closing-labels',headers:headersFor(config)}));need(stable(labels)===stable(closingLabels),'closing public criteria labels changed')
   const final=await inventory(config,'final-inventory')
   const orderedRows=value=>value.slice().sort((a,b)=>a.positionId-b.positionId)
   need(stable(orderedRows(rows))===stable(orderedRows(final.rows)),'closing native position inventory changed')
   closingReconciled=true;await report()
   const jobs=attachInventoryEvidence([...details.values()],evidence())
   return attachSourceObservationEvidence(jobs,{source:'annapurnafinance',recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false})
  }catch(error){
   if(!options.signal?.aborted)await report(true)
   throw error
  }
 })
}
