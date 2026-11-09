import {types} from 'node:util'
const ownedFailures=new WeakSet()
export const failure=(message,code)=>{const error=Object.assign(Error(message),{code});ownedFailures.add(error);return error}
export function settingsFor(defaults,options){
 const values=Object.fromEntries(Object.entries({...Object.fromEntries(Object.entries(defaults).filter(([,v])=>v!==undefined)),...Object.fromEntries(Object.entries(options).filter(([,v])=>v!==undefined))}))
 values.signal?.throwIfAborted()
 if(values.timeoutMs!==undefined&&(!Number.isSafeInteger(values.timeoutMs)||values.timeoutMs<1||values.timeoutMs>60000))throw failure('DOPPIO invalid aggregate request budget','DOPPIO_INVALID_OPTIONS')
 const settings={maxJobs:null,maxPages:null,maxRequests:512,readTimeoutMs:20000,sourceTimeoutMs:values.sourceTimeoutMs??values.timeoutMs??45000,auditTimeoutMs:10000,...values}
 for(const key of ['maxJobs','maxPages'])if(settings[key]!==null&&(!Number.isSafeInteger(settings[key])||settings[key]<0))throw failure('Invalid DOPPIO '+key,'DOPPIO_INVALID_OPTIONS')
 for(const [key,max]of [['maxRequests',1024],['readTimeoutMs',25000],['sourceTimeoutMs',900000],['auditTimeoutMs',20000]])if(!Number.isSafeInteger(settings[key])||settings[key]<(key==='maxRequests'?0:1)||settings[key]>max)throw failure('Invalid DOPPIO '+key,'DOPPIO_INVALID_OPTIONS')
 for(const key of ['fetchText','fetchJson','fetchPage','onAudit','now'])if(settings[key]!==undefined&&typeof settings[key]!=='function')throw failure('Invalid DOPPIO '+key,'DOPPIO_INVALID_OPTIONS')
 return settings
}
export async function bounded(start,{signal,timeoutMs,code}){
 signal?.throwIfAborted()
 const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal,at=performance.now()
 const expired=()=>failure('DOPPIO operation deadline exceeded',code)
 const check=()=>{combined.throwIfAborted();if(performance.now()-at>=timeoutMs){controller.abort(expired());combined.throwIfAborted()}}
 let listener;const timer=setTimeout(()=>controller.abort(expired()),timeoutMs)
 const aborted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
 try{const result=await Promise.race([Promise.resolve().then(()=>{check();return start(combined,check)}),aborted]);check();return result}
 catch(error){controller.abort(error);throw error}
 finally{clearTimeout(timer);combined.removeEventListener('abort',listener)}
}
export function runtime(settings){
 const controller=new AbortController(),signal=settings.signal?AbortSignal.any([settings.signal,controller.signal]):controller.signal,at=performance.now()
 const expired=()=>failure('DOPPIO source deadline exceeded','DOPPIO_NATIVE_TIMEOUT'),timer=setTimeout(()=>controller.abort(expired()),settings.sourceTimeoutMs)
 let requests=0
 const check=()=>{settings.signal?.throwIfAborted();signal.throwIfAborted();if(performance.now()-at>=settings.sourceTimeoutMs){controller.abort(expired());signal.throwIfAborted()}}
 return{signal,check,get requests(){return requests},admit(){check();if(requests>=settings.maxRequests)throw failure('DOPPIO request budget exhausted','DOPPIO_REQUEST_BUDGET');if(settings.maxPages!==null&&requests>=settings.maxPages)throw failure('DOPPIO page budget exhausted','DOPPIO_PAGE_BUDGET');requests++},async read(start){check();const result=await bounded(start,{signal,timeoutMs:settings.readTimeoutMs,code:'DOPPIO_READ_TIMEOUT'});check();return result},close(){clearTimeout(timer);controller.abort(failure('DOPPIO run finished','DOPPIO_FINISHED'))}}
}

// Preserve foreign producer evidence through the exact cause. Only our own
// annotations may be replaced by stronger evidence from the outer transport.
const descriptor=(value,key)=>{
 try{for(let at=value,depth=0;at&&typeof at==='object'&&depth<12;at=Object.getPrototypeOf(at),depth++){
  if(types.isProxy(at))return undefined
  const field=Object.getOwnPropertyDescriptor(at,key);if(field)return field
 }}catch{}
}
export const errorValue=(value,key)=>descriptor(value,key)?.value
export function annotateFailure(cause,patch){
 // A foreign proxy can lie during reflection and throw again during writes.
 // Only an already source-owned annotation is eligible for mutation.
 const safe=ownedFailures.has(cause)&&Object.isExtensible(cause)&&Object.keys(patch).every(key=>{const field=descriptor(cause,key);return !field||Object.hasOwn(field,'value')&&field.writable===true})
 let error=cause
 if(!safe){
  const message=errorValue(cause,'message')
  error=Error(typeof message==='string'?message:typeof cause==='string'?cause:'DOPPIO native collection incomplete',{cause})
  for(const key of ['name','code','status','requestUrl','finalUrl','failureKind','failureType','softFailure','upstreamOutage','retryDelayMs']){const value=errorValue(cause,key);if(value!==undefined)error[key]=value}
  error.code??='DOPPIO_NATIVE_INCOMPLETE'
 }
 Object.assign(error,patch);ownedFailures.add(error);return error
}
