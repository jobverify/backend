export const runtimeError=(message,code)=>Object.assign(Error(message),{code})
export function optionsFor(input){
 const supplied=Object.fromEntries(Object.entries(input).filter(([,v])=>v!==undefined))
 supplied.signal?.throwIfAborted()
 const options={maxJobs:null,maxPages:null,maxRequests:64,readTimeoutMs:supplied.timeoutMs??20000,sourceTimeoutMs:120000,auditTimeoutMs:10000,...supplied}
 for(const key of ['maxJobs','maxPages'])if(options[key]!==null&&(!Number.isSafeInteger(options[key])||options[key]<0))throw runtimeError('Invalid IMTF '+key,'IMTF_INVALID_OPTIONS')
 for(const [key,max]of [['maxRequests',128],['readTimeoutMs',20000],['sourceTimeoutMs',900000],['auditTimeoutMs',20000]])
  if(!Number.isSafeInteger(options[key])||options[key]<1||options[key]>max)throw runtimeError('Invalid IMTF '+key,'IMTF_INVALID_OPTIONS')
 for(const key of ['transport','fetchImpl','onAudit'])if(options[key]!==undefined&&typeof options[key]!=='function')throw runtimeError('Invalid IMTF '+key,'IMTF_INVALID_OPTIONS')
 return options
}

export async function boundedOperation(start,{signal,timeoutMs,code,name='TimeoutError'}){
 signal?.throwIfAborted()
 const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
 const began=performance.now(),expired=()=>Object.assign(runtimeError('IMTF operation deadline exceeded',code),{name})
 let listener
 const timer=setTimeout(()=>controller.abort(expired()),timeoutMs)
 const check=()=>{combined.throwIfAborted();if(performance.now()-began>=timeoutMs){controller.abort(expired());combined.throwIfAborted()}}
 const aborted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
 try{
  const value=await Promise.race([Promise.resolve().then(()=>{check();return start(combined,check)}),aborted])
  check();return value
 }catch(error){controller.abort(error);throw error}
 finally{clearTimeout(timer);combined.removeEventListener('abort',listener)}
}

export function createRuntime(options){
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const began=performance.now(),expired=()=>runtimeError('IMTF source deadline exceeded','IMTF_SOURCE_TIMEOUT')
 const timer=setTimeout(()=>controller.abort(expired()),options.sourceTimeoutMs)
 let requests=0,stopped=false,firstFailure
 const check=()=>{options.signal?.throwIfAborted();signal.throwIfAborted();if(performance.now()-began>=options.sourceTimeoutMs){controller.abort(expired());signal.throwIfAborted()}}
 return{signal,check,get requests(){return requests},get stopped(){return stopped},
  admit(){check();if(stopped)throw firstFailure
   if(requests>=options.maxRequests)throw runtimeError('IMTF request budget exhausted','IMTF_REQUEST_BUDGET')
   if(options.maxPages!==null&&requests>=options.maxPages)throw runtimeError('IMTF page budget exhausted','IMTF_PAGE_BUDGET')
   requests++
  },
  stop(error){if(!stopped){stopped=true;firstFailure=error}},
  async wait(start,timeoutMs,code){check();const result=await boundedOperation(start,{signal,timeoutMs,code});check();return result},
  close(){clearTimeout(timer);controller.abort(runtimeError('IMTF source run finished','IMTF_FINISHED'))},
 }
}
