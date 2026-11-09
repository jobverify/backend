export const failure=(message,code)=>Object.assign(Error(message),{code})
export function settingsFor(defaults,options){
 const values=Object.fromEntries(Object.entries({...Object.fromEntries(Object.entries(defaults).filter(([,v])=>v!==undefined)),...Object.fromEntries(Object.entries(options).filter(([,v])=>v!==undefined))}))
 values.signal?.throwIfAborted()
 const settings={maxJobs:null,maxPages:null,maxRequests:512,readTimeoutMs:25000,sourceTimeoutMs:300000,auditTimeoutMs:10000,...values}
 for(const key of ['maxJobs','maxPages'])if(settings[key]!==null&&(!Number.isSafeInteger(settings[key])||settings[key]<0))throw failure('Invalid Snowplow '+key,'SNOWPLOW_INVALID_OPTIONS')
 for(const [key,max]of [['maxRequests',1024],['readTimeoutMs',25000],['sourceTimeoutMs',900000],['auditTimeoutMs',20000]])if(!Number.isSafeInteger(settings[key])||settings[key]<1||settings[key]>max)throw failure('Invalid Snowplow '+key,'SNOWPLOW_INVALID_OPTIONS')
 for(const key of ['fetchPage','onAudit','now'])if(settings[key]!==undefined&&typeof settings[key]!=='function')throw failure('Invalid Snowplow '+key,'SNOWPLOW_INVALID_OPTIONS')
 return settings
}
export async function bounded(start,{signal,timeoutMs,code}){
 signal?.throwIfAborted()
 const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal,at=performance.now()
 const expired=()=>failure('Snowplow operation deadline exceeded',code)
 const check=()=>{combined.throwIfAborted();if(performance.now()-at>=timeoutMs){controller.abort(expired());combined.throwIfAborted()}}
 let listener;const timer=setTimeout(()=>controller.abort(expired()),timeoutMs)
 const aborted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
 try{const result=await Promise.race([Promise.resolve().then(()=>{check();return start(combined,check)}),aborted]);check();return result}
 catch(error){controller.abort(error);throw error}
 finally{clearTimeout(timer);combined.removeEventListener('abort',listener)}
}
export function runtime(settings){
 const controller=new AbortController(),signal=settings.signal?AbortSignal.any([settings.signal,controller.signal]):controller.signal,at=performance.now()
 const expired=()=>failure('Snowplow source deadline exceeded','SNOWPLOW_SOURCE_TIMEOUT'),timer=setTimeout(()=>controller.abort(expired()),settings.sourceTimeoutMs)
 let requests=0
 const check=()=>{settings.signal?.throwIfAborted();signal.throwIfAborted();if(performance.now()-at>=settings.sourceTimeoutMs){controller.abort(expired());signal.throwIfAborted()}}
 return{signal,check,get requests(){return requests},admit(){check();if(requests>=settings.maxRequests)throw failure('Snowplow request budget exhausted','SNOWPLOW_REQUEST_BUDGET');if(settings.maxPages!==null&&requests>=settings.maxPages)throw failure('Snowplow page budget exhausted','SNOWPLOW_PAGE_BUDGET');requests++},async read(start){check();const result=await bounded(start,{signal,timeoutMs:settings.readTimeoutMs,code:'SNOWPLOW_READ_TIMEOUT'});check();return result},close(){clearTimeout(timer);controller.abort(failure('Snowplow run finished','SNOWPLOW_FINISHED'))}}
}
