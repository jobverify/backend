import {lookup} from 'node:dns/promises'
import {BlockList,isIP} from 'node:net'
import https from 'node:https'
import {checkServerIdentity} from 'node:tls'
import {Readable,pipeline} from 'node:stream'
import {createGunzip,createInflate,createBrotliDecompress} from 'node:zlib'
import {createPinnedProxyAgent,publicProxyError} from './pinnedProxyAgent.js'

const denied=new BlockList()
for(const [network,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])denied.addSubnet(network,prefix,'ipv4')
for(const [network,prefix] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8],['2001:db8::',32]])denied.addSubnet(network,prefix,'ipv6')
export const isPublicAddress=address=>Boolean(isIP(address)&&!denied.check(address,isIP(address)===6?'ipv6':'ipv4'))
const initialHolds=['www.coinbase.com','careers.confluent.io','www.pinterestcareers.com','cgsinc.com','www.springboard.com','job-boards.greenhouse.io','www.ft.com','c27rhq.csb.app']
const hostStarts=new Map(),rawEncodedBody=Symbol('pinned HTTPS encoded entity')
const toWeb=stream=>Readable.toWeb(stream,{strategy:{highWaterMark:65536,size:chunk=>chunk.byteLength}})
const pause=(milliseconds,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal.reason)}
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},milliseconds)
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
})
// A signal alone cannot settle an injected collaborator that ignores it.
const within=(start,signal,milliseconds=15000,late)=>new Promise((resolve,reject)=>{
 let finished=false
 const finish=(bad,value)=>{if(finished){if(!bad)late?.(value);return}finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(signal?.aborted){if(!bad)late?.(value);reject(signal.reason)}else bad?reject(value):resolve(value)}
 const abort=()=>finish(true,signal.reason)
 const timer=setTimeout(()=>finish(true,Error('Public GET timeout')),milliseconds)
 signal?.addEventListener('abort',abort,{once:true})
 Promise.resolve().then(()=>{signal?.throwIfAborted();return start()}).then(value=>finish(false,value),error=>finish(true,error));if(signal?.aborted)abort()
})
const cancelLateResponse=value=>{try{within(()=>value?.body?.cancel?.(),undefined,1000).catch(()=>{})}catch{}}

