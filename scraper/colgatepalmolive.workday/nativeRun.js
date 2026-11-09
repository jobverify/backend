import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CORPORATE,SEARCH,API,check,verifyCorporate,verifySearch,checkEnvelope,parsePage,parseDetail} from './nativeContract.js'
const client=JSON.parse(fs.readFileSync(new URL('./nativeClient.json',import.meta.url)))
// Current declared loader reads only versions/virtualPath from this index.
// The exact second body changes only its unused deployment metadata; all other
// advertised loaders, manifest and the complete main program retain old pins.
const reviewedIndex=(asset,digest)=>asset.url==='https://performancemanager4.successfactors.com/verp/vmod_3/rmk-jobs-search/index.json?tag=b2605.31'&&asset.sha256==='8afafbe14e4c2743a9cd9fb063a9c06a81e7f17b87280043ab40f2dab1daddae'&&digest==='487a4823d307f74bc80ae971c06f14825323545e5371e9b1242335c1bd36598b'
export async function runNative(options={}){
 const now=new Date(options.now??Date.now()).toISOString(),timeout=options.timeoutMs??180000
 check(options.maxJobs==null,'Truncated extraction is unsupported');check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=240000,'Invalid extraction deadline')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Colgate deadline exceeded')),timeout),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 let cookie='',nonce='';const originalResponses=[],pages=[],closingPages=[],rows=[],nativeModels=[],heldNativeRecords=[],currentOptions={allowReviewedWorksiteGap:true}
 async function request(url,body){
  const startedAt=new Date().toISOString()
  signal.throwIfAborted();let onAbort
  const aborted=new Promise((_,reject)=>{onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true})})
  try{return await Promise.race([aborted,(async()=>{
   const headers={'Accept':body?'application/json':'text/html,application/javascript,application/json'}
   if(body){headers['Content-Type']='application/json';headers['X-CSRF-Token']=nonce;if(cookie)headers.Cookie=cookie}
   const r=await fetch(url,{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,headers,signal,redirect:'error'})
   signal.throwIfAborted()
   if(r.status!==200||r.url!==url)throw Object.assign(Error('Colgate public native contract: Native HTTP status or final URL mismatch; HTTP '+r.status+' for '+url+'; final URL '+r.url),{status:r.status,requestUrl:url,finalUrl:r.url})
   if(url===SEARCH)cookie=(r.headers.getSetCookie?.()??[]).map(s=>s.split(';')[0]).join('; ')
   const originalBytes=typeof r.arrayBuffer==='function',bytes=originalBytes?Buffer.from(await r.arrayBuffer()):Buffer.from(await r.text(),'utf8');signal.throwIfAborted();check(bytes.length<=5000000,'Native response exceeds bounded size')
   const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
   originalResponses.push({requestedURL:url,finalURL:r.url,method:body?'POST':'GET',requestBody:body?JSON.stringify(body):null,status:r.status,contentType:r.headers?.get('content-type')??null,startedAt,completedAt:new Date().toISOString(),bodyReadKind:originalBytes?'original-bytes':'decoded-text-only',bodyBytes:bytes.length,bodySHA256:createHash('sha256').update(bytes).digest('hex'),bodyBase64:bytes.toString('base64')});return text
  })()])}finally{signal.removeEventListener('abort',onAbort)}
 }
 const json=async body=>{const d=JSON.parse(await request(API,body));checkEnvelope(d);return d}
 const payload=pageNumber=>({locale:'en_US',pageNumber,sortBy:'date',keywords:'',location:'',facetFilters:{filter1:['India']},brand:'',skills:[],categoryId:0})
 try{
  signal.throwIfAborted();verifyCorporate(await request(CORPORATE));nonce=verifySearch(await request(SEARCH))
  for(const asset of client.assets){const digest=createHash('sha256').update(await request(asset.url)).digest('hex');check(digest===asset.sha256||reviewedIndex(asset,digest),'Advertised native client changed; review required')}
  const facets=await json({facetingOnly:true,categoryId:0,brand:'',locale:'en_US',keywords:'',location:'',facetFields:['filter5','filter1','filter2','sfstd_jobLocation_obj','businessUnit_obj','filter12','filter7','StudentOpp'],facetFilters:{},skills:[]})
  check(Array.isArray(facets.facetFields),'Native facets missing')
  const countries=facets.facetFields.filter(f=>f.name==='filter1');check(countries.length===1&&Array.isArray(countries[0].values),'Native country facet missing')
  const india=countries[0].values.filter(v=>v.name==='India');check(india.length===1&&Number.isSafeInteger(india[0].count)&&india[0].count>=0,'Native India facet count unavailable')
  pages.push(await json(payload(0)));const first=parsePage(pages[0],0,now,india[0].count,currentOptions);rows.push(...first.rows)
  for(let page=1;page<Math.ceil(first.total/10);page++){pages.push(await json(payload(page)));rows.push(...parsePage(pages[page],page,now,first.total,currentOptions).rows)}
  check(rows.length===first.total&&new Set(rows.map(r=>r.id)).size===rows.length,'Native duplicate or incomplete inventory')
  const jobs=[];for(const row of rows){const detail=parseDetail(await request(row.sourceURL),row,now,currentOptions);nativeModels.push(detail);if(detail.sourceWorksiteStatus==='held')heldNativeRecords.push({uid:row.id,reason:'native-list-detail-city-set-conflict-and-explicit-talent-pool',nativeRecord:structuredClone(pages.flatMap(p=>p.jobSearchResult).find(e=>e.response.id===row.id).response),nativeDetail:detail});else jobs.push(detail)}
  for(let page=0;page<pages.length;page++){const closing=await json(payload(page));closingPages.push(closing);check(JSON.stringify(closing)===JSON.stringify(pages[page]),'Native inventory changed during extraction')}
  for(const held of heldNativeRecords){const row=rows.find(r=>r.id===held.uid),closing=parseDetail(await request(row.sourceURL),row,now,currentOptions);check(JSON.stringify(closing)===JSON.stringify(held.nativeDetail),'Native held role changed during extraction');held.closingNativeRecord=structuredClone(held.nativeRecord);held.closingNativeDetail=closing}
  signal.throwIfAborted()
  for(const job of jobs){job.sourceObservedIndiaFacetCount=first.total;job.nativeClientBuild=client.observedWidgetBuild;job.lifecycleCleanupAllowed=false}
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SEARCH,firstParty:true,listingComplete:false,pagesFetched:pages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:heldNativeRecords.length?'Stable observed India facet; explicit pooling/worksite hold and whole-company coverage remain unresolved':'Complete stable observed India facet; whole company and other public recruiting surfaces are unproven'})
  const observations={source:'colgatepalmolive',recordKind:heldNativeRecords.length?'mixed':'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,observations)
  const rawRows=pages.flatMap(p=>p.jobSearchResult.map(e=>e.response)),closingRows=closingPages.flatMap(p=>p.jobSearchResult.map(e=>e.response))
  const records=rawRows.map((row,index)=>{const held=heldNativeRecords.find(h=>h.uid===row.id);return{uid:row.id,recordKind:held?'hiring-signal':'vacancy',nativeCountryCodes:[...new Set(row.jobLocationShort.map(s=>s.split(',')[2].trim()))],nativeSourceRecord:structuredClone(row),nativeClosingRecord:structuredClone(closingRows[index]),nativeDetailModel:nativeModels[index],held:!!held,...(held?{holdReason:held.reason}:{})}})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...observations,observations:records,openingNativePages:structuredClone(pages),closingNativePages:structuredClone(closingPages),openingNativeRows:structuredClone(rawRows),closingNativeRows:structuredClone(closingRows),nativeModels,heldNativeRecords,originalResponses,wholeObservedIndiaFacetClosingReconciled:true,heldPublicDetailClosingRechecked:heldNativeRecords.length>0,otherPublicDetailsClosingRechecked:false,applicationInteractions:0,lifecycleCleanupAllowed:false},configurable:true})
  return jobs
 }catch(error){
  if(error instanceof Error&&error!==signal.reason&&Object.isExtensible(error))Object.defineProperty(error,'recruitmentObservations',{value:{source:'colgatepalmolive',openingNativePages:structuredClone(pages),closingNativePages:structuredClone(closingPages),nativeModels,heldNativeRecords,originalResponses,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false},configurable:true})
  throw error
 }finally{clearTimeout(timer);controller.abort();cookie='';nonce=''}
}
