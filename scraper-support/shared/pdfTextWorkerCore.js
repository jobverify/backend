import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {MessageChannel} from 'node:worker_threads'
import {types} from 'node:util'

export const PDF_TEXT_CORE_PIN=Object.freeze({version:'6.2.108',packageSHA256:'d7918934bf0ef5b18beed1bd2d9b49a04447de445c171305a2de082ccee369ed',workerSHA256:'b4e582882f5e811f4d1b7b511f68d9a0c3209141e6f68856f01408c5cc155131'})
export const PDF_TEXT_CORE_LIMITS=Object.freeze({inputBytes:16*1024*1024,outputBytes:8*1024*1024,pages:1000,pageItems:100000,documentItems:250000,itemBytes:1024*1024,messages:100000,pageChunks:10000,pageAnnotations:4096,totalAnnotations:16384,linkUrlBytes:16384,linkBytes:1024*1024,assetBytes:4*1024*1024,totalAssetBytes:16*1024*1024,assets:128,pendingAssets:8,concurrentDocuments:8,cleanupMs:1000})
const root=new URL('../../node_modules/pdfjs-dist/',import.meta.url),workerURL=new URL('legacy/build/pdf.worker.mjs',root),sha=value=>createHash('sha256').update(value).digest('hex')
const arrayPrototype=Object.getPrototypeOf(Uint8Array.prototype),intrinsic=name=>Object.getOwnPropertyDescriptor(arrayPrototype,name).get
const byteLength=intrinsic('byteLength'),byteOffset=intrinsic('byteOffset'),buffer=intrinsic('buffer')
const metrics={documents:0,ports:0,listeners:0,pendingOperations:0},stats=()=>Object.freeze({...metrics})
export const pdfTextWorkerCoreResourceState=stats
const error=(message,code='PDF_TEXT_CORE_PROTOCOL')=>Object.assign(Error('PDF text core: '+message),{name:'PdfTextCoreError',code,failureKind:'pdf_text_core_held'})
const need=(value,message,code)=>{if(!value)throw error(message,code)}
const capability=()=>{const c=Promise.withResolvers();c.promise.catch(()=>{});return c}
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max
const normalize=value=>value.replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim()
let workerPromise=null,nextDocument=0
async function loadPinnedWorker(){
 if(!workerPromise)workerPromise=(async()=>{
  const packageBytes=await fs.readFile(new URL('package.json',root)),workerBytes=await fs.readFile(workerURL)
  need(packageBytes.length===710&&sha(packageBytes)===PDF_TEXT_CORE_PIN.packageSHA256&&JSON.parse(packageBytes).version===PDF_TEXT_CORE_PIN.version,'installed package version/hash changed','PDF_TEXT_CORE_VERSION')
  need(workerBytes.length===2383409&&sha(workerBytes)===PDF_TEXT_CORE_PIN.workerSHA256,'installed worker file hash changed','PDF_TEXT_CORE_VERSION')
  const module=await import(workerURL.href)
  need(typeof module.WorkerMessageHandler?.createDocumentHandler==='function','worker export changed','PDF_TEXT_CORE_VERSION')
  return module.WorkerMessageHandler
 })()
 return workerPromise
}
function bytes(value){
 need(types.isUint8Array(value),'input must be a Uint8Array','PDF_TEXT_CORE_INPUT')
 const length=byteLength.call(value);need(length<=PDF_TEXT_CORE_LIMITS.inputBytes,'input byte limit exceeded','PDF_TEXT_CORE_LIMIT')
 const output=new Uint8Array(length);output.set(new Uint8Array(buffer.call(value),byteOffset.call(value),length));return output
}
const serializedReason=value=>({name:'AbortException',message:typeof value==='string'?value.slice(0,320):'PDF text task cancelled'})
const workerReason=value=>{
 need(record(value)&&typeof value.name==='string'&&typeof value.message==='string'&&value.message.length<=16384,'malformed worker error')
 return Object.assign(Error(value.message),{name:value.name,code:typeof value.code==='string'?value.code:undefined})
}
async function boundedCleanup(promise){
 let timer
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('cleanup deadline exceeded','PDF_TEXT_CORE_CLEANUP')),PDF_TEXT_CORE_LIMITS.cleanupMs)})])}
 finally{clearTimeout(timer)}
}

