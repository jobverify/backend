import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
export function createZeissReader(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 if(options.fetchText||options.fetchPage||options.fetchJson)throw Error('ZEISS current native requires original HTTP metadata via fetchImpl')
 const limit=options.sourceTimeoutMs??180000,requestLimit=options.requestTimeoutMs??15000
 if(!Number.isSafeInteger(limit)||limit<1||limit>180000||!Number.isSafeInteger(requestLimit)||requestLimit<1||requestLimit>15000)throw RangeError('ZEISS native source/request budget')
 const start=performance.now(),controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,requests=[],pending=new Set(),allowed=new Map()
 const expired=()=>new DOMException('ZEISS native source deadline exceeded','TimeoutError'),timer=setTimeout(()=>controller.abort(expired()),limit)
 let bytes=0,nextStart=0,terminal
 const check=()=>{caller?.throwIfAborted();if(performance.now()-start>=limit&&!controller.signal.aborted)controller.abort(expired());signal.throwIfAborted()}
 const wait=(promise,sig)=>{sig.throwIfAborted();return new Promise((resolve,reject)=>{const stop=()=>reject(sig.reason);sig.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>sig.removeEventListener('abort',stop))})}
 const own=promise=>{pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise}
 const allow=(url,kind)=>{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!['html','javascript','json'].includes(kind))throw Error('Unbound ZEISS native URL');if(allowed.size>=32&&!allowed.has(url))throw Error('ZEISS URL budget');allowed.set(url,kind);return url}
 async function read(url,kind,request={}){
  check();if(terminal)throw terminal;if(allowed.get(url)!==kind||requests.length>=96)throw Error('Unbound ZEISS URL/kind or request budget')
  if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal});check();nextStart=performance.now()+500
  const began=performance.now(),deadline=new AbortController(),reason=new DOMException('ZEISS native request deadline exceeded','TimeoutError'),requestTimer=setTimeout(()=>deadline.abort(reason),requestLimit),requestSignal=AbortSignal.any([signal,deadline.signal])
  const checkRequest=()=>{check();if(performance.now()-began>=requestLimit&&!deadline.signal.aborted)deadline.abort(reason);requestSignal.throwIfAborted()}
  const method=request.method??'GET',body=request.body===undefined?undefined:JSON.stringify(request.body),receipt={requestedURL:url,method,requestBody:request.body??null,requestedAt:new Date().toISOString(),status:null,bodyComplete:false};requests.push(receipt)
  let response,reader,finished=false
  try{
   const fetchPromise=Promise.resolve().then(()=>(options.fetchImpl??globalThis.fetch)(url,{method,body,signal:requestSignal,redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:kind==='json'?'application/json':kind==='javascript'?'application/javascript':'text/html',...(body===undefined?{}:{'Content-Type':'application/json'})}}))
   const admission=fetchPromise.then(async r=>{if(requestSignal.aborted){Object.assign(receipt,{status:r.status,finalURL:r.url,headers:Object.fromEntries(r.headers)});await disposeResponseBody(r,{bestEffort:true,reason:caller?.aborted?caller.reason:requestSignal.reason});caller?.throwIfAborted();throw requestSignal.reason}return r});own(admission)
   response=await wait(admission,requestSignal)
   Object.assign(receipt,{status:response.status,finalURL:response.url,headers:Object.fromEntries(response.headers)})
   // Known publisher HTTP status/challenge precedes local elapsed deadline and any body access.
   await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},url,{context:'ZEISS native recruitment',signal:requestSignal,callerSignal:caller??null})
   checkRequest();const mime=(response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase()
   if(!(kind==='html'?mime==='text/html':kind==='json'?mime==='application/json':/^(?:application|text)\/(?:javascript|x-javascript|ecmascript)$/.test(mime)))throw Error('ZEISS original MIME changed')
   if(!response.body?.getReader)throw Error('ZEISS original body unavailable');reader=response.body.getReader();const chunks=[];let size=0
   for(;;){checkRequest();const q=await wait(reader.read(),requestSignal);checkRequest();if(q.done){finished=true;break}size+=q.value.byteLength;bytes+=q.value.byteLength;if(size>16*1024*1024||bytes>32*1024*1024)throw Error('ZEISS original byte budget exceeded');chunks.push(Buffer.from(q.value))}
   const raw=Buffer.concat(chunks,size),text=new TextDecoder('utf-8',{fatal:true}).decode(raw);Object.assign(receipt,{bytes:size,sha256:createHash('sha256').update(raw).digest('hex'),bodyComplete:true,completedAt:new Date().toISOString()});checkRequest()
   if(isHttpAccessChallenge({status:response.status,headers:response.headers,body:text}))throw Error('ZEISS native access challenge document')
   let value;if(kind==='json'){value=JSON.parse(text);checkRequest()}return {url,body:text,value,sha256:receipt.sha256}
  }catch(error){
   if([401,402,403,406,407,429,451].includes(receipt.status)||/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO/.test(error?.cause?.code??error?.code??''))terminal=error
   if(reader&&!finished)try{await disposeResponseBody({body:{cancel:value=>reader.cancel(value)}},{bestEffort:true,reason:error})}catch{}
   else if(response&&!finished)try{await disposeResponseBody(response,{bestEffort:true,reason:error})}catch{}
   caller?.throwIfAborted();throw error
  }finally{try{reader?.releaseLock()}catch{};clearTimeout(requestTimer)}
 }
 return {allow,read,check,stats:()=>({requests,bytes}),async close(){clearTimeout(timer);if(pending.size){let timer;try{await Promise.race([Promise.allSettled([...pending]),new Promise(resolve=>{timer=setTimeout(resolve,1100)})])}finally{clearTimeout(timer)}}caller?.throwIfAborted()}}
}
