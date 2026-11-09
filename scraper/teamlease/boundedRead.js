import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {CAREERS_URL,buildSearchUrl,isRoleURL,nativeFailure} from './currentNative.js'

export function createTeamleaseReader(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 const sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000
 if(!Number.isSafeInteger(sourceTimeoutMs)||sourceTimeoutMs<1||sourceTimeoutMs>180000
  ||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw RangeError('Invalid TeamLease public source deadline')
 const controller=new AbortController(),started=performance.now()
 const timer=setTimeout(()=>controller.abort(new DOMException('TeamLease source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 const signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const permitted=new Set([CAREERS_URL]),receipts=[]
 let aggregateBytes=0,nextStart=0
 const check=()=>{
  caller?.throwIfAborted()
  if(performance.now()-started>=sourceTimeoutMs&&!controller.signal.aborted)controller.abort(new DOMException('TeamLease source deadline exceeded','TimeoutError'))
  signal.throwIfAborted()
 }
 const fail=(message,fields={})=>Object.assign(nativeFailure(message),fields)
 const nativeFetch=async(url,init,format)=>{
  if(options.fetchImpl)return options.fetchImpl(url,{...init,credentials:'omit',cache:'no-store'})
  if(!options.fetchPage&&!options.fetchText&&!options.fetchJson)return fetch(url,{...init,credentials:'omit',cache:'no-store'})
  let page
  if(options.fetchPage)page=await options.fetchPage(url,{...init,format})
  else if(format==='json'&&options.fetchJson)page={status:200,url,body:JSON.stringify(await options.fetchJson(url,init)),headers:{'content-type':'application/json'}}
  else page={status:200,url,body:await options.fetchText(url,init),headers:{'content-type':'text/html'}}
  if(init.signal.aborted){try{Promise.resolve(page?.body?.cancel?.(init.signal.reason)).catch(()=>{})}catch{};init.signal.throwIfAborted()}
  const body=page?.body??page?.html
  if(typeof body!=='string'||Buffer.byteLength(body)>16*1024*1024)throw fail('Missing or oversized injected native body')
  const response=new Response(body,{status:page.status,headers:page.headers??{'content-type':format==='json'?'application/json':'text/html'}})
  Object.defineProperty(response,'url',{value:page.finalUrl??page.url??url})
  return response
 }
 return {
  check,
  allowInventory(page,size){const url=buildSearchUrl(page,size);permitted.add(url);return url},
  allowRole(url){if(!isRoleURL(url))throw fail('Unbound native role URL');permitted.add(url)},
  async read(url,format='html'){
   check();if(!permitted.has(url)||receipts.length>=128)throw fail('Unbound native URL or request budget exceeded')
   const wait=nextStart-performance.now()
   if(wait>0)await delay(wait,undefined,{signal})
   check();nextStart=performance.now()+500
   const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString(),status:null,bodyComplete:false}
   receipts.push(receipt)
   const requestStarted=performance.now(),deadline=new AbortController()
   const timeoutReason=new DOMException('TeamLease request deadline exceeded','TimeoutError')
   const requestTimer=setTimeout(()=>deadline.abort(timeoutReason),requestTimeoutMs)
   const requestSignal=AbortSignal.any([signal,deadline.signal])
   const checkRequest=()=>{
    check()
    if(performance.now()-requestStarted>=requestTimeoutMs&&!deadline.signal.aborted)deadline.abort(timeoutReason)
    requestSignal.throwIfAborted()
   }
   const fetchBound=async(requested,init)=>{
    checkRequest()
    const response=await nativeFetch(requested,init,format)
    try{
     checkRequest()
     const body=response.body
     checkRequest()
     return {status:response.status,url:response.url,headers:response.headers,body:body===null?null:{
      cancel:reason=>body.cancel?.(reason),
      getReader(){
       checkRequest();const nativeReader=body.getReader()
       return {async read(){checkRequest();const chunk=await nativeReader.read();checkRequest();return chunk},
        cancel:reason=>nativeReader.cancel(reason),releaseLock:()=>nativeReader.releaseLock()}
      },
     }}
    }catch(error){try{Promise.resolve(response?.body?.cancel?.(error)).catch(()=>{})}catch{};throw error}
   }
   try{
    const response=await boundedDeclaredPublicGet(url,{signal:requestSignal,overflowError:fail('Native response byte bound exceeded'),
     fetchImpl:fetchBound})
    checkRequest();Object.assign(receipt,{status:response.status,finalUrl:response.url})
    if(response.status!==200)throw fail('Original native HTTP '+response.status,{status:response.status,
     failureKind:[401,403,429,451].includes(response.status)?'blocked_or_access_denied':response.status>=500?'network_or_timeout':'surface_drift_or_fail_closed'})
    if(response.url!==url)throw fail('Native response URL identity changed',{status:response.status})
    const contentType=response.headers['content-type']??''
    if(!(format==='json'?/^(?:application|text)\/(?:[a-z.+-]*\+)?json(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i).test(contentType))throw fail('Unexpected native response MIME')
    const bytes=Buffer.from(response.bodyBase64,'base64');aggregateBytes+=bytes.length
    if(aggregateBytes>24*1024*1024)throw fail('Native aggregate body bound exceeded')
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    Object.assign(receipt,{bodyComplete:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
    checkRequest();return {url,status:200,headers:response.headers,body:text,sha256:receipt.sha256}
   }catch(error){
    if(caller?.aborted)throw caller.reason
    try{checkRequest()}catch(expired){throw expired}
    throw error
   }finally{clearTimeout(requestTimer);receipt.completedAt=new Date().toISOString()}
  },
  stats:()=>({requests:receipts.length,decodedBytes:aggregateBytes,receipts:structuredClone(receipts),
   nativeRequestIntervalMs:500,requestTimeoutMs,sourceTimeoutMs,
   legacyCallbackMetadataUnverified:Boolean(!options.fetchPage&&!options.fetchImpl&&(options.fetchText||options.fetchJson))}),
  close(){clearTimeout(timer);controller.abort()},
 }
}
