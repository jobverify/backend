import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
import{wholeHeldModel,check,unavailable}from'./currentModels20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentIBall(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'iBall',allowedURL:url=>url===p.root})
 try{const acquire=async()=>{const page=await io.read(p.root),doc=readNativeDocument(page.text);check(!hasClientDocumentBase(page.text)&&equal(activeHead(page.text).titles,p.titles),'iBall active own current title/base');check(equal(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs),p.canonical),'iBall active exact own canonical')
   const links=doc.nodes(n=>n.tag==='a'&&doc.text(n)===p.careersLabel);check(links.length===1&&links[0].attrs.href===p.handoff,'iBall unique active general HR mailto handoff');io.checkpoint();return{corporate:wholeHeldModel(page),generalRecruitmentIntake:{attrs:links[0].attrs,text:doc.text(links[0]),perRoleApplication:false}}},opening=await acquire(),closing=await acquire();io.checkpoint()
  throw unavailable('iball','iBall current own Careers declaration is a general HR email intake; no role inventory, per-role application, country or complete vacancy criteria is established',io,opening,closing,{closingFullNativeModelMatches:equal(opening,closing),hrMessageSent:false,companyVacancyInventoryProven:false})
 }finally{io.close()}
}
