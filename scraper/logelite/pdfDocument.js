import {loadPdfDisplay} from '../../scraper-support/shared/pdfDisplay.js'
import {readPublishedPdf} from '../cdot/pdfDocument.js'
import {need,hash} from './nativeModels.js'
import graphicsReview from './pdfGraphicsReview.json' with {type:'json'}
const watermarkPixels=new Set(['30a76f3a3d8dd67c670e2cce41068188de75171bfd370d1a1e165c916a5017f1','e78c5ad27edd794965e73f09b08b1663c3a5f69fb255329b341ffdc5705edcb6'])
const reviewedGraphics=new Set(graphicsReview.allowedGraphicsSHA256)
const textOperations=new Set(['dependency','beginMarkedContent','beginMarkedContentProps','endMarkedContent','beginText','endText','setCharSpacing','setWordSpacing','setHScale','setLeading','setFont','setTextRise','moveText','setLeadingMoveText','setTextMatrix','nextLine','showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText'])
const plain=value=>ArrayBuffer.isView(value)?Array.from(value):Array.isArray(value)?value.map(plain):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,child])=>[key,plain(child)])):value
const destroyTask=task=>{
 const started=performance.now();let timer,reason
 const expired=()=>reason??=Object.assign(Error('Native PDF task cleanup deadline exceeded'),{name:'NativePdfCleanupError',code:'NATIVE_PDF_CLEANUP_TIMEOUT'})
 const checkGrace=()=>{if(performance.now()-started>=1000)throw expired()}
 const destroying=Promise.resolve().then(()=>{const owned=Promise.resolve(task.destroy());owned.catch(()=>{});checkGrace();return owned}).then(value=>{checkGrace();return value})
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(expired()),1000)})
 return Promise.race([destroying,deadline]).finally(()=>clearTimeout(timer))
}
export async function readLogelitePDF(bytes,{signal}={}){
 signal?.throwIfAborted()
 let parsed
 try{parsed=await readPublishedPdf(bytes,{signal})}catch(error){signal?.throwIfAborted();throw error}
 signal?.throwIfAborted();need(parsed.totalPages<=12,'native PDF page review bound')
 for(const page of parsed.pages)for(const annotation of page.annotations)need(annotation.subtype==='Link'&&annotation.url==='mailto:hr@logelite.com'&&!annotation.action&&!annotation.actions,'unreviewed native PDF annotation/action')
 let task,cleanupPromise,listener,output,primaryFailure,failed=false
 const cleanup=()=>task?(cleanupPromise??=destroyTask(task)):Promise.resolve()
 const interrupted=new Promise((_,reject)=>{listener=()=>{cleanup().catch(()=>{});reject(signal.reason)};signal?.addEventListener('abort',listener,{once:true});if(signal?.aborted)listener()})
 interrupted.catch(()=>{})
 const wait=async value=>{
  const promise=typeof value==='function'?Promise.resolve().then(()=>{signal?.throwIfAborted();return value()}):Promise.resolve(value)
  promise.catch(()=>{});signal?.throwIfAborted()
  try{const result=await Promise.race([promise,interrupted]);signal?.throwIfAborted();return result}catch(error){signal?.throwIfAborted();throw error}
 }
 try{
  const {getDocument,OPS}=await wait(()=>loadPdfDisplay({signal})),names=new Map(Object.entries(OPS).map(([name,id])=>[id,name]))
  signal?.throwIfAborted()
  task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,verbosity:0})
  const pdf=await wait(task.promise),optional=await wait(()=>pdf.getOptionalContentConfig())
  need([...optional].length===0,'unreviewed native PDF optional content')
  need(!await wait(()=>pdf.getOpenAction()),'unreviewed native PDF document OpenAction');parsed.openAction=null
  const imageAliases=[]
  for(const model of parsed.pages){
   signal?.throwIfAborted();const page=await wait(()=>pdf.getPage(model.number)),ops=await wait(()=>page.getOperatorList())
   need(!await wait(()=>page.getJSActions()),'unreviewed native PDF page actions');model.images=[];model.graphicsOperations=[]
   for(let i=0;i<ops.fnArray.length;i++){
    const operation=names.get(ops.fnArray[i]);need(typeof operation==='string','unknown native PDF rendering operation')
    let args=plain(ops.argsArray[i])
    if(/image/i.test(operation)){
     need(operation==='paintImageXObject'&&model.images.length<4,'unreviewed native PDF image operation')
     const [id,width,height]=ops.argsArray[i],image=await wait(()=>new Promise(resolve=>page.objs.get(id,resolve)))
     need(image?.data&&image.width===width&&image.height===height&&image.kind===3,'unreviewed PDF image data')
     const pixelSHA256=hash(image.data);need(watermarkPixels.has(pixelSHA256),'new PDF artwork/criteria image requires review')
     model.images.push({operation,width,height,kind:image.kind,pixelSHA256});imageAliases.push({page:model.number,resourceID:id,pixelSHA256});args=[pixelSHA256,width,height]
    }
    if(!textOperations.has(operation))model.graphicsOperations.push({operation,arguments:args})
   }
   model.graphicsSHA256=hash(JSON.stringify(model.graphicsOperations))
   need(reviewedGraphics.has(model.graphicsSHA256),'new native PDF vector/artwork program requires review')
  }
  const {rendererFontAliases,...document}=parsed
  output={document,rendererAliases:{fonts:rendererFontAliases,images:imageAliases}}
 }catch(error){failed=true;primaryFailure=error}finally{
  try{await wait(cleanup())}catch(error){if(!failed){failed=true;primaryFailure=error}}
  finally{signal?.removeEventListener('abort',listener)}
 }
 signal?.throwIfAborted()
 if(failed)throw primaryFailure
 return output
}
