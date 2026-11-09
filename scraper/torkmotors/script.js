import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import candidate from './catalog-candidate.json' with {type:'json'}

export const SOURCE='torkmotors',COMPANY='Tork Motors'
export const FIRST_PARTY_ROOT_URL='https://www.torkmotors.com/'
export const OBSERVED_DOMAIN_URL='https://torkmotors.com/'
export const EMPLOYER_URL='https://www.linkedin.com/company/tork-motors-pvt-ltd'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createTorkMotorsScraper=(defaults={})=>({async run(options={}){
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000}={...defaults,...options}
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let timer,onAbort
 const gap=(reason,cause)=>Object.assign(new Error('Tork Motors coverage gap: '+reason,{cause}),{
  code:'TORKMOTORS_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface:OBSERVED_DOMAIN_URL,firstParty:false,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason}),
 })
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=gap('Aggregate fetch/body deadline exceeded');controller.abort(error);reject(error)},timeoutMs)
 })
 const collect=async()=>{
  const read=async url=>{
  const response=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html'}})
  const cancelBody=reason=>{void Promise.resolve().then(()=>response.body?.cancel?.(reason)).catch(()=>{})}
  if(controller.signal.aborted)cancelBody(controller.signal.reason)
  controller.signal.throwIfAborted()
  if(response.url!==url||response.status!==200){const error=gap('Historical employer domain final URL or HTTP status changed');cancelBody(error);throw error}
  if(!response.body?.getReader){const error=gap('Bounded source stream unavailable');cancelBody(error);throw error}
  const reader=response.body.getReader(),chunks=[];let bytes=0
  const cancel=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
  controller.signal.addEventListener('abort',cancel,{once:true})
  try{
   while(true){
    controller.signal.throwIfAborted()
    const {done,value}=await reader.read()
    controller.signal.throwIfAborted()
    if(done)break
    bytes+=value.byteLength
    if(bytes>4000000){void reader.cancel().catch(()=>{});throw gap('Source streamed body exceeds bound')}
    chunks.push(Buffer.from(value))
   }
  }finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock()}
  const body=Buffer.concat(chunks).toString('utf8')
  if(!body.trim())throw gap('Source body missing')
  retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
  return body
  }
  const body=await read(OBSERVED_DOMAIN_URL)
  const profile=document(await read(EMPLOYER_URL))
  if(profile.nodes(n=>/JobPosting/i.test(n.attrs.itemtype||'')||n.tag==='script'&&n.attrs.type==='application/ld+json'&&/JobPosting/.test(n.raw)).length)throw gap('New native employer JobPosting metadata requires review')
  if(!profile.nodes(n=>n.tag==='h1'&&profile.text(n)==='Tork Motors').length||!profile.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:2131408').length)throw gap('Exact native employer identity changed')
  if(!profile.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&['http://www.torkmotors.com/','https://www.torkmotors.com/'].includes(new URL(u.searchParams.get('url')).href)}catch{return false}}))throw gap('Native reciprocal historical domain identity changed')
  for(const location of ['India','Worldwide']){
   const scoped=document(await read('https://www.linkedin.com/jobs/search/?f_C=2131408&location='+location))
   if(!scoped.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='2131408'&&Object.hasOwn(n.attrs,'checked')).length||!scoped.nodes(n=>n.tag==='h1'&&scoped.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length||scoped.nodes(n=>scoped.hasClass(n,'job-search-card')).length)throw gap('Exact employer scoped inventory changed; native role country, earliest publication, expiry and active application require review')
   if(scoped.nodes(n=>/JobPosting/i.test(n.attrs.itemtype||'')||n.tag==='script'&&n.attrs.type==='application/ld+json'&&/JobPosting/.test(n.raw)).length)throw gap('New native JobPosting metadata requires review')
  }
  // A historical domain is not continuing proof of employer ownership. New jobs,
  // schema dates/countries/expiry, or a recruiting handoff require identity review.
  if(/Cà Kh?a TV|Cakhia\s*TV/i.test(body))throw gap('Historical Tork Motors domain now exposes unrelated Vietnamese football content; exact native employer 2131408 India and Worldwide searches expose no-match states, but whole-company inventory and recruiting handoff remain unverified')
  throw gap('Historical domain content changed; exact employer identity, native vacancies, country, earliest publication, expiry and active same-role application require review')
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='TORKMOTORS_COVERAGE_GAP')throw error;throw gap('Native employer transport or inventory unavailable',error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createTorkMotorsScraper(options).run(options)
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/torkmotors/script.js')){
 try{await run()}catch(error){console.error(error.message);process.exitCode=1}
}
