import {setTimeout as delay} from 'node:timers/promises'
import {types} from 'node:util'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {inspectAshbyRendererManifest,certifyAshbyRendererSource} from '../../scraper-support/utils/ashbyRendererSourceCertificate20261111.js'
import {HOME,BOARD,API,header,securitySnapshot,qualifySecurityProfile,readHome,readNative,readFeed,readBoard,readRole} from './currentProgrammeData.js'
import {VERSION,MANIFEST,ENTRY,sha,need,failure,verifyRenderer} from './currentProgrammeRenderer.js'

const ENTITY_CAP=4*1024*1024,ASSET_CAP=6*1024*1024,TOTAL_CAP=24*1024*1024
const bounded=(value,fallback,ceiling,name)=>{
 const result=value??fallback
 if(!Number.isSafeInteger(result)||result<1||result>ceiling)throw RangeError('Invalid Datafold '+name+' bound')
 return result
}
const limits=options=>({maxRequests:bounded(options.maxRequests,28,28,'request'),maxDetails:bounded(options.maxDetails,6,6,'detail'),
 sourceTimeoutMs:bounded(options.sourceTimeoutMs,180000,180000,'source deadline'),requestTimeoutMs:bounded(options.requestTimeoutMs,20000,20000,'request deadline')})
const abortable=(operation,signal)=>new Promise((resolve,reject)=>{
 let settled=false
 const abort=()=>{if(!settled){settled=true;reject(signal.reason)}}
 signal.addEventListener('abort',abort,{once:true})
 if(signal.aborted){abort();return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>{
  if(settled)return;settled=true;signal.removeEventListener('abort',abort)
  if(signal.aborted)reject(signal.reason);else resolve(value)
 },error=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(error)})
})
const headersObject=value=>{
 need(value&&typeof value==='object','Original response headers unavailable')
 const entries=typeof value.entries==='function'?[...value.entries()]:Object.entries(value)
 need(entries.every(([key,part])=>typeof key==='string'&&typeof part==='string'),'Original response headers changed shape')
 const result={}
 for(const[key,part]of entries){const lower=key.toLowerCase();need(!Object.hasOwn(result,lower),'Ambiguous original response header');result[lower]=part}
 return result
}
const javascriptKind=kind=>['entry','recorder','profiler'].includes(kind)
const certificatePacket=packet=>({requestedURL:packet.requestedURL,finalURL:packet.finalURL,status:packet.status,
 headers:packet.headers,body:Buffer.from(packet.text,'utf8')})