// The caller supplies its single end-to-end deadline and abort race. No parser
// resolver, source timeout or cancellation reason is replaced here.
export async function extractPdfTextWorkerCore(value,{check,wait,maxPages=PDF_TEXT_CORE_LIMITS.pages,includePageLinks=false,includePageTextItems=false}={}){
 need(typeof check==='function'&&typeof wait==='function','deadline context required','PDF_TEXT_CORE_CONTEXT')
 check()
 need(integer(maxPages,1,PDF_TEXT_CORE_LIMITS.pages),'maxPages must narrow the hard page limit','PDF_TEXT_CORE_INPUT')
 need(typeof includePageLinks==='boolean','includePageLinks must be a boolean','PDF_TEXT_CORE_INPUT')
 need(typeof includePageTextItems==='boolean','includePageTextItems must be a boolean','PDF_TEXT_CORE_INPUT')
 need(metrics.documents<PDF_TEXT_CORE_LIMITS.concurrentDocuments,'concurrent document limit exceeded','PDF_TEXT_CORE_LIMIT')
 const data=bytes(value)
 metrics.documents++
 let failed=false,reason,result,channel,WorkerMessageHandler
 const loaded=capability(),requests=new Map(),streams=new Map(),cancelledStreams=new Set(),assets=new Map(),seenAssetCallbacks=new Set(),assetAbort=new AbortController(),listeners=[],cleanup={terminated:false,portsClosed:0,pendingOperations:0,listenersRemoved:0},assetEvidence=[]
 const docId='text_core_'+(++nextDocument),workerName=docId+'_worker'
 let closed=false,cleaning=false,fatalFailure=false,fatalReason,callbackId=0,streamId=0,messages=0,totalAssets=0,assetBytes=0,outputBytes=0,totalAnnotations=0,linkBytes=0,retainedItems=0,terminatePromise=null
 const checked=()=>{check();if(fatalFailure)throw fatalReason}
 const awaitChecked=async promise=>{checked();try{const output=await wait(promise);checked();return output}catch(e){checked();throw e}}
 const retire=(map,id)=>{const entry=map.get(id);if(entry){map.delete(id);metrics.pendingOperations--}return entry}
 const fail=value=>{if(closed||fatalFailure)return;fatalFailure=true;fatalReason=value;loaded.reject(value);for(const [id,c]of requests){retire(requests,id);c.reject(value)}for(const [id,s]of streams){retire(streams,id);s.reject(value)}}
 const send=message=>{need(channel&&!closed,'closed message transport');channel.port1.postMessage({sourceName:docId,targetName:workerName,...message})}
 const request=(action,body)=>{
  need(requests.size<4,'pending request limit exceeded','PDF_TEXT_CORE_LIMIT')
  const id=++callbackId,c=capability();requests.set(id,{...c,action});metrics.pendingOperations++;send({action,data:body,callbackId:id});return c.promise
 }
 const terminate=()=>terminatePromise??=request('Terminate',null)
 const trackListener=(port,listener,options)=>{port.addEventListener('message',listener,options);listeners.push({port,listener});metrics.listeners++}
 async function binaryAsset(message){
  const id=message.callbackId,query=message.data
  need(integer(id,1,1000000)&&!seenAssetCallbacks.has(id),'duplicate/invalid asset callback')
  seenAssetCallbacks.add(id)
  need(record(query)&&Object.keys(query).every(k=>['kind','filename'].includes(k))&&['cMapUrl','standardFontDataUrl'].includes(query.kind)&&typeof query.filename==='string'&&/^[-A-Za-z0-9_.]+$/.test(query.filename)&&!query.filename.includes('..'),'unreviewed installed asset request')
  need(++totalAssets<=PDF_TEXT_CORE_LIMITS.assets&&assets.size<PDF_TEXT_CORE_LIMITS.pendingAssets,'asset count limit exceeded','PDF_TEXT_CORE_LIMIT')
 const c={...capability(),replied:false};assets.set(id,c);metrics.pendingOperations++
  try{
   checked();const directory=new URL(query.kind==='cMapUrl'?'cmaps/':'standard_fonts/',root),target=new URL(query.filename,directory)
   const [directoryPath,targetPath]=await awaitChecked(Promise.all([fs.realpath(directory),fs.realpath(target)])),relative=path.relative(directoryPath,targetPath)
   need(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(relative)===relative,'asset escapes installed package')
   const info=await awaitChecked(fs.stat(targetPath));need(info.isFile()&&info.size<=PDF_TEXT_CORE_LIMITS.assetBytes&&assetBytes+info.size<=PDF_TEXT_CORE_LIMITS.totalAssetBytes,'asset byte limit exceeded','PDF_TEXT_CORE_LIMIT')
   const content=await awaitChecked(fs.readFile(targetPath,{signal:assetAbort.signal}))
   need(content.length===info.size&&assetBytes+content.length<=PDF_TEXT_CORE_LIMITS.totalAssetBytes,'asset size changed','PDF_TEXT_CORE_LIMIT');assetBytes+=content.length
   assetEvidence.push({kind:query.kind,filename:query.filename,bytes:content.length,sha256:sha(content)})
   if(!closed&&!cleaning&&!c.replied){c.replied=true;send({callback:1,callbackId:id,data:new Uint8Array(content)})}
   c.resolve()
  }catch(e){
   if(!closed&&!c.replied){c.replied=true;send({callback:2,callbackId:id,reason:{name:cleaning?'AbortException':'UnknownErrorException',message:'Installed PDF text asset unavailable'}})}
   if(!closed&&!cleaning)fail(e)
   c.resolve()
  }finally{retire(assets,id)}
 }
 function receive({data:message}){
  if(closed)return
  try{
   if(!cleaning)checked()
   need(++messages<=PDF_TEXT_CORE_LIMITS.messages,'message count limit exceeded','PDF_TEXT_CORE_LIMIT')
   need(record(message)&&message.sourceName===workerName&&message.targetName===docId,'unexpected message route')
   if(message.callback!==undefined){
    need([1,2].includes(message.callback)&&integer(message.callbackId,1,callbackId)&&!message.stream&&!message.action,'malformed callback')
    const c=retire(requests,message.callbackId);need(c,'unexpected/duplicate callback')
    if(message.callback===2){c.reject(workerReason(message.reason));return}
    if(c.action==='Terminate')cleanup.terminated=true
    c.resolve(message.data);return
   }
   if(message.stream!==undefined){
    if(cleaning&&message.stream===2){need(cancelledStreams.has(message.streamId)&&typeof message.success==='boolean','unexpected cancel acknowledgement');cancelledStreams.delete(message.streamId);const cancelled=retire(streams,message.streamId);cancelled?.reject(reason);return}
    need([3,4,5,8].includes(message.stream)&&integer(message.streamId,1,streamId)&&!message.action,'unsupported stream message')
    const s=streams.get(message.streamId);need(s,'unexpected/retired stream')
    if(message.stream===8){need(!s.started&&typeof message.success==='boolean','duplicate/malformed stream start');s.started=true;if(!message.success){retire(streams,message.streamId);s.reject(workerReason(message.reason));return}}
    else if(message.stream===5){retire(streams,message.streamId);s.reject(workerReason(message.reason));return}
    else if(message.stream===3){need(!s.closed,'duplicate stream close');s.closed=true}
    else{
     need(!s.closed&&record(message.chunk)&&Array.isArray(message.chunk.items),'malformed/late text chunk')
     need(++s.chunks<=PDF_TEXT_CORE_LIMITS.pageChunks&&s.items+message.chunk.items.length<=PDF_TEXT_CORE_LIMITS.pageItems,'page stream item/chunk limit exceeded','PDF_TEXT_CORE_LIMIT')
     if(includePageTextItems){need(retainedItems+message.chunk.items.length<=PDF_TEXT_CORE_LIMITS.documentItems,'retained document item limit exceeded','PDF_TEXT_CORE_LIMIT');retainedItems+=message.chunk.items.length}
     for(const item of message.chunk.items){
      need(record(item)&&typeof item.str==='string'&&typeof item.hasEOL==='boolean','malformed text item')
      const size=Buffer.byteLength(item.str);need(size<=PDF_TEXT_CORE_LIMITS.itemBytes&&outputBytes+linkBytes+size<=PDF_TEXT_CORE_LIMITS.outputBytes,'text output limit exceeded','PDF_TEXT_CORE_LIMIT');outputBytes+=size;s.items++
      if(s.textItems)s.textItems.push({str:item.str,hasEOL:item.hasEOL})
      const text=item.str.trim();if(text){s.fragments.push(text);if(item.hasEOL)s.fragments.push('\n')}
     }
    }
    if(s.started&&s.closed){retire(streams,message.streamId);s.resolve(normalize(s.fragments.join(' ')))}
    return
   }
   need(typeof message.action==='string','missing message action')
   if(cleaning){if(message.action==='FetchBinaryData'&&message.callbackId)send({callback:2,callbackId:message.callbackId,reason:{name:'AbortException',message:'Document cleanup'}});return}
   if(message.action==='GetDoc'){need(!loaded.received&&record(message.data?.pdfInfo),'duplicate/malformed document');loaded.received=true;loaded.resolve(message.data.pdfInfo);return}
   if(message.action==='DocException'){fail(workerReason(message.data));return}
   if(message.action==='DataLoaded'){need(message.data?.length===data.length,'loaded byte length changed');return}
   if(message.action==='DocProgress')return
   if(message.action==='FetchBinaryData'){binaryAsset(message).catch(fail);return}
   throw error('unsupported worker action: '+message.action)
  }catch(e){fail(e)}
 }
 try{
  WorkerMessageHandler=await awaitChecked(loadPinnedWorker());checked()
  channel=new MessageChannel();metrics.ports+=2
  trackListener(channel.port1,receive)
  // Track the library's own listener too, so bounded shutdown can detach it
  // even when an unsupported protocol never acknowledges Terminate.
  const workerListeners=new Map()
  const workerPort={postMessage:(...args)=>channel.port2.postMessage(...args),addEventListener:(type,listener,options)=>{need(type==='message'&&typeof listener==='function','unexpected worker event');const wrapped=event=>{try{listener(event)}catch(e){fail(e)}};workerListeners.set(listener,wrapped);trackListener(channel.port2,wrapped,options)},removeEventListener:(type,listener)=>channel.port2.removeEventListener(type,workerListeners.get(listener)??listener)}
  channel.port1.start();channel.port2.start();checked()
  const name=WorkerMessageHandler.createDocumentHandler({docId,apiVersion:PDF_TEXT_CORE_PIN.version,data,password:null,disableAutoFetch:true,rangeChunkSize:65536,docBaseUrl:null,enableXfa:false,evaluatorOptions:{maxImageSize:0,disableFontFace:true,ignoreErrors:false,isOffscreenCanvasSupported:false,isImageDecoderSupported:false,canvasMaxAreaInBytes:0,fontExtraProperties:false,useSystemFonts:false,useWasm:false,useWorkerFetch:false,cMapPacked:true,cMapUrl:null,iccUrl:null,standardFontDataUrl:null,wasmUrl:null,hasGPU:false,isEvalSupported:false}},workerPort)
  checked();need(name===workerName,'worker document identity changed');send({action:'Ready',data:null})
  const info=await awaitChecked(loaded.promise)
  need(integer(info.numPages,1,maxPages)&&!info.htmlForXfa,'unsupported document page count/XFA','PDF_TEXT_CORE_LIMIT')
  const pages=[],pageLinkUrls=[],pageTextItems=[]
  for(let index=0;index<info.numPages;index++){
   checked();await awaitChecked(request('GetPage',{pageIndex:index}))
   need(streams.size===0,'concurrent page stream unsupported')
   const id=++streamId,c=capability(),textItems=includePageTextItems?[]:null;streams.set(id,{...c,started:false,closed:false,items:0,chunks:0,fragments:[],textItems});metrics.pendingOperations++
   send({action:'GetTextContent',streamId:id,desiredSize:PDF_TEXT_CORE_LIMITS.pageItems+1,data:{pageId:index,pageIndex:index,includeMarkedContent:false,disableNormalization:false}})
   const text=await awaitChecked(c.promise);pages.push({page:index+1,text,textBytes:Buffer.byteLength(text),textSHA256:sha(text)})
   if(includePageTextItems)pageTextItems.push(textItems)
   if(includePageLinks){
    // DISPLAY=2 is the installed display API's default getAnnotations intent.
    // Read the library's own URL strings only; never request/execute actions.
    const annotations=await awaitChecked(request('GetAnnotations',{pageIndex:index,intent:2}))
    need(Array.isArray(annotations),'malformed annotation list')
    need(annotations.length<=PDF_TEXT_CORE_LIMITS.pageAnnotations&&totalAnnotations+annotations.length<=PDF_TEXT_CORE_LIMITS.totalAnnotations,'annotation count limit exceeded','PDF_TEXT_CORE_LIMIT')
    totalAnnotations+=annotations.length
    const urls=[]
    for(const annotation of annotations){
     need(record(annotation),'malformed annotation record')
     if(!Object.hasOwn(annotation,'url'))continue
     const descriptor=Object.getOwnPropertyDescriptor(annotation,'url')
     need(descriptor&&'value'in descriptor&&typeof descriptor.value==='string','malformed annotation URL')
     const size=Buffer.byteLength(descriptor.value)
     need(size<=PDF_TEXT_CORE_LIMITS.linkUrlBytes,'annotation URL byte limit exceeded','PDF_TEXT_CORE_LIMIT')
     need(linkBytes+size<=PDF_TEXT_CORE_LIMITS.linkBytes&&outputBytes+linkBytes+size<=PDF_TEXT_CORE_LIMITS.outputBytes,'annotation output limit exceeded','PDF_TEXT_CORE_LIMIT')
     linkBytes+=size;urls.push(descriptor.value)
    }
    pageLinkUrls.push(urls)
   }
  }
  const text=pages.filter(page=>page.text).map(page=>page.text).join('\n\n')
  need(Buffer.byteLength(text)+linkBytes<=PDF_TEXT_CORE_LIMITS.outputBytes,'joined output byte limit exceeded','PDF_TEXT_CORE_LIMIT')
  await awaitChecked(request('Cleanup',null));await awaitChecked(terminate());checked()
  result={text,textBytes:Buffer.byteLength(text),numPages:info.numPages,pageTexts:pages.map(page=>page.text),pages:pages.map(({text:_text,...page})=>page),assets:assetEvidence,parser:PDF_TEXT_CORE_PIN,cleanup}
  if(includePageLinks)result.pageLinkUrls=pageLinkUrls
  if(includePageTextItems)result.pageTextItems=pageTextItems
 }catch(e){failed=true;reason=e}
 finally{
  cleaning=true;assetAbort.abort(error('asset work cancelled'))
  if(channel&&!closed)for(const [id,c]of assets)if(!c.replied){c.replied=true;send({callback:2,callbackId:id,reason:{name:'AbortException',message:'Document cleanup'}})}
  if(channel&&!cleanup.terminated){
   try{
    for(const id of streams.keys()){cancelledStreams.add(id);send({stream:1,streamId:id,reason:serializedReason(reason)})}
    await boundedCleanup(terminate())
   }catch(e){if(!failed){failed=true;reason=e}}
  }
  closed=true
  for(const {port,listener}of listeners){port.removeEventListener('message',listener);cleanup.listenersRemoved++;metrics.listeners--}
  if(channel){channel.port1.close();channel.port2.close();metrics.ports-=2;cleanup.portsClosed=2}
  for(const [id,c]of requests){retire(requests,id);c.reject(reason)}
  for(const [id,c]of streams){retire(streams,id);c.reject(reason)}
  for(const [id,c]of assets){retire(assets,id);c.resolve()}
  loaded.reject(reason);metrics.documents--;cleanup.pendingOperations=requests.size+streams.size+assets.size
 }
 // A late caller cancellation/deadline still wins over synchronous parsing,
 // import rejection or successful cleanup, including falsy/frozen reasons.
 check();if(failed)throw reason;return result
}
