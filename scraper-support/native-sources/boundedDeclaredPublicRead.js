import {types} from 'node:util'

const maxBytes=16*1024*1024,typedArray=Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic=name=>Object.getOwnPropertyDescriptor(typedArray,name).get
const byteLength=intrinsic('byteLength'),byteOffset=intrinsic('byteOffset'),arrayBuffer=intrinsic('buffer')
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}

// Admission and proof that a query is a public read belong to the source
// profile. This primitive preserves the declared method in every transport.
export async function boundedDeclaredPublicRead(url,{fetchImpl,signal,overflowError,request={method:'GET'},timeoutMs=15000}){
 if(!request||!['GET','POST'].includes(request.method)||Object.keys(request).some(key=>!['method','body'].includes(key))||
  (request.method==='GET'?request.body!==undefined:typeof request.body!=='string'||Buffer.byteLength(request.body)>1024||!request.body))throw TypeError('Invalid declared public read descriptor')
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw RangeError('Invalid declared public read deadline')
 const method=request.method,body=request.body,started=performance.now(),canceled=new WeakSet(),released=new WeakSet()
 let response,reader,timeoutReason
 const callerSignal=signal,deadline=new AbortController()
 const expired=()=>timeoutReason??=new DOMException('The operation was aborted due to timeout','TimeoutError')
 const timer=setTimeout(()=>deadline.abort(expired()),timeoutMs)
 signal=callerSignal?AbortSignal.any([callerSignal,deadline.signal]):deadline.signal
 const check=()=>{callerSignal?.throwIfAborted();if(performance.now()-started>=timeoutMs&&!deadline.signal.aborted)deadline.abort(expired());signal.throwIfAborted()}
 const release=value=>{if(!value||released.has(value))return;released.add(value);ignore(()=>value.releaseLock())}
 const cancelReader=(value,reason)=>{if(!value||canceled.has(value))return;canceled.add(value);ignore(()=>value.cancel(reason));release(value)}
 const cancelResponse=(value,reason)=>ignore(()=>{const body=value?.body;if(!body||canceled.has(body))return;canceled.add(body);return body.cancel(reason)})
 const wait=(operation,disposeLate)=>new Promise((resolve,reject)=>{
  let settled=false,failure
  const detach=()=>signal?.removeEventListener('abort',aborted)
  const fail=reason=>{if(!settled){settled=true;failure=reason;detach();reject(reason)}}
  const aborted=()=>fail(signal.reason)
  signal?.addEventListener('abort',aborted,{once:true})
  try{check()}catch(error){fail(error);return}
  Promise.resolve().then(()=>{check();return operation()}).then(value=>{
   if(settled){if(disposeLate)ignore(()=>disposeLate(value,failure));return}
   try{check()}catch(error){fail(error);if(disposeLate)ignore(()=>disposeLate(value,error));return}
   settled=true;detach();resolve(value)
  },error=>{if(settled)return;try{check()}catch(expired){error=expired}fail(error)})
 })
 try{
  response=await wait(()=>fetchImpl(url,{method,redirect:'manual',signal,
   ...(method==='POST'?{body}:{}),headers:{Accept:'text/html,application/json,*/*;q=0.5','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)',
    ...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'}:{})}}),cancelResponse)
  check();const chunks=[];let size=0
  if(response.body!==null){
   reader=await wait(()=>response.body.getReader(),cancelReader)
   for(;;){
    const {done,value}=await wait(()=>reader.read());if(done)break
    if(!types.isUint8Array(value))throw TypeError('Native response chunk must be a Uint8Array')
    const length=byteLength.call(value);if(length>maxBytes-size)throw overflowError
    check();chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(value),byteOffset.call(value),length)));size+=length;check()
   }
  }
  check();const bytes=Buffer.concat(chunks,size)
  const page={status:response.status,url:response.url,headers:Object.fromEntries(response.headers),bodyBase64:bytes.toString('base64')}
  check();return page
 }catch(error){if(reader)cancelReader(reader,error);else cancelResponse(response,error);throw error}
 finally{clearTimeout(timer);release(reader)}
}
