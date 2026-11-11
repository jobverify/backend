import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {extractPdfTextWorkerCore} from '../../scraper-support/shared/pdfTextWorkerCore.js'
import {createNativePdfTextContext} from '../../scraper-support/shared/nativePdfTextContext20261111.js'

const need=(ok,message)=>{if(!ok)throw Error('Workline public role: '+message)}
const text=value=>typeof value==='string'?value.trim():''
const origin='https://app52.workline.hr'
const hash=value=>createHash('sha256').update(value).digest('hex')

// A linked PDF belongs to the employer's native role, but its explicit title
// can still describe a broader template. Preserve that document and hold the
// unresolved identity instead of inventing an equivalence between job titles.
export function nativePDFRoleIdentity(pdf,record){
 const lines=Array.isArray(pdf?.pages)?pdf.pages.flatMap(page=>typeof page==='string'?page.split(/\r?\n/):[]).map(value=>value.replace(/\s+/g,' ').trim()).filter(Boolean):[]
 const titles=[]
 for(let index=0;index<lines.length;index++){
  const match=lines[index].match(/^Job\s+Title(?:\s*[:：]\s*|\s+)(.+)$/i)
  if(match)titles.push(match[1].trim())
  else if(/^Job\s+Title\s*[:：]?$/i.test(lines[index])&&lines[index+1])titles.push(lines[index+1])
 }
 const key=value=>text(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
 const distinct=new Map(titles.map(title=>[key(title),title]))
 const title=distinct.size===1?[...distinct.values()][0]:null
 const complete=Boolean(title&&key(title)&&key(title)===key(record?.Position_Name))
 return {title,complete,failureKind:complete?null:'native-description-role-title-unreconciled',
  qualification:'Explicit employer-linked PDF title compared with native vacancy; no title aliases inferred.'}
}

export function declaredRoleDescription(page,record){
 const doc=readNativeDocument(page.html),expected=new URL(page.url)
 need(expected.origin===origin&&expected.pathname.startsWith('/CandidatePortal/'+record.TrackToken+'/')&&!expected.search&&!expected.hash,'changed public role identity')
 const title=doc.nodes(n=>n.tag==='title').map(n=>decodeNativeEntities(n.raw||'').trim())
 const req=doc.nodes(n=>n.tag==='label'&&(n.attrs.class||'').split(/\s+/).includes('label')).map(n=>doc.text(n).trim())
 const placements=doc.nodes(n=>n.tag==='p').map(n=>doc.text(n).trim())
 need(title.length===1&&title[0]===text(record.Position_Name)&&req.filter(value=>value===text(record.Req_No)).length===1
  &&placements.includes(text(record.LOCATIONNAME)),'listing and visible role title, requisition or placement changed')
 const fields=name=>doc.nodes(n=>n.tag==='input'&&n.attrs.type==='hidden'&&n.attrs.id===name).map(n=>text(n.attrs.value))
 const prf=fields('PRFCode'),files=fields('hideJobSpecificationFile')
 need(prf.length===1&&/^[1-9]\d{0,15}$/.test(prf[0])&&prf[0]===String(record.PRFCode),'native PRF identity changed')
 need(files.length===1&&files[0]===text(record.JobSpecificationFile)&&files[0].length<=240
  &&!/[\\/\u0000-\u001f]/.test(files[0])&&/\.pdf$/i.test(files[0]),'native description file changed or unavailable')
 const activeText=doc.nodes(n=>n.tag==='root').map(n=>doc.text(n)).join(' ')
 need(/Copyright\s+\d{4}\s+SMFG India Credit\b/.test(activeText),'native role publisher changed')
 const prefixes=new Set();let viewer=false,nodes=0
 for(const script of doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&/^(?:|(?:application|text)\/(?:java|ecma)script)$/i.test(n.attrs.type||''))){
  const stack=[parse(script.raw||'',{ecmaVersion:'latest'})]
  while(stack.length){
   const node=stack.pop();if(!node||typeof node!=='object')continue
   need(++nodes<=120000,'native viewer script bound')
   if(node.type==='VariableDeclarator'&&node.id?.name==='url'&&node.init?.type==='BinaryExpression'&&node.init.operator==='+'){
    const {left,right}=node.init,call=right?.callee
    if(left.type==='Literal'&&typeof left.value==='string'&&call?.type==='MemberExpression'&&!call.computed&&call.property?.name==='val'
     &&call.object?.type==='CallExpression'&&call.object.callee?.name==='$'&&call.object.arguments.length===1
     &&call.object.arguments[0]?.value==='#hideJobSpecificationFile'&&right.arguments.length===0)prefixes.add(left.value)
   }
   if(node.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&!node.callee.computed
    &&node.callee.object?.name==='PDFJS'&&node.callee.property?.name==='getDocument'&&node.arguments[0]?.name==='url')viewer=true
   for(const [key,value]of Object.entries(node))if(!['start','end'].includes(key)){
    if(Array.isArray(value))stack.push(...value.filter(v=>v&&typeof v==='object'))
    else if(value&&typeof value==='object')stack.push(value)
   }
  }
 }
 need(viewer&&prefixes.size===1,'current page does not declare a unique native PDF viewer')
 const url=new URL([...prefixes][0]+encodeURIComponent(files[0]),page.url)
 need(url.origin===origin&&url.pathname==='/CPortal/CanPRFApply.aspx'&&!url.hash&&!url.username&&!url.password&&!url.port
  &&[...url.searchParams.keys()].sort().join(',')==='ModeFlag,filename'&&url.searchParams.get('ModeFlag')==='V'
  &&url.searchParams.get('filename')===files[0],'native viewer is not the published read-only PDF operation')
 return {url:url.href,filename:files[0],nativePRFCode:prf[0],roleHTMLSHA256:hash(page.html)}
}

