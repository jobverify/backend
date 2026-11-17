import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
export const SOURCE='startgenie',HOMEPAGE_URL='https://startgenie.co.in/',LANDER_URL=new URL('/lander',HOMEPAGE_URL).href
const reviewedRedirectSHA256='6dc9c7fc93bb488bb0520a6c780a8d3c0fb5486a4711aca49b4c53fac7393023'
const failure=message=>firstPartyFailure(SOURCE,message,{failureKind:'source_identity_unverified',sourceScopeComplete:false,currentEmployerIdentityQualified:false})
export function readCurrentUnqualifiedPublisher(page){
 const doc=readNativeDocument(page.body),programmeDeclarations=doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''}))
 return {url:page.url,sha256:page.sha256,wholeOriginalHTML:page.body,wholeObservedDOM:structuredClone(doc.nodes(()=>true)),programmeDeclarations,currentEmployerIdentityQualified:false,nativeInventoryQualified:false,
  parkingConfirmed:page.url===LANDER_URL&&programmeDeclarations.some(n=>n.body.includes('window.LANDER_SYSTEM="PW"'))&&programmeDeclarations.some(n=>n.body.includes('ap:"parking"'))&&programmeDeclarations.some(n=>/^https:\/\/img1\.wsimg\.com\/parking-lander\/static\/js\/main\.[a-z0-9]+\.js$/.test(n.attrs.src??''))}
}
export async function runCurrentNative(options={}){
 options.signal?.throwIfAborted()
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html']],learnedURL:(url,kind)=>url===LANDER_URL&&kind==='html'});let opening,closing
 const summary={source:SOURCE,currentEmployerIdentityQualified:false,nativeInventoryQualified:false,observedRecordCount:null,observedVacancyCount:null,companyIndiaTotal:null,companyGlobalTotal:null,companyIndiaZeroProven:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,parkingThirdPartyRequests:0,guessedCareerRouteRequests:0,applicationInteractions:0,programmesExecuted:false}
 const audit=()=>({...summary,nativeOpening:opening,nativeClosing:closing,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,
  holds:['configured-domain-does-not-establish-current-employer-identity','parking-content-and-absence-of-jobs-cannot-certify-employer-inventory-or-company-zero','third-party-parking-programmes-not-executed-or-requested']})
 async function authority(target){
  const home=await reader.read(HOMEPAGE_URL);target.home=readCurrentUnqualifiedPublisher(home)
  if(home.sha256!==reviewedRedirectSHA256)throw failure('Unreviewed configured-domain publisher/redirect programme; employer identity and native inventory remain unknown')
  // This is the exact literal /lander target in the observed root programme,
  // not a guessed career route or execution of a third-party parking script.
  reader.allow(LANDER_URL,'html');target.lander=readCurrentUnqualifiedPublisher(await reader.read(LANDER_URL))
  if(!target.lander.parkingConfirmed)throw failure('Declared lander publisher changed; current employer identity and native inventory remain unknown')
 }
 try{
  opening={};await authority(opening);closing={};await authority(closing)
  if(!isDeepStrictEqual(opening,closing))throw failure('Closing whole observed root/parking publisher model changed; employer identity remains unqualified')
  const evidence=audit();if(Buffer.byteLength(JSON.stringify(evidence))>8*1024*1024)throw failure('Unqualified native publisher evidence byte ceiling exceeded');reader.check()
  throw failure('Configured domain currently serves a declared parking lander; employer identity and vacancy inventory are unverified')
 }catch(error){
  options.signal?.throwIfAborted()
  try{if(error&&typeof error==='object'){Object.defineProperty(error,'recruitmentObservations',{value:audit(),configurable:true});Object.defineProperty(error,'abortRetries',{value:true,configurable:true})}}catch{}
  // Audit attachment may synchronously transfer caller ownership. Known HTTP
  // failures still outrank the local source timer, so only recheck the caller.
  options.signal?.throwIfAborted();throw error
 }finally{reader.close();options.signal?.throwIfAborted()}
}
