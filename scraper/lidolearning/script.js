import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {normalizeInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import candidate from './catalog-candidate.json' with {type:'json'}

export const SOURCE='lidolearning', COMPANY='Lido Learning'
export const FIRST_PARTY_ROOT_URL='https://www.lidolearning.com/'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createLidoLearningScraper=(defaults={})=>({async run(options={}) {
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000}={...defaults,...options}
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let surface=FIRST_PARTY_ROOT_URL,timer,onAbort
 const gap=(reason,cause)=>Object.assign(new Error('LidoLearning coverage gap: '+reason,{cause}),{
  code:'LIDOLEARNING_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty:false,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason}),
 })
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=gap('Aggregate source fetch/body deadline exceeded');controller.abort(error);reject(error)},timeoutMs)
 })
 const collect=async()=>{
  const read=async (url,request={})=>{
   surface=url;controller.signal.throwIfAborted()
   const response=await fetchImpl(url,{signal:controller.signal,redirect:'error',method:request.method||'GET',headers:{Accept:'text/html,application/json',...request.headers},...(request.body?{body:JSON.stringify(request.body)}:{})})
   const cancelBody=reason=>{void Promise.resolve().then(()=>response.body?.cancel?.(reason)).catch(()=>{})}
   if(controller.signal.aborted)cancelBody(controller.signal.reason)
   controller.signal.throwIfAborted()
   if(response.url!==url||(response.status!==200&&!(request.observeUnauthorized&&response.status===401))){
    retainedResponses.push({url,finalUrl:response.url,status:response.status,bodyUnread:true,capturedAt:new Date().toISOString()})
    const reason=response.url!==url?'Source final URL changed':'Source HTTP failure'
    const error=Object.assign(gap(reason+'; HTTP '+response.status+' for '+url+'; final URL '+response.url),{status:response.status,requestUrl:url,finalUrl:response.url})
    cancelBody(error);throw error
   }
   let body
   if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let bytes=0
    const cancel=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
    controller.signal.addEventListener('abort',cancel,{once:true})
    try{while(true){controller.signal.throwIfAborted();const {done,value}=await reader.read();controller.signal.throwIfAborted();if(done)break;bytes+=value.byteLength;if(bytes>4000000){void reader.cancel().catch(()=>{});throw gap('Source streamed body exceeds byte limit')}chunks.push(Buffer.from(value))}body=Buffer.concat(chunks).toString('utf8')}
    finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock()}
   }else {const error=gap('Bounded source stream unavailable');cancelBody(error);throw error}
   controller.signal.throwIfAborted()
   if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>4000000)throw gap('Source body missing or exceeds bound')
   retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex'),...(request.observeUnauthorized?{requestHeaders:request.headers,requestBody:request.body??null,requestMethod:request.method||'GET'}:{})})
   return request.observeUnauthorized?{body,status:response.status}:body
  }
  const corporateHTML=await read(FIRST_PARTY_ROOT_URL),corporate=document(corporateHTML)
  const title=corporateHTML.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''
  const employerIdentity=/lido\s*learning/i.test(title)&&corporate.nodes(n=>/^h[1-3]$/.test(n.tag)&&/lido\s*learning/i.test(corporate.text(n))).length>0
  if(!title)throw gap('Corporate identity document changed or shell unavailable')
  const employer=document(await read('https://www.linkedin.com/company/lido-learning'))
  if(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='LIDO').length!==1||employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:14625914').length!==1)throw gap('Exact native employer identity changed')
  if(!employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const url=new URL(n.attrs.href);return url.origin==='https://www.linkedin.com'&&url.pathname==='/redir/redirect'&&new URL(url.searchParams.get('url')).href===FIRST_PARTY_ROOT_URL}catch{return false}}))throw gap('Native reciprocal employer domain changed')
  const observations=[]
  for(const location of ['India','Worldwide']){
   const url='https://www.linkedin.com/jobs/search/?f_C=14625914&location='+location
   const doc=document(await read(url))
   const scope=doc.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='14625914'&&Object.hasOwn(n.attrs,'checked')).length===1
   const noMatch=doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1
   if(!scope||!noMatch||doc.nodes(n=>doc.hasClass(n,'job-search-card')||/JobPosting/i.test(n.attrs.itemtype||'')||n.tag==='time'||Object.hasOwn(n.attrs,'itemprop')||n.tag==='script'&&n.attrs.type==='application/ld+json'&&/JobPosting/.test(n.raw)).length)throw gap('Native scoped listing changed; role country, earliest publication, expiry and active Apply require review')
   observations.push({url,exactEmployerId:'14625914',location,observedNoMatch:true,listingComplete:false})
  }
  const webbtree=document(await read('https://app.webbtree.com/company/lidolearning/jobs'))
  const client=webbtree.nodes(n=>n.tag==='script'&&n.attrs.src==='main-es2015.7b693001c98af043cb86.js').length===1
  if(!client)throw gap('Unassociated Webbtree discovery client changed; employer association and vacancy metadata require review')
  const nativeClient=await read('https://app.webbtree.com/company/main-es2015.7b693001c98af043cb86.js')
  if(createHash('sha256').update(nativeClient).digest('hex')!=='8295ed0326d18cca3d2c560dd2b3b7ddb4923d340b47611686569d98398d1ab9')throw gap('Native Webbtree client changed; tenant identity, endpoint and eligibility require review')
  const encoded='VA34plKma25sh4vywwGhgggweqeq',tenant='lidolearning/'+encoded
  const companyAPI='https://appapi.webbtree.com/candidate/company/getcompanyinfo?domain='+tenant+'&c_n=lidolearning&c_e='+encoded
  const webbtreeAPIObservations=[]
  for(const [url,request] of [[companyAPI,{headers:{customurl:'/'+tenant}}],['https://appapi.webbtree.com/candidate/jobs/getjobs',{method:'POST',headers:{customurl:tenant,'Content-Type':'application/json'},body:{params:{locationname:'',employmenttype:'',jobnameordept:''}}}]]){
   const response=await read(url,{...request,observeUnauthorized:true})
   if(response.status!==401||response.body!=='{"message":"Incorrect client"}')throw gap('Native Webbtree API observation changed; current employer association and vacancy eligibility require review')
   webbtreeAPIObservations.push({url,status:401,reason:'Incorrect client',inventoryKnown:false})
  }
  throw Object.assign(gap('Corporate root identity is '+(employerIdentity?'unverified':'unrelated')+'; exact native employer 14625914 India and Worldwide scoped no-match observations do not prove company emptiness. Exact-name Webbtree anonymous company and vacancy APIs each return HTTP401 Incorrect client; no verified current recruiting handoff and whole-company inventory unknown'),{nativeCollectionEvidence:{nativeEmployerId:'14625914',corporateEmployerIdentityVerified:false,observations,webbtreeEmployerAssociationVerified:false,webbtreeAPIObservations,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='LIDOLEARNING_COVERAGE_GAP')throw error;throw gap('Native source transport, body or inventory unavailable',error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createLidoLearningScraper(options).run(options)
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/lidolearning/script.js')){
 const jobs=await run()
 if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
}
