import {createHash} from 'node:crypto'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {buildHttpError} from '../../scraper-support/utils/fetch.js'

export const HOME='https://arya.ai/',CAREERS=HOME+'careers'
const MAX_BYTES=4*1024*1024,sha=value=>createHash('sha256').update(value).digest('hex')
const fail=(message,code='ARYA_PUBLIC_NATIVE_CHANGED',status=null)=>Object.assign(Error('Arya.ai: '+message),{source:'aryaai',code,status,abortRetries:true,softFailure:true,failureKind:[401,403,429].includes(status)?'blocked_or_access_denied':'source_inventory_unavailable'})
const need=(condition,message)=>{if(!condition)throw fail(message)}
const cls=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const structural=html=>{
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],parents=new WeakMap(),nodes=[]
 const walk=(node,parent)=>{if(parent)parents.set(node,parent);nodes.push(node);for(const child of node.children.filter(n=>typeof n!=='string'))walk(child,node)};walk(root)
 const active=node=>{for(let n=node;n;n=parents.get(n))if(n.inert||['hidden','d-none','invisible'].some(c=>cls(n,c)))return false;return true}
 const within=(node,predicate)=>nodes.filter(n=>{if(!active(n)||!predicate(n))return false;for(let p=n;p;p=parents.get(p))if(p===node)return true;return false})
 return{doc,nodes,active,within}
}
const one=(nodes,label)=>{need(nodes.length===1,'careers page has missing or ambiguous '+label);return nodes[0]}
export const inspectCurrentAryaHome=html=>{
 const s=structural(html),title=s.nodes.filter(n=>s.active(n)&&n.tag==='title').map(n=>n.raw)
 need(title.length===1&&/arya\.ai/i.test(title[0]),'homepage employer identity changed')
 const links=s.nodes.filter(n=>s.active(n)&&n.tag==='a'&&n.attrs.href).map(n=>new URL(n.attrs.href,HOME).href)
 need(links.includes(CAREERS),'homepage careers link changed')
 return{careersUrl:CAREERS}
}
export const inspectCurrentAryaCareers=html=>{
 const s=structural(html),title=s.nodes.filter(n=>s.active(n)&&n.tag==='title').map(n=>n.raw),brand=s.nodes.find(n=>n.tag==='html')?.attrs['data-wf-domain']
 need(brand==='arya.ai'&&title.length===1&&/careers at arya\.ai/i.test(title[0]),'careers page employer identity changed')
 const cards=s.nodes.filter(n=>cls(n,'car_item'))
 need(cards.length>0&&cards.every(s.active),'careers page has no qualified active role-card inventory')
 const rows=cards.map(card=>{
  const title=s.doc.text(one(s.within(card,n=>n.tag==='h3'&&cls(n,'car_h3')),'native role title'))
  const link=one(s.within(card,n=>n.tag==='a'&&/apply now/i.test(s.doc.text(n))),'native role handoff'),url=new URL(link.attrs.href,CAREERS),id=url.pathname.match(/^\/jobs\/(\d+)-[a-z0-9-]+$/i)
  need(url.origin==='https://wellfound.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&id,'careers page native role handoff changed')
  const department=s.doc.text(one(s.within(card,n=>n.attrs['fs-cmsfilter-field']==='dept'&&s.doc.text(n)!=='View all'),'native role department'))
  const workplace=one(s.within(card,n=>cls(n,'car_dept')&&s.within(n,c=>c.attrs['fs-cmsfilter-field']==='dept').length===0),'native workplace/work-mode field')
  const workMode=s.doc.text(workplace),employmentType=s.doc.text(one(s.within(card,n=>cls(n,'car_contract')),'native employment type'))
  const summary=one(s.within(card,n=>cls(n,'flex-vertical-32')),'native summary wrapper').children.filter(n=>typeof n!=='string'&&s.active(n)&&n.tag==='div'&&!n.attrs.class)
  const sourceSummary=s.doc.text(one(summary,'native short summary'))
  need(title&&department&&workMode&&employmentType&&sourceSummary,'careers page native brief is incomplete')
  return{source:'aryaai',company:'Arya.ai',title,department,workMode,employmentType,sourceSummary,jobId:id[1],requisitionId:null,sourceUrl:CAREERS,applyUrl:url.href,country:null,city:null,location:null,postingDate:null,closingDate:null,jobDescription:null,sourceDetailComplete:false,fullNativeCriteriaAvailable:false,kind:'native-role-brief',nativeIdentity:{externalPostingId:id[1],formalRequisitionId:null,originalPublicRoute:url.href},sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 })
 need(new Set(rows.map(row=>row.applyUrl)).size===rows.length,'careers page has duplicate native role identities')
 need(new Set(rows.map(row=>row.jobId)).size===rows.length,'careers page has duplicate native posting IDs')
 return rows
}

export const createCurrentAryaAiScraper=(defaults={})=>({async run(passed={}){
 const options={...defaults,...passed},caller=options.signal,budget=options.collectionBudgetMs??90000,requestBudget=options.requestTimeoutMs??15000
 caller?.throwIfAborted()
 if(!Number.isSafeInteger(budget)||budget<=0||budget>300000||!Number.isSafeInteger(requestBudget)||requestBudget<=0||requestBudget>30000)throw TypeError('Invalid Arya public read bound')
 const controller=new AbortController(),timeout=fail('public collection deadline exceeded','ARYA_COLLECTION_TIMEOUT');timeout.name='TimeoutError'
 const timer=setTimeout(()=>controller.abort(timeout),budget),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[],allowed=new Set([HOME,CAREERS]),heldHosts=new Set()
 const read=async(url,phase,detail=false)=>{
  need(allowed.has(url),'undeclared public read is not authorized by the current corporate page')
  const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal,AbortSignal.timeout(requestBudget)]),supplied=options.fetchPage??options.fetchText
  let response,reader
  const discard=async()=>{const body=reader??response?.body;if(typeof body?.cancel==='function')await withCallerSignal(()=>body.cancel(),AbortSignal.timeout(500)).catch(()=>{})}
  try{
   if(heldHosts.has(new URL(url).hostname))return{status:null,kind:'held-after-access-denial',html:null}
   const request={method:'GET',redirect:'manual',signal:supplied?(caller??requestSignal):requestSignal,headers:{Accept:'text/html,application/xhtml+xml,*/*;q=0.8','User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)'}}
   response=await withCallerSignal(()=>supplied?supplied(url,request):(options.fetchImpl??globalThis.fetch)(url,request),requestSignal)
   need(Number.isInteger(response?.status)&&response.url===url,'public response status or final URL identity is unqualified')
   const status=response.status
   if(status!==200){
    receipts.push({phase,requestedUrl:url,finalUrl:response.url,status,bodyRetained:false})
    const retry=buildHttpError(response,url)
    if([401,403,429].includes(status))heldHosts.add(new URL(url).hostname)
    if(detail)return{status,kind:status===410?'gone':[401,403,429].includes(status)?'access-denied':'unavailable',html:null,retryDelayMs:retry.retryDelayMs??null}
    const error=fail('public HTTP '+status,'ARYA_PUBLIC_HTTP',status)
    if(retry.retryDelayMs!=null)error.retryDelayMs=retry.retryDelayMs
    throw error
   }
   let html=response.html??(typeof response.body==='string'?response.body:undefined)
   if(html===undefined&&typeof response.body?.getReader==='function'){
    reader=response.body.getReader();let size=0;const chunks=[]
    while(true){const chunk=await withCallerSignal(()=>reader.read(),requestSignal);if(chunk.done)break;size+=chunk.value.byteLength;need(size<=MAX_BYTES,'public body exceeds input limit');chunks.push(Buffer.from(chunk.value))}
    html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));reader.releaseLock();reader=null
   }else if(html===undefined&&typeof response.text==='function')html=await withCallerSignal(()=>response.text(),requestSignal)
   need(typeof html==='string'&&Buffer.byteLength(html)<=MAX_BYTES,'public body is missing or exceeds input limit')
   receipts.push({phase,requestedUrl:url,finalUrl:response.url,status,bytes:Buffer.byteLength(html),sha256:sha(html)})
   return{status,kind:detail?'public-detail-not-yet-qualified':'corporate-public-page',html}
  }finally{requestController.abort();await discard()}
 }
 const snapshot=async phase=>{
  const home=inspectCurrentAryaHome((await read(HOME,phase)).html),records=inspectCurrentAryaCareers((await read(CAREERS,phase)).html)
  return{home,records}
 }
 const execute=async()=>{
  const opening=await snapshot('opening'),observations=[]
  for(const row of opening.records){allowed.add(row.applyUrl);const detail=await read(row.applyUrl,'declared-role',true);observations.push({...row,nativeDetail:{url:row.applyUrl,status:detail.status,kind:detail.kind,retryDelayMs:detail.retryDelayMs??null,fullCriteriaQualified:false}})}
  const closing=await snapshot('closing')
  need(JSON.stringify(opening)===JSON.stringify(closing),'current corporate role briefs changed during closing verification')
  const stamp=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
  need(typeof stamp==='string'&&Number.isFinite(Date.parse(stamp)),'invalid public observation clock')
  const evidence={status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:stamp,reason:'current-corporate-role-briefs-only;full-native-criteria-active-application-and-work-countries-unqualified'}
  const audit={source:'aryaai',observations,publicPages:receipts,closingReconciled:true,inventoryEvidence:evidence,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,productionWrites:false}
  await withCallerSignal(()=>options.onAudit?.(structuredClone(audit)),signal)
  await withCallerSignal(()=>options.onRecords?.(structuredClone(observations)),signal)
  const jobs=attachInventoryEvidence([],evidence)
  attachSourceObservationEvidence(jobs,{source:'aryaai',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false})
  Object.defineProperty(jobs,'sourceAudit',{value:audit})
  return jobs
 }
 try{return await withCallerSignal(execute,signal)}finally{clearTimeout(timer)}
}})
