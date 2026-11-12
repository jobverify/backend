import {loadPdfDisplay} from '../../scraper-support/shared/pdfDisplay.js'
const {getDocument,OPS,VerbosityLevel}=await loadPdfDisplay()
import {fileURLToPath} from 'node:url'
import {failure} from './runtime20261107.js'
const need=(ok,message)=>{if(!ok)throw failure('BHEL native PDF '+message,'BHEL_NATIVE_PROOF')}
const destroyTask=task=>{
 const started=performance.now();let timer,reason
 const expired=()=>reason??=Object.assign(Error('Native PDF task cleanup deadline exceeded'),{name:'NativePdfCleanupError',code:'NATIVE_PDF_CLEANUP_TIMEOUT'})
 const checkGrace=()=>{if(performance.now()-started>=1000)throw expired()}
 const destroying=Promise.resolve().then(()=>{const owned=Promise.resolve(task.destroy());owned.catch(()=>{});checkGrace();return owned}).then(value=>{checkGrace();return value})
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(expired()),1000)})
 return Promise.race([destroying,deadline]).finally(()=>clearTimeout(timer))
}
const fontId=name=>typeof name==='string'?name.replace(/^g_d\d+_/,''):name
function snapshot(value,seen=new Set(),depth=0){
 need(depth<=64,'excessive decoded PDF model nesting')
 if(value===undefined)return{decoderValue:'undefined'}
 if(value===null||typeof value==='string'||typeof value==='boolean')return value
 if(typeof value==='number'){need(Number.isFinite(value),'nonfinite decoded PDF value');return value}
 if(ArrayBuffer.isView(value))return{decoderTypedArray:value.constructor.name,byteLength:value.byteLength,bodyBase64:Buffer.from(value.buffer,value.byteOffset,value.byteLength).toString('base64')}
 if(value instanceof ArrayBuffer)return{decoderTypedArray:'ArrayBuffer',byteLength:value.byteLength,bodyBase64:Buffer.from(value).toString('base64')}
 need(typeof value==='object'&&!seen.has(value),'unsupported or cyclic decoded PDF value');seen.add(value)
 let result
 if(Array.isArray(value))result=value.map(v=>snapshot(v,seen,depth+1))
 else if(value instanceof Map)result={decoderMap:[...value].map(([k,v])=>[snapshot(k,seen,depth+1),snapshot(v,seen,depth+1)])}
 else result=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,snapshot(v,seen,depth+1)]))
 seen.delete(value);return result
}
// Retain all raw text items separately. Join adjacent glyph runs by geometry,
// so an inline font change cannot insert a space into a single authored word.
export function pdfTextFlow(items){
 let text='',previous=null
 for(const item of items){
  if(typeof item.str!=='string')continue
  if(item.str&&previous&&!/\s$/.test(text)&&!/^\s/.test(item.str)){
   const p=previous.transform,c=item.transform,length=Math.hypot(p?.[0]||0,p?.[1]||0),nextLength=Math.hypot(c?.[0]||0,c?.[1]||0)
   if(length&&nextLength){
    const ux=p[0]/length,uy=p[1]/length,dx=c[4]-p[4],dy=c[5]-p[5],sameDirection=Math.abs(ux*c[0]/nextLength+uy*c[1]/nextLength-1)<.001,sameLine=sameDirection&&Math.abs(-uy*dx+ux*dy)<Math.max(.5,Math.min(previous.height||length,item.height||nextLength)*.1)
    if(!sameLine)text+='\n'
    else if(dx*ux+dy*uy-(previous.width||0)>Math.max(.75,Math.min(previous.height||length,item.height||nextLength)*.12))text+=' '
   }else text+=' '
  }
  text+=item.str
  if(item.hasEOL){if(!text.endsWith('\n'))text+='\n';previous=null}else if(item.str)previous=item
 }
 return text.trim()
}
export async function readBhelNativePdf(value,{signal,loadDocument=getDocument}={}){
 signal?.throwIfAborted();const bytes=Buffer.from(value);need(bytes.length>0&&bytes.length<=4*1024*1024&&bytes.subarray(0,5).toString()==='%PDF-','unavailable/non-PDF document')
 let task,cleanupPromise,listener,output,primaryFailure,failed=false
 const cleanup=()=>task?(cleanupPromise??=destroyTask(task)):Promise.resolve()
 const aborted=new Promise((_,reject)=>{listener=()=>{cleanup().catch(()=>{});reject(signal.reason)};signal?.addEventListener('abort',listener,{once:true});if(signal?.aborted)listener()})
 aborted.catch(()=>{})
 const checked=async value=>{
  const promise=typeof value==='function'?Promise.resolve().then(()=>{signal?.throwIfAborted();return value()}):Promise.resolve(value)
  promise.catch(()=>{});signal?.throwIfAborted()
  try{const result=await Promise.race([promise,aborted]);signal?.throwIfAborted();return result}catch(error){signal?.throwIfAborted();throw error}
 }
 try{
  signal?.throwIfAborted()
  task=loadDocument({data:new Uint8Array(bytes),useWorkerFetch:false,isEvalSupported:false,enableXfa:false,disableAutoFetch:true,verbosity:VerbosityLevel.ERRORS,standardFontDataUrl:fileURLToPath(new URL('../../node_modules/pdfjs-dist/standard_fonts/',import.meta.url)).replaceAll('\\','/')})
  const pdf=await checked(task.promise);need(pdf.numPages>0&&pdf.numPages<=32,'unreviewed PDF page scope');const missingAPIs=[]
  const call=async(name,...args)=>{if(typeof pdf[name]!=='function'){missingAPIs.push(name);return{decoderAPIUnavailable:name}}return checked(()=>pdf[name](...args))}
  const metadata=await call('getMetadata'),optional=await call('getOptionalContentConfig'),optionalEntries=typeof optional?.[Symbol.iterator]==='function'?[...optional]:[]
  const optionalContent={entries:optionalEntries.map(([id,group])=>({id,properties:snapshot(group),visible:group.visible})),order:typeof optional?.getOrder==='function'?snapshot(optional.getOrder()):null,hash:typeof optional?.getHash==='function'?optional.getHash():null,hasInitialVisibility:typeof optional?.hasInitialVisibility==='function'?optional.hasInitialVisibility():optional?.hasInitialVisibility??null,serialized:snapshot(typeof optional?.serializable==='function'?optional.serializable():optional?.serializable)}
  const visibilityLimits=[];if(optionalEntries.some(([,group])=>group.visible===false))visibilityLimits.push('inactive-optional-content')
  const pageModels=[]
  for(let n=1;n<=pdf.numPages;n++){
   const page=await checked(()=>pdf.getPage(n)),content=await checked(()=>page.getTextContent({includeMarkedContent:true,disableNormalization:true})),operators=await checked(()=>page.getOperatorList());need(content.items.length<=50000&&operators.fnArray.length<=100000,'excessive decoded PDF page')
   const stack=[];let state={mode:0,fill:1,stroke:1}
   for(let i=0;i<operators.fnArray.length;i++){
    const op=operators.fnArray[i],args=operators.argsArray[i]
    if(op===OPS.save)stack.push({...state});else if(op===OPS.restore){need(stack.length>0,'unbalanced PDF graphics state');state=stack.pop()}
    else if(op===OPS.setTextRenderingMode)state.mode=args[0]
    else if(op===OPS.setGState)for(const[k,v]of args[0]||[]){if(k==='ca')state.fill=v;if(k==='CA')state.stroke=v}
    if([OPS.showText,OPS.showSpacedText,OPS.nextLineShowText,OPS.nextLineSetSpacingShowText].includes(op)){const mode=state.mode%4;if(mode===3||mode===0&&state.fill===0||mode===1&&state.stroke===0||mode===2&&state.fill===0&&state.stroke===0)visibilityLimits.push('invisible-text-rendering')}
   }
   for(const item of content.items)if(typeof item.str==='string'){
    const[x0,y0,x1,y1]=page.view,x=item.transform?.[4],y=item.transform?.[5],height=Math.abs(item.height||0)
    if(Number.isFinite(x)&&Number.isFinite(y)&&(x<x0-height||x>x1+height||y<y0-height||y>y1+height))visibilityLimits.push('off-page-text')
   }
   const pageCall=async(name,...args)=>{if(typeof page[name]!=='function'){missingAPIs.push('page.'+name);return{decoderAPIUnavailable:name}}return checked(()=>page[name](...args))}
   const annotations=await pageCall('getAnnotations',{intent:'display'}),structureTree=await pageCall('getStructTree'),javaScriptActions=await pageCall('getJSActions')
   const textContent=snapshot({...content,items:content.items.map(item=>Object.hasOwn(item,'fontName')?{...item,fontName:fontId(item.fontName)}:item),styles:Object.fromEntries(Object.entries(content.styles).map(([k,v])=>[fontId(k),v]))})
   const argsArray=operators.argsArray.map((args,i)=>{
    if(operators.fnArray[i]===OPS.dependency)return args.map(fontId)
    if(operators.fnArray[i]===OPS.setFont)return[fontId(args[0]),...args.slice(1)]
    return args
   })
   pageModels.push({pageNumber:n,view:snapshot(page.view),rotate:page.rotate,userUnit:page.userUnit,reference:snapshot(page.ref),isPureXfa:page.isPureXfa??false,text:pdfTextFlow(content.items),textContent,operatorList:snapshot({fnArray:Array.from(operators.fnArray),argsArray}),annotations:snapshot(annotations),structureTree:snapshot(structureTree),javaScriptActions:snapshot(javaScriptActions)})
  }
  const fields={};for(const[name,key]of[['getPermissions','permissions'],['getMarkInfo','markInfo'],['getPageLabels','pageLabels'],['getOutline','outline'],['getAttachments','attachments'],['getFieldObjects','fieldObjects'],['getJSActions','javaScriptActions'],['getCalculationOrderIds','calculationOrderIds'],['getDestinations','destinations']])fields[key]=snapshot(await call(name))
  const result={text:pageModels.map(p=>p.text).join('\n\n'),pages:pdf.numPages,pageCount:pdf.numPages,pageModels,metadata:{info:snapshot(metadata.info),rawXML:metadata.metadata?.getRaw?.()??null,contentDispositionFilename:metadata.contentDispositionFilename??null,contentLength:metadata.contentLength??null},documentMetadata:snapshot(metadata.info),fingerprints:snapshot(pdf.fingerprints),optionalContent,...fields,missingAPIs:[...new Set(missingAPIs)].sort(),visibilityQualified:visibilityLimits.length===0,visibilityLimits:[...new Set(visibilityLimits)],visibilityDiagnosticOnly:true,renderedCriteriaVisibilityQualified:false,publicationDateQualified:false,publisherProgramsExecuted:false,PDFJavaScriptActionsExecuted:false,decoderResourceIdNormalization:'only-parser-generated-g_d-counter-font-identifiers',modelCoverage:'whole-available-PDF.js-page-text-operators-geometry-annotations-forms-actions-and-document-metadata; complete-original-bytes-retained-separately'}
  need(Buffer.byteLength(JSON.stringify(result))<=8*1024*1024,'decoded PDF model exceeds bound');output=result
 }catch(error){failed=true;primaryFailure=error}finally{
  try{await checked(cleanup())}catch(error){if(!failed){failed=true;primaryFailure=error}}
  finally{signal?.removeEventListener('abort',listener)}
 }
 signal?.throwIfAborted()
 if(failed)throw primaryFailure
 return output
}
