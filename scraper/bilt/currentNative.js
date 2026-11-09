import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createBiltReader,HOME,CAREERS,BOARD,FEED,need} from './nativeTransport.js'
import {readBiltCorporate,readBiltBoard,readBiltRSS,readBiltRole} from './nativeModels.js'

const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right)
const sameRSSRows=(before,after)=>before.length===after.length&&before.every((row,index)=>{
 const {link:openingURL,...opening}=row,{link:closingURL,...closing}=after[index]
 return equal(opening,closing)&&opening.id===closing.id&&openingURL&&closingURL
})
const sameNativeRole=(before,after)=>{
 if(!before?.complete||!after?.complete||before.declaredCanonical!==after.declaredCanonical)return false
 const {url:openingURL,rssItem:openingRSS,...opening}=before,{url:closingURL,rssItem:closingRSS,...closing}=after
 return Boolean(openingURL&&closingURL&&sameRSSRows([openingRSS],[closingRSS])&&equal(opening,closing))
}
const wait=(value,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason)}
 signal.addEventListener('abort',abort,{once:true})
 Promise.resolve(value).then(result=>{signal.removeEventListener('abort',abort);signal.aborted?abort():resolve(result)},error=>{signal.removeEventListener('abort',abort);signal.aborted?abort():reject(error)})
 if(signal.aborted)abort()
})
export async function runBiltNative(options={}){
 const reader=createBiltReader(options),audit={source:'bilt',sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,
  companyIndiaZeroProven:false,serverPublishedModelsOnly:true,externalClientRuntimeReviewed:false,applicationInteractions:0,publisherProgramsExecuted:false,receipts:reader.receipts,
  openingRoles:[],closingRoles:[],heldRoles:[],failures:[]}
 const parse=async(url,fn)=>{const page=await reader.read(url);reader.check();return fn(page.html)}
 const bind=(board,rss)=>{
  need(board.rows.length===rss.rows.length&&board.rows.every(row=>rss.rows.some(item=>row.id===item.id&&item.title.startsWith(row.title+' - '))),'Native board/RSS identity or total disagrees')
 }
 const role=async(row,boardRow)=>{
  const page=await reader.read(row.link)
  try{
   const native=readBiltRole(page.html,row)
   need(boardRow.title===native.title&&boardRow.rowText===`${native.title} ${native.city}, ${native.state}${native.workplaceType==='Hybrid'?' Hybrid':''}`,'Native board/detail workplace disagrees')
   return {...native,boardRow}
  }catch(error){
   reader.check()
   return {id:row.id,url:row.link,rssItem:row,boardRow,complete:false,holdReason:error.message,originalBodySHA256:page.sha256,originalRawHTML:page.html}
  }
 }
 try{
  audit.homeOpening=await parse(HOME,html=>readBiltCorporate(html,HOME));audit.careersOpening=await parse(CAREERS,html=>readBiltCorporate(html,CAREERS))
  audit.boardOpening=await parse(BOARD,readBiltBoard);audit.rssOpening=await parse(FEED,readBiltRSS);bind(audit.boardOpening,audit.rssOpening)
  for(const row of audit.rssOpening.rows)reader.allowRole(row.link)
  for(const row of audit.rssOpening.rows)audit.openingRoles.push(await role(row,audit.boardOpening.rows.find(item=>item.id===row.id)))
  audit.rssClosing=await parse(FEED,readBiltRSS);audit.boardClosing=await parse(BOARD,readBiltBoard);bind(audit.boardClosing,audit.rssClosing)
  need(sameRSSRows(audit.rssOpening.rows,audit.rssClosing.rows)&&equal(audit.boardOpening,audit.boardClosing),'Native listing changed during full role reads')
  for(const row of audit.rssClosing.rows)reader.allowRole(row.link)
  for(const row of audit.rssClosing.rows)audit.closingRoles.push(await role(row,audit.boardClosing.rows.find(item=>item.id===row.id)))
  audit.rssFinal=await parse(FEED,readBiltRSS);audit.boardFinal=await parse(BOARD,readBiltBoard);bind(audit.boardFinal,audit.rssFinal)
  need(sameRSSRows(audit.rssClosing.rows,audit.rssFinal.rows)&&equal(audit.boardClosing,audit.boardFinal),'Native final listing changed after closing details')
  audit.careersClosing=await parse(CAREERS,html=>readBiltCorporate(html,CAREERS));audit.homeClosing=await parse(HOME,html=>readBiltCorporate(html,HOME))
  need(equal(audit.careersOpening,audit.careersClosing)&&equal(audit.homeOpening,audit.homeClosing),'Corporate/native delegation changed at closing')
  const full=[]
  for(const opening of audit.openingRoles){
   const closing=audit.closingRoles.find(item=>item.id===opening.id)
   if(sameNativeRole(opening,closing))full.push(opening)
   else audit.heldRoles.push({id:opening.id,reason:opening.holdReason??closing?.holdReason??'Full native role changed at closing',opening,closing})
  }
  const observedAt=options.now?options.now():new Date().toISOString()
  need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Invalid collection observation clock')
  const india=full.filter(item=>item.country==='India'),observations={source:'bilt',recordKind:'vacancy-rows',observedRecordCount:audit.rssOpening.rows.length,
   observedVacancyCount:audit.rssOpening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  Object.assign(audit,{observedAt,observations:full,fullServerPublishedNativeModels:full.length,returnedIndiaJobs:india.length,listingOpeningClosingStable:true,allRoleModelsOpeningClosingStable:audit.heldRoles.length===0,transport:reader.stats()})
  audit.declaredRoleURLReconciliation=full.map(opening=>{
   const closing=audit.closingRoles.find(item=>item.id===opening.id),final=audit.rssFinal.rows.find(item=>item.id===opening.id)
   return {id:opening.id,openingURL:opening.url,closingURL:closing.url,finalDeclaredURL:final.link,openingCanonical:opening.declaredCanonical,closingCanonical:closing.declaredCanonical,
    bothActualFullModelsMatchCanonicalAndAllNativeFields:true,originalURLsRetained:true,URLRewritingPerformed:false,globalDomainAliasesAdded:false}
  })
  reader.check()
  if(options.onAudit)await wait(Promise.resolve().then(()=>{reader.check();return options.onAudit(structuredClone(audit))}),reader.signal)
  reader.check()
  const jobs=india.map(item=>({source:'bilt',company:'Bilt',companyDomain:'bilt.ai',companyCareerPage:CAREERS,atsPlatform:'brightmove',
   jobId:item.id,title:item.title,sourceUrl:item.url,link:item.url,applyUrl:item.url,country:item.country,city:item.city,state:item.state,
   location:`${item.city}, ${item.state}, ${item.country}`,postingDate:item.postingDate,closingDate:null,employmentType:item.employmentType,workplaceType:item.workplaceType,
   jobDescription:item.fullCriteriaText,sourceDescription:item.fullCriteriaHTML,sourceNativeRecord:item,sourceNativeClosingRecord:audit.closingRoles.find(row=>row.id===item.id),
   sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:observedAt}))
  attachSourceObservationEvidence(jobs,observations)
  Object.defineProperty(jobs,'sourceAudit',{value:audit});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:FEED,firstParty:true,listingComplete:false,pagesFetched:reader.receipts.length,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'Configured publisher RSS/board and full server-published role models only. External client behavior, complete company/country scope and application acceptance remain unverified; cleanup is not authorized.'})
 }catch(error){
  options.signal?.throwIfAborted()
  if(error&&typeof error==='object'&&Object.isExtensible(error)){
   audit.failures.push({message:error.message,status:error.status??null,requestUrl:error.requestUrl??null});audit.transport=reader.stats()
   Object.assign(error,{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false,recruitmentObservations:audit})
  }
  throw error
 }finally{reader.close()}
}
