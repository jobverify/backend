// Exclusive public-context collection for the four reviewed surface sources.
// No public hiring entry, missing CMS model or marketing page proves zero jobs.
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {withCallerSignal,possibleVacancyMarkup} from '../abmknowledgeware/publicIntake.js'

export const sha=value=>createHash('sha256').update(value).digest('hex')
export const norm=value=>String(value||'').replace(/\s+/g,' ').trim()
export const fail=(message,code='PUBLIC_NATIVE_CONTEXT_CHANGED')=>Object.assign(new Error(message),{code})
const canonical=value=>{const url=new URL(value);return url.origin+url.pathname.replace(/\/$/,'')+url.search+url.hash}
export function visit(ast,callback){const pending=[ast];while(pending.length){const node=pending.pop();callback(node);for(const value of Object.values(node))if(value&&typeof value==='object'){if(Array.isArray(value)){for(const child of value)if(child&&typeof child==='object')pending.push(child)}else pending.push(value)}}}
const syntaxCache=new Map()
export function javascript(body){
 const key=sha(body)
 if(!syntaxCache.has(key)){let ast;try{ast=parse(body,{ecmaVersion:'latest',sourceType:'module'})}catch{throw fail('Current public client is not valid supported JavaScript')}
  if(syntaxCache.size>=8)syntaxCache.delete(syntaxCache.keys().next().value)
  syntaxCache.set(key,ast)
 }
 return syntaxCache.get(key)
}
export const property=(object,key)=>object?.type==='ObjectExpression'?object.properties.find(item=>(item.key?.name||item.key?.value)===key)?.value:null
export const literal=node=>node?.type==='Literal'?node.value:undefined
export function strings(ast){const result=[];visit(ast,node=>{if(node.type==='Literal'&&typeof node.value==='string')result.push(node.value)});return result}
export function executableRoleClients(ast){
 const hints=[]
 visit(ast,node=>{
  if(node.type!=='CallExpression')return
  const method=node.callee?.type==='Identifier'&&node.callee.name==='fetch'?'fetch':node.callee?.property?.name==='get'?'get':null
  const target=literal(node.arguments?.[0]),requestMethod=String(literal(property(node.arguments?.[1],'method'))||'GET').toUpperCase()
  if(method&&requestMethod==='GET'&&typeof target==='string'&&/(?:\/(?:api\/)?(?:jobs?|positions|openings)(?:\/|\?|$)|boards-api\.greenhouse|jobs\.lever\.co)/i.test(target))hints.push({kind:'unreviewed-executable-role-client',url:target,method:'GET'})
 })
 return hints
}
export function scripts(html,url){
 const doc=document(html),result=[]
 const walk=(node,inactiveAncestors=[])=>{
  if(node.tag==='template')return
  if(node.tag==='script'){const type=(node.attrs.type||'').toLowerCase(),body=node.raw||''
   result.push({attrs:node.attrs,body,sha256:sha(body),visuallyInactive:node.inactive||false,ancestorTags:inactiveAncestors.map(value=>value.tag),
    executable:!['application/json','application/ld+json','speculationrules','importmap'].includes(type)})
   return
  }
  for(const child of node.children||[])if(typeof child!=='string')walk(child,[...inactiveAncestors,node])
 }
 walk(doc.root)
 return{url,scripts:result}
}
export function asset(html,base,pattern){
 const found=scripts(html,base).scripts.filter(row=>row.attrs.src).map(row=>new URL(row.attrs.src,base)).filter(url=>url.origin===new URL(base).origin&&pattern.test(url.pathname)&&!url.search&&!url.hash)
 if(found.length!==1)throw fail('Current public first-party client asset identity changed')
 return found[0].href
}
export function activeLinks(html,base){
 const doc=document(html)
 return doc.nodes(node=>node.tag==='a'&&node.attrs.href).map(node=>{try{return{url:new URL(node.attrs.href,base).href,text:doc.text(node),node}}catch{return null}}).filter(Boolean)
}

