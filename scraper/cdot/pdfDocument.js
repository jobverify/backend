import {createHash} from 'node:crypto'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Published PDF: '+message),{abortRetries:true,code:'PUBLISHED_PDF_UNQUALIFIED'})}
const normalize=value=>String(value??'').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim()
export async function readPublishedPdf(value,{signal}={}){
 signal?.throwIfAborted()
 const bytes=Buffer.from(value)
 check(bytes.length>100&&bytes.length<=4000000&&bytes.subarray(0,5).toString()==='%PDF-','native PDF bytes unavailable or oversized')
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 signal?.throwIfAborted()
 const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,verbosity:0})
 const quietDestroy=()=>{try{Promise.resolve(task.destroy()).catch(()=>{})}catch{}}
 let listener
 const interrupted=signal?new Promise((_,reject)=>{listener=()=>{reject(signal.reason);quietDestroy()};signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()}):null
 const wait=promise=>interrupted?Promise.race([promise,interrupted]):promise
 try{
  const pdf=await wait(task.promise)
  check(Number.isInteger(pdf.numPages)&&pdf.numPages>=1&&pdf.numPages<=100,'native page count exceeds review bound')
  const pages=[],fontReferences=new Map();let characters=0,itemsRead=0
  // PDF.js allocates a new document prefix on each parse. These aliases are
  // renderer bookkeeping, not publisher font names. Keep the original mapping
  // separately and use local references in the page model.
  const fontReference=name=>{if(!fontReferences.has(name))fontReferences.set(name,'font-'+(fontReferences.size+1));return fontReferences.get(name)}
  for(let number=1;number<=pdf.numPages;number++){
   signal?.throwIfAborted()
   const page=await wait(pdf.getPage(number)),content=await wait(page.getTextContent()),annotations=await wait(page.getAnnotations({intent:'display'}))
   const items=content.items.filter(item=>typeof item.str==='string').map(item=>({text:item.str,x:item.transform[4],y:item.transform[5],endOfLine:item.hasEOL===true,
    width:item.width,height:item.height,fontReference:fontReference(item.fontName),dir:item.dir,transform:structuredClone(item.transform)}))
   const text=normalize(items.map(item=>item.text+(item.endOfLine?'\n':' ')).join(' '))
   characters+=text.length;itemsRead+=items.length
   check(text.length>30&&characters<=500000&&itemsRead<=100000,'native page text unavailable or document model exceeds review bound')
   pages.push({number,width:page.view[2]-page.view[0],height:page.view[3]-page.view[1],text,items,
    styles:Object.fromEntries(Object.entries(content.styles).map(([name,style])=>[fontReference(name),structuredClone(style)])),annotations:structuredClone(annotations)})
  }
  const metadata=await wait(pdf.getMetadata()),attachments=await wait(pdf.getAttachments()),fields=await wait(pdf.getFieldObjects()),actions=await wait(pdf.getJSActions())
  check(!attachments||!Object.keys(attachments).length,'native PDF attachments require separate review')
  check(!fields||!Object.keys(fields).length,'native PDF form fields require separate review')
  check(!actions||!Object.keys(actions).length,'native PDF actions require separate review')
  signal?.throwIfAborted()
  return {pages,totalPages:pdf.numPages,text:pages.map(page=>page.text).join('\n\n'),sha256:createHash('sha256').update(bytes).digest('hex'),
   metadata:{info:structuredClone(metadata.info),xml:metadata.metadata?.getRaw()??null},attachments:null,fields:null,actions:null,
   rendererFontAliases:[...fontReferences].map(([rendererFontName,localReference])=>({rendererFontName,localReference}))}
 }finally{if(listener)signal.removeEventListener('abort',listener);quietDestroy()}
}
export function pdfBoxText(page,{left,right,bottom,top}){
 const items=page.items.filter(item=>item.x>=left&&item.x<right&&item.y>=bottom&&item.y<=top&&item.text.trim()).sort((a,b)=>b.y-a.y||a.x-b.x)
 const lines=[]
 for(const item of items){const last=lines.at(-1);if(!last||Math.abs(last.y-item.y)>2)lines.push({y:item.y,items:[item]});else last.items.push(item)}
 return normalize(lines.map(line=>line.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ')).join(' '))
}
