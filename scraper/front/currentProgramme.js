import {setTimeout as delay} from 'node:timers/promises'
import {types,isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readFrontCorporate,readFrontFeed,readFrontApi,reconcileFrontServerProgramme} from './currentProgrammeData.js'
import {CORPORATE,FEED,API,sha,failure,need,originalHeaders,readFrontNativeHtml} from './currentProgrammeRenderer.js'

const plain=value=>value&&typeof value==='object'&&!types.isProxy(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))
const own=(value,key,required=true)=>{
  need(plain(value),'transport','Expected original plain own-data transport metadata')
  const descriptor=Object.getOwnPropertyDescriptor(value,key)
  need(!descriptor||Object.hasOwn(descriptor,'value'),'transport','Original metadata accessor is unsupported: '+key)
  need(!required||descriptor,'transport','Original metadata unavailable: '+key)
  return descriptor?.value
}
const cap=(value,fallback,max,label)=>{value??=fallback;need(Number.isSafeInteger(value)&&value>0&&value<=max,'bounds','Invalid '+label+' bound');return value}
const bounds=options=>({requests:cap(own(options,'maxRequests',false),18,18,'request'),entity:cap(own(options,'maxResponseBytes',false),4194304,4194304,'entity byte'),
  aggregate:cap(own(options,'maxAggregateBytes',false),25165824,25165824,'aggregate byte'),source:cap(own(options,'sourceTimeoutMs',false),90000,120000,'source deadline'),
  request:cap(own(options,'requestTimeoutMs',false),20000,20000,'request deadline')})
const typed=Object.getPrototypeOf(Uint8Array.prototype)
const byteLength=Object.getOwnPropertyDescriptor(typed,'byteLength').get
const byteOffset=Object.getOwnPropertyDescriptor(typed,'byteOffset').get
const arrayBuffer=Object.getOwnPropertyDescriptor(typed,'buffer').get
const typedSet=typed.set
const entityLength=value=>{
  need(types.isUint8Array(value)&&!types.isProxy(value),'body','Original entity must be native bytes')
  need(!types.isSharedArrayBuffer(arrayBuffer.call(value)),'body','Shared mutable entity is unsupported')
  return byteLength.call(value)
}
const snapshot=(value,maximum)=>{
  const size=entityLength(value);need(size<=maximum,'body','Entity/aggregate byte bound exceeded')
  const copy=new Uint8Array(size);typedSet.call(copy,value,0);return Buffer.from(copy.buffer)
}
const prefix=(value,maximum)=>{
  const size=Math.min(entityLength(value),maximum),copy=new Uint8Array(size)
  typedSet.call(copy,new Uint8Array(arrayBuffer.call(value),byteOffset.call(value),size),0)
  return Buffer.from(copy.buffer)
}
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const wait=(operation,signal,disposeLate)=>new Promise((resolve,reject)=>{
  let settled=false
  const finish=(callback,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);callback(value)}
  const abort=()=>finish(reject,signal.reason)
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}
  Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>{
    if(settled){if(disposeLate)ignore(()=>disposeLate(value));return}finish(resolve,value)
  },error=>finish(reject,error))
})
const arrayValues=(value,label)=>{
  need(Array.isArray(value)&&!types.isProxy(value)&&Object.getPrototypeOf(value)===Array.prototype,'headers','Original '+label+' must be a plain array')
  const size=Object.getOwnPropertyDescriptor(value,'length')?.value
  need(Number.isSafeInteger(size)&&size<=256,'headers','Original '+label+' exceeds supported bounds')
  const result=[]
  for(let index=0;index<size;index++){
    const descriptor=Object.getOwnPropertyDescriptor(value,String(index))
    need(descriptor&&Object.hasOwn(descriptor,'value'),'headers','Original '+label+' contains an accessor or hole');result.push(descriptor.value)
  }
  need(Reflect.ownKeys(value).length===size+1,'headers','Original '+label+' has unsupported extra fields')
  return result
}
const headerViews=page=>{
  const input=own(page,'headers');need(plain(input),'headers','Original HTTP headers unavailable')
  const names=Reflect.ownKeys(input);need(names.length<=256,'headers','Original HTTP headers exceed supported bounds')
  const headers=Object.create(null)
  for(const name of names){
    const descriptor=Object.getOwnPropertyDescriptor(input,name)
    need(typeof name==='string'&&Object.hasOwn(descriptor,'value')&&typeof descriptor.value==='string'
      &&/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name)&&!['__proto__','constructor','prototype'].includes(name.toLowerCase())
      &&descriptor.value.length<=65536&&!/[\r\n\0]/.test(descriptor.value),'headers','Unreviewed original HTTP header data')
    headers[name]=descriptor.value
  }
  const headerEntries=arrayValues(own(page,'headerEntries'),'header entries').map(pair=>{
    const values=arrayValues(pair,'header pair');need(values.length===2&&values.every(value=>typeof value==='string'),'headers','Original HTTP entry must retain two strings');return values
  })
  return{headers:{...headers},headerEntries}
}
const policyNames=['content-security-policy','content-security-policy-report-only','x-content-type-options','cross-origin-embedder-policy',
  'cross-origin-opener-policy','cross-origin-resource-policy','permissions-policy','document-policy','x-frame-options']