// Direct sockets use validated DNS and peer addresses. An explicitly configured
// Node proxy CONNECTs to a validated IP with the original Host and TLS identity.
export const pinnedHTTPSFetch=(value,init)=>new Promise((resolve,reject)=>{
 const url=new URL(value),host=url.hostname.replace(/^\[|\]$/g,''),addresses=(init.validatedAddresses||[]).map(a=>({address:a.address,family:isIP(a.address)}))
 if(init.signal?.aborted){reject(init.signal.reason);return}
 if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address))){reject(Error('No validated public destination'));return}
 const allowed=new BlockList();for(const a of addresses)allowed.addAddress(a.address,a.family===6?'ipv6':'ipv4')
 const pinnedLookup=(hostname,options,callback)=>{
  if(typeof options==='function'){callback=options;options={}}
  if(hostname.toLowerCase()!==host.toLowerCase()){callback(Error('Lookup left validated hostname'));return}
  const candidates=addresses.filter(a=>!options.family||a.family===Number(options.family))
  if(!candidates.length){callback(Error('No validated address for requested family'));return}
  if(options.all)callback(null,candidates.map(a=>({...a})))
  else callback(null,candidates[0].address,candidates[0].family)
 }
 let request,proxy,incomingOwned,connectionNotification=Promise.resolve(),connected=false,settled=false,failed=false,primary,requestDestroyed=false,proxyDestroyed=false
 const abort=()=>fail(init.signal.reason)
 const cleanup=()=>{init.signal?.removeEventListener('abort',abort);if(proxy&&!proxyDestroyed){proxyDestroyed=true;try{Promise.resolve(proxy.agent.destroy()).catch(()=>{})}catch{}}}
 const destroyedIncoming=new WeakSet()
 const destroyIncoming=incoming=>{if(!incoming||destroyedIncoming.has(incoming))return;destroyedIncoming.add(incoming);try{incoming.destroy(primary)}catch{}}
 const destroyRequest=()=>{if(!request||requestDestroyed)return;requestDestroyed=true;try{request.destroy(primary)}catch{}}
 const fail=(error,rawRequest=false)=>{
  if(!failed){failed=true;primary=init.signal?.aborted?init.signal.reason:rawRequest&&proxy?publicProxyError(error):error}
  if(init.signal?.aborted)primary=init.signal.reason
  if(!settled){settled=true;reject(primary)}
  destroyRequest();destroyIncoming(incomingOwned);cleanup()
 }
 const active=()=>{if(init.signal?.aborted){fail(init.signal.reason);return false}return!failed}
 const notifyConnection=info=>{connected=true;connectionNotification=within(()=>init.onConnected?.(info),init.signal);connectionNotification.catch(error=>fail(error));return true}
 const inspectSocket=socket=>{
  if(!active())return false
  if(proxy){
   if(socket.encrypted!==true||socket.authorized!==true){fail(Error('Origin TLS certificate was not verified'));return false}
   return notifyConnection({url:url.href,connectionMode:'validated-public-ip-connect',pinnedAddress:proxy.address,
    validatedAddresses:addresses.map(a=>({...a})),originCertificateVerified:true,publicDestinationBound:true})
  }
  const address=socket.remoteAddress,family=isIP(address||'')
  if(!family||!isPublicAddress(address)||!allowed.check(address,family===6?'ipv6':'ipv4')){fail(Error('Socket destination is outside the validated public set'));return false}
  return notifyConnection({url:url.href,remoteAddress:address,validatedAddresses:addresses.map(a=>({...a})),publicDestinationBound:true})
 }
 init.signal?.addEventListener('abort',abort,{once:true})
 try{
  proxy=createPinnedProxyAgent(url,addresses)
  if(!active()){cleanup();return}
  const headersForOrigin=new Headers(init.headers);if(proxy)headersForOrigin.set('Host',url.host)
  request=https.request({protocol:'https:',hostname:proxy?proxy.address:host,port:url.port||443,path:url.pathname+url.search,method:'GET',headers:proxy?Object.fromEntries(headersForOrigin):init.headers,agent:proxy?proxy.agent:false,
   ...(!proxy?{lookup:pinnedLookup,autoSelectFamily:true}:{}),servername:isIP(host)?undefined:host,rejectUnauthorized:true,
   checkServerIdentity:(_hostname,certificate)=>checkServerIdentity(host,certificate),signal:init.signal},incoming=>{
   try{
    incoming.on('error',error=>fail(error));incoming.once('close',cleanup)
    if(!active()){destroyIncoming(incoming);return}
    incomingOwned=incoming
    if(!connected&&!inspectSocket(incoming.socket)){destroyIncoming(incoming);return}
    const headers=new Headers()
    for(const [name,value] of Object.entries(incoming.headers))if(value!=null){if(Array.isArray(value))for(const item of value)headers.append(name,item);else headers.set(name,String(value))}
    // R1: notify the denial/receipt observer before constructing or reading body.
    within(()=>connectionNotification,init.signal).then(()=>within(()=>init.onResponseHeaders?.({url:url.href,status:incoming.statusCode,headers:Object.fromEntries(headers),httpVersion:incoming.httpVersion}),init.signal)).then(()=>{
     try{
      if(!active()){destroyIncoming(incoming);return}
      const empty=[204,205,304].includes(incoming.statusCode);if(empty)incoming.resume()
      const response=new Response(empty?null:toWeb(incoming),{status:incoming.statusCode,headers})
      Object.defineProperty(response,'url',{value:url.href});Object.defineProperty(response,rawEncodedBody,{value:true});settled=true;resolve(response)
     }catch(error){fail(error)}
    },error=>fail(error))
   }catch(error){incomingOwned=incoming;fail(error)}
  })
  request.on('error',error=>fail(error,true))
  request.on('socket',socket=>{try{if(!active())return;if(socket.connecting||(proxy&&socket.secureConnecting))socket.once(proxy?'secureConnect':'connect',()=>{try{inspectSocket(socket)}catch(error){fail(error)}});else inspectSocket(socket)}catch(error){fail(error)}})
  if(!active()){destroyRequest();return}
  request.end()
 }catch(error){fail(error)}
})

const decodedBody=response=>{
 const encoding=(response.headers.get('content-encoding')||'').trim().toLowerCase()
 if(!response[rawEncodedBody]||!response.body||!encoding||encoding==='identity')return response.body
 const decompress=encoding==='gzip'?createGunzip:encoding==='deflate'?createInflate:encoding==='br'?createBrotliDecompress:null
 if(!decompress)throw Error('Unsupported original HTTP content encoding: '+encoding)
 const source=Readable.fromWeb(response.body),decoder=decompress()
 pipeline(source,decoder,()=>{}) // pipeline destroys the source when decoding/cancellation fails.
 return toWeb(decoder)
}

