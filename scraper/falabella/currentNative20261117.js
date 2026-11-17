import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
import{wholeHeldModel,check,unavailable}from'./currentModels20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentFalabella(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'Falabella',allowedURL:url=>[p.root,p.home,p.native].includes(url)})
 try{const redirect=await io.read(p.root,'html',{status:301,location:p.home});check(redirect.status===301,'Falabella literal owned current regional redirect')
  const page=await io.read(p.home),doc=readNativeDocument(page.text);check(!hasClientDocumentBase(page.text)&&equal(activeHead(page.text).titles,p.homeTitles),'Falabella active current corporate title/base')
  const links=doc.nodes(n=>n.tag==='a'&&doc.text(n)===p.careersLabel);check(links.length===1&&links[0].attrs.href===p.native,'Falabella unique active current own recruitment handoff')
  const opening={corporate:wholeHeldModel(page),redirect:{url:redirect.url,status:redirect.status,location:redirect.location,fullNativeResponse:redirect.text},recruitmentDeclaration:{attrs:links[0].attrs,text:doc.text(links[0])}}
  try{const native=await io.read(p.native);throw unavailable('falabella','Falabella declared native response requires review before any current vacancy inventory or country/employer/criteria qualification',io,{...opening,unreviewedNativeResponse:wholeHeldModel(native)},null,{closingNativeInventoryProven:false})}catch(error){options.signal?.throwIfAborted();if(error.status!==404||error.requestedUrl!==p.native||error.responseUrl!==p.native)throw error
   const held=unavailable('falabella','Falabella current own corporate recruitment link returns HTTP404; current employer vacancy inventory is unavailable and no company empty count is established',io,opening,null,{closingNativeInventoryProven:false,nativeHTTPFailure:{requestedURL:error.requestedUrl,responseURL:error.responseUrl,status:error.status,contentType:error.contentType,responseBodyAccepted:false,failedBeforeClosing:true}});Object.assign(held,{status:error.status,httpStatus:error.status,code:error.code,requestedUrl:error.requestedUrl,responseUrl:error.responseUrl});throw held
  }
 }finally{io.close()}
}