// This contract releases no positive jobs. It proves only the finite current
// corporate-declared programme, retaining the original application gaps and
// forbidding company-global lifecycle cleanup.
export async function readCurrentDatafoldProgramme(options={}){
 const {maxRequests,maxDetails,sourceTimeoutMs,requestTimeoutMs}=limits(options)
 if(typeof options.readPage!=='function')throw TypeError('A bounded original raw response reader is required')
 options.signal?.throwIfAborted()
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof now==='string'&&Number.isFinite(Date.parse(now)),'Invalid native observation date')
 const started=performance.now()
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const timer=setTimeout(()=>controller.abort(new DOMException('Datafold source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 const check=()=>{
  if(performance.now()-started>=sourceTimeoutMs&&!signal.aborted)controller.abort(new DOMException('Datafold source deadline exceeded','TimeoutError'))
  signal.throwIfAborted()
 }
 const parse=(operation,...args)=>{check();const value=operation(...args);check();return value}
 const sourceProof=(operation,input)=>parse(value=>{
  try{return operation(value)}catch(error){
   if(error?.code!=='ASHBY_SOURCE_CERTIFICATE_HOLD')throw error
   const held=failure('Renderer source certificate: '+error.reason)
   held.code=error.code;held.cause=error;throw held
  }
 },input)
 const allowed=new Set([HOME,BOARD,API,MANIFEST,ENTRY]),receipts=[],roles=[]
 const audit={source:'datafold',checkedAt:now,receipts,roles,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  companyGlobalScopeQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,
  publisherLegalNameRegistryVerified:false,applicationVisited:false,screeningCriteriaAcquired:false,currentDeclaredSourceProgramComplete:false}
 let total=0
 const read=async(url,kind,phase)=>{
  check()
  need(allowed.has(url)&&receipts.length<maxRequests,'Native public URL/request bound reached')
  const receipt={requestedURL:url,phase,kind,method:'GET',requestedAt:new Date().toISOString()};receipts.push(receipt)
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(requestTimeoutMs)])
  const requestStarted=performance.now()
  const page=await abortable(()=>options.readPage(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',signal:requestSignal}),requestSignal)
  check()
  if(performance.now()-requestStarted>=requestTimeoutMs)throw new DOMException('Datafold request deadline exceeded','TimeoutError')
  need(page?.url===url,'Original response URL identity missing or changed')
  Object.assign(receipt,{finalURL:page.url,status:page.status,completedAt:new Date().toISOString()})
  if(page.status!==200){
   const error=failure('Native public HTTP '+page.status);error.status=page.status
   if([401,403,429,451].includes(page.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true})
   else if(page.status>=500)Object.assign(error,{failureKind:'network_or_timeout',upstreamOutage:true})
   throw error
  }
  const headers=headersObject(page.headers),contentType=header({headers},'content-type'),cap=javascriptKind(kind)?ASSET_CAP:ENTITY_CAP
  const mime=javascriptKind(kind)?/^(?:text|application)\/javascript(?:;|$)/i:kind==='css'?/^text\/css(?:;|$)/i:
   ['feed','manifest'].includes(kind)?/^application\/json(?:;|$)/i:/^text\/html(?:;|$)/i
  need(mime.test(contentType||''),'Unexpected original response MIME')
  need(/^[^;\s]+(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType),'Unreviewed or ambiguous declared charset/encoding representation')
  need(typeof page.text==='string'&&Buffer.byteLength(page.text)<=cap,'Missing/oversized original raw response text')
  const size=Buffer.byteLength(page.text);total+=size;need(total<=TOTAL_CAP,'Native aggregate byte bound reached')
  Object.assign(receipt,{headers,contentType,bodyBytes:size,bodySHA256:sha(page.text),bodyText:page.text})
  const packet={url,requestedURL:url,finalURL:page.url,status:page.status,text:page.text,headers,hash:receipt.bodySHA256,size}
  if(!['board','role'].includes(kind))parse(qualifySecurityProfile,packet,kind)
  receipt.securityHeaders=securitySnapshot(packet);check();return packet
 }
 const unchanged=(opening,closing,label)=>{
  need(opening.hash===closing.hash,label+' whole original body changed')
  // Date/Age/cache headers may advance. CSP binds recruitment-carrier authority
  // and must remain exact in this initial no-exception comparison model.
  need(JSON.stringify(securitySnapshot(opening))===JSON.stringify(securitySnapshot(closing)),label+' original enforced security headers changed')
  check()
 }
 try{
  const corporate=await read(HOME,'corporate','opening');audit.corporateProgramme=parse(readHome,corporate)
  const boardPacket=await read(BOARD,'board','opening'),native=parse(readNative,boardPacket)
  const declaration=native.rendererSourceDeclaration,sourceCertificateRequired=declaration.version!==VERSION
  const sameDeclaration=other=>need(other.rendererSourceDeclaration.version===declaration.version
   &&other.rendererSourceDeclaration.manifestURL===declaration.manifestURL,'Native active renderer/bootstrap changed during transaction')
  const feedPacket=await read(API,'feed','opening'),feed=parse(readFeed,feedPacket),board=parse(readBoard,native,feed)
  Object.assign(audit,{nativePayload:feed,originalNativeFeedJSON:feedPacket.text,originalNativeFeedSHA256:feedPacket.hash,
   nativeReportedTotal:feed.jobs.length,observedRecordCount:feed.jobs.length,observedVacancyCount:feed.jobs.length,
   originalNativeBoardJSON:native.rawJSON,originalNativeBoard:board,originalNativeOrganization:native.model.organization})
  need(feed.jobs.length<=maxDetails,'Every current native role must fit the detail bound')
  need(maxRequests-receipts.length>=2*feed.jobs.length+(sourceCertificateRequired?13:7),
   'Reserve every opening role and all corporate/native/renderer closings')
  let manifest,entry,sourcePackets,resourceDeclarations
  if(sourceCertificateRequired){
   allowed.add(declaration.manifestURL)
   manifest=await read(declaration.manifestURL,'manifest','opening')
   resourceDeclarations=sourceProof(inspectAshbyRendererManifest,{declaration,manifest:certificatePacket(manifest)}).resources
   sourcePackets={manifest}
   for(const kind of['entry','recorder','profiler','css']){
    allowed.add(resourceDeclarations[kind].url)
    sourcePackets[kind]=await read(resourceDeclarations[kind].url,kind,'opening')
   }
   audit.renderer={...sourceProof(certifyAshbyRendererSource,{declaration,
    packets:Object.fromEntries(Object.entries(sourcePackets).map(([kind,packet])=>[kind,certificatePacket(packet)]))}),
    version:declaration.version,manifestURL:declaration.manifestURL,entryURL:resourceDeclarations.entry.url,
    stylesheetBytesAcquired:true,untrustedJavaScriptExecuted:false}
  }else{
   // Preserve the separately reviewed 07dd compatibility route and its original
   // fixture/limits. It does not claim the new five-resource source certificate.
   manifest=await read(MANIFEST,'manifest','opening');entry=await read(ENTRY,'entry','opening')
   audit.renderer=parse(verifyRenderer,manifest,entry)
  }
  audit.rendererSourceDeclaration=declaration
  audit.completeSourceCertificateRequired=sourceCertificateRequired
  const openings=[]
  for(const record of feed.jobs){
   allowed.add(record.jobUrl)
   const packet=await read(record.jobUrl,'role','opening'),own=parse(readNative,packet,true)
   parse(sameDeclaration,own)
   roles.push(parse(readRole,own,record,board.jobPostings.find(j=>j.id===record.id),board,now));openings.push(packet)
  }
  need(total*2<=TOTAL_CAP,'All acquired openings must reserve complete closing byte budget')
  audit.allOpeningRolesBeforeClosingRoles=true
  for(const[index,record]of feed.jobs.entries()){
   const packet=await read(record.jobUrl,'role','closing'),own=parse(readNative,packet,true)
   parse(sameDeclaration,own)
   parse(readRole,own,record,board.jobPostings.find(j=>j.id===record.id),board,now)
   unchanged(openings[index],packet,'Own role')
   Object.assign(roles[index],{closingOwnHTMLSHA256:packet.hash,closingWholeOwnRoleUnchanged:true})
  }
  const closingBoard=await read(BOARD,'board','closing'),closingNative=parse(readNative,closingBoard)
  parse(sameDeclaration,closingNative);parse(readBoard,closingNative,feed);unchanged(boardPacket,closingBoard,'Native board')
  const closingFeed=await read(API,'feed','closing');parse(readFeed,closingFeed);unchanged(feedPacket,closingFeed,'Native full feed')
  const closingCorporate=await read(HOME,'corporate','closing');parse(readHome,closingCorporate);unchanged(corporate,closingCorporate,'Corporate programme')
  if(sourceCertificateRequired){
   const closingManifest=await read(declaration.manifestURL,'manifest','closing')
   const closingDeclarations=sourceProof(inspectAshbyRendererManifest,{declaration,manifest:certificatePacket(closingManifest)}).resources
   need(JSON.stringify(closingDeclarations)===JSON.stringify(resourceDeclarations),'Declared current renderer resources changed')
   unchanged(manifest,closingManifest,'Manifest')
   const closingPackets={manifest:closingManifest}
   for(const kind of['entry','recorder','profiler','css'])closingPackets[kind]=await read(resourceDeclarations[kind].url,kind,'closing')
   audit.closingRendererSourceCertificate=sourceProof(certifyAshbyRendererSource,{declaration,
    packets:Object.fromEntries(Object.entries(closingPackets).map(([kind,packet])=>[kind,certificatePacket(packet)]))})
   for(const kind of['entry','recorder','profiler','css'])unchanged(sourcePackets[kind],closingPackets[kind],'Renderer '+kind)
   audit.allDeclaredSourceResourcesRechecked=true
  }else{
   const closingManifest=await read(MANIFEST,'manifest','closing'),closingEntry=await read(ENTRY,'entry','closing')
   parse(verifyRenderer,closingManifest,closingEntry);unchanged(manifest,closingManifest,'Manifest');unchanged(entry,closingEntry,'Renderer')
  }
  check()
  Object.assign(audit,{requests:receipts.length,totalDecodedBytes:total,currentDeclaredSourceProgramComplete:true,
   nativeIndiaCount:0,nativeProgrammeIsEmpty:feed.jobs.length===0,allOwnRolesRechecked:true,wholeNativeBoardRechecked:true,
   wholePublicFeedRechecked:true,currentCorporateHandoffRechecked:true,currentRendererRechecked:true,
   noNonceComparisonExceptionApplied:true,enforcedSecurityProfilesQualified:true,sourceMonotonicDeadlineChecked:true,
   sourceScope:'current-corporate-declared-Datafold-Ashby-programme-only',
   completenessLimit:'Entire current native published programme and original criteria; application/survey/automated legal fallback fields are null and unacquired. Company-global inventory and legal-entity verification remain unknown.'})
  if(options.onAudit)await abortable(()=>options.onAudit(structuredClone(audit)),signal)
  check()
  const jobs=[]
  attachSourceObservationEvidence(jobs,{source:'datafold',recordKind:'vacancy-rows',observedRecordCount:feed.jobs.length,
   observedVacancyCount:feed.jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const result=attachInventoryEvidence(jobs,{status:'complete-inventory',surface:BOARD,firstParty:true,listingComplete:true,lifecycleCleanupAllowed:false,
   pagesFetched:receipts.length,reportedTotal:feed.jobs.length,indiaFacetCount:0,verifiedAt:now,
   reason:'Complete current corporate-declared Datafold Ashby programme: every native role, explicit work/applicant countries and full original published descriptions/supplements, reviewed current renderer, and all closing reads reconcile. Application screening and company-global inventory remain unqualified; lifecycle cleanup forbidden.'})
  check();return result
 }catch(error){
  Object.assign(audit,{requests:receipts.length,totalDecodedBytes:total,currentDeclaredSourceProgramComplete:false})
  try{Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})}catch{}
  throw error
 }finally{clearTimeout(timer);controller.abort()}
}

export async function runCurrentDatafoldProgramme(options={}){
 const {sourceTimeoutMs,requestTimeoutMs}=limits(options),interval=options.requestIntervalMs??500
 if(!Number.isSafeInteger(interval)||interval<0||interval>5000)throw RangeError('Invalid Datafold pacing')
 need(typeof options.fetchImpl==='function'||typeof options.fetchPage==='function'
  ||!['fetchJson','fetchText'].some(name=>typeof options[name]==='function'),'Parsed-only hooks cannot replace original raw transport')
 options.signal?.throwIfAborted()
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const timer=setTimeout(()=>controller.abort(new DOMException('Datafold source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 const typedArray=Object.getPrototypeOf(Uint8Array.prototype),byteLength=Object.getOwnPropertyDescriptor(typedArray,'byteLength').get
 let streamTotal=0,next=0
 const fetcher=async(url,init)=>{
  // URL admission is performed by the exact declaration-derived set in read().
  // This classification supplies only Accept and stream caps, never a new URL.
  const kind=url.endsWith('.js')?'entry':url.endsWith('.css')?'css':url===API||url.endsWith('/.vite/manifest.json')?'json':'html'
  const request={...init,cache:'no-store',credentials:'omit',headers:{...init.headers,
   Accept:kind==='entry'?'application/javascript':kind==='css'?'text/css':kind==='json'?'application/json':'text/html'}}
  let response
  if(options.fetchImpl)response=await options.fetchImpl(url,request)
  else if(options.fetchPage){
   const page=await options.fetchPage(url,request),text=page?.text??page?.html??page?.body
   need(typeof text==='string','Injected original raw text unavailable (parsed-only hooks are unsupported)')
   const urls=['url','finalURL','finalUrl'].filter(key=>Object.hasOwn(page,key))
   need(urls.length>0&&urls.every(key=>page[key]===url),'Injected original URL provenance missing or changed')
   response=new Response(text,{status:page.status,headers:page.headers});Object.defineProperty(response,'url',{value:page[urls[0]]})
  }else response=await fetch(url,request)
  const cap=kind==='entry'?ASSET_CAP:ENTITY_CAP;let size=0
  const body=response.body===null?null:response.body.pipeThrough(new TransformStream({transform(chunk,sink){
   need(types.isUint8Array(chunk),'Original response chunk type changed')
   const length=byteLength.call(chunk);size+=length;streamTotal+=length
   need(size<=cap&&streamTotal<=TOTAL_CAP,'Original response/aggregate stream byte budget exceeded');sink.enqueue(chunk)
  }}))
  return {url:response.url,status:response.status,headers:response.headers,body}
 }
 try{
  return await readCurrentDatafoldProgramme({...options,signal,readPage:async(url)=>{
   if(next>performance.now())await delay(next-performance.now(),undefined,{signal})
   signal.throwIfAborted();next=performance.now()+interval
   const page=await boundedDeclaredPublicGet(url,{fetchImpl:fetcher,signal,timeoutMs:requestTimeoutMs,
    overflowError:failure('Original native byte bound exceeded')})
   return {url:page.url,status:page.status,headers:page.headers,
    text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(page.bodyBase64,'base64'))}
  }})
 }finally{clearTimeout(timer);controller.abort()}
}
