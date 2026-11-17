import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {extractPdfTextWorkerCore} from '../../scraper-support/shared/pdfTextWorkerCore.js'
// Exact public advertisements are learned only from current own notification cards.
export const isOwnHpclDocument=url=>{try{const u=new URL(url);return u.href===url&&u.origin==='https://www.hindustanpetroleum.com'&&u.pathname.startsWith('/documents/pdf/')&&u.pathname.endsWith('.pdf')&&!u.search&&!u.hash&&!u.username&&!u.password}catch{return false}}
export async function readCurrentHpclDocument(url,{options,signal,check,receipts,bytesRead}){
 const caller=options.signal,fail=message=>firstPartyFailure('hpcl',message),requestTimeoutMs=options.requestTimeoutMs??15000
 caller?.throwIfAborted();check();if(!isOwnHpclDocument(url))throw fail('Unbound public native advertisement URL')
 try{await delay(500,undefined,{signal})}catch(error){caller?.throwIfAborted();check();throw error}check()
 const receipt={requestedUrl:url,method:'GET',requestBodyPresent:false,requestedAt:new Date().toISOString(),status:null,bodyComplete:false};receipts.push(receipt)
 let knownHTTP
 try{
  const result=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,overflowError:fail('Native public advertisement16MiB response ceiling exceeded'),fetchImpl:async(requested,init)=>{
   caller?.throwIfAborted();check();let response,page
   if(options.fetchImpl)response=await options.fetchImpl(requested,{...init,credentials:'omit',cache:'no-store'})
   else if(options.fetchPage){page=await options.fetchPage(requested,{...init,credentials:'omit',cache:'no-store',format:'pdf'});if(!page?.headers||!Number.isInteger(page.status)||typeof(page.finalUrl??page.url)!=='string')throw fail('Complete original binary PDF HTTP metadata required');response={status:page.status,headers:new Headers(page.headers),url:page.finalUrl??page.url,body:null}}
   else response=await fetch(requested,{...init,credentials:'omit',cache:'no-store'})
   try{
    caller?.throwIfAborted();Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:Object.fromEntries(response.headers)})
    try{await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},requested,{context:'hpcl declared public advertisement',signal:init.signal,callerSignal:caller??null})}catch(error){knownHTTP=error;disposeResponseBody(response,{bestEffort:true}).catch(()=>{});throw error}
    check();if(response.status!==200||response.url!==requested||!/^application\/pdf(?:;|$)/i.test(response.headers.get('content-type')??''))throw fail('Original public advertisement status/final URL/PDF MIME changed')
    if(page){if(page.bodyUnavailable===true||typeof page.bodyBase64!=='string'||page.bodyBase64.length>4*Math.ceil(16*1024*1024/3))throw fail('Complete bounded original binary PDF body required');response.body=new Response(Buffer.from(page.bodyBase64,'base64')).body}
    return response
   }catch(error){if(!knownHTTP)disposeResponseBody(response,{bestEffort:true}).catch(()=>{});throw error}
  }})
  caller?.throwIfAborted();check();const bytes=Buffer.from(result.bodyBase64,'base64'),sha256=createHash('sha256').update(bytes).digest('hex');Object.assign(receipt,{bodyComplete:true,bytes:bytes.length,sha256});bytesRead(bytes.length);check()
  if(bytes.subarray(0,5).toString()!=='%PDF-')throw fail('Original native advertisement PDF signature changed')
  let text=null,textError=null,nativePdfTextModel=null
  const parserDeadline=new AbortController(),parserStarted=performance.now(),parserTimeout=new DOMException('hpcl public PDF text deadline exceeded','TimeoutError'),parserSignal=AbortSignal.any([signal,parserDeadline.signal])
  const parserTimer=setTimeout(()=>parserDeadline.abort(parserTimeout),requestTimeoutMs)
  const parserCheck=()=>{caller?.throwIfAborted();check();if(performance.now()-parserStarted>=requestTimeoutMs&&!parserDeadline.signal.aborted)parserDeadline.abort(parserTimeout);parserSignal.throwIfAborted()}
  const wait=promise=>new Promise((resolve,reject)=>{
   let settled=false
   const finish=(operation,value)=>{if(settled)return;settled=true;parserSignal.removeEventListener('abort',aborted);operation(value)},aborted=()=>finish(reject,parserSignal.reason)
   parserSignal.addEventListener('abort',aborted,{once:true})
   try{parserCheck()}catch(error){finish(reject,error);return}
   Promise.resolve(promise).then(value=>{try{parserCheck();finish(resolve,value)}catch(error){finish(reject,error)}},error=>{try{parserCheck()}catch(reason){error=reason}finish(reject,error)})
  })
  // Text-core only: zero text is retained as a qualification gap. Never invoke
  // OCR workers, model downloads or an unbounded external fallback for a notice.
  try{nativePdfTextModel=await extractPdfTextWorkerCore(bytes,{check:parserCheck,wait});text=nativePdfTextModel.text;parserCheck()}catch(error){caller?.throwIfAborted();check();textError={name:error?.name??null,message:error?.message??String(error),code:error?.code??null}}finally{clearTimeout(parserTimer);parserDeadline.abort()}
  return {url,status:result.status,headers:result.headers,bodyBase64:result.bodyBase64,sha256,bytes:bytes.length,nativeExtractedText:text,nativePdfTextModel,nativeTextExtractionError:textError,nativeTextCompletenessQualified:false,fullRoleCriteriaQualified:false,originalEntityRetained:true,ocrInvoked:false,applicationInteractions:0}
 }catch(error){caller?.throwIfAborted();if(knownHTTP)throw knownHTTP;check();throw error}finally{receipt.completedAt=new Date().toISOString()}
}
