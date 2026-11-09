import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence,normalizeInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CORPORATE_HOME,CORPORATE_CAREERS,ATS_ROOT,IDENTIFIER,EMPLOYER,APPLICATION_CLIENT,parseCorporate,verifyDetail,mapNative,verifyApplication,buildLocationCountryReferences} from './native.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import candidate from './catalog-candidate.json' with {type:'json'}

export const SOURCE='myclassboard', COMPANY='MyClassboard'
export const FIRST_PARTY_CAREERS_URL='https://www.myclassboard.com/careers/'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createMyClassboardScraper=(defaults={})=>({async run(options={}) {
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000,now=new Date()}={...defaults,...options}
 const sourceNow=typeof now==='function'?now():now
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let pagesFetched=0,surface=CORPORATE_HOME,timer,onAbort
 const gap=(reason,cause)=>Object.assign(new Error('MyClassboard coverage gap: '+reason,{cause}),{
  code:'MYCLASSBOARD_COVERAGE_GAP',sourceListingComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason}),
 })
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=gap('Aggregate source deadline exceeded');controller.abort(error);reject(error)},timeoutMs)
 })
 const collect=async()=>{
  const read=async url=>{
   surface=url;controller.signal.throwIfAborted()
   const response=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html,application/json'}})
   if(controller.signal.aborted)void response.body?.cancel?.(controller.signal.reason).catch(()=>{})
   controller.signal.throwIfAborted()
   if(response.status!==200||response.url!==url)throw gap('Source HTTP failure or final URL changed')
   let body
   if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let bytes=0
    const cancel=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
    controller.signal.addEventListener('abort',cancel,{once:true})
    try{while(true){controller.signal.throwIfAborted();const {done,value}=await reader.read();controller.signal.throwIfAborted();if(done)break;bytes+=value.byteLength;if(bytes>4000000){void reader.cancel().catch(()=>{});throw gap('Source body exceeds bound')}chunks.push(value)}body=Buffer.concat(chunks).toString('utf8')}
    finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock()}
   }else body=await response.text()
   controller.signal.throwIfAborted()
   if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>4000000)throw gap('Source body missing or exceeds bound')
   pagesFetched++;retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
   return body
  }
  const home=await read(CORPORATE_HOME),careers=await read(CORPORATE_CAREERS)
  const cards=parseCorporate(home,careers)
  const shell=await read(ATS_ROOT.slice(0,-1))
  const scripts=document(shell).nodes(n=>n.tag==='script').map(n=>n.raw||'').join('\n')
  const docPath=scripts.match(/fetch\('([^']+)'\)/)?.[1]
  if(!docPath?.startsWith('/ats/documents/'+IDENTIFIER+'/careerportal/')||!docPath.endsWith('.html'))throw gap('Native Keka document handoff changed')
  const portal=await read(new URL(docPath,ATS_ROOT).href)
  if(!portal.includes("identifier: '"+IDENTIFIER+"'")||!portal.includes("domain: '"+ATS_ROOT+"'"))throw gap('Native tenant configuration changed')
  const info=JSON.parse(await read(ATS_ROOT+'api/organization/default/careerportalinfo'))
  if(info.name!==EMPLOYER||info.shortName!==EMPLOYER||info.careersPortalDomain!=='mcb.keka.com'||info.companyWebsite!=='https://www.myclassboard.com/')throw gap('Exact native employer identity changed')
  const group=JSON.parse(await read(ATS_ROOT+'api/embedjobs/grouplinkstatus/'+IDENTIFIER))
  if(group.isGroupLinked!==false)throw gap('Unreviewed grouped employer scope')
  const rows=JSON.parse(await read(ATS_ROOT+'api/embedjobs/default/active/'+IDENTIFIER))
  if(!Array.isArray(rows)||rows.some(r=>!Number.isSafeInteger(r?.id)||r.id<=0||typeof r.title!=='string'||!r.title.trim())||new Set(rows.map(r=>r.id)).size!==rows.length||rows.length>200)throw gap('Native active inventory malformed or outside request bound')
  const client=await read(APPLICATION_CLIENT)
  if(!client.includes('applyjob/${e[t-1]}')||!client.includes('$("#apply-job").on("click"')||!client.includes('window.location.href=applyJobUrl'))throw gap('Native application button route changed')
  const locationCountryReferences=buildLocationCountryReferences(rows),jobs=[],exclusions=[]
  for(const row of rows){
   const description=verifyDetail(await read(ATS_ROOT+'jobdetails/'+row.id),row)
   verifyApplication(await read(ATS_ROOT+'applyjob/'+row.id),row)
   const job=mapNative(row,description,{now:sourceNow,locationCountryReferences})
   if(job)jobs.push(job);else exclusions.push({id:String(row.id),title:row.title,reason:'explicit-India-country-unproven',nativePostingDate:row.publishedOn})
  }
  const reason='Current corporate careers cards bind exact MyClassboard Keka employer; native active array, individual details, application client and individual application forms recovered. Corporate cards differ from native inventory and some observed records lack explicit country; whole-company scope remains incomplete, cleanup disabled.'
  const result=attachInventoryEvidence(jobs,{status:'discovery-only',surface:ATS_ROOT,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:{retainedResponses,nativeRecordCount:rows.length,corporateCardCount:cards.length,exclusions,lifecycleCleanupAllowed:false}})
  attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,
   observedVacancyCount:rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return result
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='MYCLASSBOARD_COVERAGE_GAP')throw error;throw gap('Native source transport, body or inventory unavailable',error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createMyClassboardScraper(options).run(options)
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/myclassboard/script.js')){
 const jobs=await run()
 if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
}
