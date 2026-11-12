import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {createHash} from 'node:crypto'
export function createCurrentPublicTransport(source,origins,options={}){
 const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(options.timeoutMs??170000),...(options.signal?[options.signal]:[])])
 const receipts=[],records=new Map(),allowed=new Set(origins)
 const fail=(message,fields={})=>Object.assign(Error(source+' current native input: '+message),{abortRetries:true,failureKind:'parser_or_contract_error',
  inventoryEvidence:{status:'coverage-gap',firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null},...fields})
 const read=async(url,json,init={})=>{
  signal.throwIfAborted()
  try{
   if(!allowed.has(new URL(url).origin))throw fail('undeclared response authority')
   const response=await(options.fetchImpl||fetch)(url,{...init,credentials:'omit',redirect:'manual',
    signal:AbortSignal.any([signal,AbortSignal.timeout(25000),...(init.signal?[init.signal]:[])]),headers:{'User-Agent':'JobverifyScraper/1.0',...init.headers,Accept:json?'application/json':'text/html'}})
   if(response.status!==200){await disposeResponseBody(response,{signal:options.signal,bestEffort:true});throw fail('HTTP '+response.status,{status:response.status,
    failureKind:[401,403,406,429].includes(response.status)?'blocked_or_access_denied':'network_or_timeout'})}
   if(response.url!==url){await disposeResponseBody(response,{signal:options.signal,bestEffort:true});throw fail('response URL identity changed')}
   if(!(json?/^application\/json\b/i:/^text\/html\b/i).test(response.headers?.get('content-type')||''))throw fail('native MIME identity changed')
   const body=await response.text();signal.throwIfAborted();if(Buffer.byteLength(body)>4000000)throw fail('native response budget exceeded')
   if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden|Just a moment)\b/i.test(body))throw fail('HTTP200 access denial',{failureKind:'blocked_or_access_denied'})
   receipts.push({url,method:init.method||'GET',status:response.status,sha256:createHash('sha256').update(body).digest('hex')})
   if(!json)return{status:response.status,url,html:body}
   const value=JSON.parse(body);if(!records.has(url))records.set(url,structuredClone(value));return value
  }catch(error){controller.abort(error);throw error}
 }
 return{signal,receipts,records,fail,fetchPage:(url,init)=>read(url,false,init),fetchJson:(url,init)=>read(url,true,init)}
}
