import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'

const profile=JSON.parse(readFileSync(new URL('./currentProfile20261114.json',import.meta.url))),assets=new Map(profile.assets.map(asset=>[asset.url,asset]))
const sha=value=>createHash('sha256').update(value).digest('hex'),byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const fail=(message,status)=>Object.assign(Error('navi current public assets: '+message),{abortRetries:true,incompleteScope:true,...(status===undefined?{}:{status,publicReadFailure:true})})
const cancel=(body,reason)=>{try{Promise.resolve(body?.cancel?.(reason)).catch(()=>{})}catch{}}

// Share the original source signal/deadline and count ALL old/new reads against
// the existing280-read ceiling. Current immutable entities require original
// HTTP bytes; legacy body-callback compatibility remains in the old transport.
export const createNaviPublicReads=(transport,options)=>{
 let count=0
 const signal=transport.signal,requestIntervalMs=options.requestIntervalMs??1000
 const start=()=>{signal.throwIfAborted();if(++count>280)throw fail('existing total public read limit exceeded')}
 const wrap=method=>(...args)=>{start();return transport[method](...args)}
 return {fetchText:wrap('fetchText'),fetchScript:wrap('fetchScript'),fetchJson:wrap('fetchJson'),
  async fetchCurrentAsset(url){
   start();const asset=assets.get(url)
   if(!asset)throw fail('unreviewed immutable asset URL')
   if(options.fetchText||options.fetchJson||options.fetchPage)throw fail('original HTTP entity bytes are required; body-only callbacks cannot qualify current assets')
   if(requestIntervalMs)await delay(requestIntervalMs,undefined,{signal})
   signal.throwIfAborted()
   const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:20000,overflowError:fail('original response body limit'),
    fetchImpl:async(target,init)=>{
     const original=await(options.fetchImpl??globalThis.fetch)(target,{...init,credentials:'omit',headers:{...init.headers,Accept:asset.kind==='css'?'text/css':'application/javascript'}})
     try{
      signal.throwIfAborted()
      if(original.status!==200)throw fail('HTTP '+original.status,original.status)
      if(original.url!==target)throw fail('original final URL changed')
      if(!(asset.kind==='css'?/^text\/css(?:;|$)/i:/^(?:application|text)\/(?:x-)?(?:java|ecma)script(?:;|$)/i).test(original.headers.get('content-type')??''))throw fail('original immutable asset MIME changed')
      const body=original.body,limit=asset.kind==='css'?4000000:16000000
      return{status:original.status,url:original.url,headers:original.headers,body:body===null?null:{cancel:reason=>body.cancel(reason),getReader(){
       const reader=body.getReader();let size=0
       return{async read(){const value=await reader.read();signal.throwIfAborted();if(!value.done&&types.isUint8Array(value.value)&&((size+=byteLength.call(value.value))>limit))throw fail('original response body limit');return value},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}}
     }catch(error){cancel(original.body,error);throw error}
    }})
   signal.throwIfAborted()
   const bytes=Buffer.from(response.bodyBase64,'base64'),entitySHA256=sha(bytes)
   if(bytes.length!==asset.bytes||entitySHA256!==asset.entitySHA256)throw fail('immutable original entity bytes changed')
   let body
   try{body=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw fail('original immutable entity is invalid UTF8')}
   const decodedBodySHA256=sha(body)
   if(decodedBodySHA256!==asset.decodedBodySHA256)throw fail('immutable original byte/text pair changed')
   return{url,body,entitySHA256,decodedBodySHA256,bytes:bytes.length}
  },
 }
}
