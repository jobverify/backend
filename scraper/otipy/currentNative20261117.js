import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
export const SOURCE='otipy',HOMEPAGE_URL='https://otipy.com/'
const own=(value,key)=>value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key)?.value:undefined
const describe=error=>{const cause=own(error,'cause');return {name:error instanceof TypeError?'TypeError':error instanceof Error?'Error':null,message:own(error,'message')??null,...(cause&&typeof cause==='object'?{cause:Object.fromEntries(['name','message','code','reason'].flatMap(key=>own(cause,key)===undefined?[]:[[key,own(cause,key)]]))}:{})}}
export async function defaultFetchPage(url,options={}){
 options.signal?.throwIfAborted()
 if(url!==HOMEPAGE_URL)throw firstPartyFailure(SOURCE,'Only the exact configured public root is admitted')
 const reader=createCurrentNativeReader({...options,requestTimeoutMs:options.timeoutMs??options.requestTimeoutMs??15000},{source:SOURCE,admitted:[[HOMEPAGE_URL,'html']]})
 try{const page=await reader.read(url);reader.check();return page}finally{reader.close()}
}
export async function runCurrentNative(options={}){
 options.signal?.throwIfAborted()
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html']]});let opening
 try{
  const page=await reader.read(HOMEPAGE_URL),doc=readNativeDocument(page.body)
  opening={url:page.url,sha256:page.sha256,wholeOriginalHTML:page.body,wholeObservedDOM:structuredClone(doc.nodes(()=>true)),programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),currentEmployerIdentityQualified:false}
  const evidence={nativeOpening:opening};if(Buffer.byteLength(JSON.stringify(evidence))>8*1024*1024)throw firstPartyFailure(SOURCE,'Unqualified publisher evidence byte ceiling exceeded');reader.check()
  throw firstPartyFailure(SOURCE,'Current configured publisher requires native employer/hiring review; inventory remains unknown',{failureKind:'source_identity_unverified'})
 }catch(error){
  options.signal?.throwIfAborted()
  try{if(error&&typeof error==='object'){Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,transportFailure:describe(error),sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,currentEmployerIdentityQualified:false,nativeInventoryQualified:false,observedRecordCount:null,observedVacancyCount:null,companyIndiaTotal:null,companyGlobalTotal:null,companyIndiaZeroProven:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,alternateHostRequests:0,guessedCareerRouteRequests:0,applicationInteractions:0,holds:['original-root-transport-or-unreviewed-publisher-is-not-a-vacancy-inventory','no-alternate-host-TLS-bypass-or-guessed-career-routes']},configurable:true});Object.defineProperty(error,'abortRetries',{value:true,configurable:true})}}catch{}
  options.signal?.throwIfAborted();throw error
 }finally{reader.close()}
}
