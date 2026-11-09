import {requireNative} from '../../scraper-support/shared/nativeJobPosting.js'
export async function readNativePDF(bytes,{signal}={}){
 signal?.throwIfAborted()
 requireNative(bytes instanceof Uint8Array&&bytes.length<=2097152&&Buffer.from(bytes).subarray(0,5).toString()==='%PDF-','GAIL: bounded native PDF unavailable')
 // Only this installed pure JavaScript geometry module is imported. The
 // scraper audit continues to deny all native addons,workers and children.
 if(!globalThis.DOMMatrix){const geometry=await import('@napi-rs/canvas/geometry.js');globalThis.DOMMatrix=geometry.default.DOMMatrix}
 const {getDocument,VerbosityLevel}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const deadline=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)])
 const loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,disableFontFace:true,useSystemFonts:false,verbosity:VerbosityLevel.ERRORS})
 let listener
 const pending=(async()=>{
  const pdf=await loading.promise;requireNative(pdf.numPages>0&&pdf.numPages<=10,'GAIL: PDF page bound')
  const pages=[]
  for(let page=1;page<=pdf.numPages;page++){
   deadline.throwIfAborted();const content=await(await pdf.getPage(page)).getTextContent()
   pages.push({page,text:content.items.filter(item=>typeof item.str==='string').map(item=>item.str+(item.hasEOL?'\n':' ')).join('')})
  }
  return{pages}
 })()
 try{return await Promise.race([pending,new Promise((_,reject)=>{listener=()=>reject(deadline.reason);deadline.addEventListener('abort',listener,{once:true});if(deadline.aborted)listener()})])}
 finally{if(listener)deadline.removeEventListener('abort',listener);pending.catch(()=>{});await loading.destroy()}
}
