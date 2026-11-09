import {createHash} from 'node:crypto'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CAREERS_URL='https://www.camsonline.com/about-cams/careers'
const fail=(message,code='CAMS_PUBLIC_ENTRY_CHANGED',status=null)=>Object.assign(Error('CAMS public careers: '+message),{source:'cams',code,status,abortRetries:true,failureKind:[401,403,429].includes(status)?'blocked':'source_inventory_unavailable'})
const canonical=value=>{const url=new URL(value,CAREERS_URL);return url.origin+url.pathname.replace(/\/$/,'')}
const model=html=>{
 const doc=readNativeDocument(html),titles=doc.nodes(node=>node.tag==='title').map(node=>node.raw.trim()),canonicals=doc.nodes(node=>node.tag==='link'&&(node.attrs.rel||'').toLowerCase().split(/\s+/).includes('canonical')).map(node=>canonical(node.attrs.href)),roots=doc.nodes(node=>node.tag==='app-root')
 if(titles.length!==1||!/CAMS Careers.*CAMS Jobs Vacancy/i.test(titles[0])||canonicals.length!==1||canonicals[0]!==CAREERS_URL||roots.length!==1)throw fail('current corporate client-rendered entry changed; native inventory requires discovery')
 return{kind:'unresolved-client-rendered-careers-entry',title:titles[0],canonical:canonicals[0],applicationRoot:'app-root',renderedPublicRootText:doc.text(roots[0])||null,nativeVacancyTotal:null,indiaVacancyTotal:null,explicitNoOpeningsStatement:false}
}

export const createCurrentCamsScraper=defaults=>({async run(passed={}){
 const options={...defaults,...passed},caller=options.signal,budget=options.collectionBudgetMs??60000
 caller?.throwIfAborted()
 if(!Number.isSafeInteger(budget)||budget<=0||budget>300000)throw TypeError('Invalid CAMS collection budget')
 const deadline=new AbortController(),timeout=fail('collection deadline exceeded','CAMS_COLLECTION_TIMEOUT');timeout.name='TimeoutError'
 const timer=setTimeout(()=>deadline.abort(timeout),budget),signal=caller?AbortSignal.any([caller,deadline.signal]):deadline.signal,receipts=[]
 const read=async phase=>{
  const controller=new AbortController(),requestSignal=AbortSignal.any([signal,controller.signal,AbortSignal.timeout(15000)]),supplied=options.fetchPage??options.fetchText
  let response,reader
  const discard=async()=>{const body=reader??response?.body;if(body?.cancel)await withCallerSignal(()=>body.cancel(),AbortSignal.timeout(500)).catch(()=>{})}
  try{
   const request={method:'GET',redirect:'manual',signal:requestSignal,headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html,application/xhtml+xml,*/*;q=0.8'}}
   response=await withCallerSignal(()=>supplied?supplied(CAREERS_URL,request):(options.fetchImpl??globalThis.fetch)(CAREERS_URL,request),requestSignal)
   const textOnly=typeof response==='string',status=textOnly?null:response?.status,url=textOnly?null:response?.url
   if([401,403,429].includes(status))throw fail('HTTP '+status+' access denied','CAMS_PUBLIC_ACCESS_DENIED',status)
   if(!textOnly&&(status!==200||url!==CAREERS_URL))throw fail('public response status or final URL changed','CAMS_PUBLIC_RESPONSE_UNQUALIFIED',status??null)
   let html=textOnly?response:response.html??(typeof response.body==='string'?response.body:undefined),bytes
   if(html===undefined&&response.body?.getReader){reader=response.body.getReader();const chunks=[];let size=0;for(;;){const chunk=await withCallerSignal(()=>reader.read(),requestSignal);if(chunk.done)break;size+=chunk.value.byteLength;if(size>2*1024*1024)throw fail('public response exceeds byte limit');chunks.push(Buffer.from(chunk.value))}bytes=Buffer.concat(chunks);html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);reader.releaseLock();reader=null}
   else if(html===undefined&&typeof response.text==='function')html=await withCallerSignal(()=>response.text(),requestSignal)
   if(typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024)throw fail('public response body unavailable or oversized')
   const current=model(html);bytes??=Buffer.from(html);const record={phase,url:CAREERS_URL,finalUrl:url,status,firstParty:!textOnly,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};receipts.push(record)
   if(options.onResponse)await withCallerSignal(()=>options.onResponse({...record,bodyBase64:bytes.toString('base64')}),signal)
   return current
  }finally{controller.abort();await discard()}
 }
 const execute=async()=>{
  const opening=await read('opening'),closing=await read('closing');if(JSON.stringify(opening)!==JSON.stringify(closing))throw fail('public client-rendered entry changed during closing read')
  const evidence={status:'coverage-gap',surface:CAREERS_URL,firstParty:receipts.every(row=>row.firstParty),listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'client-rendered-careers-entry;app-root-and-marketing-metadata-are-not-native-vacancy-or-country-zero-proof'}
  const observations=[{source:'cams',company:'CAMS',sourceUrl:CAREERS_URL,jobId:null,requisitionId:null,country:null,postingDate:null,...opening,sourceScopeComplete:false,lifecycleCleanupAllowed:false}],audit={source:'cams',observations,opening,closing,closingReconciled:true,responses:receipts,inventoryEvidence:evidence,sourceScopeComplete:false,sourceDeclaredBoardScopeComplete:false,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,privateApplicationRequests:0,productionWrites:false}
  if(options.onRecords)await withCallerSignal(()=>options.onRecords(structuredClone(observations)),signal)
  if(options.onAudit)await withCallerSignal(()=>options.onAudit(structuredClone(audit)),signal)
  const jobs=attachInventoryEvidence([],evidence);attachSourceObservationEvidence(jobs,{source:'cams',recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false});signal.throwIfAborted();return jobs
 }
 try{return await withCallerSignal(execute,signal)}finally{clearTimeout(timer);deadline.abort()}
}})
