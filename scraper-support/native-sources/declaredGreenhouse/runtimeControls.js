async function abortable(start,signal){
 signal.throwIfAborted()
 let listener
 const interrupted=new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})
 try{return await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return start()}),interrupted])}
 catch(error){signal.throwIfAborted();throw error}
 finally{signal.removeEventListener('abort',listener)}
}
export const mergeDefinedNativeOptions=(defaults,passed)=>({...Object.fromEntries(Object.entries(defaults).filter(([,v])=>v!==undefined)),...Object.fromEntries(Object.entries(passed).filter(([,v])=>v!==undefined))})
export async function withNativeRuntimeControls(profile,defaults,passed,collect){
 const options=mergeDefinedNativeOptions(defaults,passed)
 options.signal?.throwIfAborted()
 options.maxJobs=options.maxJobs??null
 const maxPages=options.maxPages
 if(!(options.maxJobs===null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0))throw new RangeError('Declared Greenhouse maxJobs must be a nonnegative safe integer or null')
 if(maxPages!=null&&maxPages!==Infinity)throw new RangeError('Declared Greenhouse finite page limits cannot truncate the native inventory')
 const readTimeout=options.nativeReadTimeoutMs===undefined?15000:options.nativeReadTimeoutMs
 if(!Number.isSafeInteger(readTimeout)||readTimeout<1||readTimeout>120000)throw new RangeError('Declared Greenhouse native read timeout must be an integer from 1 to 120000 ms')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,sourceStarted=performance.now()
 let capture=null
 const evidence=()=>{
  const empty={source:profile?.source??null,observations:[],rawPages:[],sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,incompleteCollection:true}
  if(!capture)return empty
  try{const snapshot=structuredClone(capture());return snapshot&&typeof snapshot==='object'?{...snapshot,...Object.fromEntries(Object.entries(empty).filter(([key])=>!Object.hasOwn(snapshot,key)))}:empty}
  catch{return{...empty,snapshotUnavailable:true}}
 }
 const expire=(label,context,cause)=>{
  if(signal.aborted)return
  const audit=evidence(),error=Object.assign(Error(label==='source'?'Declared Greenhouse source deadline':'Declared Greenhouse native '+label+' deadline',{cause}),{
   name:'NativeGreenhouseTimeoutError',code:'GREENHOUSE_'+label.toUpperCase()+'_TIMEOUT',source:profile?.source??null,status:null,
   requestUrl:typeof context?.requestUrl==='string'?context.requestUrl:null,deadlineContext:context??null,
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,partialNativeJobs:[],
   nativeEvidence:audit,sourceAudit:audit,partialNativeRecords:Array.isArray(audit.observations)?audit.observations:[],retainedNativeResponses:Array.isArray(audit.rawPages)?audit.rawPages:[]})
  controller.abort(error)
 }
 // Every owned boundary and timer selects the same earliest active deadline.
 const sourceDeadline={at:sourceStarted+900000,label:'source',context:null},activeDeadlines=new Set()
 const earliest=()=>{let first=sourceDeadline;for(const deadline of activeDeadlines)if(deadline.at<first.at)first=deadline;return first}
 const expireEarliest=cause=>{const first=earliest();expire(first.label,first.context,cause)}
 const checkSource=cause=>{options.signal?.throwIfAborted();signal.throwIfAborted();if(performance.now()>=earliest().at){expireEarliest(cause);signal.throwIfAborted()}}
 const sourceTimer=setTimeout(()=>expireEarliest(),900000)
 const bounded=async(start,label,timeout,context)=>{
  checkSource()
  const deadline={at:performance.now()+timeout,label,context}
  activeDeadlines.add(deadline)
  const timer=setTimeout(()=>expireEarliest(),timeout)
  try{const value=await abortable(()=>{checkSource();return start(checkSource)},signal);checkSource();return value}
  catch(error){checkSource(error);throw error}
  finally{clearTimeout(timer);activeDeadlines.delete(deadline)}
 }
 const controls={read:(start,context)=>bounded(start,'read',readTimeout,context),audit:start=>bounded(start,'audit',15000),retain:provider=>{if(typeof provider!=='function')throw new TypeError('Declared Greenhouse evidence provider must be a function');capture=provider}}
 try{const value=await abortable(()=>{checkSource();return collect({...options,signal},controls)},signal);checkSource();return value}
 catch(error){checkSource(error);throw error}
 finally{clearTimeout(sourceTimer)}
}
