import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'

export const createNativeReader=(source,initial,options={})=>{
 const fail=message=>Object.assign(Error(source+' current original HTTP: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})
 const need=(ok,message)=>{if(!ok)throw fail(message)}
 const caller=options.signal;caller?.throwIfAborted()
 const sourceTimeoutMs=options.sourceTimeoutMs??180000,requestTimeoutMs=options.requestTimeoutMs??15000
 const interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'invalid read deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=500||typeof options.fetchImpl==='function'),'invalid request interval')
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const timer=setTimeout(()=>controller.abort(new DOMException('Native source deadline','TimeoutError')),sourceTimeoutMs)
 const permitted=new Set(initial),receipts=[];let decodedBytes=0,nextStart=0,gate=Promise.resolve()
 const check=()=>{caller?.throwIfAborted();signal.throwIfAborted()}
 const pace=async()=>{
  const previous=gate;let release;gate=new Promise(resolve=>{release=resolve})
  try{await previous;check();if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal});check();nextStart=performance.now()+interval}
  finally{release()}
 }
 return {check,allow:url=>permitted.add(url),async read(url,mime='html'){
  check();need(permitted.has(url)&&receipts.length<180,'unbound URL or exhausted request budget')
  const receipt={requestedUrl:url,method:'GET',bodyComplete:false};receipts.push(receipt)
  await pace()
  try{
   const response=await boundedDeclaredPublicGet(url,{signal,timeoutMs:requestTimeoutMs,overflowError:fail('native streaming ceiling exceeded'),
    fetchImpl:(requested,init)=>(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})})
   check();const bytes=Buffer.from(response.bodyBase64,'base64');decodedBytes+=bytes.length
   Object.assign(receipt,{url:response.url,status:response.status,headers:Object.fromEntries(Object.entries(response.headers).filter(([k])=>['content-type','location','last-modified','etag','content-length'].includes(k))),
    bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),bodyComplete:true})
   need(decodedBytes<=64*1024*1024&&response.url===url,'native aggregate budget or original URL changed')
   need(response.status===200,'original HTTP '+response.status)
   const type=response.headers['content-type']??''
   need(mime==='html'?/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(type):mime==='css'?/^text\/css(?:;|$)/i.test(type):/^(?:application|text)\/javascript(?:;|$)/i.test(type),'native MIME changed')
   const body=new TextDecoder('utf8',{fatal:true}).decode(bytes);check();return {body,receipt}
  }catch(error){if(caller?.aborted)throw caller.reason;throw error}
 },stats:()=>({requests:receipts.length,decodedBytes,receipts:structuredClone(receipts),sourceTimeoutMs,requestTimeoutMs,nativeRequestIntervalMs:interval,maxRequests:180,maxAggregateBytes:64*1024*1024,maxParallelRoleReads:3}),
 close(){clearTimeout(timer);controller.abort()}}
}

export async function mapOriginalRoles(rows,read){
 const result=[]
 for(let offset=0;offset<rows.length;offset+=3){
  const settled=await Promise.allSettled(rows.slice(offset,offset+3).map((row,index)=>read(row,offset+index)))
  let failure
  for(const row of settled)if(row.status==='fulfilled')result.push(row.value);else failure??=row.reason
  if(failure!==undefined)throw failure
 }
 return result
}
