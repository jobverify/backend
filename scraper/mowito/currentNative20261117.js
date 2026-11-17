import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const SOURCE='mowito',HOME='https://www.mowito.ai/',BOARD='https://www.linkedin.com/company/mowito/jobs/?viewAsMember=true'
const HOME_SHA='fabc8d0b0b7cb6bc9cfd52942a12283680e17242f61b17628309123b1ba8382b'
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const sha=value=>createHash('sha256').update(value).digest('hex')
const fail=(message,fields)=>{throw firstPartyFailure(SOURCE,message,fields)}
const need=(ok,message,fields)=>{if(!ok)fail(message,fields)}
function employerHandoff(body){
 const doc=readNativeDocument(body),scripts=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json')
 let models;try{models=scripts.map(node=>readLiteralModel(node.raw).value)}catch{fail('Current corporate structured employer authority changed')}
 const employers=models.filter(model=>model?.['@type']==='Organization')
 need(employers.length===1&&employers[0].name==='Mowito'&&employers[0].url==='https://www.mowito.in','Current corporate employer identity changed')
 const links=doc.nodes(node=>node.tag==='a'&&node.attrs.href===BOARD)
 need(links.length===1&&doc.text(links[0])==='LinkedIn'&&doc.nodes(node=>node.tag==='div'&&node.attrs.class==='rt-text-style-h4'&&doc.text(node)==='Careers').length===1&&doc.nodes(node=>node.tag==='a'&&node.attrs.href==='mailto:careers@mowito.in').length===1,'Missing exact active employer Careers handoff')
 // The complete current corporate input is a finite reviewed profile. Its
 // product-pilot inline "Apply now" is retained; it is not vacancy evidence.
 need(sha(body)===HOME_SHA,'Whole reviewed current corporate HTML authority changed')
 return {officialHome:HOME,employer:'Mowito',declaredCareersBoard:BOARD,nativeCorporateStructuredData:models,homepageSHA256:sha(body),corporateCountryNotRoleCountry:true,productPilotIsVacancy:false}
}
export async function runCurrentMowito(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'Original HTTP metadata is required; body-only callbacks cannot certify a native source')
 const sourceTimeoutMs=options.sourceTimeoutMs??45000,requestTimeoutMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=90000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'Invalid native read deadline')
 const aggregate=new AbortController(),timer=setTimeout(()=>aggregate.abort(new DOMException('Mowito source deadline exceeded','TimeoutError')),sourceTimeoutMs),signal=options.signal?AbortSignal.any([options.signal,aggregate.signal]):aggregate.signal
 const fetchImpl=options.fetchImpl??globalThis.fetch,originalResponses=[];let nextStart=0,decodedBytes=0,currentAuthority
 async function read(url){
  signal.throwIfAborted();need(originalResponses.length<2,'Native request bound exceeded')
  if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal});nextStart=performance.now()+500
  const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString()};originalResponses.push(receipt)
  const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,overflowError:firstPartyFailure(SOURCE,'Original native entity over 16MiB bound'),fetchImpl:(requested,init)=>fetchImpl(requested,{...init,credentials:'omit',cache:'no-store',headers:{...init.headers,'User-Agent':USER_AGENT}})})
  signal.throwIfAborted();const bytes=Buffer.from(response.bodyBase64,'base64');decodedBytes+=bytes.length
  Object.assign(receipt,{...response,bodyBytes:bytes.length,bodySHA256:sha(bytes),bodyComplete:true,completedAt:new Date().toISOString()})
  need(decodedBytes<=2*1024*1024,'Aggregate native body over bound')
  need(response.url===url,'Native employer/board response authority changed',{status:response.status})
  const body=new TextDecoder('utf8',{fatal:true}).decode(bytes)
  return {...response,body}
 }
 try{
  const home=await read(HOME)
  need(home.status===200,'Original corporate HTTP '+home.status,{status:home.status,failureKind:[401,403,429,451].includes(home.status)?'blocked_or_access_denied':'surface_drift_or_fail_closed'})
  need(/^text\/html(?:;|$)/i.test(home.headers['content-type']??''),'Native corporate MIME changed')
  currentAuthority=employerHandoff(home.body)
  const board=await read(BOARD)
  if(board.status!==200){
   const challenge=/cloudflare|cf-chl-|just a moment/i.test(board.body)?' (Cloudflare challenge)':''
   fail('Employer-declared LinkedIn careers board returned original HTTP '+board.status+challenge+'; native vacancy inventory remains unknown',{status:board.status,httpStatus:board.status,requestUrl:BOARD,failureKind:[401,403,429,451].includes(board.status)?'blocked_or_access_denied':board.status>=500?'network_or_timeout':'surface_drift_or_fail_closed'})
  }
  fail('Employer-declared LinkedIn board is accessible but its native inventory/criteria are unreviewed; inventory remains unknown',{failureKind:'surface_drift_or_fail_closed',requestUrl:BOARD})
 }catch(error){
  options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,currentAuthority,originalResponses,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,activeApplyVerified:false,applicationInteractions:0},configurable:true,enumerable:true})}catch{}
  throw error
 }finally{clearTimeout(timer)}
}
