import {createHash} from 'node:crypto'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CAREERS_URL='https://www.capillarytech.com/careers/'
const fail=(message,code='CAPILLARY_PUBLIC_SURFACE_CHANGED')=>Object.assign(new Error('Capillary Technologies: '+message),{code,abortRetries:true})
const sha=body=>createHash('sha256').update(body).digest('hex')
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const denied=status=>Object.assign(fail('public HTTP '+status+' access denied','CAPILLARY_PUBLIC_ACCESS_DENIED'),{status,failureKind:'blocked'})
const pendingModel=html=>{
 const doc=readNativeDocument(html),title=doc.nodes(node=>node.tag==='title').map(node=>norm(node.raw)),root=doc.nodes(node=>node.tag==='root')[0],text=doc.text(root)
 const message=text.match(/hand-crafting a brand-new careers experience[\s\S]*?live soon/i)?.[0]
 if(!title.some(value=>/capillary/i.test(value))||!message)throw fail('current careers page changed; a native vacancy collector is required')
 return{kind:'careers-experience-under-construction',title:title[0],message:norm(message),nativeVacancyTotal:null,indiaVacancyTotal:null}
}

export const createCurrentCapillaryScraper=(defaults={})=>({async run(passed={}){
 const options={...defaults,...passed},caller=options.signal,budget=options.collectionBudgetMs??60000
 caller?.throwIfAborted()
 if(!Number.isSafeInteger(budget)||budget<=0||budget>600000)throw new TypeError('Invalid Capillary collection budget')
 const controller=new AbortController(),timeout=fail('public collection deadline exceeded','CAPILLARY_COLLECTION_TIMEOUT')
 timeout.name='TimeoutError'
 const timer=setTimeout(()=>controller.abort(timeout),budget),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[]
 const read=async phase=>{
  const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal,AbortSignal.timeout(15000)])
  try{
  const request={signal:requestSignal,method:'GET',redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html,application/xhtml+xml,*/*;q=0.8'}}
  const supplied=options.fetchPage??options.fetchText
  const response=await withCallerSignal(()=>supplied?supplied(CAREERS_URL,request):(options.fetchImpl??globalThis.fetch)(CAREERS_URL,{...request,signal:requestSignal}),requestSignal)
  const textOnly=typeof response==='string',status=textOnly?null:response?.status,url=textOnly?null:response?.url
  const discard=async()=>{if(response?.body?.cancel)await withCallerSignal(()=>response.body.cancel(),[signal,AbortSignal.timeout(500)]).catch(()=>{})}
  if([401,403,429].includes(status)){
   await discard()
   throw denied(status)
  }
  if(!textOnly&&(status!==200||url!==CAREERS_URL)){await discard();throw Object.assign(fail('public response status or URL changed'),{status:status??null,failureKind:'source_unavailable'})}
  let html=textOnly?response:typeof response?.html==='string'?response.html:typeof response?.body==='string'?response.body:response?.text
  if(typeof html==='function')html=await withCallerSignal(()=>html.call(response),requestSignal)
  if(typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024)throw fail('public page is missing or exceeds the input limit')
  if(/<(?:title|h1)\b[^>]*>\s*(?:Just a moment|Access denied|Verify you are human|Captcha|Checking your browser)|\bid=["'](?:challenge-form|cf-chl-)/i.test(html))throw denied(status??200)
  receipts.push({phase,requestedUrl:CAREERS_URL,finalUrl:url,status,firstPartyResponse:!textOnly,bytes:Buffer.byteLength(html),sha256:sha(html)})
  return pendingModel(html)
  }finally{requestController.abort()}
 }
 const execute=async()=>{
  const opening=await read('opening'),closing=await read('closing')
  if(JSON.stringify(opening)!==JSON.stringify(closing))throw fail('current hiring-entry model changed during closing verification')
  const stamp=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
  if(typeof stamp!=='string'||!Number.isFinite(Date.parse(stamp)))throw new TypeError('Invalid Capillary observation clock')
  const observations=[{source:'capillarytechnologies',kind:'hiring-entry-under-construction',sourceUrl:CAREERS_URL,jobId:null,requisitionId:null,...opening,sourceScopeComplete:false,lifecycleCleanupAllowed:false}]
  const evidence={status:'coverage-gap',surface:CAREERS_URL,firstParty:receipts.every(row=>row.firstPartyResponse),listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:stamp,
   reason:'public-careers-experience-under-construction;native-vacancy-inventory-and-work-countries-unknown'}
  const audit={source:'capillarytechnologies',observations,opening,closing,closingReconciled:true,publicPages:receipts,inventoryEvidence:evidence,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,productionWrites:false}
  await withCallerSignal(()=>options.onAudit?.(structuredClone(audit)),signal)
  await withCallerSignal(()=>options.onRecords?.(structuredClone(observations)),signal)
  const jobs=attachInventoryEvidence([],evidence)
  attachSourceObservationEvidence(jobs,{source:'capillarytechnologies',recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false})
  Object.defineProperty(jobs,'sourceAudit',{value:audit})
  return jobs
 }
 try{return await withCallerSignal(execute,signal)}finally{clearTimeout(timer)}
}})
