import {readPublishedPdf} from '../cdot/pdfDocument.js'
import {need,hash} from './nativeModels.js'
import graphicsReview from './pdfGraphicsReview.json' with {type:'json'}
const watermarkPixels=new Set(['30a76f3a3d8dd67c670e2cce41068188de75171bfd370d1a1e165c916a5017f1','e78c5ad27edd794965e73f09b08b1663c3a5f69fb255329b341ffdc5705edcb6'])
const reviewedGraphics=new Set(graphicsReview.allowedGraphicsSHA256)
const textOperations=new Set(['dependency','beginMarkedContent','beginMarkedContentProps','endMarkedContent','beginText','endText','setCharSpacing','setWordSpacing','setHScale','setLeading','setFont','setTextRise','moveText','setLeadingMoveText','setTextMatrix','nextLine','showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText'])
const plain=value=>ArrayBuffer.isView(value)?Array.from(value):Array.isArray(value)?value.map(plain):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,child])=>[key,plain(child)])):value
export async function readLogelitePDF(bytes,{signal}={}){
 const parsed=await readPublishedPdf(bytes,{signal});need(parsed.totalPages<=12,'native PDF page review bound')
 for(const page of parsed.pages)for(const annotation of page.annotations)need(annotation.subtype==='Link'&&annotation.url==='mailto:hr@logelite.com'&&!annotation.action&&!annotation.actions,'unreviewed native PDF annotation/action')
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs'),names=new Map(Object.entries(OPS).map(([name,id])=>[id,name]))
 const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,verbosity:0})
 const destroy=()=>{try{Promise.resolve(task.destroy()).catch(()=>{})}catch{}}
 let listener;const interrupted=signal?new Promise((_,reject)=>{listener=()=>{reject(signal.reason);destroy()};signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()}):null
 const wait=promise=>interrupted?Promise.race([promise,interrupted]):promise
 try{
  signal?.throwIfAborted();const pdf=await wait(task.promise),optional=await wait(pdf.getOptionalContentConfig())
  need([...optional].length===0,'unreviewed native PDF optional content')
  need(!await wait(pdf.getOpenAction()),'unreviewed native PDF document OpenAction');parsed.openAction=null
  const imageAliases=[]
  for(const model of parsed.pages){
   signal?.throwIfAborted();const page=await wait(pdf.getPage(model.number)),ops=await wait(page.getOperatorList())
   need(!await wait(page.getJSActions()),'unreviewed native PDF page actions');model.images=[];model.graphicsOperations=[]
   for(let i=0;i<ops.fnArray.length;i++){
    const operation=names.get(ops.fnArray[i]);need(typeof operation==='string','unknown native PDF rendering operation')
    let args=plain(ops.argsArray[i])
    if(/image/i.test(operation)){
     need(operation==='paintImageXObject'&&model.images.length<4,'unreviewed native PDF image operation')
     const [id,width,height]=ops.argsArray[i],image=await wait(new Promise(resolve=>page.objs.get(id,resolve)))
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
  return {document,rendererAliases:{fonts:rendererFontAliases,images:imageAliases}}
 }finally{if(listener)signal.removeEventListener('abort',listener);destroy()}
}
