// Read-only transport and structural inspection owned by this four-source batch.
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {decodeLeaf} from '../bluebinaries/nativeVisibility.js'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
export const failure=(company,message,code='PUBLIC_NATIVE_CONTRACT')=>Object.assign(Error(company+' native: '+message),{code,abortRetries:true})
export const need=(value,company,message)=>{if(!value)throw failure(company,message)}
export const hasClass=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
export const within=(n,p)=>[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>within(c,p))]
export const htmlEscape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const voids=new Set(['meta','link','img','input','br','hr','source','wbr','area','base','col','embed','param','track'])
export const outer=n=>typeof n==='string'?n:n.tag==='root'?n.children.map(outer).join(''):'<'+n.tag+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+htmlEscape(v)+'"').join('')+'>'+(voids.has(n.tag)?'':(n.raw??n.children.map(outer).join(''))+'</'+n.tag+'>')
export const inner=n=>n.raw??n.children.map(outer).join('')
const leaves=n=>typeof n==='string'?decodeLeaf(n):n.inert||['script','style','textarea','iframe','noscript'].includes(n.tag)?'':n.tag==='br'?'\n':n.raw!=null?decodeLeaf(n.raw):n.children.map(leaves).join('')+(/^(?:p|div|li|h[1-6]|section|ul|ol|article|td|th|tr)$/.test(n.tag)?'\n':'')
export async function bounded(operation,signals){
 const active=[signals].flat().filter(Boolean),listeners=[]
 for(const signal of active)signal.throwIfAborted()
 const cancelled=new Promise((_,reject)=>{for(const signal of active){const abort=()=>reject(signal.reason);listeners.push([signal,abort]);signal.addEventListener('abort',abort,{once:true})}})
 try{const result=await Promise.race([Promise.resolve().then(()=>{for(const s of active)s.throwIfAborted();return operation()}),cancelled]);for(const s of active)s.throwIfAborted();return result}
 finally{for(const[s,listener]of listeners)s.removeEventListener('abort',listener)}
}
export function structure(html){
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],nodes=[],parents=new WeakMap()
 const walk=(node,parent)=>{if(node.tag==='template')return;if(parent)parents.set(node,parent);nodes.push(node);for(const child of node.children||[])if(typeof child!=='string')walk(child,node)};walk(root)
 const active=node=>{for(let n=node;n;n=parents.get(n))if(n.inert||/(?:^|\s)(?:hidden|d-none|invisible)(?:\s|$)/.test(n.attrs.class||'')||/(?:^|;)\s*opacity\s*:\s*0(?:\.0*)?\s*(?:!important\s*)?(?:;|$)/i.test(n.attrs.style||''))return false;return true}
 const scripts=nodes.filter(n=>n.tag==='script').map(n=>({attrs:n.attrs,body:n.raw||'',sha256:sha(n.raw||''),visuallyInactive:!active(n),executable:!Object.hasOwn(n.attrs,'nomodule')&&(!n.attrs.type||/^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(n.attrs.type))}))
 return{doc,root,nodes,parents,active,scripts,visible:predicate=>nodes.filter(n=>active(n)&&predicate(n)),text:n=>norm(leaves(n))}
}
export async function publicRead(config,options,operation){
 const budget=options.collectionBudgetMs??options.timeoutMs??600000
 if(!Number.isSafeInteger(budget)||budget<=0||budget>2147483647)throw TypeError('Invalid public collection budget')
 const controller=new AbortController(),timeout=failure(config.company,'collection deadline exceeded','PUBLIC_COLLECTION_TIMEOUT');timeout.name='TimeoutError'
 const timer=setTimeout(()=>controller.abort(timeout),budget),signals=[options.signal,controller.signal].filter(Boolean),signal=signals.length===1?signals[0]:AbortSignal.any(signals),publicPages=[]
 const read=async(url,{kind='html',phase='initial',allowedFinalUrls=[url]}={})=>{
  const allowed=new Set([url,...allowedFinalUrls]),request={method:'GET',signal,redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',Accept:kind==='json'?'application/json, text/plain, */*':kind==='javascript'?'application/javascript, text/javascript, */*':'text/html,application/xhtml+xml,*/*'}}
  let current=url
  for(let redirects=0;redirects<=5;redirects++){
   const requestController=new AbortController(),deadline=AbortSignal.timeout(30000),requestSignals=[...signals,deadline,requestController.signal],requestSignal=AbortSignal.any(requestSignals)
   let response,requestFailure
   const discard=async()=>{
    try{
     if(typeof response?.body?.cancel!=='function')return
     // Attempt disposal even when the caller has already aborted, then bound
     // only its wait. Cleanup failure never replaces the source/caller error.
     const pending=Promise.resolve(response.body.cancel()).catch(()=>{})
     await bounded(()=>pending,[...signals,AbortSignal.timeout(500)]).catch(()=>{})
    }catch{ /* A locked/failed stream is also terminated by request abort. */ }
   }
   try{
   const reader=options.fetchPage||options.fetchText||options.fetchImpl||fetch
   response=await bounded(()=>reader(current,{...request,signal:requestSignal}),requestSignals)
   const status=typeof response==='string'?null:response?.status,finalUrl=typeof response==='string'?null:response?.url
   if([301,302,303,307,308].includes(status)){
    const location=response.headers?.get?.('location')??response.location
    let target;try{target=new URL(location,current).href}catch{need(false,config.company,'invalid public redirect')}
    need(allowed.has(target),config.company,'public redirect left the reviewed hiring handoff')
    publicPages.push({requestedUrl:url,url:current,finalUrl,status,phase,redirectTo:target,bodyRetained:false});current=target;continue
   }
   if(status!=null&&status!==200){
    throw Object.assign(failure(config.company,'public HTTP '+status+'; stopped without retry','PUBLIC_NATIVE_HTTP'),{status,failureKind:[401,403,429].includes(status)?'public_access_denied':'network_or_timeout',inventoryEvidence:{status:'coverage-gap',surface:url,firstParty:false,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})
   }
   need(typeof response==='string'||allowed.has(finalUrl),config.company,'public response URL identity changed')
   let body=typeof response==='string'?response:typeof response?.body==='string'?response.body:typeof response?.html==='string'?response.html:response?.text
   if(typeof body==='function')body=await bounded(()=>body.call(response),requestSignals)
   need(typeof body==='string'&&Buffer.byteLength(body)<=24000000,config.company,'invalid or oversized public response')
   if(kind==='html'&&/<(?:title|h1)\b[^>]*>\s*(?:access denied|just a moment|verify you are human|request rejected|captcha|attention required|pardon our interruption|robot check)|\bid=["'](?:challenge-form|cf-chl-)/i.test(body))throw failure(config.company,'public access denied; stopped without retry','PUBLIC_NATIVE_HTTP')
   const publicHeaders=Object.fromEntries(['x-wp-total','x-wp-totalpages','link','content-type'].map(key=>[key,response?.headers?.get?.(key)??response?.publicHeaders?.[key]??null]).filter(([,value])=>value!=null))
   publicPages.push({requestedUrl:url,url:current,finalUrl,status,kind,phase,sha256:sha(body),bytes:Buffer.byteLength(body),html:body,publicHeaders,responseIdentity:typeof response==='string'?'caller-supplied-public-text':'validated-public-response'})
   return body
   }catch(error){requestFailure=error;throw error}
   finally{requestController.abort(requestFailure);await discard()}
  }
  throw failure(config.company,'public redirect limit exceeded')
 }
 const stamp=()=>{const value=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(typeof value==='string'&&Number.isFinite(Date.parse(value)),config.company,'invalid observation clock');return new Date(value).toISOString()}
 const audit=async value=>bounded(()=>options.onAudit?.(structuredClone({source:config.source,...value,publicPages,productionWrites:false})),signals)
 try{for(const s of signals)s.throwIfAborted();return await bounded(()=>operation({read,stamp,audit,signal,signals,publicPages}),signals)}finally{clearTimeout(timer)}
}
