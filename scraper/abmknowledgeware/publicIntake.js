// Used only by the four reviewed first-party hiring-intake sources. A public
// resume entry or an unsupported counter never establishes vacancy inventory.
import {createHash} from 'node:crypto'
import {document,decode} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const norm=value=>String(value||'').replace(/\s+/g,' ').trim()
const sha=value=>createHash('sha256').update(value).digest('hex')
const canonical=value=>{const url=new URL(value);return url.origin+url.pathname.replace(/\/$/,'')+url.search+url.hash}
const failure=(message,code='PUBLIC_HIRING_SURFACE_CHANGED')=>Object.assign(new Error(message),{code})
export async function withCallerSignal(operation,signal){
 const signals=(Array.isArray(signal)?signal:[signal]).filter(Boolean),listeners=[]
 for(const item of signals)item.throwIfAborted()
 if(!signals.length)return operation()
 const cancelled=new Promise((_,reject)=>{for(const item of signals){const abort=()=>reject(item.reason);listeners.push([item,abort]);item.addEventListener('abort',abort,{once:true})}})
 try{const value=await Promise.race([Promise.resolve().then(()=>{for(const item of signals)item.throwIfAborted();return operation()}),cancelled]);for(const item of signals)item.throwIfAborted();return value}
 finally{for(const[item,abort]of listeners)item.removeEventListener('abort',abort)}
}

function activeDocument(html){
 const doc=document(html),parents=new Map(),all=[]
 const walk=node=>{all.push(node);for(const child of node.children||[])if(typeof child!=='string'){parents.set(child,node);walk(child)}}
 walk(doc.root)
 const active=node=>{
  for(let value=node;value;value=parents.get(value)){
   if(value.inactive||/(?:^|\s)(?:d-none|hidden|invisible)(?:\s|$)/.test(value.attrs.class||''))return false
   if(/(?:^|;)\s*opacity\s*:\s*0(?:\.0*)?\s*(?:!important\s*)?(?:;|$)/i.test(value.attrs.style||''))return false
  }
  return true
 }
 const text=node=>!node||!active(node)||node.tag==='script'?'':(node.children||[]).map(child=>typeof child==='string'?decode(child):text(child)).join(' ')
 doc.text=node=>norm(text(node))
 return{doc,all,nodes:doc.nodes(()=>true).filter(active),active}
}

