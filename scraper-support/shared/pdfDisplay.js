// Initialize the installed display module only for an admitted caller.
export async function loadPdfDisplay({signal}={}){
 signal?.throwIfAborted()
 const operation=(async()=>{
  if(typeof globalThis.DOMMatrix==='undefined'){
   const {DOMMatrix}=await import('@napi-rs/canvas/geometry.js')
   signal?.throwIfAborted()
   if(typeof globalThis.DOMMatrix==='undefined')globalThis.DOMMatrix=DOMMatrix
  }
  signal?.throwIfAborted()
  return import('pdfjs-dist/legacy/build/pdf.mjs')
 })()
 operation.catch(()=>{})
 let listener
 const aborted=signal&&new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()})
 try{const result=await (aborted?Promise.race([operation,aborted]):operation);signal?.throwIfAborted();return result}
 catch(error){signal?.throwIfAborted();throw error}
 finally{if(listener)signal.removeEventListener('abort',listener)}
}
