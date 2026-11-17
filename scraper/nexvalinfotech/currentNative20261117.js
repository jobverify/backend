import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
import{wholeHeldModel,check,unavailable}from'./currentModels20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentNexval(options={}){
 options.signal?.throwIfAborted();check(options.fetchImpl||!options.fetchText&&!options.fetchPage,'current acquisition requires metadata-aware fetchImpl; body-only callbacks are unqualified');const io=currentTransport({...options,label:'Nexval',allowedURL:u=>[p.root,p.current].includes(u)})
 try{const acquire=async()=>{const redirect=await io.read(p.root,'html',p.redirect);check(redirect.status===p.redirect.status,'actual published current locale redirect');const home=await io.read(p.current),doc=readNativeDocument(home.text),canon=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');check(!hasClientDocumentBase(home.text)&&equal(activeHead(home.text).titles,p.currentTitles)&&canon.length===1&&canon[0].attrs.href===p.canonical,'current active own Nexval publisher and canonical locale');const model={publishedRedirect:{url:redirect.url,status:redirect.status,location:redirect.location,fullNativeResponse:redirect.text},corporate:wholeHeldModel(home),remoteProgrammesAndNativeRecruitmentUnqualified:true,genericWorkingSessionIsNotJobApplication:true};io.checkpoint();return model},opening=await acquire(),closing=await acquire(),error=unavailable('nexvalinfotech','Current own Nexval locale publishes product/demo content without an independently qualified native recruitment inventory; former unlinked careers routes are not a current handoff.',io,opening,closing,{closingFullNativeModelsMatch:equal(opening,closing),pagesFetched:io.receipts.length});io.checkpoint();throw error}finally{io.close();options.signal?.throwIfAborted()}
}
