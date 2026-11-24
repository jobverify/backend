import {setTimeout as delay} from 'node:timers/promises'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {createHash} from 'node:crypto'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'

export const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex')
export function createCurrentReader(options={}){
 const caller=options.signal,deadline=new AbortController(),started=performance.now(),receipts=[]
 const sourceTimeoutMs=options.sourceTimeoutMs??240000,requestTimeoutMs=options.requestTimeoutMs??25000,interval=options.requestIntervalMs??300
 if(!Number.isSafeInteger(sourceTimeoutMs)||sourceTimeoutMs<1||sourceTimeoutMs>240000||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>25000||!Number.isSafeInteger(interval)||interval<0||interval>5000||(!options.fetchImpl&&interval<300))throw RangeError('Invalid Futurism bounded public read limits')
 if(options.fetchText&&!options.fetchImpl)throw TypeError('Futurism current publication requires HTTP response metadata')
 const expired=new DOMException('Futurism current source deadline exceeded','TimeoutError')
 const timer=setTimeout(()=>deadline.abort(expired),sourceTimeoutMs)
 const signal=caller?AbortSignal.any([caller,deadline.signal]):deadline.signal
 let last=0,total=0
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=sourceTimeoutMs&&!deadline.signal.aborted)deadline.abort(expired);signal.throwIfAborted()}
 const read=async(url,type='html',input)=>{
  check();if(receipts.length>=200)throw Error('Futurism current request ceiling exceeded')
  const remaining=last+interval-performance.now()
  if(remaining>0)try{await delay(remaining,undefined,{signal})}catch(error){check();throw error}
  check();last=performance.now();const requestStarted=performance.now();let observedError,validation
  try{
   const page=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,request:input?{method:'POST',body:JSON.stringify(input)}:{method:'GET'},overflowError:Error('Futurism current response byte ceiling exceeded'),
    fetchImpl:async(value,init)=>{
     let response
     try{response=await(options.fetchImpl??globalThis.fetch)(value,{...init,credentials:'omit',headers:{...init.headers,...(input?{'Content-Type':'application/json; charset=UTF-8'}:{})}})}catch(error){if(error?.httpStatus||error?.status)observedError=error;throw error}
     try{validation=requireNativeHttpResponse(response,url,{signal:init.signal,callerSignal:caller??null,context:'Futurism current public native response'});await validation}catch(error){observedError=error;throw error}
     return response
    }})
   caller?.throwIfAborted()
   if(performance.now()-requestStarted>=requestTimeoutMs)throw new DOMException('Futurism current request deadline exceeded','TimeoutError')
   check()
   const contentType=(page.headers['content-type']??'').split(';',1)[0].trim().toLowerCase()
   const permitted=type==='json'?['application/json']:type==='js'?['application/javascript','text/javascript','application/x-javascript']:['text/html','application/xhtml+xml']
   if(!permitted.includes(contentType))throw Error('Futurism current declared media type changed')
   const bytes=Buffer.from(page.bodyBase64,'base64');total+=bytes.length
   if(bytes.length>4*1024*1024||total>20*1024*1024)throw Error('Futurism current original byte ceiling exceeded')
   const receipt={requestedURL:url,finalURL:page.url,status:page.status,headers:page.headers,method:input?'POST':'GET',...(input?{requestBody:JSON.stringify(input)}:{}),bytes:bytes.length,sha256:sha(bytes),bodyBase64:page.bodyBase64}
   receipts.push(receipt)
   const result=type==='json'?parseEightfoldJson(bytes.toString('utf8')):bytes.toString('utf8')
   caller?.throwIfAborted();if(performance.now()-requestStarted>=requestTimeoutMs)throw new DOMException('Futurism current request decode deadline exceeded','TimeoutError')
   check();return result
  }catch(error){caller?.throwIfAborted();if(validation)try{await validation}catch(primary){caller?.throwIfAborted();throw primary}if(observedError)throw observedError;check();throw error}
  finally{caller?.throwIfAborted()}
 }
 return{read,check,receipts,close(){clearTimeout(timer);deadline.abort();caller?.throwIfAborted()}}
}
