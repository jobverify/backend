import {createHash} from 'node:crypto'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import profile from './test-data/current-data-profile-20261121.json' with {type:'json'}

const SOURCE='jkfennerindialtd',COMPANY='J.K.Fenner India Ltd'
const sha=value=>createHash('sha256').update(value).digest('hex')
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value
const canonical=value=>JSON.stringify(ordered(value))
const ownedErrors=new WeakSet()
const fail=message=>{const error=Object.assign(Error('J.K.Fenner current native DATA: '+message),{code:'JKFENNER_CURRENT_NATIVE',abortRetries:true});ownedErrors.add(error);return error}
const need=(condition,message)=>{if(!condition)throw fail(message)}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')

// Publisher programmes are never executed. Full finite corporate/frame/asset
// hashes bind only the reviewed anonymous DATA contract, not rendered UI/CSS.
const bounded=(operation,signal)=>{
 signal.throwIfAborted()
 return new Promise((resolve,reject)=>{
  let done=false
  const finish=(callback,value)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);callback(value)}
  const abort=()=>finish(reject,signal.reason)
  signal.addEventListener('abort',abort,{once:true})
  Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>finish(resolve,value),error=>finish(reject,error))
 })
}

// Only the selected public carrier's read signature/expiry are transport data.
// Every other model value, including application declarations, remains bound.
// Opening and closing originals retain the complete, unmodified signed URLs.
const normalizeModel=(envelope,now)=>{
 const copy=structuredClone(envelope),file=copy.data?.jobProperties?.jdpdf
 need(object(file)&&file.isUploaded===true&&typeof file.fileUrl==='string','native criteria carrier declaration missing')
 need(/^[a-f0-9]{32}\.(?:pdf|docx)$/.test(file.uploadedFileName),'native criteria carrier filename changed')
 let url
 try{url=new URL(file.fileUrl)}catch{throw fail('native criteria carrier URL changed')}
 need(url.protocol==='https:'&&url.hostname==='zinghrprodblob.blob.core.windows.net'&&!url.username&&!url.password&&!url.hash&&url.port===''&&url.pathname==='/jkfenner/Documents/Recruitment/JD/'+file.uploadedFileName,'native criteria carrier authority changed')
 const keys=[...url.searchParams.keys()].sort()
 need(canonical(keys)===canonical(['se','sig','sp','sr','sv'])&&url.searchParams.get('sp')==='r'&&url.searchParams.get('sr')==='c'&&url.searchParams.get('sv')==='2018-03-28','native criteria carrier read permission/schema changed')
 const expiry=url.searchParams.get('se'),signature=url.searchParams.get('sig'),expires=Date.parse(expiry)
 need(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(expiry)&&Number.isFinite(expires)&&expires>now&&expires<=now+3600000&&/^[A-Za-z0-9+/]{43}=$/.test(signature),'native criteria carrier expired or signature/expiry contract changed; no refresh attempted')
 url.searchParams.set('se','@SIGNED_READ_EXPIRY');url.searchParams.set('sig','@SIGNED_READ_SIGNATURE');url.searchParams.sort()
 file.fileUrl=url.href
 return copy
}

