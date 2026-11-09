import {createHash} from 'node:crypto'

export function createTransport(options={}) {
 const controller=new AbortController()
 const timeout=setTimeout(()=>controller.abort(Object.assign(new Error('Samsung overall timeout'),{code:'SAMSUNG_TIMEOUT'})),options.overallTimeoutMs??180000)
 const callerAbort=()=>controller.abort(options.signal.reason)
 if(options.signal?.aborted)callerAbort()
 else options.signal?.addEventListener('abort',callerAbort,{once:true})
 const signal=controller.signal, retainedResponses=[]
 const bounded=async work=>{
  signal.throwIfAborted()
  let timer,onAbort
  const abort=new Promise((_,reject)=>{onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true})})
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=Object.assign(new Error('Samsung request/body timeout'),{code:'SAMSUNG_TIMEOUT'});controller.abort(error);reject(error)},options.requestTimeoutMs??25000)})
  try{return await Promise.race([Promise.resolve().then(work),abort,deadline])}
  finally{clearTimeout(timer);signal.removeEventListener('abort',onAbort)}
 }
 const read=async(url,requestBody)=>bounded(async()=>{
  const parsed=new URL(url)
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||!['www.samsung.com','research.samsung.com','sec.wd3.myworkdayjobs.com'].includes(parsed.hostname))throw Error('Samsung unapproved upstream URL')
  const nativeJSON=Boolean(requestBody)||parsed.pathname.includes('/wday/cxs/')
  const response=await (options.fetchImpl??fetch)(url,{method:requestBody?'POST':'GET',redirect:'error',signal,headers:{Accept:nativeJSON?'application/json':'text/html','Content-Type':'application/json'},...(requestBody?{body:JSON.stringify(requestBody)}:{})})
  signal.throwIfAborted()
  if(response.status!==200)throw Error('Samsung HTTP '+response.status+' at '+url)
  if(response.url&&response.url!==url)throw Error('Samsung response URL mismatch')
  if(!/^(?:text\/html|application\/json)(?:;|$)/i.test(response.headers.get('content-type')??''))throw Error('Samsung unexpected content type')
  const body=await response.text()
  signal.throwIfAborted()
  if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>8*1024*1024)throw Error('Samsung incomplete/oversized body')
  retainedResponses.push({url,finalUrl:response.url||url,status:response.status,capturedAt:new Date().toISOString(),body,bodySHA256:createHash('sha256').update(body).digest('hex'),...(requestBody?{requestBody}:{})})
  return nativeJSON?JSON.parse(body):body
 })
 return {read,signal,retainedResponses,close(){clearTimeout(timeout);options.signal?.removeEventListener('abort',callerAbort)}}
}
