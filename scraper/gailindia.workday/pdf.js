import {requireNative} from '../../scraper-support/shared/nativeJobPosting.js'
import {loadPdfDisplay} from '../../scraper-support/shared/pdfDisplay.js'
const destroyTask=task=>{
 const started=performance.now();let timer,reason
 const expired=()=>reason??=Object.assign(Error('Native PDF task cleanup deadline exceeded'),{name:'NativePdfCleanupError',code:'NATIVE_PDF_CLEANUP_TIMEOUT'})
 const checkGrace=()=>{if(performance.now()-started>=1000)throw expired()}
 const destroying=Promise.resolve().then(()=>{const owned=Promise.resolve(task.destroy());owned.catch(()=>{});checkGrace();return owned}).then(value=>{checkGrace();return value})
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(expired()),1000)})
 return Promise.race([destroying,deadline]).finally(()=>clearTimeout(timer))
}
export async function readNativePDF(bytes,{signal}={}){
 signal?.throwIfAborted()
 requireNative(bytes instanceof Uint8Array&&bytes.length<=2097152&&Buffer.from(bytes).subarray(0,5).toString()==='%PDF-','GAIL: bounded native PDF unavailable')
 const {getDocument,VerbosityLevel}=await loadPdfDisplay({signal})
 const started=performance.now(),deadline=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)])
 let loading,cleanupPromise,output,primaryFailure,elapsedReason,failed=false
 const cleanup=()=>loading?(cleanupPromise??=destroyTask(loading)):Promise.resolve()
 const check=()=>{
  signal?.throwIfAborted();deadline.throwIfAborted()
  if(performance.now()-started>=15000)throw elapsedReason??=new DOMException('Native PDF extraction deadline exceeded','TimeoutError')
 }
 const wait=async(value,active)=>{
  let listener
  const checkWait=()=>{if(active===deadline)check();else signal?.throwIfAborted()}
  const pending=typeof value==='function'?Promise.resolve().then(()=>{checkWait();return value()}):Promise.resolve(value)
  pending.catch(()=>{})
  const interrupted=active&&new Promise((_,reject)=>{listener=()=>{cleanup().catch(()=>{});reject(active.reason)};active.addEventListener('abort',listener,{once:true});if(active.aborted)listener()})
  interrupted?.catch(()=>{})
  try{checkWait();const result=await(interrupted?Promise.race([pending,interrupted]):pending);checkWait();return result}catch(error){checkWait();throw error}
  finally{if(listener)active.removeEventListener('abort',listener)}
 }
 try{
  check()
  loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,disableFontFace:true,useSystemFonts:false,verbosity:VerbosityLevel.ERRORS})
  const ready=Promise.resolve(loading.promise);ready.catch(()=>{});check()
  const pdf=await wait(ready,deadline);requireNative(pdf.numPages>0&&pdf.numPages<=10,'GAIL: PDF page bound')
  const pages=[]
  for(let page=1;page<=pdf.numPages;page++){
   check();const nativePage=await wait(()=>pdf.getPage(page),deadline),content=await wait(()=>nativePage.getTextContent(),deadline)
   pages.push({page,text:content.items.filter(item=>typeof item.str==='string').map(item=>item.str+(item.hasEOL?'\n':' ')).join('')})
  }
  output={pages};check()
 }catch(error){
  failed=true;primaryFailure=error
  try{check()}catch(reason){primaryFailure=reason}
 }finally{
  // Extraction has settled; cleanup keeps its own grace and caller signal.
  try{await wait(cleanup(),signal)}catch(error){if(!failed){failed=true;primaryFailure=error}}
 }
 signal?.throwIfAborted()
 if(failed)throw primaryFailure
 return output
}