export const createPublicPageReader=(options={})=>{
 const {signal,resolveHost=host=>lookup(host,{all:true,verbatim:true})}=options
 const injected=Boolean(options.fetchImpl&&!options.fetchPage)
 if(injected&&options.testOnlyInjectedTransport!==true)throw Error('Unpinned raw fetch override refused; use retained original fetchPage or explicit test-only transport injection')
 const fetchImpl=injected?options.fetchImpl:pinnedHTTPSFetch,events=[],held=options.heldHosts||new Set(initialHolds)
 for(const host of initialHolds)held.add(host)
 let count=0
 const refuse=(url,reason)=>{events.push({url,reason,HTTPResponseFabricated:false});throw Error('Public GET withheld: '+reason)}
 const read=async value=>{
  signal?.throwIfAborted();try{const url=new URL(value),host=url.hostname.replace(/^\[|\]$/g,'')
  if(url.protocol!=='https:'||url.username||url.password||/\/(?:apply|application|applications|login|sign-in|sign_in|register|consent|form|forms|signup|sign-up)(?:\/|$)/i.test(url.pathname))refuse(url.href,'prohibited HTTP/auth/form route')
  if(held.has(host))refuse(url.href,'held host')
  if(isIP(host)&&!isPublicAddress(host))refuse(url.href,'no public destination')
  if(++count>128)refuse(url.href,'source request limit')
  let page
  if(options.fetchPage)page=await within(()=>options.fetchPage(url.href,{signal}),signal,15000,cancelLateResponse)
  else{
   // Refresh each request; the resulting set also controls the actual socket.
   const resolved=isIP(host)?[{address:host,family:isIP(host)}]:await within(()=>resolveHost(host),signal)
   const addresses=Array.isArray(resolved)?resolved.map(a=>({address:a.address,family:isIP(a.address)})):[]
   const publicOnly=addresses.length>0&&addresses.every(a=>isPublicAddress(a.address));events.push({host,addresses,publicOnly,HTTPResponseFabricated:false})
   if(!publicOnly)refuse(url.href,'no public destination');signal?.throwIfAborted()
   const start=Math.max(Date.now(),hostStarts.get(host)||0);hostStarts.set(host,start+1000)
   if(start>Date.now())await pause(start-Date.now(),signal);signal?.throwIfAborted();if(held.has(host))refuse(url.href,'held host while queued')
   const requestSignal=AbortSignal.any([AbortSignal.timeout(15000),...(signal?[signal]:[])])
   const request={url:url.href,method:'GET',requestBody:null,authenticationOrCookiesSent:false,requestedAt:new Date().toISOString(),validatedAddresses:addresses}
   await within(()=>options.onRequest?.(structuredClone(request)),requestSignal)
   let headerSeen=false
   const headersReceived=info=>{
    if(headerSeen)return;headerSeen=true
    if([401,403,429].includes(info.status)){held.add(host);events.push({kind:'denial-headers',url:url.href,host,status:info.status,headersReceived:true,bodyReadBeforeHold:false,HTTPResponseFabricated:false})}
    return options.onResponseHeaders?.(structuredClone(info))
   }
   const response=await within(()=>fetchImpl(url,{method:'GET',redirect:'manual',signal:requestSignal,validatedAddresses:addresses,
    headers:{Accept:'text/html,application/json,text/markdown,*/*;q=0.5','Accept-Encoding':'identity','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'},
    onResponseHeaders:headersReceived,onConnected:info=>{events.push({kind:'connected-public-destination',...info});return options.onConnected?.(structuredClone(info))}}),requestSignal,15000,cancelLateResponse)
   if(injected)events.push({kind:'test-only-injected-transport',url:url.href,currentNetworkProof:false})
   await within(()=>headersReceived({url:url.href,status:response.status,headers:Object.fromEntries(response.headers)}),requestSignal)
   const chunks=[];let total=0,body
   try{
    body=decodedBody(response)
    if(body?.getReader){
     const reader=body.getReader()
     let readFailed=false,readFailure
     try{for(;;){requestSignal.throwIfAborted();const {done,value}=await within(()=>reader.read(),requestSignal);if(done)break;total+=value.byteLength;if(total>16*1024*1024)throw Error('Public GET entity exceeds16MB');chunks.push(Buffer.from(value))}}
     catch(error){readFailed=true;readFailure=error;await within(()=>reader.cancel(error),undefined,1000).catch(()=>{})}finally{try{reader.releaseLock()}catch(error){if(!readFailed){readFailed=true;readFailure=error}}}
     if(readFailed)throw readFailure
    }else{const bytes=Buffer.from(await within(()=>response.arrayBuffer(),requestSignal));if(bytes.length>16*1024*1024)throw Error('Public GET entity exceeds16MB');chunks.push(bytes)}
   }catch(error){if(!body&&response.body)await within(()=>response.body.cancel(error),undefined,1000).catch(()=>{});throw error}
   page={url:response.url||url.href,status:response.status,headers:Object.fromEntries(response.headers),bodyBase64:Buffer.concat(chunks).toString('base64')}
  }
  signal?.throwIfAborted()
  if([401,403,429].includes(page?.status))held.add(host)
  const original=typeof page?.bodyBase64==='string'?Buffer.from(page.bodyBase64,'base64').toString('utf8'):''
  if(/<(?:title|h1)\b[^>]*>\s*(?:Access Denied|Security Verification|Just a moment|Verify you are human|Checking your browser|Captcha)/i.test(original)){
   held.add(host);events.push({url:url.href,reason:'original security/consent gate; no activation',status:page.status});return {...page,transportQualified:false}
  }
  return page
  }catch(error){signal?.throwIfAborted();throw error}
 }
 return {read,events,held,get remainingRequests(){return Math.max(0,128-count)}}
}
