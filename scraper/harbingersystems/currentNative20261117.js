import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
const SOURCE='harbingersystems',CAREERS='https://www.harbingergroup.com/current-openings/'
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const BOARD='https://harbingergroup.darwinbox.in/ms/candidatev2/main/careers/home',MAIN='https://harbingergroup.darwinbox.in/ms/candidatev2/main.819c4120b20f8091.js',INFO='https://harbingergroup.darwinbox.in/ms/candidateapi/getCompanyConfig?is_preview=false&companyId=main'
const CORPORATE_SHA='a888ae16b998944e8fd60cd6854b9f67a846fe5b64588682051fada188c5e9cd',BOARD_SHA='bda2aa6dd1e12529a2cf9198959c0baff4a8837417d660ea3d34f07d19d71437',CLIENT_SHA='ee0926eab1aaa71ffd022d8a0b2898f90b058543b857491c889648cd0ca10b5d'
const PREVIEW_SHA='e9151a12e7be4b1b19e814ea061a7c3522e6fb8460c1c43de4f951445c21844f'
const sha=value=>createHash('sha256').update(value).digest('hex')
const fail=(message,fields)=>{throw firstPartyFailure(SOURCE,message,fields)}
const need=(ok,message,fields)=>{if(!ok)fail(message,fields)}
export async function runCurrentHarbinger(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchListingPage&&!options.fetchJson,'Original HTTP metadata is required; body-only callbacks cannot certify a native handoff')
 const sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=90000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'Invalid native read deadline')
 const aggregate=new AbortController(),timer=setTimeout(()=>aggregate.abort(new DOMException('Harbinger native source deadline exceeded','TimeoutError')),sourceTimeoutMs),signal=options.signal?AbortSignal.any([options.signal,aggregate.signal]):aggregate.signal
 const originalResponses=[],fetchImpl=options.fetchImpl??globalThis.fetch;let nextStart=0,decodedBytes=0,currentAuthority
 async function read(url){
  signal.throwIfAborted();need(originalResponses.length<4,'Native request bound exceeded')
  if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal});nextStart=performance.now()+500
  const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString()};originalResponses.push(receipt)
  // Use the single ordinary public GET representation captured from these
  // exact declarations. HTML/cache-control negotiation also publishes a
  // metadata-only preview; it is not the vacancy app or empty proof.
  const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,fetchImpl:(requested,init)=>fetchImpl(requested,{...init,credentials:'omit',headers:{...init.headers,'User-Agent':USER_AGENT,Accept:'*/*'}}),overflowError:firstPartyFailure(SOURCE,'Native entity over 16MiB bound')})
  signal.throwIfAborted();const bytes=Buffer.from(response.bodyBase64,'base64');decodedBytes+=bytes.length
  Object.assign(receipt,{...response,bodyBytes:bytes.length,bodySHA256:sha(bytes),bodyComplete:true,completedAt:new Date().toISOString()})
  need(decodedBytes<=4*1024*1024&&response.url===url,'Native employer/tenant response authority or body bound changed')
  return {...response,body:new TextDecoder('utf8',{fatal:true}).decode(bytes)}
 }
 try{
  const corporate=await read(CAREERS);need(corporate.status===200,'Native corporate HTTP '+corporate.status,{status:corporate.status})
  const doc=readNativeDocument(corporate.body),links=doc.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD).map(n=>doc.text(n))
  need(sha(corporate.body)===CORPORATE_SHA&&activeHead(corporate.body).titles[0]==='Current Job Openings at Harbinger Group'&&JSON.stringify(links)==='["Current Openings","click here"]','Whole current native employer HTML/handoff changed')
  const board=await read(BOARD)
  if(board.status===200&&sha(board.body)===PREVIEW_SHA&&activeHead(board.body).titles[0]==='Harbingergroup'){
   currentAuthority={officialCareers:CAREERS,employerDeclaredBoard:BOARD,representation:'native-tenant-metadata-preview',nativeClientDeclared:false}
   fail('Current employer-declared Darwinbox returned only its native tenant metadata preview; vacancy inventory remains unknown',{status:200,requestUrl:BOARD,failureKind:'coverage_gap'})
  }
  need(board.status===200&&sha(board.body)===BOARD_SHA,'Whole current native employer board HTML changed',{status:board.status})
  const native=readNativeDocument(board.body),bases=native.nodes(n=>n.tag==='base')
  need(bases.length===1&&bases[0].attrs.href==='/ms/candidatev2/'&&native.nodes(n=>n.tag==='script'&&n.attrs.src==='main.819c4120b20f8091.js'&&n.attrs.type==='module').length===1,'Current native tenant client declaration changed')
  const client=await read(MAIN);need(client.status===200&&sha(client.body)===CLIENT_SHA,'Whole reviewed current native client changed',{status:client.status})
  currentAuthority={officialCareers:CAREERS,employerDeclaredBoard:BOARD,client:{url:MAIN,sha256:sha(client.body)},declaredEmployerConfigURL:INFO,corporateHTMLSHA256:sha(corporate.body),boardHTMLSHA256:sha(board.body),companyId:'main',currentCandidatev2HandoffVerified:true}
  const info=await read(INFO)
  if(info.status!==200)fail('Current employer-declared Darwinbox company config returned original HTTP '+info.status+(/cloudflare|cf-chl-|attention required/i.test(info.body)?' (Cloudflare challenge)':'')+'; native inventory remains unknown',{status:info.status,httpStatus:info.status,requestUrl:INFO,failureKind:[401,403,429,451].includes(info.status)?'blocked_or_access_denied':info.status>=500?'network_or_timeout':'surface_drift_or_fail_closed'})
  fail('Current employer config is accessible but native tenant inventory/criteria are unreviewed; inventory remains unknown',{failureKind:'surface_drift_or_fail_closed'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,currentAuthority,originalResponses,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,applicationInteractions:0,wholeObservedNativeBoardClosingReconciled:false},configurable:true,enumerable:true})}catch{};throw error}finally{clearTimeout(timer)}
}
