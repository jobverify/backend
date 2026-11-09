// Read-only public transport shared only by this reviewed four-source batch.
import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const error=(company,message,code='PUBLIC_NATIVE_CONTRACT')=>Object.assign(new Error(company+' native: '+message),{code,abortRetries:true})
export const requireNative=(ok,company,message)=>{if(!ok)throw error(company,message)}
const httpError=(company,status)=>Object.assign(error(company,([401,403,429].includes(status)?'public access denied HTTP ':'public HTTP ')+status+'; stopped without retry','PUBLIC_NATIVE_HTTP'),{status,failureKind:[401,403,429].includes(status)?'public_access_denied':'network_or_timeout'})
export function structure(html){
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],nodes=[],parents=new WeakMap()
 const walk=(node,parent)=>{if(node.tag==='template')return;if(parent)parents.set(node,parent);nodes.push(node);for(const child of node.children||[])if(typeof child!=='string')walk(child,node)}
 walk(root)
 const scripts=nodes.filter(n=>n.tag==='script').map(n=>({attrs:n.attrs,body:n.raw||'',sha256:sha(n.raw||''),visuallyInactive:Boolean(n.inert),
  executable:!Object.hasOwn(n.attrs,'nomodule')&&(!n.attrs.type||/^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(n.attrs.type))}))
 return{doc,root,nodes,parents,scripts,text:n=>n?.raw!=null?norm(decodeNativeEntities(n.raw)):doc.text(n)}
}
const canonical=value=>{const u=new URL(value);return u.origin+u.pathname.replace(/\/$/,'')+u.search+u.hash}
export async function publicRead(config,options,operation){
 const budget=options.collectionBudgetMs??600000
 if(!Number.isSafeInteger(budget)||budget<=0||budget>2147483647)throw new TypeError('Invalid public native collection budget')
 const controller=new AbortController(),timeout=error(config.company,'collection deadline exceeded','PUBLIC_NATIVE_COLLECTION_TIMEOUT');timeout.name='TimeoutError'
 const timer=setTimeout(()=>controller.abort(timeout),budget),signals=[options.signal,controller.signal],signal=options.signal?AbortSignal.any(signals):controller.signal,publicPages=[]
 const read=async(url,{method='GET',body,headers={},kind='html',phase='initial',retainBody=true}={})=>{
  const request={method,body,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',Accept:kind==='json'?'application/json, text/plain, */*':kind==='javascript'?'application/javascript, text/javascript, */*':'text/html,application/xhtml+xml,*/*',...headers},signal}
  let response,text
  if(options.fetchPage||options.fetchText){
   response=await withCallerSignal(()=>(options.fetchPage||options.fetchText)(url,request),signals)
   text=typeof response==='string'?response:response?.body??response?.html??response?.text
  }else{
   const networkSignal=AbortSignal.any([signal,AbortSignal.timeout(30000)])
   response=await withCallerSignal(()=>(options.fetchImpl||fetch)(url,{...request,signal:networkSignal,redirect:'manual'}),signals)
   if(response.status!==200)throw httpError(config.company,response.status)
   text=await withCallerSignal(()=>response.text(),[...signals,networkSignal])
  }
  if(typeof response!=='string'&&response?.status!==200)throw httpError(config.company,response?.status)
  requireNative(typeof text==='string'&&Buffer.byteLength(text)<=24000000,config.company,'invalid or oversized public response')
  requireNative(typeof response==='string'||typeof response.url==='string'&&canonical(response.url)===canonical(url),config.company,'public response URL identity changed')
  if(kind==='html'&&/<(?:title|h1)\b[^>]*>\s*(?:access denied|just a moment|verify you are human|request rejected|captcha|attention required|pardon our interruption|robot check)|\bid=["'](?:challenge-form|cf-chl-)/i.test(text))throw error(config.company,'public access denied; stopped without retry','PUBLIC_NATIVE_HTTP')
  publicPages.push({requestedUrl:url,url,finalUrl:typeof response==='string'?null:response.url,status:typeof response==='string'?null:response.status,method,kind,phase,
   responseIdentity:typeof response==='string'?'caller-supplied-public-response':'validated-public-http-response',sha256:sha(text),bytes:Buffer.byteLength(text),...(retainBody?{html:text}:{bodyRetained:false})})
  return text
 }
 const stamp=()=>{const value=(options.now||(()=>new Date().toISOString()))();requireNative(typeof value==='string'&&Number.isFinite(Date.parse(value)),config.company,'invalid observation clock');return new Date(value).toISOString()}
 const audit=async value=>withCallerSignal(()=>options.onAudit?.(structuredClone({source:config.source,...value,publicPages,productionWrites:false})),signals)
 try{for(const current of signals.filter(Boolean))current.throwIfAborted();return await operation({read,stamp,audit,signal,publicPages})}finally{clearTimeout(timer)}
}
