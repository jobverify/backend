import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'

export function createCurrentReader(source,initial,options={}){
 const failure=(message,fields={})=>Object.assign(Error(source+' current native HTTP: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false,...fields})
 const need=(ok,message)=>{if(!ok)throw failure(message,{failureKind:'parser_or_contract_error'})}
 const controller=new AbortController(),caller=options.signal,signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const sourceMs=options.sourceTimeoutMs??180000,requestMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(sourceMs)&&sourceMs>0&&sourceMs<=180000&&Number.isSafeInteger(requestMs)&&requestMs>0&&requestMs<=15000,'Invalid deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=500||typeof options.fetchImpl==='function'),'Invalid pacing')
 const timer=setTimeout(()=>controller.abort(new DOMException('Current native source deadline','TimeoutError')),sourceMs)
 const key=(url,request)=>JSON.stringify([url,request.method,request.body??null]),get={method:'GET'},allowed=new Set(initial.map(url=>key(url,get)))
 const deniedOrigins=new Map(),receipts=[];let decodedBytes=0,nextStart=0
 const check=()=>{caller?.throwIfAborted();signal.throwIfAborted()}
 const read=async(url,mime='html',request=get,allowRedirect=false)=>{
  check();const origin=new URL(url).origin
  need(allowed.has(key(url,request))&&receipts.length<100,'Unbound request or100-request budget')
  need(decodedBytes+16*1024*1024<=64*1024*1024,'Aggregate budget cannot reserve next bounded response')
  if(deniedOrigins.has(origin))throw deniedOrigins.get(origin)
  if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal});check()
  if(deniedOrigins.has(origin))throw deniedOrigins.get(origin)
  nextStart=performance.now()+interval
  const receipt={requestedUrl:url,method:request.method,...(request.body?{originalRequestBody:request.body,requestBodySHA256:createHash('sha256').update(request.body).digest('hex')}:{})};receipts.push(receipt)
  try{
   const response=await boundedDeclaredPublicRead(url,{request,signal,timeoutMs:requestMs,overflowError:failure('Streaming body limit'),fetchImpl:async(requested,init)=>{
    const response=await(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store',headers:Object.fromEntries(Object.entries(init.headers).filter(([name])=>name.toLowerCase()!=='x-requested-with'))})
    try{
     need(response?.url===requested&&response.redirected===false&&response.headers?.get&&(response.body||[301,302,303,307,308].includes(response.status)),'Original native Response identity unavailable')
     if([202,401,402,403,406,407,429,451].includes(response.status)){const error=failure('Restricted origin HTTP '+response.status,{httpStatus:response.status});deniedOrigins.set(origin,error);throw error}
     return response
    }catch(error){try{Promise.resolve(response?.body?.cancel(error)).catch(()=>{})}catch{}throw error}
   }})
   check();const bytes=Buffer.from(response.bodyBase64,'base64');decodedBytes+=bytes.length
   Object.assign(receipt,{url:response.url,status:response.status,headers:response.headers,
    bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),bodyComplete:true})
   need(decodedBytes<=64*1024*1024&&response.url===url,'Aggregate bound or original final URL changed')
   if(deniedOrigins.has(origin))throw deniedOrigins.get(origin)
   const redirect=allowRedirect&&[301,302,303,307,308].includes(response.status)
   if(response.status!==200&&!redirect)throw failure('Original HTTP '+response.status,{httpStatus:response.status})
   const type=response.headers['content-type']??'',expected={plain:/^text\/plain(?:;|$)/i,xml:/^(?:text|application)\/xml(?:;|$)/i,html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,json:/^application\/json(?:;|$)/i,javascript:/^(?:text|application)\/(?:x-)?javascript(?:;|$)/i}
   need(redirect||expected[mime]?.test(type),'Unexpected native MIME')
   let body
   try{body=new TextDecoder('utf8',{fatal:true}).decode(bytes)}catch(error){throw failure('Malformed complete200 native UTF8',{failureKind:'parser_or_contract_error',cause:error})}
   return {body,receipt}
  }catch(error){caller?.throwIfAborted();throw error}
 }
 return {check,read,allow:url=>allowed.add(key(url,get)),
  allowForm:(url,body)=>{need(typeof body==='string'&&Buffer.byteLength(body)<=1024,'Native public form-search body bound');const request={method:'POST',body};allowed.add(key(url,request));return request},
  stats:()=>({requests:receipts.length,decodedBytes,receipts:structuredClone(receipts),deniedOrigins:[...deniedOrigins.keys()],sourceTimeoutMs:sourceMs,requestTimeoutMs:requestMs,
   nativeRequestIntervalMs:interval,maxRequests:100,maxAggregateBytes:64*1024*1024}),
  close(){clearTimeout(timer);controller.abort()}}
}