export async function collectContext(config,options,operation){
 const {signal,onAudit,now=()=>new Date().toISOString(),collectionBudgetMs=600000}=options
 if(!Number.isSafeInteger(collectionBudgetMs)||collectionBudgetMs<=0||collectionBudgetMs>2147483647)throw new TypeError('Invalid public context collection budget')
 const deadline=new AbortController(),timeout=fail(config.company+' collection deadline exceeded','PUBLIC_CONTEXT_COLLECTION_TIMEOUT');timeout.name='TimeoutError'
 const timer=setTimeout(()=>deadline.abort(timeout),collectionBudgetMs),signals=[signal,deadline.signal],requestSignal=signal?AbortSignal.any(signals):deadline.signal,publicPages=[]
 const reader=options.fetchText||options.fetchPage
 const read=async(url,kind='html',phase='initial')=>{
  const response=await withCallerSignal(()=>reader?reader(url,{signal:signal||deadline.signal}):fetchTextWithRetry(url,{signal:requestSignal,includeResponseMetadata:true,timeoutMs:20000,label:config.source,headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html,application/json,application/javascript;q=0.9,*/*;q=0.8'}}),signals)
  const body=typeof response==='string'?response:response?.html??response?.text
  if(typeof body!=='string'||typeof response!=='string'&&(response?.status!==200||typeof response.url!=='string'||canonical(response.url)!==canonical(url)))throw fail(config.company+' first-party response identity changed')
  publicPages.push({url,requestedUrl:url,finalUrl:typeof response==='string'?null:response.url,status:typeof response==='string'?null:response.status,
   responseIdentity:typeof response==='string'?'caller-supplied-html':'validated-public-http-response',kind,phase,html:body,sha256:sha(body),bytes:Buffer.byteLength(body)})
  return body
 }
 const finish=async({observations=[],nativeContext={},closingMatches,possible=[],reason})=>{
  const scriptStructure=publicPages.filter(page=>page.kind==='html').map(page=>scripts(page.html,page.url))
  for(const page of publicPages.filter(page=>page.kind==='html'))possible.push(...possibleVacancyMarkup(page.html,page.url))
  for(const record of scriptStructure)for(const script of record.scripts.filter(row=>row.executable&&row.body)){
   let ast;try{ast=javascript(script.body);script.parserStatus='parsed-without-execution'}catch(error){script.parserStatus='unparsed-public-script';script.parserFailure=error.message;continue}
   possible.push(...executableRoleClients(ast).map(row=>({...row,publishedByPage:record.url,clientSha256:script.sha256})))
  }
  const stamp=now()
  if(typeof stamp!=='string'||!Number.isFinite(Date.parse(stamp)))throw fail('Invalid public observation clock')
  const evidence={status:'coverage-gap',surface:config.entry,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:publicPages.length,verifiedAt:stamp,reason:possible.length?'public-native-role-discovery-requires-collector':closingMatches?reason:'closing-public-native-context-changed'}
  const jobs=[]
  attachInventoryEvidence(jobs,evidence)
  attachSourceObservationEvidence(jobs,{source:config.source,recordKind:'hiring-signals',observedRecordCount:observations.length,observedVacancyCount:0,sourceScopeComplete:false})
  await withCallerSignal(()=>onAudit?.({source:config.source,observations,nativeContext,closingMatches,closingComparison:'public-hiring-or-company-context-only',
   possibleVacancyMarkup:possible,scriptStructure,publicPages,inventoryEvidence:evidence,productionWrites:false}),signals)
  if(possible.length)throw fail(config.company+' public native role discovery requires a collector','PUBLIC_NATIVE_ROLE_COLLECTOR_REQUIRED')
  if(!closingMatches)throw fail(config.company+' closing native context changed','PUBLIC_CONTEXT_CHANGED_DURING_READ')
  return jobs
 }
 try{return await operation({read,finish})}finally{clearTimeout(timer)}
}
