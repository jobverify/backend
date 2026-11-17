import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {hasClientDocumentBase} from '../../scraper-support/utils/reviewedClientProgram.js'
import {currentGmmcoTransport} from './currentTransport20261117.js'
const HOME='https://www.gmmco.in/about/careers',HANDOFF='https://gmmco.darwinbox.in/ms/candidate/careers'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Gmmco current native contract: '+message),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
export async function runCurrentGmmco(options={}){
 options.signal?.throwIfAborted()
 const io=currentGmmcoTransport({...options,allowedURL:url=>[HOME,HANDOFF].includes(url)})
 try{
  const home=await io.read(HOME),doc=readNativeDocument(home.text),titles=activeHead(home.text).titles
  check(!hasClientDocumentBase(home.text)&&titles.length===1&&['Job Openings at Gmmco | Build Your Career with Us','Job Openings at GMMCO | Build Your Career with Us'].includes(titles[0]),'current corporate title/base identity')
  check(doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&doc.text(n)==="Join us in shaping India's future").length===1,'current corporate hiring heading')
  const links=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='VIEW JOB OPENINGS')
  check(links.length===1&&links[0].attrs.href===HANDOFF,'active exact native careers handoff')
  const native=await io.read(HANDOFF)
  check(isDeepStrictEqual(activeHead(native.text).titles,['Gmmco'])&&native.bodyBytes===1247&&native.bodySHA256==='e29eb428182bc7009a91419b11e97ed3670daca110b2eff18462ef8cad8f0a7b','reviewed native metadata-only response changed')
  const error=Object.assign(Error('Gmmco declared current Darwinbox page publishes only branded metadata; no vacancy inventory, native recruitment client or current API handoff is available'),{
   name:'GmmcoNativeInventoryUnavailableError',abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:'source_inventory_unavailable',sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   nativeCollectionEvidence:{source:'gmmco',observedListingCount:null,candidateDetails:null,companyGlobalTotal:null,companyIndiaTotal:null,
    currentCorporateHandoff:{url:HOME,title:titles[0],label:doc.text(links[0]),href:HANDOFF},nativeResponseBody:native.text,
    failures:[{stage:'native-inventory',reason:'declared-current-native-metadata-only;no-vacancy-authority'}],retainedResponses:io.receipts,
    listingPaginationComplete:false,closingInventoryMatches:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false},
  })
  throw error
 }finally{io.close()}
}
