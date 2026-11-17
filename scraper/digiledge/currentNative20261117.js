import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='digiledge',ROOT='https://digiledge.in/',WWW='https://www.digiledge.in/',HOME=WWW+'en',CAREERS=HOME+'/careers'
const CLIENT=WWW+'_next/static/chunks/app/%5Blocale%5D/careers/page-773f9de1389ff397.js'
const HOME_SHA='52ec3f342efc2c55232b9dc5c5147611058cddecb33ea4138f3778fce9746681'
const CAREERS_SHA='06cc508909faa00cd8e6b15be3a76e9e450b8daedcf3a174a9cd6b55bcedba32'
const CLIENT_SHA='c97cebd936fcda577aa84fb22d500d3babcafe07a7b56f583a09890b080565b4'
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const fail=(message,fields)=>{throw firstPartyFailure(SOURCE,message,fields)}
const need=(ok,message,fields)=>{if(!ok)fail(message,fields)}
const sha=value=>createHash('sha256').update(value).digest('hex')
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
// These are exact native Location values, not a generic redirect follower.
const REDIRECTS=new Map([[ROOT,{status:301,location:'https://www.digiledge.in',next:WWW}],[WWW,{status:307,location:'/en/',next:WWW+'en/'}],[WWW+'en/',{status:308,location:'/en',next:HOME}],[WWW+'careers',{status:307,location:'/en/careers',next:CAREERS}]])

function nativeModel(homeHTML,careersHTML,program){
 need(sha(homeHTML)===HOME_SHA&&sha(careersHTML)===CAREERS_SHA,'Whole reviewed current native HTML identity/criteria changed')
 need(sha(program)===CLIENT_SHA,'Whole reviewed current careers client renderer changed')
 const home=readNativeDocument(homeHTML),careers=readNativeDocument(careersHTML)
 need(home.nodes(node=>node.tag==='a'&&node.attrs.href==='/careers').length>0,'Missing current native corporate careers handoff')
 const canonical=careers.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
 need(canonical.length===1&&canonical[0].attrs.href===CAREERS,'Current careers canonical identity changed')
 need(careers.nodes(node=>node.tag==='script'&&node.attrs.src&&new URL(node.attrs.src,CAREERS).href===CLIENT).length===1,'Missing current declared careers renderer')
 // Only literal data frames are decoded. The exact complete HTML and critical
 // renderer are pinned; no Next/client program is evaluated or requested as API.
 const records=readLiteralFlightRecords(careersHTML),scopes=[]
 const walk=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value.blocks))scopes.push(value);for(const item of Object.values(value))walk(item)}
 for(const record of records?.values()??[])if(record.kind==='model')walk(record.value)
 need(scopes.length===1,'Unreviewed or duplicate current careers model owner')
 const blocks=scopes[0].blocks.filter(block=>block?.__typename==='ComponentCareerComponentsOpenPositions')
 need(blocks.length===1&&blocks[0].enable_section===true&&Array.isArray(blocks[0].jobs)&&blocks[0].jobs.length===0&&blocks[0].pitchCtaUrl==='mailto:careers@digiledge.com','Current observed native openings block changed; new rows require full criteria/country review')
 return {officialHome:HOME,officialCareers:CAREERS,corporateCareersHref:'/careers',nativeCareersModel:structuredClone(scopes[0]),nativeOpenPositions:structuredClone(blocks[0]),client:{url:CLIENT,sha256:sha(program),bytes:Buffer.byteLength(program)},homepageSHA256:sha(homeHTML),careersHTMLSHA256:sha(careersHTML),renderedBlockOnly:true}
}

export async function runCurrentDigiledge(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'Original HTTP metadata is required; body-only callbacks cannot certify a native source')
 need(options.maxJobs==null,'A read cap cannot establish the observed native cohort')
 const sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=90000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'Invalid native read deadline')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(Number.isFinite(Date.parse(now)),'Invalid observation clock')
 const aggregate=new AbortController(),timer=setTimeout(()=>aggregate.abort(new DOMException('Digiledge source deadline exceeded','TimeoutError')),sourceTimeoutMs),signal=options.signal?AbortSignal.any([options.signal,aggregate.signal]):aggregate.signal
 const fetchImpl=options.fetchImpl??globalThis.fetch,receipts=[];let bytesRead=0,nextStart=0
 async function read(url){
  signal.throwIfAborted();need(receipts.length<14,'Native request bound exceeded')
  if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal});nextStart=performance.now()+500
  const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString()};receipts.push(receipt)
  const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,overflowError:firstPartyFailure(SOURCE,'Original native entity over 16MiB bound'),fetchImpl:(requested,init)=>fetchImpl(requested,{...init,credentials:'omit',cache:'no-store',headers:{...init.headers,'User-Agent':USER_AGENT}})})
  signal.throwIfAborted();const bytes=Buffer.from(response.bodyBase64,'base64');bytesRead+=bytes.length
  Object.assign(receipt,{...response,bytes:bytes.length,sha256:sha(bytes),completedAt:new Date().toISOString(),bodyComplete:true})
  need(bytesRead<=8*1024*1024,'Aggregate native body bound exceeded')
  need(response.url===url,'Original native response URL/authority changed')
  const redirect=REDIRECTS.get(url)
  if(redirect){
   need(response.status===redirect.status&&response.headers.location===redirect.location,'Declared native redirect authority/status changed',{status:response.status,lifecycleCleanupAllowed:false})
  }else{
   need(response.status===200,'Original native HTTP '+response.status,{status:response.status,requestUrl:url,failureKind:[401,403,429,451].includes(response.status)?'blocked_or_access_denied':response.status>=500?'network_or_timeout':'surface_drift_or_fail_closed'})
   need((url===CLIENT?/^(?:text|application)\/javascript(?:;|$)/i:/^text\/html(?:;|$)/i).test(response.headers['content-type']??''),'Original native MIME changed')
  }
  return new TextDecoder('utf8',{fatal:true}).decode(bytes)
 }
 async function authority(){
  for(const url of [ROOT,WWW,WWW+'en/'])await read(url)
  const home=await read(HOME);await read(WWW+'careers')
  const careers=await read(CAREERS),program=await read(CLIENT)
  return {...nativeModel(home,careers,program),declaredRedirects:[...REDIRECTS].map(([url,value])=>({url,...value}))}
 }
 try{
  const opening=await authority(),closing=await authority()
  need(same(opening,closing),'Opening/closing whole native careers model changed')
  signal.throwIfAborted()
  const jobs=[]
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'whole-reviewed-current-careers-block-observed-empty-company-country-and-global-inventory-scope-unknown'})
  const summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null};attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,observations:[],nativeOpeningAuthority:opening,nativeClosingAuthority:closing,originalResponses:receipts,observedNativeBoardTotal:0,wholeObservedNativeBoardClosingReconciled:true,companyIndiaZeroProven:false,companyScopeComplete:false,lifecycleCleanupAllowed:false,activeApplyVerified:false,applicationInteractions:0,readLimits:{sourceTimeoutMs,requestTimeoutMs,maximumReads:14,nativeRequestIntervalMs:500,decodedBytes:bytesRead}},configurable:true})
  return jobs
 }catch(error){
  options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null},configurable:true,enumerable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
