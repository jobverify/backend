import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const HOME='https://drytis.com/',CAREERS=HOME+'careers/',PROGRAMS=[HOME+'assets/live-widget.js',HOME+'assets/one-tap.js'],profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url)))
const holds=['unqualified-third-party-rendering-and-employer-wide-inventory','newsletter-not-application-or-vacancy','no-typed-native-country-full-criteria-or-per-role-employer-inventory']
export async function runCurrentDrytis(options={}){
 const io=createCurrentReader(options,[[HOME,'html'],[CAREERS,'html'],...PROGRAMS.map(url=>[url,'javascript'])],{maxReads:8})
 try{
  const acquire=async()=>{
   const documents=[]
   for(const [i,expected]of profile.documents.entries()){
    const page=await io.read(expected.url);need(page.sha256===expected.sha256,'current complete publisher/program profile changed')
    if(i<2){const doc=readNativeDocument(page.text);need(!doc.nodes(n=>n.tag==='base').length,'unexpected native base');need(isDeepStrictEqual(activeHead(page.text).titles,[i===0?'drytis — Built with AI. Perfected by engineers.':'Careers — Drytis']),'current publisher title changed')
     if(i===0)need(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/'&&doc.text(n)==='Careers').length===1,'unique own careers declaration changed')
     else{need(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===CAREERS).length===1,'own careers canonical changed');need(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='No open roles right now .').length===1&&doc.nodes(n=>n.tag==='form'&&n.attrs.id==='notifyForm').length===1,'advertised empty newsletter state changed')}
     for(const program of PROGRAMS)need(doc.nodes(n=>n.tag==='script'&&new URL(n.attrs.src??'',HOME).href===program).length===1,'current unique own program declaration changed')
    }
    documents.push({url:expected.url,body:page.text})
   }
   return documents
  }
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'complete native publisher/program closing changed')
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:'Publisher advertises no open roles; '+holds.join('; ')})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'drytis',advertisedEmptyState:'No open roles right now .',newsletterFormId:'notifyForm',sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,employerWideScopeQualified:false,fullPublisherClosingEqual:true,fullOwnProgramClosingEqual:true,unreviewedExternalProgramDeclarations:['https://www.googletagmanager.com/gtag/js?id=G-1218QBZT6R','https://dashboard.searchatlas.com/scripts/dynamic_optimization.js'],originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true})
  return jobs
 }finally{io.close()}
}