export async function runCurrentNativeData(options={}){
 options.signal?.throwIfAborted()
 const cap=options.maxJobs??null,budget=options.collectionBudgetMs??90000,maxRequests=options.maxRequests??64
 need(cap===null||Number.isSafeInteger(cap)&&cap>=0,'invalid caller cap')
 need(Number.isSafeInteger(budget)&&budget>0&&budget<=90000,'invalid collection budget')
 need(Number.isSafeInteger(maxRequests)&&maxRequests>0&&maxRequests<=128,'invalid request budget')
 const observedValue=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 options.signal?.throwIfAborted()
 need(typeof observedValue==='string'&&Number.isFinite(Date.parse(observedValue)),'invalid observation clock')
 const observedAt=new Date(observedValue).toISOString(),observedMS=Date.parse(observedValue),started=performance.now()
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(fail('collection deadline exceeded')),budget)
 const signal=AbortSignal.any([options.signal,controller.signal].filter(Boolean)),receipts=[]
 let requests=0,totalBytes=0,opening=null
 const fetchImpl=options.fetchImpl??globalThis.fetch
 const read=async(url,kind,phase,init={})=>{
  signal.throwIfAborted();need(requests<maxRequests,'request budget exhausted before next public read');requests++
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(10000)])
  const request={method:'GET',...init,redirect:'manual',credentials:'omit',signal:requestSignal,headers:{Accept:'*/*',...init.headers}}
  const response=await bounded(()=>fetchImpl(url,request),requestSignal)
  need(response&&response.status===200&&response.url===url&&response.redirected!==true,'public HTTP/URL hold; stopped without retry or redirect')
  const media=response.headers?.get?.('content-type')??response.headers?.['content-type']
  const types={html:/^text\/html(?:;|$)/i,json:/^application\/json(?:;|$)/i,script:/^(?:text|application)\/(?:javascript|x-javascript|ecmascript|plain|octet-stream)(?:;|$)/i,pdf:/^application\/pdf(?:;|$)/i,docx:/^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document(?:;|$)/i}
  need(typeof media==='string'&&types[kind]?.test(media),'public response media metadata changed')
  let bytes
  if(response.body?.getReader){
   const reader=response.body.getReader(),chunks=[];let size=0,complete=false
   try{for(;;){const item=await bounded(()=>reader.read(),requestSignal);if(item.done){complete=true;break}size+=item.value.byteLength;need(size<=2*1024*1024,'public original byte bound exceeded');chunks.push(Buffer.from(item.value))}bytes=Buffer.concat(chunks,size)}
   finally{if(!complete)void reader.cancel().catch(()=>{});reader.releaseLock()}
  }else{
   need(typeof response.arrayBuffer==='function','public original byte transport unavailable')
   bytes=Buffer.from(await bounded(()=>response.arrayBuffer(),requestSignal));need(bytes.length<=2*1024*1024,'public original byte bound exceeded')
  }
  signal.throwIfAborted();totalBytes+=bytes.length;need(totalBytes<=12*1024*1024,'collection original byte budget exceeded')
  receipts.push({url,phase,method:request.method,requestBody:request.body??null,status:response.status,contentType:media,bytes:bytes.length,sha256:sha(bytes)})
  return bytes
 }
 const readPinned=async(row,kind,phase,label)=>{
  const bytes=await read(row.url,kind,phase);need(sha(bytes)===row.sha256,'whole '+label+' authority/programme changed');return bytes
 }
 const authority=async phase=>{
  const home=await read(profile.homeURL,'html',phase)
  need(sha(home)===profile.homeSHA256,'whole current corporate homepage authority changed')
  const careers=await readPinned({url:profile.careersURL,sha256:profile.careersSHA256},'html',phase,'current corporate careers')
  for(const row of profile.corporateAssets){need(careers.toString('utf8').includes(new URL(row.url).pathname),'corporate selected programme declaration missing');await readPinned(row,'script',phase,'corporate selected')}
  const frame=await readPinned({url:profile.frameURL,sha256:profile.frameSHA256},'html',phase,'native public frame')
  for(const row of profile.nativeAssets){need(frame.toString('utf8').includes(new URL(row.url).pathname),'native selected programme declaration missing');await readPinned(row,'script',phase,'native selected')}
  const bytes=await read(profile.configURL,'json',phase)
  let configuration
  try{configuration=JSON.parse(bytes.toString('utf8'))}catch{throw fail('native configuration schema unavailable')}
  need(configuration.code===1&&configuration.data?.careerKey===profile.careerKey&&sha(canonical(configuration))===profile.configurationSHA256,'native account/configuration authority changed')
  return{configuration}
 }
 const listing=async phase=>{
  const rows=[],pages=[];let count=null
  for(let pageIndex=1;pageIndex<=4;pageIndex++){
   const body={...structuredClone(profile.listingBody),pageIndex}
   const bytes=await read(profile.listingURL,'json',phase,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
   let value
   try{value=JSON.parse(bytes.toString('utf8'))}catch{throw fail('native listing JSON unavailable')}
   need(object(value)&&value.code===1&&object(value.data)&&canonical(Object.keys(value.data).sort())===canonical(['count','requisitionList'])&&Array.isArray(value.data.requisitionList)&&Number.isSafeInteger(value.data.count)&&value.data.count>=0&&value.data.count<=48,'native listing/count/schema hold')
   if(count===null)count=value.data.count
   need(value.data.count===count&&value.data.requisitionList.length===Math.min(12,count-rows.length),'native pagination/count mismatch')
   for(const row of value.data.requisitionList)need(object(row)&&/^[a-f0-9]{24}$/.test(row.requisitionId)&&typeof row.jobProperties?.jobReferenceTitle==='string'&&row.jobProperties.jobReferenceTitle.trim(),'native row identity/schema changed')
   rows.push(...value.data.requisitionList);pages.push(value)
   need(new Set(rows.map(row=>row.requisitionId)).size===rows.length,'native duplicate requisition identity')
   if(rows.length===count)return{rows,pages,count}
  }
  throw fail('native listing page budget incomplete; cleanup forbidden')
 }
 const snapshot=async phase=>{
  const declaration=await authority(phase)
  const board=await listing(phase),records=[]
  for(const row of board.rows){
   const url=profile.apiOrigin+'recruitmentnext/v1/CareerConfiguration/GetCareerRequisitionById?CareerKey='+profile.careerKey+'&RequisitionId='+row.requisitionId
   const bytes=await read(url,'json',phase)
   let envelope,normalized,reviewed,reason=null
   try{
    try{envelope=JSON.parse(bytes.toString('utf8'))}catch{throw fail('native full detail JSON unavailable')}
    need(object(envelope)&&envelope.code===1&&object(envelope.data),'native full detail model unavailable')
    need(envelope.data.requisitionId===row.requisitionId&&envelope.data.jobProperties?.jobReferenceTitle===row.jobProperties.jobReferenceTitle,'native full detail/list identity mismatch')
    normalized=normalizeModel(envelope,observedMS+performance.now()-started)
    reviewed=profile.models.find(candidate=>candidate.requisitionId===row.requisitionId&&candidate.listingSHA256===sha(canonical(row))&&candidate.modelSHA256===sha(canonical(normalized)))
    need(reviewed,'full native criteria/country/employer/publication/application model outside reviewed finite contract')
   }catch(error){if(!ownedErrors.has(error))throw error;reason=error.message}
   let carrier=null
   if(!reason){
    const file=envelope.data.jobProperties.jdpdf,kind=file.uploadedFileName.endsWith('.pdf')?'pdf':'docx'
    const content=await read(file.fileUrl,kind,phase)
    carrier={url:file.fileUrl,sha256:sha(content),bodyBase64:content.toString('base64'),bytes:content.length}
    if(carrier.sha256!==reviewed.carrierSHA256)reason='full original criteria carrier outside reviewed finite contract'
   }
   records.push({row,envelope:envelope??null,rawDetailBase64:bytes.toString('base64'),normalized:normalized??envelope??bytes.toString('utf8'),reviewed,reason,carrier})
  }
  return{declaration,...board,records}
 }
 try{
  opening=await snapshot('opening')
  const closing=await snapshot('closing')
  need(canonical(opening.pages)===canonical(closing.pages),'whole native listing closing reconciliation changed')
  need(opening.records.length===closing.records.length,'whole native model closing count changed')
  for(let index=0;index<opening.records.length;index++){
   const first=opening.records[index],last=closing.records[index]
   need(canonical(first.normalized)===canonical(last.normalized)&&first.carrier?.sha256===last.carrier?.sha256&&first.reason===last.reason,'whole native criteria/publication/application model closing reconciliation changed')
  }
  signal.throwIfAborted()
  const heldRecords=opening.records.filter(record=>record.reason).map(record=>({requisitionId:record.row.requisitionId,reason:record.reason,nativeListingRecord:structuredClone(record.row),nativeRawDetail:structuredClone(record.envelope),rawDetailBase64:record.rawDetailBase64,originalCriteriaCarrier:record.carrier}))
  const nativePayload=opening.records.flatMap((record,index)=>{
   if(record.reason)return[]
   const raw=record.envelope.data,reviewed=record.reviewed,file=raw.jobProperties.jdpdf
   const sections=Object.values(raw.positionDetails).map(section=>section.htmlText)
   const description=sections.join('\n')+'\n<pre>'+escape(reviewed.carrierText)+'</pre>'
   return[{source:SOURCE,company:COMPANY,title:raw.jobProperties.jobReferenceTitle,jobId:raw.requisitionId,requisitionId:raw.requisitionId,sourceUrl:profile.frameURL,companyCareerPage:profile.careersURL,companyDomain:'jkfenner.com',link:null,applyUrl:null,
    location:reviewed.nativeLocationLabel,city:null,state:null,country:null,countryCode:null,sourceCountryScopeUnresolved:true,remoteStatus:null,sourceRemoteStatusUnresolved:true,
    employmentType:raw.jobProperties.employeeType.description,department:raw.jobProperties.industry.description,experienceRequired:null,minimumQualification:raw.certificationAndEduction.mandatory.join(', '),preferredQualification:null,requiredSkills:[...raw.skill.mandatory],
    jobDescription:description,sourceDescription:description,nativePositionDetails:structuredClone(raw.positionDetails),nativeOriginalCriteriaCarrierText:reviewed.carrierText,nativeOriginalCriteriaCarrierSHA256:record.carrier.sha256,nativeOriginalCriteriaCarrierBase64:record.carrier.bodyBase64,nativeOriginalCriteriaCarrierFileName:file.fileName,
    nativeRawModel:structuredClone(raw),nativeClosingRawModel:structuredClone(closing.records[index].envelope.data),nativeRawEnvelope:structuredClone(record.envelope),nativeClosingRawEnvelope:structuredClone(closing.records[index].envelope),nativeListingRecord:structuredClone(record.row),
    postingDate:null,closingDate:null,nativePublicationSchedule:structuredClone(raw.postChannelConfiguration),sourcePublicationInstantUnresolved:true,sourcePublicationTimeZoneUnresolved:true,sourceNativeCriteriaConflict:reviewed.nativeCriteriaConflict,
    nativeApplicationDeclarations:{shortURL:raw.shortURL,longURL:raw.longURL},activeApplyVerified:false,applicationVisited:false,applicationFormSubmitted:false,applicationVerified:false,
    criteriaComplete:true,sourceDetailComplete:false,sourceNativeDataOnly:true,sourceRenderedDetailComplete:false,renderedUIQualified:false,sourceClientQualified:false,sourceCSSQualified:false,sourceTransportContractQualified:true,nativeAccountDeclarationBound:true,nativeRoleClosingReconciled:true,
    sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:observedAt}]
  })
  const observations={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.count,observedVacancyCount:opening.count,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  const evidence={...observations,scope:'finite-native-data-only',openingNativeRows:opening.count,closingNativeRows:closing.count,fullNativeModelsObserved:opening.records.length,fullRawCriteriaRecords:nativePayload.length,unknownWorkCountryRecords:nativePayload.length,nativePayload,heldRecords,openingNativeModels:opening.records.map(record=>structuredClone(record.envelope)),closingNativeModels:closing.records.map(record=>structuredClone(record.envelope)),openingNativePages:opening.pages,closingNativePages:closing.pages,configuredRawBoardComplete:heldRecords.length===0,closingReconciled:true,completeInventory:false,lifecycleCleanupAllowed:false,renderedUIQualified:false,applicationVerified:false,publisherProgramsExecuted:false,applicationInteractions:0,physicalRequests:null,receipts,requestAttempts:requests,originalDecodedBytes:totalBytes,verifiedAt:observedAt,readCarrierComparison:'Only exact published read-signature/expiry leaves are normalized; all original model URLs and original complete carrier bytes are retained. Every other field and complete carrier hash is reconciled.'}
  for(const callback of[options.onNativeEvidence,options.onAudit])if(typeof callback==='function')await bounded(()=>callback(structuredClone(evidence)),signal)
  if(typeof options.onRecords==='function')await bounded(()=>options.onRecords(structuredClone(nativePayload)),signal)
  signal.throwIfAborted()
  const jobs=attachSourceObservationEvidence(cap===null?nativePayload:nativePayload.slice(0,cap),observations)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.frameURL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'full-native-data-only;work-country-publication-instant-rendering-application-and-company-scope-unqualified'})
  signal.throwIfAborted();return jobs
 }catch(error){
  if(ownedErrors.has(error))Object.defineProperty(error,'nativeCollectionEvidence',{value:{source:SOURCE,openingNativeRows:opening?.count??null,openingNativeModels:opening?.records?.map(record=>record.envelope)??[],completeInventory:false,lifecycleCleanupAllowed:false,receipts,requestAttempts:requests},configurable:true})
  throw error
 }finally{clearTimeout(timer);if(!controller.signal.aborted)controller.abort()}
}
