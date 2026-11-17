import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
import{wholeHeldModel,check,unavailable}from'./currentModels20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentKarbonn(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'Karbonn',allowedURL:url=>[...p.redirects.map(r=>r.url),p.landing].includes(url)})
 try{const acquire=async()=>{const redirects=[];for(const binding of p.redirects){const r=await io.read(binding.url,'html',{status:binding.status,location:binding.location});check(r.status===binding.status,'exact current publisher routing status');redirects.push({url:r.url,status:r.status,location:r.location,fullNativeResponse:r.text})}
   const page=await io.read(p.landing),doc=readNativeDocument(page.text);check(!hasClientDocumentBase(page.text)&&equal(activeHead(page.text).titles,p.landingTitles),'current actual product-landing identity');const joins=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Join the list');check(joins.length===1&&joins[0].attrs.href===p.productJoinHandoff,'actual product marketing handoff retained without recruitment promotion');io.checkpoint();return{redirects,currentLanding:wholeHeldModel(page),productJoinDeclaration:{attrs:joins[0].attrs,text:doc.text(joins[0])},nativeEmployerLegalContinuityQualified:false}
  },opening=await acquire(),closing=await acquire();io.checkpoint()
  throw unavailable('karbonn','Karbonn configured own domains currently redirect to a Karbonn Rebel product-launch landing; its Join-the-list link is an Amazon product handoff, not a qualified employer vacancy inventory',io,opening,closing,{closingFullNativeModelMatches:equal(opening,closing),nativeEmployerLegalContinuityQualified:false,productStoreNavigationPerformed:false,staleCareerRoutesRequested:false})
 }finally{io.close()}
}
