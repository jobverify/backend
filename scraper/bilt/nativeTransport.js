import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'

export const HOME='https://bilt.ai/',CAREERS='https://bilt.ai/careers/',BOARD='https://j.brt.mv/ax.do?portalGK=37115',FEED='https://j.brt.mv/JobRSS.do?companyGK=46774&portalGK=37115'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const failure=(message,fields={})=>Object.assign(Error('[bilt] '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',lifecycleCleanupAllowed:false,...fields})
export const need=(condition,message)=>{if(!condition)throw failure(message)}
export function roleID(value){
 try{const url=new URL(value),id=url.searchParams.get('reqGK');return url.href===value&&['https://j.brt.mv','https://ejob.bz'].includes(url.origin)&&url.pathname==='/jb.do'&&!url.username&&!url.password&&!url.hash
  &&/^[1-9]\d{5,11}$/.test(id??'')&&url.searchParams.get('companyGK')==='46774'&&url.searchParams.get('portalGK')==='37115'
  &&[...url.searchParams.keys()].length===3&&['reqGK','companyGK','portalGK'].every(key=>url.searchParams.getAll(key).length===1)?id:null
 }catch{return null}
}
const ignore=operation=>{try{void Promise.resolve(operation()).catch(()=>{})}catch{}}

// Only the configured corporate documents, their exact BrightMove delegation,
// and role URLs actually discovered in that tenant may be read. The shared
// primitive retains ordinary TLS validation and never follows redirects.
export function createBiltReader(options={}){
 const caller=options.signal,sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500
 caller?.throwIfAborted()
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000
  &&Number.isSafeInteger(interval)&&interval>=0&&interval<=2000,'Invalid source/request budget')
 const stop=new AbortController(),timer=setTimeout(()=>stop.abort(new DOMException('Bilt source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 const signal=caller?AbortSignal.any([caller,stop.signal]):stop.signal,allowed=new Set([HOME,CAREERS,BOARD,FEED]),receipts=[]
 let nextStart=0,totalBytes=0,closed=false
 const check=()=>{caller?.throwIfAborted();signal.throwIfAborted()}
 return {receipts,check,signal,
  allowRole(value){need(roleID(value),'Unbound native role');allowed.add(value)},
  async read(url){
   check();need(!closed&&allowed.has(url)&&receipts.length<64,'Unbound native request or source request cap')
   if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal})
   check();nextStart=performance.now()+interval
   const deadline=new AbortController(),requestTimer=setTimeout(()=>deadline.abort(new DOMException('Bilt request deadline exceeded','TimeoutError')),requestTimeoutMs)
   const requestSignal=AbortSignal.any([signal,deadline.signal]),receipt={sequence:receipts.length+1,requestedURL:url,method:'GET',status:null,bodyComplete:false,startedAt:new Date().toISOString()}
   receipts.push(receipt)
   try{
    const page=await boundedDeclaredPublicGet(url,{signal:requestSignal,overflowError:failure('Original response exceeds byte limit'),fetchImpl:async(value,init)=>{
     requestSignal.throwIfAborted()
     const originalInit={...init,credentials:'omit',cache:'no-store',headers:{...init.headers,Accept:url===FEED?'application/rss+xml,text/xml,application/xml':'text/html,application/xhtml+xml'}}
     let response
     if(options.fetchPage){
      const original=await options.fetchPage(value,originalInit)
      requestSignal.throwIfAborted()
      need(typeof original?.html==='string'&&Buffer.byteLength(original.html)<=4*1024*1024,'Missing or oversized original injected body')
      response=new Response(original.html,{status:original.status,headers:{'content-type':original.contentType}})
      Object.defineProperty(response,'url',{value:original.url})
     }else response=await(options.fetchImpl??globalThis.fetch)(value,originalInit)
     if(requestSignal.aborted){ignore(()=>response?.body?.cancel());requestSignal.throwIfAborted()}
     Object.assign(receipt,{status:response.status,finalURL:response.url,headers:Object.fromEntries(response.headers)})
     const declaredLength=response.headers.get('content-length')
     need(declaredLength===null||/^\d+$/.test(declaredLength)&&Number(declaredLength)<=4*1024*1024,'Original declared byte limit exceeded')
     return response
    }})
    requestSignal.throwIfAborted()
    const body=Buffer.from(page.bodyBase64,'base64');totalBytes+=body.length
    Object.assign(receipt,{status:page.status,finalURL:page.url,headers:page.headers,bodyComplete:true,bytes:body.length,sha256:sha(body),bodyBase64:page.bodyBase64})
    need(body.length<=4*1024*1024&&totalBytes<=32*1024*1024,'Original source byte budget exceeded')
    if(page.status!==200)throw failure('Public HTTP '+page.status,{status:page.status,requestUrl:url,failureKind:[401,403,406,429,451].includes(page.status)?'blocked_or_access_denied':'network_or_timeout',upstreamOutage:[401,403,406,429,451].includes(page.status)})
    need(page.url===url,'Original response URL changed')
    const mime=page.headers['content-type']??''
    need((url===FEED?/^(?:application\/(?:rss\+xml|xml)|text\/xml)(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i).test(mime),'Unexpected original source MIME')
    const html=new TextDecoder('utf-8',{fatal:true}).decode(body)
    return {url:page.url,status:page.status,contentType:mime,html,sha256:receipt.sha256}
   }catch(error){
    closed=true
    caller?.throwIfAborted()
    // Header provenance survives a denied stream that fails while being read.
    if([401,403,406,429,451].includes(receipt.status)){
     if(error?.status===receipt.status)throw error
     throw failure('Public HTTP '+receipt.status+'; original body unavailable',{status:receipt.status,requestUrl:url,failureKind:'blocked_or_access_denied',upstreamOutage:true,cause:requestSignal.aborted?requestSignal.reason:error})
    }
    requestSignal.throwIfAborted()
    throw error
   }finally{clearTimeout(requestTimer);receipt.completedAt=new Date().toISOString()}
  },
  stats:()=>({requests:receipts.length,totalDecodedBytes:totalBytes,sourceTimeoutMs,requestTimeoutMs,requestIntervalMs:interval,
   byteQualification:'16MiB shared streaming ceiling;4MiB per entity and32MiB aggregate checked after each bounded body; oversized declared entities rejected before reading.'}),
  close(){closed=true;clearTimeout(timer);stop.abort()},
 }
}
