import {createHash} from 'node:crypto'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CORPORATE,BOARD,need,corporateModel,boardModel,listingModel,listingUrl,detailModel} from './nativeModels.js'
import {declaredStylesheets,NATIVE_STYLESHEETS} from './criteriaVisibility.js'

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const listingIdentity=row=>({id:row.detailId,title:row.title,requisitionId:row.requisitionId,location:row.location,visibleLocation:row.visibleLocation,positionType:row.sourceNativePositionType??null,postingDate:row.postingDate})
const inventoryIdentity=inventory=>inventory.channels.map(channel=>({url:channel.url,total:channel.reportedTotal,rows:channel.rows.map(listingIdentity).sort((a,b)=>a.id.localeCompare(b.id))}))
const bindingIdentity=value=>({corporate:value.corporate,board:{publisher:value.board.publisher,corporateAboutUrl:value.board.corporateAboutUrl,channels:value.board.channels}})
const failure=(message,code,extra={})=>Object.assign(Error('Akulaku public: '+message),{code,abortRetries:true,...extra})

export async function runCurrentAkulaku(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 const budget=options.collectionBudgetMs??720000
 if(!Number.isSafeInteger(budget)||budget<=0||budget>900000)throw TypeError('Invalid Akulaku collection budget')
 const controller=new AbortController(),timeout=failure('collection deadline exceeded','AKULAKU_COLLECTION_TIMEOUT'),timer=setTimeout(()=>controller.abort(timeout),budget),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const responses=[],failures=[],observerErrors=new Set(),lastHostStart=new Map(),supplied=options.fetchPage??options.fetchText,documents={opening:new Map(),closing:new Map()},styles={opening:new Map(),closing:new Map(),final:new Map()}
 const wait=operation=>withCallerSignal(operation,signal)
 const notify=async(name,value)=>{if(options[name])try{await wait(()=>options[name](value))}catch(error){observerErrors.add(error);throw error}}
 const read=async url=>{
  signal.throwIfAborted();need(responses.length<1200,'public request safety bound exceeded')
  const address=new URL(url),native=address.origin===new URL(BOARD).origin
  need(url===CORPORATE||url===BOARD||NATIVE_STYLESHEETS.includes(url)||native&&(/^\/alljob\/$/.test(address.pathname)||/^\/zpdetail\/\d+$/.test(address.pathname)),'unpublished or private URL refused')
  need(!address.username&&!address.password&&!address.hash,'credentialed or fragment URL refused')
  if(native&&address.pathname==='/alljob/')listingUrl(url)
  if(native&&address.pathname.startsWith('/zpdetail/'))need([...address.searchParams.keys()].every(name=>['o','PageIndex'].includes(name))&&['1','2'].includes(address.searchParams.get('o')),'unrecognized native detail routing')
  if(!supplied){const delay=Math.max(0,500-(Date.now()-(lastHostStart.get(address.host)||0)));if(delay)await wait(()=>new Promise(resolve=>setTimeout(resolve,delay)));lastHostStart.set(address.host,Date.now())}
  const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal,AbortSignal.timeout(20000)]),requestedAt=new Date().toISOString()
  let packet,networkAttempts=0,transientConnectTimeoutRetried=false
  try{
   const request={method:'GET',redirect:'manual',signal:requestSignal,headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:NATIVE_STYLESHEETS.includes(url)?'text/css,*/*;q=0.1':'text/html,application/xhtml+xml,*/*;q=0.8'}}
   const getPacket=()=>{networkAttempts++;return withCallerSignal(()=>supplied?supplied(url,request):(options.fetchImpl??globalThis.fetch)(url,{...request,signal:requestSignal}),requestSignal)}
   try{packet=await getPacket()}catch(error){
    if(supplied||!NATIVE_STYLESHEETS.includes(url)||signal.aborted||requestSignal.aborted||error?.status!=null||error?.response!=null||error?.cause?.code!=='UND_ERR_CONNECT_TIMEOUT')throw error
    // Only the observed pre-header public CDN connect timeout is retried. The
    // identical GET shares the original request/collection cancellation budget.
    transientConnectTimeoutRetried=true;await withCallerSignal(()=>new Promise(resolve=>setTimeout(resolve,500)),requestSignal);packet=await getPacket()
   }
   signal.throwIfAborted()
   if(packet?.status!==200){if(packet?.body?.cancel)await withCallerSignal(()=>packet.body.cancel(),[signal,AbortSignal.timeout(500)]).catch(()=>{});const status=packet?.status;throw failure('HTTP '+status+'; stopped without retry/browser/private session',[401,403,429].includes(status)?'AKULAKU_PUBLIC_ACCESS_DENIED':status===404||status===410?'AKULAKU_DETAIL_UNAVAILABLE':'AKULAKU_PUBLIC_HTTP',{status,failureKind:[401,403,429].includes(status)?'blocked':'source_unavailable'})}
   need(packet.url===url,'public final URL identity changed')
   let html,receivedBytes
   if(typeof packet.html==='string')html=packet.html
   else if(typeof packet.body==='string')html=packet.body
   else if(typeof packet.text==='string')html=packet.text
   else if(packet.body?.getReader){const reader=packet.body.getReader(),parts=[];let bytes=0;try{for(;;){const row=await withCallerSignal(()=>reader.read(),requestSignal);if(row.done)break;bytes+=row.value.byteLength;need(bytes<=2*1024*1024,'native body exceeds safety bound');parts.push(Buffer.from(row.value))}receivedBytes=Buffer.concat(parts);html=new TextDecoder('utf-8',{fatal:true}).decode(receivedBytes)}finally{await withCallerSignal(()=>reader.cancel(),AbortSignal.timeout(500)).catch(()=>{});reader.releaseLock()}}
   else if(typeof packet.text==='function')html=await withCallerSignal(()=>packet.text(),requestSignal)
   need(typeof html==='string'&&Buffer.byteLength(html)>0&&Buffer.byteLength(html)<=2*1024*1024,'public body unavailable or oversized')
   signal.throwIfAborted();const body=receivedBytes??Buffer.from(html),record={url,finalUrl:packet.url,status:packet.status,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),requestedAt,completedAt:new Date().toISOString(),networkAttempts,transientConnectTimeoutRetried};responses.push(record);await notify('onResponse',{...record,bodyBase64:body.toString('base64')});return html
  }finally{requestController.abort();if(packet?.body?.cancel)await withCallerSignal(()=>packet.body.cancel(),AbortSignal.timeout(500)).catch(()=>{})}
 }
 const binding=async()=>({corporate:corporateModel(await read(CORPORATE)),board:boardModel(await read(BOARD))})
 const inventory=async bind=>{
  const channels=[],all=new Map(),conflicts=[]
  for(const url of bind.board.channels){let next=url,total,pages;const seen=new Set(),rows=[]
   while(next){need(!seen.has(next)&&seen.size<50,'native pagination loop or bound');seen.add(next);const model=listingModel(await read(next),next);if(total===undefined){total=model.reportedTotal;pages=model.pages}else need(total===model.reportedTotal&&pages===model.pages,'native total changed within enumeration');rows.push(...model.cards);next=model.nextUrl}
   need(rows.length===total&&new Set(rows.map(row=>row.detailId)).size===total&&seen.size===pages,'native total and unique posting inventory do not reconcile')
   channels.push({url,reportedTotal:total,pages:seen.size,rows})
   for(const row of rows){const previous=all.get(row.detailId);if(previous&&!same(listingIdentity(previous),listingIdentity(row)))conflicts.push({id:row.detailId,reason:'native listing fields differ between declared public channels'});if(!previous)all.set(row.detailId,row)}
  }
  const nativeListedRows=[...all.values()],unmatchedPublicCards=[]
  for(const card of bind.board.publicCards){const listed=all.get(card.detailId);if(listed){if(listed.title!==card.title)conflicts.push({id:card.detailId,reason:'native featured/title and complete listing title conflict'})}else{unmatchedPublicCards.push(card);all.set(card.detailId,{...card,requisitionId:/[（(](J\d+)[)）]$/.exec(card.title)?.[1]||null,location:null,visibleLocation:null,department:null,postingDate:null,sourceNativeHotOnly:true})}}
  return{channels,nativeListedRows,rows:[...all.values()].sort((a,b)=>a.detailId.localeCompare(b.detailId)),conflicts,unmatchedPublicCards}
 }
 const currentStyles=async(html,phase)=>{for(const sheet of declaredStylesheets(html))if(NATIVE_STYLESHEETS.includes(sheet.url)&&!styles[phase].has(sheet.url))styles[phase].set(sheet.url,{url:sheet.url,body:await read(sheet.url)});return[...styles[phase].values()]}
 const details=async(inv,phase)=>{
  const records=[]
  for(const row of inv.rows){signal.throwIfAborted();try{const html=await read(row.detailUrl);documents[phase].set(row.detailId,html);const stylesheets=await currentStyles(html,phase),job=detailModel(html,row,{stylesheets});records.push(job)}catch(error){signal.throwIfAborted();if(observerErrors.has(error)||!['AKULAKU_NATIVE_MODEL','AKULAKU_DETAIL_UNAVAILABLE'].includes(error?.code))throw error;failures.push({phase,id:row.detailId,sourceUrl:row.detailUrl,stage:'public-role-detail',status:error.status??null,reason:error.message});records.push({source:'akulaku',company:'Akulaku',jobId:row.detailId,requisitionId:row.requisitionId,title:row.title,sourceUrl:row.detailUrl,jobDescription:null,sourceDetailComplete:false,country:null,sourceCountryScopeUnresolved:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}}
  return records
 }
 const execute=async()=>{
  const openingBinding=await binding(),openingInventory=await inventory(openingBinding),openingDetails=await details(openingInventory,'opening'),closingBinding=await binding(),closingInventory=await inventory(closingBinding),closingDetails=await details(closingInventory,'closing'),finalBinding=await binding(),finalInventory=await inventory(finalBinding)
  for(const html of documents.closing.values())await currentStyles(html,'final')
  const bindingsMatch=same(bindingIdentity(openingBinding),bindingIdentity(closingBinding))&&same(bindingIdentity(closingBinding),bindingIdentity(finalBinding)),closingInventoryMatches=bindingsMatch&&same(inventoryIdentity(openingInventory),inventoryIdentity(closingInventory))&&same(inventoryIdentity(closingInventory),inventoryIdentity(finalInventory)),opened=new Map(openingDetails.map(row=>[row.jobId,row])),final=new Map(finalInventory.rows.map(row=>[row.detailId,row])),closedRows=new Map(closingInventory.rows.map(row=>[row.detailId,row])),observed=[],unmatchedPublicCards=[...new Map([...openingInventory.unmatchedPublicCards,...closingInventory.unmatchedPublicCards,...finalInventory.unmatchedPublicCards].map(row=>[row.detailId,row])).values()]
  for(const row of closingDetails){
   const before=opened.get(row.jobId),current=closedRows.get(row.jobId),last=final.get(row.jobId),activeMembershipUnresolved=Boolean(current.sourceNativeHotOnly||last?.sourceNativeHotOnly);let finalModel=row
   if(row.sourceDetailComplete&&documents.closing.has(row.jobId))try{finalModel=detailModel(documents.closing.get(row.jobId),current,{stylesheets:[...styles.final.values()]})}catch(error){if(error?.code!=='AKULAKU_NATIVE_MODEL')throw error;finalModel={...row,sourceDetailComplete:false,sourceNativeCriteriaIssues:[...(row.sourceNativeCriteriaIssues||[]),'final-public-visibility-model-unqualified']}}
   const stable=before&&row.sourceDetailComplete&&before.sourceDetailComplete&&finalModel.sourceDetailComplete&&same(before,row)&&same(row,finalModel)&&last&&!activeMembershipUnresolved&&same(listingIdentity(current),listingIdentity(last))&&bindingsMatch&&!openingInventory.conflicts.some(issue=>issue.id===row.jobId)&&!closingInventory.conflicts.some(issue=>issue.id===row.jobId)&&!finalInventory.conflicts.some(issue=>issue.id===row.jobId)
   observed.push({...finalModel,sourceNativeActiveMembershipUnresolved:activeMembershipUnresolved,sourceCurrentNativeRoleQualified:Boolean(stable),sourceNativeTemporalQualification:stable?'two-full-public-details-plus-final-native-membership-and-criteria-styles':'native-identity-criteria-date-country-membership-or-visibility-unqualified'});if(!stable)failures.push({stage:'closing-native-role',id:row.jobId,reason:'two full public details, final native membership and relevant current criteria styles do not reconcile'})
  }
  for(const row of openingDetails)if(!observed.some(current=>current.jobId===row.jobId))observed.push({...row,sourceCurrentNativeRoleQualified:false,sourceNativeTemporalQualification:'missing-at-closing'})
  for(const row of finalInventory.rows)if(!observed.some(current=>current.jobId===row.detailId))observed.push({source:'akulaku',company:'Akulaku',jobId:row.detailId,requisitionId:row.requisitionId,title:row.title,sourceUrl:row.detailUrl,location:row.location,postingDate:row.postingDate,jobDescription:null,country:null,sourceCountryScopeUnresolved:true,sourceDetailComplete:false,sourceCurrentNativeRoleQualified:false,sourceNativeFinalOnly:true,sourceNativeActiveMembershipUnresolved:Boolean(row.sourceNativeHotOnly),sourceNativeTemporalQualification:'new-final-candidate-after-closing-details',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  const countryGaps=observed.filter(row=>row.sourceCountryScopeUnresolved),qualified=observed.filter(row=>row.sourceCurrentNativeRoleQualified&&row.sourceDetailComplete&&row.sourceIndiaWorksiteQualified&&row.country==='India'),limit=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0?options.maxJobs:null,jobs=limit?qualified.slice(0,limit):qualified,limited=jobs.length!==qualified.length,complete=closingInventoryMatches&&failures.length===0&&countryGaps.length===0&&unmatchedPublicCards.length===0&&!limited
  const evidence={status:complete?'complete-inventory':'coverage-gap',surface:BOARD+'alljob/?o=1',firstParty:true,listingComplete:complete,pagesFetched:responses.length,reportedTotal:finalInventory.nativeListedRows.length,indiaFacetCount:complete?qualified.length:null,verifiedAt:new Date().toISOString(),reason:complete?'Current declared native public channels, unique posting identities, full criteria/workplace countries and final membership reconcile. Declared-board-only; company-wide/lifecycle coverage unproved.':'Current declared native public observations retained; role countries, detail failures, field conflicts, changed membership or positive output limit remain unresolved. No city/HQ/citizenship inference, private account/application prerequisites or verified-empty claim.'}
  attachInventoryEvidence(jobs,evidence);attachSourceObservationEvidence(jobs,{source:'akulaku',recordKind:'vacancy-rows',observedRecordCount:observed.length,observedVacancyCount:observed.length,sourceScopeComplete:false})
  const audit={source:'akulaku',observedDetails:observed,unmatchedPublicCards,countryGaps:countryGaps.map(row=>({id:row.jobId,location:row.location??null,reason:'native role workplace does not establish configured India eligibility/exclusion; all original country/location alternatives retained without city/province default'})),openingBinding,closingBinding,finalBinding,openingInventory,closingInventory,finalInventory,closingInventoryMatches,finalInventoryReadAfterDetails:true,failures,limited,responses,privateApplicationRequests:0,sourceDeclaredBoardScopeComplete:complete,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false,inventoryEvidence:evidence}
  await notify('onRecords',structuredClone(observed));await notify('onAudit',structuredClone(audit));signal.throwIfAborted();return jobs
 }
 try{return await wait(execute)}finally{clearTimeout(timer);controller.abort()}
}
