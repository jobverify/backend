import {types} from 'node:util'
const ownedFailures=new WeakSet()
export const failure=(message,code)=>{const error=Object.assign(Error(message),{code});ownedFailures.add(error);return error}
export function settingsFor(defaults,options){
 const values=Object.fromEntries(Object.entries({...Object.fromEntries(Object.entries(defaults).filter(([,v])=>v!==undefined)),...Object.fromEntries(Object.entries(options).filter(([,v])=>v!==undefined))}))
 values.signal?.throwIfAborted()
 if(values.maxPages===Infinity)values.maxPages=null
 if(values.maxPages!==undefined&&values.maxPages!==null)throw failure('BASE64AI finite page limits cannot truncate the native inventory','BASE64AI_INVALID_OPTIONS')
 if(values.nativeReadTimeoutMs!==undefined&&(!Number.isSafeInteger(values.nativeReadTimeoutMs)||values.nativeReadTimeoutMs<1||values.nativeReadTimeoutMs>120000))throw failure('Invalid BASE64AI native read budget','BASE64AI_INVALID_OPTIONS')
 if(values.readTimeoutMs===undefined&&values.nativeReadTimeoutMs!==undefined)values.readTimeoutMs=values.nativeReadTimeoutMs
 if(values.timeoutMs!==undefined&&(!Number.isSafeInteger(values.timeoutMs)||values.timeoutMs<1||values.timeoutMs>60000))throw failure('BASE64AI invalid aggregate request budget','BASE64AI_INVALID_OPTIONS')
 const settings={maxJobs:null,maxPages:null,maxRequests:512,readTimeoutMs:20000,sourceTimeoutMs:values.sourceTimeoutMs??values.timeoutMs??900000,auditTimeoutMs:15000,...values}
 for(const key of ['maxJobs','maxPages'])if(settings[key]!==null&&(!Number.isSafeInteger(settings[key])||settings[key]<0))throw failure('Invalid BASE64AI '+key,'BASE64AI_INVALID_OPTIONS')
 for(const [key,max]of [['maxRequests',1024],['readTimeoutMs',120000],['sourceTimeoutMs',900000],['auditTimeoutMs',20000]])if(!Number.isSafeInteger(settings[key])||settings[key]<(key==='maxRequests'?0:1)||settings[key]>max)throw failure('Invalid BASE64AI '+key,'BASE64AI_INVALID_OPTIONS')
 for(const key of ['fetchImpl','fetchPage','onAudit','onRecords','now'])if(settings[key]!==undefined&&typeof settings[key]!=='function')throw failure('Invalid BASE64AI '+key,'BASE64AI_INVALID_OPTIONS')
 if(settings.rateLimitMs!==undefined&&(!Number.isSafeInteger(settings.rateLimitMs)||settings.rateLimitMs<0||settings.rateLimitMs>5000))throw failure('Invalid BASE64AI rate limit','BASE64AI_INVALID_OPTIONS')
 return settings
}
// Every linked read/audit and the source lifetime share the same monotonic
// deadline order. Remember the first expired owner even after its scope exits.
const scopes=new WeakMap()
export const combineNativeSignals=signals=>{const combined=AbortSignal.any(signals);for(const parent of signals){const scope=scopes.get(parent);if(scope){scopes.set(combined,scope);break}}return combined}
const arm=(at,action)=>{let timer,closed=false;const fire=()=>{if(closed)return;const remaining=at-performance.now();if(remaining>0){timer=setTimeout(fire,Math.max(1,Math.ceil(remaining)));return}action()};timer=setTimeout(fire,Math.max(1,Math.ceil(at-performance.now())));return()=>{closed=true;clearTimeout(timer)}}
const checkScope=scope=>{scope.caller?.throwIfAborted();if(scope.failure)throw scope.failure;if(scope.closed)return;let first=null;for(const value of scope.deadlines)if(!first||value.at<first.at)first=value;if(first&&performance.now()>=first.at){scope.failure=first.expired();first.controller.abort(scope.failure);throw scope.failure}}
const expireScope=scope=>{try{checkScope(scope)}catch{}}
export async function bounded(start,{signal,timeoutMs,code}){
 signal?.throwIfAborted()
 const controller=new AbortController(),combined=signal?combineNativeSignals([signal,controller.signal]):controller.signal,at=performance.now(),scope=signal?scopes.get(signal):null
 const expired=()=>failure('BASE64AI operation deadline exceeded',code),deadline={at:at+timeoutMs,controller,expired}
 if(scope)scope.deadlines.add(deadline)
 const check=()=>{if(scope)checkScope(scope);combined.throwIfAborted();if(!scope&&performance.now()>=deadline.at){controller.abort(expired());combined.throwIfAborted()}}
 let listener;const stopTimer=arm(deadline.at,()=>{if(scope)expireScope(scope);else controller.abort(expired())})
 const aborted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
 try{const result=await Promise.race([Promise.resolve().then(()=>{check();return start(combined,check)}),aborted]);check();return result}
 catch(error){controller.abort(error);throw error}
 finally{stopTimer();combined.removeEventListener('abort',listener);if(scope)scope.deadlines.delete(deadline)}
}
export function runtime(settings){
 const controller=new AbortController(),signal=settings.signal?AbortSignal.any([settings.signal,controller.signal]):controller.signal,at=performance.now(),scope={caller:settings.signal,deadlines:new Set(),failure:null,closed:false}
 const expired=()=>failure('BASE64AI source deadline exceeded','BASE64AI_NATIVE_TIMEOUT'),deadline={at:at+settings.sourceTimeoutMs,controller,expired};scope.deadlines.add(deadline);scopes.set(signal,scope)
 const stopTimer=arm(deadline.at,()=>expireScope(scope));let requests=0
 const check=()=>{checkScope(scope);signal.throwIfAborted()}
 return{signal,check,get requests(){return requests},admit(){check();if(requests>=settings.maxRequests)throw failure('BASE64AI request budget exhausted','BASE64AI_REQUEST_BUDGET');if(settings.maxPages!==null&&requests>=settings.maxPages)throw failure('BASE64AI page budget exhausted','BASE64AI_PAGE_BUDGET');requests++},async read(start){check();const result=await bounded(start,{signal,timeoutMs:settings.readTimeoutMs,code:'BASE64AI_READ_TIMEOUT'});check();return result},close(){stopTimer();scope.closed=true;controller.abort(failure('BASE64AI run finished','BASE64AI_FINISHED'))}}
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
  error=Error(typeof message==='string'?message:typeof cause==='string'?cause:'BASE64AI native collection incomplete',{cause})
  for(const key of ['name','code','status','requestUrl','finalUrl','failureKind','failureType','softFailure','upstreamOutage','retryDelayMs']){const value=errorValue(cause,key);if(value!==undefined)error[key]=value}
  error.code??='BASE64AI_NATIVE_INCOMPLETE'
 }
 Object.assign(error,patch);ownedFailures.add(error);return error
}