const corsNames=['access-control-allow-origin','access-control-allow-credentials','access-control-allow-methods','access-control-allow-headers','access-control-expose-headers','access-control-max-age']
const controls=new Set(['refresh','location','content-location','content-range','www-authenticate','proxy-authenticate','authentication-info','proxy-authentication-info','cf-mitigated','cf-chl-out','cf-chl-bypass','x-captcha','x-captcha-required','x-challenge'])
const challenge=name=>name==='cf-mitigated'||name.startsWith('cf-chl-')||/^x-(?:captcha|challenge)(?:-|$)/.test(name)
function security(headers,url){
  const corporate=url===CORPORATE,feed=url===FEED,api=url===API,native=!corporate&&!feed&&!api
  for(const name of Object.keys(headers)){
    need(!controls.has(name)&&!challenge(name),'security','Unreviewed navigation/authentication/challenge header: '+name)
    need(!/^access-control-/.test(name)||corsNames.includes(name),'security','Unreviewed CORS policy field')
    need(!/(?:content-security-policy|permissions-policy|document-policy|cross-origin-(?:embedder|opener|resource)-policy)/.test(name)||policyNames.includes(name),
      'security','Unreviewed security policy field')
  }
  need((headers['content-disposition']??null)===(corporate?'inline':null),'security','Unreviewed source-channel disposition')
  const expectedOrigin=corporate||api?'*':null
  for(const name of corsNames)need((headers[name]??null)===(name==='access-control-allow-origin'?expectedOrigin:null),'security','Unreviewed source-channel CORS policy')
  need((headers['referrer-policy']??null)===(corporate||feed?'origin-when-cross-origin':'same-origin'),'security','Unreviewed source-channel referrer policy')
  need((headers['strict-transport-security']??null)===(corporate||feed?'max-age=63072000; includeSubDomains; preload':'max-age=31536000; includeSubDomains; preload'),
    'security','Unreviewed source-channel transport policy')
  const policy=Object.fromEntries(policyNames.map(name=>[name,headers[name]??null]))
  if(!native)need(sha(JSON.stringify(policy))===(api?'3e0f54da8f3b1357e0ea055b959391c0a533b0a66fff5c5758d04bb66b4d2973':'31021b75f5331efc443c4681c963ba546bae3ca90927ac8cc5635c0c0a877f3b'),
    'security','Unreviewed original source-channel policy profile')
  return{original:{...policy,...Object.fromEntries([...corsNames,'referrer-policy','strict-transport-security','content-disposition','content-type','content-encoding'].map(name=>[name,headers[name]??null]))}}
}
const failureField=(error,key)=>error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptor(error,key)?.value:undefined
const extensibleError=error=>{
  if(error&&typeof error==='object'&&!types.isProxy(error)&&Object.isExtensible(error))return error
  const result=Error(typeof error==='string'?error:'Native transport operation failed',{cause:error})
  result.name=failureField(error,'name')??'Error';return result
}
const responseFailures=new WeakMap()
// Only this module's fetch adapter can publish progress. The outer abort race
// may settle before the adapter catch; acquired evidence must already exist.
const responseProgress=new WeakMap()

