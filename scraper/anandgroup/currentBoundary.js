import {createHash} from 'node:crypto'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CAREERS_URL='https://www.anandgroupindia.com/careers-at-anand/'
export const JOIN_US_URL='https://www.anandgroupindia.com/careers-at-anand/join-usnew/'
const fail=(source,message,code='ANAND_PUBLIC_ENTRY_CHANGED',status=null)=>Object.assign(Error('ANAND public careers: '+message),{source,code,status,abortRetries:true,failureKind:[401,403,429].includes(status)?'blocked':'source_inventory_unavailable'})
const model=(html,url,source)=>{
 const head=activeHead(html),doc=readNativeDocument(html),canonicals=doc.nodes(node=>node.tag==='link'&&(node.attrs.rel||'').toLowerCase().split(/\s+/).includes('canonical')).map(node=>node.attrs.href),join=url===JOIN_US_URL,title=join?'Join Us - ANAND Group':'Career at ANAND - ANAND Group'
 if(head.titles.length!==1||head.titles[0]!==title||canonicals.length!==1||canonicals[0]!==url)throw fail(source,'current first-party publisher identity changed')
 if(join&&!doc.nodes(node=>/^h[1-3]$/.test(node.tag)&&doc.text(node)==='Join Us At ANAND').length)throw fail(source,'current own generic hiring entry unavailable')
 if(!join&&!doc.nodes(node=>node.tag==='a'&&node.attrs.href===JOIN_US_URL&&doc.text(node)==='Join Us').length)throw fail(source,'current declared Join Us handoff unavailable')
 return{kind:join?'general-group-hiring-entry':'group-careers-handoff',publisher:'ANAND Group',url,title,joinUsUrl:JOIN_US_URL,nativeVacancyTotal:null,indiaVacancyTotal:null,explicitNoOpeningsStatement:false}
}

// Shared exclusively by the two historical ANAND catalog rows. Their common
// general intake is not a complete native inventory or canonical role feed.
export const createCurrentAnandScraper=(source,defaults={})=>{
 if(!['anandgroup','anandgroupindia'].includes(source))throw TypeError('Unsupported ANAND catalog source')
 return{async run(passed={}){
  const options={...defaults,...passed},caller=options.signal,budget=options.collectionBudgetMs??60000
  caller?.throwIfAborted();if(!Number.isSafeInteger(budget)||budget<=0||budget>300000)throw TypeError('Invalid ANAND collection budget')
  const deadline=new AbortController(),timeout=fail(source,'collection deadline exceeded','ANAND_COLLECTION_TIMEOUT'),timer=setTimeout(()=>deadline.abort(timeout),budget),signal=caller?AbortSignal.any([caller,deadline.signal]):deadline.signal,responses=[]
  let previousStart=0
  const read=async(url,phase)=>{
   signal.throwIfAborted();const supplied=options.fetchPage??options.fetchText
   if(!supplied&&Date.now()-previousStart<500)await withCallerSignal(()=>new Promise(resolve=>setTimeout(resolve,500-(Date.now()-previousStart))),signal)
   previousStart=Date.now();const controller=new AbortController(),requestSignal=AbortSignal.any([signal,controller.signal,AbortSignal.timeout(15000)])
   let response,reader
   const discard=async()=>{const body=reader??response?.body;if(body?.cancel)await withCallerSignal(()=>body.cancel(),AbortSignal.timeout(500)).catch(()=>{})}
   try{
    const request={method:'GET',redirect:'manual',signal:requestSignal,headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html,application/xhtml+xml,*/*;q=0.8'}}
    response=await withCallerSignal(()=>supplied?supplied(url,request):(options.fetchImpl??globalThis.fetch)(url,request),requestSignal)
    const textOnly=typeof response==='string',status=textOnly?null:response?.status,finalUrl=textOnly?null:response?.url
    if([401,403,429].includes(status))throw fail(source,'HTTP '+status+'; stopped without retry or private fallback','ANAND_PUBLIC_ACCESS_DENIED',status)
    if(!textOnly&&(status!==200||finalUrl!==url))throw fail(source,'public response status or final URL changed','ANAND_PUBLIC_RESPONSE_UNQUALIFIED',status??null)
    let html=textOnly?response:response.html??(typeof response.body==='string'?response.body:undefined),bytes
    if(html===undefined&&response.body?.getReader){reader=response.body.getReader();const parts=[];let size=0;for(;;){const part=await withCallerSignal(()=>reader.read(),requestSignal);if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024)throw fail(source,'public response exceeds byte limit');parts.push(Buffer.from(part.value))}bytes=Buffer.concat(parts);html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);reader.releaseLock();reader=null}
    else if(html===undefined&&typeof response.text==='function')html=await withCallerSignal(()=>response.text(),requestSignal)
    if(typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024)throw fail(source,'public response body unavailable or oversized')
    const current=model(html,url,source);bytes??=Buffer.from(html);const record={phase,url,finalUrl,status,firstParty:!textOnly,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};responses.push(record)
    if(options.onResponse)await withCallerSignal(()=>options.onResponse({...record,bodyBase64:bytes.toString('base64')}),signal)
    return current
   }finally{controller.abort();await discard()}
  }
  const execute=async()=>{
   const opening={careers:await read(CAREERS_URL,'opening'),hiring:await read(JOIN_US_URL,'opening')},closing={careers:await read(CAREERS_URL,'closing'),hiring:await read(JOIN_US_URL,'closing')}
   if(JSON.stringify(opening)!==JSON.stringify(closing))throw fail(source,'current public hiring entry changed during closing read')
   const evidence={status:'coverage-gap',surface:JOIN_US_URL,firstParty:responses.every(row=>row.firstParty),listingComplete:false,pagesFetched:responses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'generic-group-hiring-entry;complete-native-vacancies-role-countries-and-subsidiary-employer-scope-unproved'},observations=[{source,company:'ANAND Group',sourceUrl:JOIN_US_URL,jobId:null,requisitionId:null,country:null,postingDate:null,...closing.hiring,sourceScopeComplete:false,lifecycleCleanupAllowed:false}],audit={source,observations,opening,closing,closingReconciled:true,responses,inventoryEvidence:evidence,sourceScopeComplete:false,sourceDeclaredBoardScopeComplete:false,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false,inventoryDelegationComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,privateApplicationRequests:0,productionWrites:false}
   if(options.onRecords)await withCallerSignal(()=>options.onRecords(structuredClone(observations)),signal)
   if(options.onAudit)await withCallerSignal(()=>options.onAudit(structuredClone(audit)),signal)
   const jobs=attachInventoryEvidence([],evidence);attachSourceObservationEvidence(jobs,{source,recordKind:'hiring-signals',observedRecordCount:1,observedVacancyCount:0,sourceScopeComplete:false});signal.throwIfAborted();return jobs
  }
  try{return await withCallerSignal(execute,signal)}finally{clearTimeout(timer);deadline.abort()}
 }}
}
