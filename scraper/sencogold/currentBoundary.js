import {createHash} from 'node:crypto'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CAREERS_URL='https://www.sencogold.com/career'
const FORM_URL='https://www.sencogold.com/career_submit'
const MAX_BYTES=2*1024*1024
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const sha=value=>createHash('sha256').update(value).digest('hex')
const fail=(message,code='SENCO_PUBLIC_SURFACE_CHANGED',status=null)=>Object.assign(new Error('Senco Gold: '+message),{
 source:'sencogold',code,status,abortRetries:true,softFailure:true,
 failureKind:[401,403,429].includes(status)?'blocked_or_access_denied':'source_inventory_unavailable',
 inventoryEvidence:{status:'coverage-gap',surface:CAREERS_URL,firstParty:false,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:message},
})
const descendants=node=>node.inert?[]:[node,...node.children.filter(child=>typeof child!=='string').flatMap(descendants)]
const model=html=>{
 const doc=readNativeDocument(html),titles=doc.nodes(node=>node.tag==='title').map(node=>norm(node.raw)),headings=doc.nodes(node=>/^h[12]$/.test(node.tag)).map(doc.text)
 if(titles.length!==1||!/career.*senco/i.test(titles[0])||!headings.includes('Career')||!headings.includes('Join Us'))throw fail('current corporate careers identity changed')
 const forms=doc.nodes(node=>node.tag==='form'&&String(node.attrs.method).toLowerCase()==='post'&&new URL(node.attrs.action??'',CAREERS_URL).href===FORM_URL)
 if(forms.length!==1)throw fail('current public resume form changed')
 const fields=descendants(forms[0]).filter(node=>['input','select','textarea'].includes(node.tag)&&String(node.attrs.type).toLowerCase()!=='hidden'&&node.attrs.name).map(node=>({tag:node.tag,name:node.attrs.name,type:node.attrs.type==null?null:node.attrs.type.toLowerCase()}))
 if(fields.filter(field=>field.name==='position_applying_for'&&field.tag==='input'&&field.type==='text').length!==1||fields.filter(field=>field.name==='cv'&&field.type==='file').length!==1)throw fail('free-text public resume intake changed; a native vacancy collector may be required')
 const hiringLinks=doc.nodes(node=>node.tag==='a'&&node.attrs.href&&/career|vacanc|job|opening/i.test(doc.text(node)+' '+node.attrs.href)).map(node=>({text:doc.text(node),url:new URL(node.attrs.href,CAREERS_URL).href}))
 if(hiringLinks.some(link=>link.url!==CAREERS_URL))throw fail('new current public hiring handoff requires native inventory discovery')
 return{kind:'general-resume-intake',title:titles[0],headings,formUrl:FORM_URL,fields,hiringLinks,nativeVacancyTotal:null,indiaVacancyTotal:null}
}

export const createCurrentSencoGoldScraper=()=>({async run(options={}){
 const caller=options.signal,budget=options.collectionBudgetMs??60000,requestBudget=options.requestTimeoutMs??15000
 caller?.throwIfAborted()
 if(!Number.isSafeInteger(budget)||budget<=0||budget>300000||!Number.isSafeInteger(requestBudget)||requestBudget<=0||requestBudget>30000)throw new TypeError('Invalid Senco public read bound')
 const controller=new AbortController(),timeout=fail('public collection deadline exceeded','SENCO_COLLECTION_TIMEOUT');timeout.name='TimeoutError'
 const timer=setTimeout(()=>controller.abort(timeout),budget),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[]
 const read=async phase=>{
  const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal,AbortSignal.timeout(requestBudget)])
  const supplied=options.fetchPage??options.fetchText
  let response,reader
  const discard=async()=>{
   const body=reader??response?.body
   if(typeof body?.cancel==='function')await withCallerSignal(()=>body.cancel(),AbortSignal.timeout(500)).catch(()=>{})
  }
  try{
   const request={method:'GET',redirect:'manual',signal:requestSignal,headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html,application/xhtml+xml,*/*;q=0.8'}}
   response=await withCallerSignal(()=>supplied?supplied(CAREERS_URL,request):(options.fetchImpl??globalThis.fetch)(CAREERS_URL,request),requestSignal)
   const status=response?.status,url=response?.url
   if([401,403,429].includes(status))throw fail('public HTTP '+status+' access denied','SENCO_PUBLIC_ACCESS_DENIED',status)
   if(status!==200||url!==CAREERS_URL)throw fail('public response status or final URL is unqualified','SENCO_PUBLIC_RESPONSE_UNQUALIFIED',status??null)
   let html=response.html??(typeof response.body==='string'?response.body:undefined)
   if(html===undefined&&typeof response.body?.getReader==='function'){
    reader=response.body.getReader();const chunks=[];let size=0
    while(true){const chunk=await withCallerSignal(()=>reader.read(),requestSignal);if(chunk.done)break;size+=chunk.value.byteLength;if(size>MAX_BYTES)throw fail('public page exceeds input limit');chunks.push(Buffer.from(chunk.value))}
    html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));reader.releaseLock();reader=null
   }else if(html===undefined&&typeof response.text==='function')html=await withCallerSignal(()=>response.text(),requestSignal)
   if(typeof html!=='string'||Buffer.byteLength(html)>MAX_BYTES)throw fail('public page is missing or exceeds input limit')
   const current=model(html)
   receipts.push({phase,requestedUrl:CAREERS_URL,finalUrl:url,status,bytes:Buffer.byteLength(html),sha256:sha(html)})
   return current
  }finally{requestController.abort();await discard()}
 }
 const execute=async()=>{
  const opening=await read('opening'),closing=await read('closing')
  if(JSON.stringify(opening)!==JSON.stringify(closing))throw fail('current public resume intake changed during closing verification')
  const stamp=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
  if(typeof stamp!=='string'||!Number.isFinite(Date.parse(stamp)))throw new TypeError('Invalid Senco observation clock')
  const observations=[{source:'sencogold',company:'Senco Gold',sourceUrl:CAREERS_URL,jobId:null,requisitionId:null,...opening,sourceScopeComplete:false,lifecycleCleanupAllowed:false}]
  const evidence={status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:stamp,reason:'general-free-text-resume-intake;native-vacancy-inventory-and-work-countries-unknown'}
  const audit={source:'sencogold',observations,publicPages:receipts,closingReconciled:true,inventoryEvidence:evidence,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,productionWrites:false}
  await withCallerSignal(()=>options.onAudit?.(structuredClone(audit)),signal)
  await withCallerSignal(()=>options.onRecords?.(structuredClone(observations)),signal)
  const jobs=attachInventoryEvidence([],evidence)
  attachSourceObservationEvidence(jobs,{source:'sencogold',recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false})
  Object.defineProperty(jobs,'sourceAudit',{value:audit})
  return jobs
 }
 try{return await withCallerSignal(execute,signal)}finally{clearTimeout(timer)}
}})