export async function readCurrentFrontProgramme(options={}){
  need(plain(options),'options','Original controller options must be plain own data')
  const parentSignal=own(options,'signal',false);parentSignal?.throwIfAborted()
  const bound=bounds(options),readPage=own(options,'readPage',false),onAudit=own(options,'onAudit',false)
  need(bound.requests>=8,'bounds','Complete minimum opening/closing request capacity unavailable')
  need(typeof readPage==='function'&&(onAudit===undefined||typeof onAudit==='function'),'options','Bounded original transport/observer required')
  for(const key of ['skipBoard','board','sourceInput','profile'])need(!Object.hasOwn(options,key),'options','No caller-supplied source authority or profile bypass')
  const started=performance.now(),controller=new AbortController(),signal=parentSignal?AbortSignal.any([parentSignal,controller.signal]):controller.signal
  const expire=()=>controller.abort(new DOMException('Front source deadline exceeded','TimeoutError'))
  const timer=setTimeout(expire,bound.source)
  const check=()=>{if(performance.now()-started>=bound.source&&!controller.signal.aborted)expire();signal.throwIfAborted()}
  const audit={source:'front',archiveNativeCollectionEvidence:true,checkedAt:new Date().toISOString(),requests:0,nativeProgrammeRequests:0,rawPages:[],nativePayload:null,nativeRecords:null,
    recordKind:'vacancy-rows',observedRecordCount:null,observedVacancyCount:null,sourceScopeComplete:false,companyGlobalScopeQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
    sourceBodiesQualified:false,rendererConsumptionQualified:false,boardAcquired:false,fullRenderedCriteriaQualified:false,applicationVisited:false,screeningCriteriaAcquired:false,applicantEligibilityQualified:false,legalEmployerQualified:false,
    browserExecutionQualified:false,browserCORSExecutionQualified:false,corporateHook82515Qualified:false,publisherScriptsExecuted:false,currentDeclaredSourceProgramComplete:false,currentTransactionQualified:false,
    sourceScope:'Only exact current corporate SSR/first-party feed/named-account public API and every corresponding full own server LD/raw boot publication; no native board,renderer/UI/application/global inventory claim.',
    countryQualificationScope:'finite-server-published-work-country',countSemantics:'All observed native vacancies,not an independently reported server/company total.',
    requestCountScope:'Exactly this native6+2N transaction; earlier primary/discovery retries and probes remain separately unmeasured.',totalPublicRequests:null,activeDependencyDeclarations:[]}
  let aggregate=0,closingBytes=0,openingPlan=[CORPORATE,FEED,API,null]
  const opened=new Map(),allowed=new Set([CORPORATE,FEED,API])
  const read=async(url,phase,isOpening)=>{
    check();need(allowed.has(url),'route','Undeclared source route')
    const remainingOpening=isOpening?openingPlan.length-opened.size:0
    const remainingClosing=opened.size
    need(audit.requests+(isOpening?remainingOpening*2+remainingClosing:remainingClosing)<=bound.requests,'bounds','Complete closing request reserve unavailable')
    let maximum
    if(isOpening)maximum=Math.min(bound.entity,Math.floor((bound.aggregate-aggregate-closingBytes-2*(remainingOpening-1))/2))
    else{
      const opening=opened.get(url);need(opening,'phase','Closing source was never opened')
      need(bound.aggregate-aggregate>=closingBytes,'bounds','Complete closing entity reserve unavailable')
      maximum=Math.min(bound.entity,bound.aggregate-aggregate-(closingBytes-opening.body.length))
    }
    need(maximum>0,'bounds','Complete entity/closing byte capacity unavailable')
    const receipt={phase,requestedURL:url,method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',requestedAt:new Date().toISOString(),bodyComplete:false}
    audit.rawPages.push(receipt);audit.requests=audit.nativeProgrammeRequests=audit.rawPages.length
    const request=new AbortController(),requestSignal=AbortSignal.any([signal,request.signal]),requestStarted=performance.now()
    const requestTimer=setTimeout(()=>request.abort(new DOMException('Front request deadline exceeded','TimeoutError')),bound.request)
    const checkRequest=()=>{check();if(performance.now()-requestStarted>=bound.request&&!request.signal.aborted)request.abort(new DOMException('Front request deadline exceeded','TimeoutError'));requestSignal.throwIfAborted()}
    let responseAccounted=false
    try{
      const page=await wait(()=>readPage(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',headers:{Accept:url===FEED||url===API?'application/json':'text/html','Cache-Control':'no-store',Pragma:'no-cache'},signal:requestSignal,maxBodyBytes:maximum}),requestSignal)
      need(plain(page),'transport','Original complete response metadata unavailable')
      const requestedURL=own(page,'requestedURL',false),finalURL=own(page,'finalURL',false),status=own(page,'status',false)
      if(typeof finalURL==='string')receipt.finalURL=finalURL
      if(Number.isSafeInteger(status))receipt.status=status
      if(typeof requestedURL==='string'&&requestedURL!==url)receipt.returnedRequestedURL=requestedURL
      receipt.responseAt=new Date().toISOString()
      const supplied=own(page,'body'),size=entityLength(supplied),body=size>maximum?prefix(supplied,maximum):snapshot(supplied,maximum)
      aggregate+=body.length;responseAccounted=true
      Object.assign(receipt,{bodyBase64:body.toString('base64'),bodyBytes:body.length,bodySHA256:sha(body),bodyComplete:own(page,'bodyComplete',false)===true&&size<=maximum,
        completedAt:new Date().toISOString(),bodyRepresentation:'Original Fetch-decoded entity bytes;not raw-wire bytes. Incomplete records retain only an honestly acquired bounded prefix.'})
      if(size>maximum)Object.assign(receipt,{discardedOverflowBytes:size-maximum,consumedBodyBytes:size})
      const views=headerViews(page);Object.assign(receipt,views)
      const headers=originalHeaders(views.headers,views.headerEntries)
      checkRequest()
      need(requestedURL===url&&finalURL===url,'route','Original requested/final URL provenance changed or missing')
      need(Number.isSafeInteger(status),'transport','Original HTTP status unavailable')
      if(status!==200){
        const error=failure('http','Native public HTTP '+status);error.status=status
        if([401,403,429,451].includes(status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true})
        else if(status>=500)Object.assign(error,{failureKind:'network_or_timeout',upstreamOutage:true})
        throw error
      }
      need(receipt.bodyComplete&&body.length>0,'body','Original entity incomplete,empty or over bound')
      const mime=url===FEED||url===API?'application/json':'text/html'
      need(new RegExp('^'+mime.replace('/','\\/')+'(?:\\s*;\\s*charset\\s*=\\s*(?:utf-8|"utf-8"))?\\s*$','i').test(headers['content-type']??''),'encoding','Unreviewed original MIME/UTF8 declaration')
      need(!headers['content-encoding']||/^(?:gzip|br|deflate)$/i.test(headers['content-encoding']),'encoding','Unreviewed original content encoding')
      const securityPolicy=security(headers,url);receipt.securityPolicy=securityPolicy
      let text
      try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body)}catch{throw failure('encoding','Original entity contains invalid UTF8')}
      checkRequest()
      if(!isOpening){const opening=opened.get(url);need(body.equals(opening.body)&&isDeepStrictEqual(securityPolicy,opening.securityPolicy),'closing','Closing whole original entity or security policy changed')}
      const model=url===CORPORATE?readFrontCorporate({text,url}):url===FEED?readFrontFeed({text,url}):url===API?readFrontApi({text,url}):readFrontNativeHtml({text,url,headers:views.headers,headerEntries:views.headerEntries})
      if(model.securityFacts)receipt.nativeSecurityFacts=structuredClone(model.securityFacts)
      checkRequest()
      if(isOpening){opened.set(url,{body,securityPolicy,receipt});closingBytes+=body.length}
      else{
        const opening=opened.get(url)
        audit.openingClosingEquality.push({URL:url,openingSHA256:opening.receipt.bodySHA256,closingSHA256:receipt.bodySHA256,wholeRawEntityEqual:true,securityPolicyEqual:true})
        closingBytes-=opening.body.length;opened.delete(url)
      }
      return{model,receipt}
    }catch(caught){
      const error=extensibleError(caught),evidence=!responseAccounted&&(responseFailures.get(error)??responseProgress.get(requestSignal)?.())
      if(evidence){Object.assign(receipt,evidence);aggregate+=evidence.bodyBytes??0}
      if([401,403,429,451].includes(receipt.status)||Object.keys(receipt.headers??{}).some(challenge))Object.assign(error,{failureKind:'blocked_or_access_denied',softFailure:true,abortRetries:true,upstreamOutage:true})
      receipt.failure={name:error.name??'Error',message:String(error.message??error),...(error.failureKind?{failureKind:error.failureKind}:{})}
      throw error
    }finally{responseProgress.delete(requestSignal);clearTimeout(requestTimer);request.abort()}
  }
  try{
    const corporate=(await read(CORPORATE,'opening-corporate',true)).model
    openingPlan=[CORPORATE,FEED,API,...corporate.ownURLs]
    need(bound.requests>=openingPlan.length*2,'bounds','All current own roles and closing requests exceed available capacity')
    check()
    const feed=(await read(FEED,'opening-feed',true)).model
    need(isDeepStrictEqual(corporate.originalJobs,feed.originalGroups),'corporate-feed','Current complete corporate/feed records or order disagree')
    const api=(await read(API,'opening-api',true)).model
    audit.nativePayload=api.originalPayload
    need(api.originalPayload.jobs.length===corporate.ownURLs.length&&corporate.ownURLs.every(url=>api.originalPayload.jobs.some(record=>record.jobUrl===url)),
      'membership','Current API does not exhaust the declared corporate/feed records')
    for(const url of corporate.ownURLs)allowed.add(url)
    const roles=[]
    for(const url of corporate.ownURLs)roles.push((await read(url,'opening-own:'+url.split('/').at(-1),true)).model)
    check()
    const reconciled=reconcileFrontServerProgramme({corporate,feed,api,roles});check()
    audit.nativePayload=reconciled.nativePayload;audit.nativeRecords=reconciled.nativeRecords;audit.pureReconciliationFacts=reconciled.qualificationFacts
    audit.observedRecordCount=audit.observedVacancyCount=reconciled.nativeRecords.length
    audit.activeDependencyDeclarations=reconciled.nativeRecords.map(record=>({id:record.id,declaration:record.nativeDeclaration,sourceBodiesQualified:false,rendererConsumptionQualified:false}))
    audit.allOpeningReadsBeforeClosing=true;audit.openingClosingEquality=[]
    const closingRoles=[]
    for(const url of corporate.ownURLs)closingRoles.push((await read(url,'closing-own:'+url.split('/').at(-1),false)).model)
    const closingAPI=(await read(API,'closing-api',false)).model,closingFeed=(await read(FEED,'closing-feed',false)).model,closingCorporate=(await read(CORPORATE,'closing-corporate',false)).model
    const closingResult=reconcileFrontServerProgramme({corporate:closingCorporate,feed:closingFeed,api:closingAPI,roles:closingRoles});check()
    need(isDeepStrictEqual(closingResult.nativePayload,reconciled.nativePayload)&&opened.size===0&&closingBytes===0&&audit.requests===6+2*reconciled.nativeRecords.length,
      'closing','Complete native opening/closing interval did not reconcile')
    Object.assign(audit,{currentDeclaredSourceProgramComplete:true,currentTransactionQualified:true,allNativeModelsRechecked:true,nativeIndiaCount:0,aggregateBytes:aggregate,completedAt:new Date().toISOString()})
    if(onAudit){const copy=structuredClone(audit);check();await wait(()=>onAudit(copy),signal);check()}
    const jobs=[],N=reconciled.nativeRecords.length
    attachSourceObservationEvidence(jobs,{source:'front',recordKind:'vacancy-rows',observedRecordCount:N,observedVacancyCount:N,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
    check()
    const result=attachInventoryEvidence(jobs,{status:'complete-inventory',surface:CORPORATE,firstParty:true,listingComplete:true,lifecycleCleanupAllowed:false,pagesFetched:audit.requests,
      reportedTotal:null,indiaFacetCount:0,verifiedAt:audit.completedAt,reason:'Complete current finite Front corporate SSR/feed/named-account API and every own server LD/raw boot publication; all original primary/supplementary criteria,identity,typed published work-country and whole raw closing interval reconciled. Real observed vacancies only,no reported company total. Native board,renderer/UI,application/screening,unpublished applicant eligibility,global scope,legal registry identity and cleanup remain unqualified.'})
    check();return result
  }catch(caught){
    const error=extensibleError(caught);audit.currentDeclaredSourceProgramComplete=false;audit.currentTransactionQualified=false;audit.aggregateBytes=aggregate
    try{Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})}catch{
      const wrapped=failure('held','Current server publication proof held');wrapped.cause=error;Object.defineProperty(wrapped,'nativeCollectionEvidence',{value:audit,configurable:true});throw wrapped
    }
    throw error
  }finally{clearTimeout(timer);controller.abort()}
}

export async function runCurrentFrontProgramme(options={}){
  need(plain(options),'options','Original controller options must be plain own data')
  for(const key of ['skipBoard','board','sourceInput','profile'])need(!Object.hasOwn(options,key),'options','No caller-supplied source authority or profile bypass')
  const parentSignal=own(options,'signal',false);parentSignal?.throwIfAborted()
  const fetchImpl=own(options,'fetchImpl',false)??globalThis.fetch,interval=own(options,'requestIntervalMs',false)??500
  need(typeof fetchImpl==='function'&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000,'options','Original raw fetch transport/request pacing unavailable')
  need(own(options,'fetchImpl',false)||!['fetchPage','fetchJson'].some(key=>typeof own(options,key,false)==='function'),'transport','Original raw fetchImpl required; parsed-only injection is unsupported')
  // Forward only own supported values. An options spread would evaluate
  // unrelated caller accessors before the fixed-profile reader can reject them.
  const forwarded={}
  for(const key of ['signal','sourceTimeoutMs','requestTimeoutMs','maxRequests','maxResponseBytes','maxAggregateBytes','onAudit']){
    const value=own(options,key,false);if(value!==undefined)forwarded[key]=value
  }
  let next=0
  return readCurrentFrontProgramme({...forwarded,readPage:async(url,init)=>{
    if(next>performance.now())await delay(next-performance.now(),undefined,{signal:init.signal})
    init.signal.throwIfAborted();next=performance.now()+interval
    let response,reader,canceled=false,complete=false,size=0,discardedOverflowBytes=0,base=null
    const chunks=[]
    const acquiredEvidence=()=>{
      const body=Buffer.concat(chunks,size)
      return{...base,bodyComplete:false,bodyBase64:body.toString('base64'),bodyBytes:body.length,bodySHA256:sha(body),discardedOverflowBytes,
        consumedBodyBytes:body.length+discardedOverflowBytes,completedAt:new Date().toISOString(),bodyRepresentation:'Genuinely acquired bounded Fetch-decoded prefix;not a complete entity or raw-wire bytes.'}
    }
    const release=()=>{try{reader?.releaseLock()}catch{}}
    const cancel=reason=>{if(canceled)return;canceled=true;ignore(()=>reader?reader.cancel(reason):response?.body?.cancel(reason));release()}
    const aborted=()=>cancel(init.signal.reason)
    try{
      response=await wait(()=>fetchImpl(url,init),init.signal,late=>late?.body?.cancel())
      need(response&&typeof response.url==='string','transport','Original Fetch response URL unavailable')
      const headers=Object.fromEntries(response.headers),headerEntries=[...response.headers]
      base={requestedURL:url,finalURL:response.url,status:response.status,headers,headerEntries,bodyComplete:false,responseAt:new Date().toISOString()}
      responseProgress.set(init.signal,acquiredEvidence)
      const advertised=response.headers.get('content-length')
      need(advertised===null||/^\d+$/.test(advertised),'body','Invalid original advertised entity length')
      need(advertised===null||Number(advertised)<=init.maxBodyBytes,'body','Advertised entity/aggregate byte bound exceeded')
      init.signal.addEventListener('abort',aborted,{once:true});init.signal.throwIfAborted()
      reader=response.body?.getReader();need(reader,'body','Original response stream unavailable')
      while(true){
        const part=await wait(()=>reader.read(),init.signal);init.signal.throwIfAborted()
        need(plain(part),'body','Original stream result unavailable')
        if(own(part,'done')===true){complete=true;break}
        need(own(part,'done')===false,'body','Unknown original stream completion state')
        const value=own(part,'value'),length=entityLength(value),remaining=init.maxBodyBytes-size
        if(length>remaining){if(remaining>0){chunks.push(prefix(value,remaining));size+=remaining}discardedOverflowBytes+=length-Math.max(remaining,0);throw failure('body','Streamed entity/aggregate byte bound exceeded')}
        const chunk=snapshot(value,remaining);chunks.push(chunk);size+=chunk.length
      }
      init.signal.throwIfAborted();return{...base,body:Buffer.concat(chunks,size),bodyComplete:true}
    }catch(caught){
      const error=extensibleError(caught)
      if(base){
        const evidence=acquiredEvidence()
        responseFailures.set(error,evidence)
        try{Object.defineProperty(error,'nativeResponseEvidence',{value:evidence,configurable:true})}catch{}
      }
      throw error
    }finally{init.signal.removeEventListener('abort',aborted);if(!complete)cancel();release()}
  }})
}
