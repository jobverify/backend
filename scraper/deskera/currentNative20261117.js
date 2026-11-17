import{readFileSync}from'node:fs'
import{createHash}from'node:crypto'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{clientScriptDeclarations,hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8')),sha=s=>createHash('sha256').update(s).digest('hex'),tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:n.attrs,...(n.raw===undefined?{}:{raw:n.raw}),children:n.children.map(tree)}
const check=(ok,reason)=>{if(!ok)throw Object.assign(Error('Deskera current native contract: '+reason),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
export async function runCurrentDeskera(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'Deskera',allowedURL:url=>[profile.root,profile.home,profile.native].includes(url)})
 try{const corporate=async()=>{
   const redirect=await io.read(profile.root,'html',{status:307,location:'/in'});check(redirect.status===307&&redirect.location==='/in','literal current own regional redirect')
   const page=await io.read(profile.home),doc=readNativeDocument(page.text);check(!hasClientDocumentBase(page.text)&&equal(activeHead(page.text).titles,[profile.title]),'effective current own title/base identity')
   const canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');check(canonical.length===1&&canonical[0].attrs.href===profile.home,'exact current regional canonical')
   check(equal(clientScriptDeclarations(page.text).map(n=>({attrs:n.attrs,...(n.attrs.src?{}:{sha256:sha(n.raw??'')})})),profile.programs),'whole current corporate declaration graph')
   const links=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Careers');check(links.length>0&&links.every(n=>n.attrs.href===profile.native),'active exact current own Careers handoff')
   io.checkpoint();return{redirect:{status:redirect.status,url:redirect.url,location:redirect.location,text:redirect.text},url:page.url,fullNativeHTML:page.text,programs:profile.programs}
  },opening=await corporate(),native=await io.read(profile.native),doc=readNativeDocument(native.text)
  check(!hasClientDocumentBase(native.text),'unqualified native document base')
  const candidates=doc.nodes(n=>/^urn:li:jobPosting:\d+$/.test(n.attrs['data-entity-urn']??'')),unqualifiedNativeCandidates=candidates.map(n=>({id:n.attrs['data-entity-urn'],nativeRecord:tree(n),publishedText:doc.text(n),employer:doc.nodes(x=>x.tag==='h4',n).map(x=>doc.text(x)),sourceEmployerBound:false}))
  check(candidates.length>0,'current keyword page has no reviewable candidate rows; no empty certification')
  const closing=await corporate();check(equal(opening,closing),'whole current corporate passive context changed at closing');io.checkpoint()
  throw Object.assign(Error('Deskera declared Careers link currently returns a generic LinkedIn keyword search with unqualified other-employer candidates; no Deskera vacancy inventory or empty count is established'),{name:'DeskeraNativeInventoryUnavailableError',abortRetries:true,softFailure:true,failureKind:'source_inventory_unavailable',sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeCollectionEvidence:{source:'deskera',nativeOpeningCorporateModel:opening,nativeClosingCorporateModel:closing,closingCorporateModelMatches:true,currentNativeResponseHTML:native.text,unqualifiedNativeCandidates,sourceEmployerBindingsProven:false,observedVacancyCount:null,companyIndiaTotal:null,companyGlobalTotal:null,closingVacancyInventoryMatch:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationSubmitted:false,browserEquivalenceComplete:false,verifiedEmpty:false,retainedResponses:io.receipts}})
 }finally{io.close()}
}