export function possibleVacancyMarkup(html,baseUrl){
 const {doc,nodes,all}=activeDocument(html),result=[]
 const add=(node,kind,url=null)=>result.push({kind,url,text:doc.text(node),htmlSha256:sha(doc.outer(node))})
 for(const node of nodes){
  if(/(?:^|\s)(?:job[-_]?(?:card|listing|result)|open[-_]?position|career[-_]?listing)(?:\s|$)/i.test(node.attrs.class||'')&&doc.text(node))add(node,'unreviewed-role-container')
  if(node.tag==='a'&&node.attrs.href){
   // A current privacy footer uses a bare company hostname as its href.
   // Browser URL resolution puts it under /careers/, but it is a website
   // reference, without a role identity or recruiting action.
   const raw=node.attrs.href,host=new URL(baseUrl).hostname.replace(/^www\./,'')
   if(doc.text(node)===raw&&[host,'www.'+host].includes(raw))continue
   let url;try{url=new URL(node.attrs.href,baseUrl)}catch{continue}
   if(!['http:','https:'].includes(url.protocol))continue
   const ats=/(?:^|\.)(?:greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|oraclecloud\.com|darwinbox\.(?:com|in)|peoplestrong\.com|icims\.com|jobvite\.com|taleo\.net)$/.test(url.hostname)
   if(ats||url.origin===new URL(baseUrl).origin&&/\/(?:jobs?|careers)\/[^/]+/.test(url.pathname)&&canonical(url.href)!==canonical(baseUrl))add(node,'unreviewed-public-role-link',url.href)
  }
  if(node.tag==='script'&&/application\/ld\+json/i.test(node.attrs.type||'')){
   try{
    const scan=value=>{if(!value||typeof value!=='object')return;if([value['@type']].flat().includes('JobPosting'))add(node,'unreviewed-structured-job');for(const child of Object.values(value))if(child&&typeof child==='object')scan(child)}
    scan(JSON.parse(node.raw))
   }catch{if(/JobPosting/.test(node.raw||''))add(node,'unreviewed-malformed-structured-job')}
  }
  const target=node.attrs['data-bs-target']||node.attrs['data-target']||node.attrs.href
  if(['a','button'].includes(node.tag)&&/job|role|position|vacan/i.test(doc.text(node))&&/^#[\w-]+$/.test(target||'')&&all.some(value=>value.attrs.id===target.slice(1)))add(node,'unreviewed-public-role-reveal',new URL(target,baseUrl).href)
 }
 return result
}

export function inspectHomepage(html,config){
 const {doc,nodes}=activeDocument(html),links=[]
 for(const node of nodes.filter(node=>node.tag==='a'&&node.attrs.href)){
  try{const url=new URL(node.attrs.href,config.homepageUrl);if(canonical(url.href)===canonical(config.careersUrl))links.push(url.href)}catch{ /* Non-URL page controls are not recruiting authority. */ }
 }
 return{valid:config.brand.test(doc.text(doc.root))&&links.length>0,careersLinks:[...new Set(links)].sort()}
}

export function inspectCareers(html,config){
 const {doc,nodes}=activeDocument(html),text=doc.text(doc.root)
 const identity=config.brand.test(text)&&config.careersHeading.test(text)
 const controls=nodes.filter(node=>['a','button','input','select','form'].includes(node.tag)&&(/job|role|position|vacan|resume|application|search/i.test(doc.text(node))||node.tag==='form'))
  .map(node=>({tag:node.tag,text:doc.text(node),href:node.attrs.href||null,type:node.attrs.type||null,action:node.attrs.action||null,target:node.attrs['data-bs-target']||node.attrs['data-target']||null}))
 let nativeFacts=null
 if(config.intakeEmail){
  if(text.toLowerCase().includes(config.intakeEmail.toLowerCase()))nativeFacts={email:config.intakeEmail}
 }else if(config.intakeKind==='general-resume-form'){
  const forms=nodes.filter(node=>node.tag==='form'&&doc.nodes(value=>value.tag==='input'&&value.attrs.type==='file',node).length>0)
  const form=forms.find(node=>/upload your resume/i.test(doc.text(node))&&/submit application/i.test(doc.text(node)))
  if(form)nativeFacts={method:(form.attrs.method||'get').toLowerCase(),action:form.attrs.action||null,name:form.attrs.name||null,
   controls:doc.nodes(node=>['input','textarea','select','button'].includes(node.tag),form).map(node=>({tag:node.tag,type:node.attrs.type||null,name:node.attrs.name||null})),
   publicFileUpload:true,applicationActionPerformed:false}
 }else if(config.intakeKind==='unresolved-public-careers-controls'){
  const match=text.match(/\b\d+\s+open positions\b/i)
  if(controls.some(node=>/search|open roles/i.test(node.text)))nativeFacts={unsupportedCounterText:match?.[0]||null,confirmedVacancyCount:null,
   controls:controls.filter(node=>/search|open roles/i.test(node.text)),nativeVacancyEndpoint:null}
 }
 const observation=nativeFacts?{kind:config.intakeKind,url:config.careersUrl,vacancy:false,country:null,postingDate:null,
  descriptionComplete:false,...nativeFacts}:null
 const possible=possibleVacancyMarkup(html,config.careersUrl)
 return{identity,observation,possibleVacancyMarkup:possible,model:{identity,observation,possibleVacancyMarkup:possible}}
}

export const createPublicIntakeScraper=config=>({
 async run({fetchPage,signal,onAudit,now=()=>new Date().toISOString(),collectionBudgetMs=600000}={}){
  if(!Number.isSafeInteger(collectionBudgetMs)||collectionBudgetMs<=0||collectionBudgetMs>2147483647)throw new TypeError('Invalid public hiring collection budget')
  const deadline=new AbortController(),timeout=failure(config.companyName+' public hiring collection deadline exceeded','PUBLIC_HIRING_COLLECTION_TIMEOUT')
  timeout.name='TimeoutError'
  const timer=setTimeout(()=>deadline.abort(timeout),collectionBudgetMs),signals=[signal,deadline.signal]
  const requestSignal=signal?AbortSignal.any(signals):deadline.signal
  const execute=async()=>{
  const read=async(url,phase)=>{
   const response=await withCallerSignal(()=>fetchPage?fetchPage(url,{signal:signal||deadline.signal}):fetchTextWithRetry(url,{
    label:config.source,timeoutMs:20000,signal:requestSignal,includeResponseMetadata:true,headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'}}),signals)
   const html=typeof response==='string'?response:response?.html??response?.text
   if(typeof html!=='string'||typeof response!=='string'&&(response?.status!==200||typeof response.url!=='string'||canonical(response.url)!==canonical(url)))throw failure(config.companyName+' first-party response identity changed')
   return{phase,url,requestedUrl:url,finalUrl:typeof response==='string'?null:response.url,
    status:typeof response==='string'?null:response.status,responseIdentity:typeof response==='string'?'caller-supplied-html':'validated-public-http-response',
    html,sha256:sha(html),bytes:Buffer.byteLength(html)}
  }
  const publicPages=[]
  let initialHome=null,closingHome=null
  if(config.homepageUrl){const page=await read(config.homepageUrl,'initial-homepage');publicPages.push(page);initialHome=inspectHomepage(page.html,config);if(!initialHome.valid)throw failure(config.companyName+' official homepage recruiting authority changed')}
  const first=await read(config.careersUrl,'initial-careers');publicPages.push(first)
  const initial=inspectCareers(first.html,config)
  if(!initial.identity)throw failure(config.companyName+' official careers identity changed')
  if(!initial.observation&&!initial.possibleVacancyMarkup.length)throw failure(config.companyName+' official careers hiring entry changed')
  if(config.homepageUrl){const page=await read(config.homepageUrl,'closing-homepage');publicPages.push(page);closingHome=inspectHomepage(page.html,config)}
  const last=await read(config.careersUrl,'closing-careers');publicPages.push(last)
  const closing=inspectCareers(last.html,config),closingMatches=JSON.stringify([initialHome,initial.model])===JSON.stringify([closingHome,closing.model])
  const possible=[...initial.possibleVacancyMarkup,...closing.possibleVacancyMarkup],stamp=now()
  if(typeof stamp!=='string'||!Number.isFinite(Date.parse(stamp)))throw failure('Invalid hiring observation clock','INVALID_OBSERVATION_CLOCK')
  const observations=initial.observation?[initial.observation]:[],jobs=[]
  const evidence={status:'coverage-gap',surface:config.careersUrl,firstParty:true,listingComplete:false,pagesFetched:publicPages.length,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:stamp,reason:possible.length?'unreviewed-public-vacancy-discovery-requires-native-collector':closingMatches?'public-hiring-entry-without-enumerable-native-vacancy-inventory':'closing-public-hiring-entry-model-changed'}
  attachInventoryEvidence(jobs,evidence)
  attachSourceObservationEvidence(jobs,{source:config.source,recordKind:'hiring-signals',observedRecordCount:observations.length,observedVacancyCount:0,sourceScopeComplete:false})
  await withCallerSignal(()=>onAudit?.({source:config.source,observations,possibleVacancyMarkup:possible,publicPages,
   closingMatches,closingComparison:'published-hiring-entry-model-only',closingModel:closing.model,inventoryEvidence:evidence,productionWrites:false}),signals)
  if(possible.length)throw failure(config.companyName+' public vacancy discovery requires a native job collector','PUBLIC_VACANCY_COLLECTOR_REQUIRED')
  if(!closingMatches)throw failure(config.companyName+' closing public hiring entry model changed','PUBLIC_HIRING_ENTRY_CHANGED_DURING_READ')
  return jobs
  }
  try{return await execute()}finally{clearTimeout(timer)}
 }
})
