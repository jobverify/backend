import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,need,readMmcPage} from './nativeFields.js'
import {createMmcPublicRead} from './publicRead.js'
export async function runMmcNative(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchPage&&!options.fetchJson&&!options.fetchBinary,'HTTP response metadata required; body-only transports unsupported')
 need(options.maxPages==null,'native single-page observation has no supported page cap')
 const cap=options.maxJobs??Infinity;need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),receipts=[]
 let jobs=[],nativeRecords=null
 if(cap!==0){
  const transport=createMmcPublicRead(options,receipts)
  try{
   const {receipt}=await transport.read(CAREERS),page=readMmcPage(receipt.rawHTML);nativeRecords=page.rows.length
   jobs=page.rows.map(j=>({...j,sourceRawNativeHTML:receipt.rawHTML,sourceRawNativeHTMLSHA256:receipt.bodySHA256,scrapedAt:clock,
    companyCareerPage:CAREERS,companyDomain:'mmcinfotech.com',atsPlatform:'official-company-careers'})).slice(0,cap)
  }finally{transport.close()}
 }
 const audit={source:'mmcinfotechservices',observedAt:clock,nativeRecords,returnedRecords:jobs.length,responses:structuredClone(receipts),complete:false,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,unresolved:['native-role-country-unproven','native-posting-identity-unproven','closing-observation-not-collected','company-recruitment-scope-unverified',...(cap!==Infinity?['caller-result-limit']:[])]}
 Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:audit})
 if(nativeRecords!==null)attachSourceObservationEvidence(jobs,{source:'mmcinfotechservices',recordKind:'vacancy-rows',observedRecordCount:nativeRecords,observedVacancyCount:nativeRecords,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:receipts.length===1,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,
  reason:'Original inline role descriptions retained; native work country, posting identity, closing reconciliation and complete company scope remain unverified'})
 options.signal?.throwIfAborted()
 if(options.onAudit){
  let abort
  const cancelled=new Promise((_,reject)=>{abort=()=>reject(options.signal.reason);options.signal?.addEventListener('abort',abort,{once:true})})
  try{await Promise.race([Promise.resolve().then(()=>options.onAudit(audit)),cancelled])}finally{options.signal?.removeEventListener('abort',abort)}
 }
 options.signal?.throwIfAborted();return jobs
}
