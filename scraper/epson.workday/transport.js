import {HOME,CAREERS} from './parser.js'
export const MAX_BODY_BYTES=2*1024*1024
export const MAX_REDIRECTS=3
export const TIMEOUT_MS=20000
export function validateURL(url){if(typeof url!=='string'||![HOME,CAREERS].includes(url))throw Object.assign(new TypeError('Disallowed Epson regional GET URL'),{code:'EPSON_URL_DISALLOWED'});return url}
export function redirectTarget(current,location){if(typeof location!=='string'||!location||location.trim()!==location||/[\\\r\n\t]/.test(location))throw Error('Invalid redirect location');
 // Preserve explicit default ports and encoded paths for exact lexical validation.
 const target=/^[A-Za-z][A-Za-z0-9+.-]*:/.test(location)?location:location.startsWith('//')?'https:'+location:location.startsWith('/')?'https://www.epson.co.in'+location:new URL(location,current).href;return validateURL(target)}
// The deadline covers fetch headers AND streaming reads. No cookies, auth,
// application links or automatic redirects are available on this boundary.
export function createNativeTransport({fetchImpl=globalThis.fetch,signal,timeoutMs=TIMEOUT_MS}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>TIMEOUT_MS)throw Error('Invalid bounded timeout')
 return async url=>{validateURL(url);const controller=new AbortController(),abort=()=>controller.abort(signal.reason);let reader,timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const e=Object.assign(new Error('Epson GET stream timeout'),{name:'TimeoutError',code:'ETIMEDOUT'});controller.abort(e);reject(e)},timeoutMs)});if(signal?.aborted)throw signal.reason;signal?.addEventListener('abort',abort,{once:true});
 const task=(async()=>{const response=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html'},signal:controller.signal});if(response.url!==url)throw Error('Transport followed redirect or returned a different URL');if(!response.headers||typeof response.headers.entries!=='function'||!Number.isInteger(response.status)||!response.body||typeof response.body.getReader!=='function')throw Error('Invalid streaming response');const headers=Object.fromEntries(response.headers.entries()),length=headers['content-length'];if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY_BYTES))throw Error('Oversized or invalid content length');reader=response.body.getReader();const chunks=[];let bytes=0;for(;;){const {done,value}=await reader.read();if(done)break;if(!(value instanceof Uint8Array))throw Error('Invalid response stream chunk');bytes+=value.byteLength;if(bytes>MAX_BODY_BYTES)throw Object.assign(new Error('Epson response exceeds 2MiB stream limit'),{code:'EPSON_BODY_LIMIT'});chunks.push(Buffer.from(value))}return {url:response.url,status:response.status,headers,body:Buffer.concat(chunks,bytes),bodyComplete:true}})();
 try{return await Promise.race([task,timeout])}catch(error){controller.abort(error);try{Promise.resolve(reader?.cancel(error)).catch(()=>{})}catch{}throw error}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}}
}