export async function readDescriptionPDF(bytes,{signal}={}){
 signal?.throwIfAborted()
 const context=createNativePdfTextContext({signal})
 try{
  const data=Buffer.from(bytes)
  need(data.length>100&&data.length<=4e6&&data.subarray(0,5).toString()==='%PDF-','missing or oversized PDF bytes')
  const native=await extractPdfTextWorkerCore(data,{...context,maxPages:30,includePageTextItems:true})
  need(Number.isInteger(native.numPages)&&native.numPages>0&&native.numPages<=30,'native PDF page bound')
  need(Array.isArray(native.pageTextItems)&&native.pageTextItems.length===native.numPages,'native PDF pages are incomplete')
  // Retain the source's original item/EOL layout. Blank EOL items delimit
  // employer title fields and cannot be dropped by a general text formatter.
  const pages=native.pageTextItems.map(items=>items.map(item=>item.str+(item.hasEOL?'\n':' ')).join(' ')
   .replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim())
  for(const body of pages)need(typeof body==='string'&&body.length>30,'a native PDF page has no complete extractable text')
  const description=pages.join('\n\n')
  need(description.length>=100&&description.length<=300000,'native PDF description bound')
  context.check()
  return {text:description,pages,sha256:hash(data)}
 }finally{context.close()}
}

export async function fetchDescriptionPDF(url,{signal}={}){
 const target=new URL(url)
 need(target.origin===origin&&target.pathname==='/CPortal/CanPRFApply.aspx'&&target.searchParams.get('ModeFlag')==='V','unqualified native PDF URL')
 const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(20000)].filter(Boolean)),redirect:'error',credentials:'omit',headers:{Accept:'application/pdf,application/octet-stream'}})
 need(response.status===200&&response.url===url,'native PDF HTTP '+response.status)
 need(/^(?:application\/(?:pdf|octet-stream))\b/i.test(response.headers.get('content-type')||''),'native description is not a PDF response')
 const reader=response.body?.getReader();need(reader,'missing PDF body')
 const chunks=[];let size=0
 try{for(;;){signal?.throwIfAborted();const row=await reader.read();if(row.done)break;size+=row.value.byteLength;need(size<=4e6,'native PDF body bound');chunks.push(Buffer.from(row.value))}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 return Buffer.concat(chunks)
}
