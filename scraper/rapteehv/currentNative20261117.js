import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
const SOURCE='rapteehv',CAREERS='https://www.rapteehv.com/careers',CURRENT=CAREERS+'/',EMBED='https://raptee.keka.com/careers/api/embedjobs/js/3d03878f-6bf4-4fe3-9090-2989304de3b4',DENIED='https://raptee.keka.com/careers/Content/403.html'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},sha=value=>createHash('sha256').update(value).digest('hex')
export function readCurrentRapteeCorporate(body){
 const doc=readNativeDocument(body),canonicals=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.src===EMBED)
 need(JSON.stringify(activeHead(body).titles)==='["Careers at Raptee.HV | EV Jobs in Chennai & Bangalore"]'&&!doc.nodes(n=>n.tag==='base').length,'Current Raptee employer title/base changed')
 need(canonicals.length===1&&canonicals[0].attrs.href===CAREERS&&scripts.length===1&&Object.hasOwn(scripts[0].attrs,'defer'),'Current Raptee own canonical/widget handoff changed')
 need(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Build the Future With Us').length===1&&doc.nodes(n=>n.tag==='h2'&&n.attrs.id==='openings-heading'&&doc.text(n)==='Current openings').length===1,'Current Raptee recruitment heading changed')
 const modules=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module').map(n=>n.attrs)
 need(modules.length===1&&modules[0].src==='/assets/app-0fiCKGX2.js'&&doc.nodes(n=>n.tag==='a'&&n.attrs.href?.includes('/careers')).every(n=>!n.attrs.href.startsWith('https://')||n.attrs.href.startsWith('https://www.rapteehv.com/')),'Current Raptee reviewed client declaration changed')
 return {title:activeHead(body).titles[0],canonical:canonicals[0].attrs.href,widgetDeclaration:structuredClone(scripts[0]),moduleDeclarations:modules,wholeOriginalCareersHTML:body,declaredWidgetURL:EMBED,fullInventoryQualified:false}
}
export async function runCurrentRaptee(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'Original fetch response metadata required')
 const timeout=options.sourceTimeoutMs??90000,readMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000&&Number.isSafeInteger(readMs)&&readMs>0&&readMs<=15000,'Invalid native source/read deadlines')
 const owner=new AbortController(),started=performance.now(),timer=setTimeout(()=>owner.abort(new DOMException('Raptee native source deadline exceeded','TimeoutError')),timeout),signal=options.signal?AbortSignal.any([options.signal,owner.signal]):owner.signal
 const originalResponses=[];let next=0,total=0,corporate
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-started>=timeout&&!owner.signal.aborted)owner.abort(new DOMException('Raptee native source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 const read=async(url,redirect,status)=>{
  check();need([CAREERS,CURRENT,EMBED,DENIED].includes(url)&&originalResponses.length<4,'Unbound or excessive native request')
  if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
  check();next=performance.now()+500
  const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString(),status:null,bodyComplete:false};originalResponses.push(receipt);let observedHTTPError
  try{
   const page=await boundedDeclaredPublicRead(url,{signal,timeoutMs:readMs,overflowError:firstPartyFailure(SOURCE,'Original16MiB response ceiling'),fetchImpl:async(requested,init)=>{
    const response=await(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:Object.fromEntries(response.headers)})
    try{
     if(!(redirect&&response.status===status&&response.url===requested&&!isHttpAccessChallenge(response)&&new URL(response.headers.get('location'),requested).href===redirect))await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},requested,{context:'Raptee current native read',signal:init.signal,callerSignal:options.signal??null})
     if(redirect)need(response.status===status&&new URL(response.headers.get('location'),requested).href===redirect,'Current exact native publisher redirect changed')
    }catch(error){observedHTTPError=error;disposeResponseBody(response,{bestEffort:true}).catch(()=>{});throw error}
    return response
   }})
   check();const bytes=Buffer.from(page.bodyBase64,'base64');total+=bytes.length;Object.assign(receipt,{bodyComplete:true,bytes:bytes.length,sha256:sha(bytes)})
   need(total<=2*1024*1024,'Aggregate native response byte ceiling exceeded')
   if(url!==EMBED)need(/^text\/html(?:;|$)/i.test(page.headers['content-type']??''),'Current original native HTML MIME changed')
   return new TextDecoder('utf8',{fatal:true}).decode(bytes)
  }catch(error){options.signal?.throwIfAborted();throw observedHTTPError??error}finally{receipt.completedAt=new Date().toISOString()}
 }
 try{
  await read(CAREERS,CURRENT,301);corporate=readCurrentRapteeCorporate(await read(CURRENT));await read(EMBED,DENIED,302)
  const denied=await read(DENIED),doc=readNativeDocument(denied)
  need(JSON.stringify(activeHead(denied).titles)==='["Forbidden Access"]'&&doc.nodes(n=>n.tag==='p'&&doc.hasClass(n,'status-code')&&doc.text(n)==='FORBIDDEN ACCESS').length===1,'Current declared native denial representation changed; inventory remains unknown')
  throw firstPartyFailure(SOURCE,'Current exact employer-declared Keka widget redirects to publisher Forbidden Access; native inventory remains unknown',{status:200,httpStatus:200,requestUrl:DENIED,failureKind:'blocked_or_access_denied',upstreamOutage:true,sourceScopeComplete:false})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{configurable:true,value:{source:SOURCE,currentCorporateAuthority:corporate,originalResponses,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,observedVacancyCount:null}})}catch{}throw error}
 finally{clearTimeout(timer);owner.abort()}
}
