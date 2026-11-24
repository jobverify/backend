import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {selectCurrentTwilioContract} from './currentNative20261115.js'

const SOURCE='twilio',HOME='https://www.twilio.com/en-us/careers',BOARD='https://jobs.twilio.com/careers'
const ENTRY='https://jobs.twilio.com/gen/js/pcsxPwa.ceaedf5d9f9dac50.js',ROLE_RENDERER='https://jobs.twilio.com/gen/js/12480.6ba506c902de6e73.js'
const HISTORICAL_ENTRY='https://jobs.twilio.com/gen/js/pcsxPwa.6c903be3a68c07ae.js',HISTORICAL_ROLE_RENDERER='https://jobs.twilio.com/gen/js/12480.612f8bee165df945.js'
const NOVEMBER21_ENTRY='https://jobs.twilio.com/gen/js/pcsxPwa.068e7dc3d3bb906d.js'
const sha=value=>createHash('sha256').update(value).digest('hex')
const problem=(message,kind='coverage_gap')=>Object.assign(Error('Twilio current native: '+message),{softFailure:true,abortRetries:true,failureKind:kind,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const permitted=url=>url===HOME||url===BOARD||url===ENTRY||url===ROLE_RENDERER||url===HISTORICAL_ENTRY||url===HISTORICAL_ROLE_RENDERER||url===NOVEMBER21_ENTRY
 ||/^https:\/\/jobs\.twilio\.com\/api\/pcsx\/search\?domain=twilio\.com&query=&location=India&start=(?:0|[1-9]\d*)&$/.test(url)
 ||/^https:\/\/jobs\.twilio\.com\/api\/pcsx\/position_details\?position_id=[1-9]\d*&domain=twilio\.com&hl=en$/.test(url)
 ||/^https:\/\/jobs\.twilio\.com\/careers\/job\/[1-9]\d*$/.test(url)

export async function runCurrentTwilio(options={}){
 need(!(options.fetchPage||options.fetchJson||options.fetchText)||options.fetchImpl,'current native HTTP metadata and raw response text required; body-only overrides cannot qualify roles')
 const maxRequests=options.maxRequests??48,maxPages=options.maxPages??8,maxDetails=options.maxDetails??20,sourceTimeoutMs=options.sourceTimeoutMs??90000
 for(const [name,value,max]of[['maxRequests',maxRequests,48],['maxPages',maxPages,8],['maxDetails',maxDetails,20],['sourceTimeoutMs',sourceTimeoutMs,90000]])need(Number.isSafeInteger(value)&&value>0&&value<=max,'invalid existing native limit '+name)
 const requestIntervalMs=options.requestIntervalMs??500
 need(Number.isSafeInteger(requestIntervalMs)&&requestIntervalMs>=0&&requestIntervalMs<=60000&&(requestIntervalMs>=500||options.fetchImpl),'invalid native public pacing')
 const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 options.signal?.throwIfAborted()
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded','network_or_timeout')),sourceTimeoutMs)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const fetchImpl=options.fetchImpl||globalThis.fetch,allowed=new Set([HOME,BOARD]),receipts=[],nativeRows=[],inventories=[],holds=[],nativeJobs=[],lastRead=new Map()
 const observedIDs=new Set();let totalBytes=0,requests=0
 const audit=()=>({source:SOURCE,observedAt,recordKind:'vacancy-rows',observedRecordCount:observedIDs.size,observedVacancyCount:observedIDs.size,
  nativeRows,nativeInventoryReads:inventories,holds,returnedIndiaJobs:nativeJobs.length,publicRequestReceipts:receipts,
  sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
  sourceRenderedApplicationQualified:false,applicationSubmitted:false,reason:'current-own-Twilio-native-models-and-original-published-criteria-rechecked;company-inventory-scope-unverified'})
 const read=async(url,mime)=>{
  signal.throwIfAborted();need(permitted(url)&&allowed.has(url),'unbound public native endpoint');need(++requests<=maxRequests,'native request count bound')
  const origin=new URL(url).origin,wait=Math.max(0,requestIntervalMs-(performance.now()-(lastRead.get(origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});lastRead.set(origin,performance.now())
  const nativeFetch=async(value,init)=>{
   const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit',headers:{Accept:mime==='json'?'application/json':mime==='javascript'?'application/javascript':'text/html','User-Agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}})
   let bytes=0
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();return{
    async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native byte chunk type');need(part.value.byteLength<=4000000-bytes&&part.value.byteLength<=24000000-totalBytes,'native streaming byte bound');bytes+=part.value.byteLength;totalBytes+=part.value.byteLength}return part},
    cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }
  const packet=await boundedDeclaredPublicRead(url,{fetchImpl:nativeFetch,signal,timeoutMs:15000,overflowError:problem('native streaming byte bound')})
  const bytes=Buffer.from(packet.bodyBase64,'base64'),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  receipts.push({url,finalURL:packet.url,status:packet.status,headers:packet.headers,bytes:bytes.length,sha256:sha(bytes),body:text,checkedAt:new Date().toISOString()})
  if(packet.status!==200)throw problem('native HTTP '+packet.status,[401,403,429,451].includes(packet.status)?'blocked_or_access_denied':'upstream_unavailable')
  need(packet.url===url,'native final URL changed')
  const pattern=mime==='json'?/^application\/json\b/i:mime==='javascript'?/^(?:application|text)\/javascript\b/i:/^text\/html\b/i
  need(pattern.test(packet.headers['content-type']||''),'native response MIME changed')
  return{url,status:packet.status,html:text,text}
 }
 const permit=url=>{need(permitted(url),'unreviewed native public endpoint');allowed.add(url);return true}
 try{
  const official=await read(HOME,'html'),board=await read(BOARD,'html'),{descriptor,readNative}=selectCurrentTwilioContract(board,{source:SOURCE})
  need(descriptor,'current own native descriptor unavailable')
  await readNative(descriptor,{
   readPage:url=>read(url,'html'),readRenderer:url=>read(url,'javascript'),readNativeJson:url=>read(url,'json'),permit,
   matchingEmployer:name=>name==='Twilio',addJob:value=>nativeJobs.push(value),
   recordRead:row=>{need(Number.isSafeInteger(row.id)&&row.id>0,'native observation ID unavailable');if(!observedIDs.has(row.id)){observedIDs.add(row.id);nativeRows.push(structuredClone(row))}},
   inventoryRead:value=>inventories.push(structuredClone(value)),unresolved:reason=>holds.push({reason}),
   maxPages,maxDetails,remainingRequests:()=>maxRequests-requests,now:observedAt,
   officialBinding:{officialURL:HOME,declaredURL:BOARD,page:official},recheckOfficialBinding:()=>read(HOME,'html')})
  signal.throwIfAborted()
  const jobs=nativeJobs.map(native=>({source:SOURCE,company:'Twilio',companyCareerPage:HOME,companyDomain:'twilio.com',atsPlatform:'eightfold-pcsx',
   jobId:String(native.id),requisitionId:native.record.originalNativeRole.displayJobId,title:native.title,
   country:'India',city:null,location:native.location,locations:structuredClone(native.record.originalNativeRole.locations),
   applyUrl:native.url,sourceUrl:native.url,sourceURL:native.url,link:native.url,
   jobDescription:native.description,sourceDescription:native.description,nativeSourceRecord:native.record,
   nativeHiringOrganization:native.employer,nativeLegalEmployer:null,nativeEmployerBinding:native.employerBinding,
   postingDate:null,postedAt:null,nativePostingDate:null,closingDate:null,firstEverPostedAt:null,sourcePublicationDateUnavailable:true,
   employmentType:native.employmentType,remoteStatus:null,sourceRemoteStatusUnresolved:true,
   sourceDetailComplete:true,sourceNativeCriteriaComplete:true,sourceNativeClosingReconciled:true,
   sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,applicationVisited:false,scrapedAt:new Date().toISOString()}))
  const evidence=audit();attachSourceObservationEvidence(jobs,evidence);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  await options.onAudit?.(structuredClone(evidence))
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:receipts.length,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:evidence.reason})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error)){
   try{Object.assign(error,{softFailure:true,abortRetries:true,failureKind:error.failureKind||'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceAudit:audit()})}catch{}
  }
  throw error
 }finally{clearTimeout(timer)}
}
