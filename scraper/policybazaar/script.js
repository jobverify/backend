import {createHash} from 'node:crypto'
import {collectPolicybazaarNative} from './employer.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { POLICYBAZAAR_CATALOG } from './catalog.js'
import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = POLICYBAZAAR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_BOARD_URL = PROVIDER_METADATA.publicBoardUrl

// The shared reader handles hidden/inert/template/display/visibility. Close its
// content-visibility gap locally without changing other providers' contracts.
const activeDocument = html => {
  const doc = document(html)
  const mark = (node, inherited = false) => {
    if (typeof node === 'string') return
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, ''))
    node.children.forEach(child => mark(child, node.inactive))
  }
  mark(doc.root)
  return doc
}
const byClass = (doc, node, tag, cls) => doc.nodes(n => n.tag === tag && doc.hasClass(n, cls), node)
const slug = value => norm(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const hasOfficialCareersPageSignal = html => {
  const doc = activeDocument(html)
  return /Policybazaar/i.test(activeHead(html).titles.join(' '))
    && doc.nodes(n => doc.hasClass(n, 'ijp') && n.tag === 'ul').length === 1
    && /Find the job that's right for you/i.test(doc.text(doc.root))
}
export const hasSharedApplicationFormSignal = html => /<form\b[^>]*\bid=["']careerFormReferer["']/i.test(html)
  && /<select\b[^>]*\bid=["']refPosition["']/i.test(html)
  && /<input\b[^>]*\btype=["']file["']/i.test(html)

export const extractHiringCities = html => {
  const doc = activeDocument(html)
  return [...new Set(doc.nodes(n => doc.hasClass(n, 'city-location')).map(doc.text).filter(Boolean))]
}

export const extractSearchResults = html => {
  const doc = activeDocument(html)
  const board = doc.nodes(n => n.tag === 'ul' && doc.hasClass(n, 'ijp'))
  if (board.length !== 1) return []
  const jobs = [], seen = new Set()
  for (const card of board[0].children.filter(n => typeof n !== 'string' && n.tag === 'li' && !n.inactive)) {
    const headings = byClass(doc, card, 'p', 'heading')
    if (headings.length !== 1) continue
    const title = doc.text(headings[0])
    if (!title || /don't see a job opening/i.test(title)) continue
    const jobId = slug(title)
    if (!jobId || seen.has(jobId)) throw Error('Ambiguous native role card identity')
    seen.add(jobId)
    let role = null, eligibility = null
    for (const p of byClass(doc, card, 'p', 'text')) {
      const labels = doc.nodes(n => n.tag === 'strong', p)
      const label = labels.map(doc.text).join(' ')
      // Strong/headings-only content is not active description prose.
      const prose = norm(p.children.map(child => typeof child === 'string' ? child : ['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(child.tag) ? '' : doc.text(child)).join(' '))
      if (/^Role\s*:/i.test(label)) role = prose.length >= 20 && prose !== title ? prose : null
      if (/^Eligibility\s*:/i.test(label)) eligibility = prose || null
    }
    jobs.push({ title, company: COMPANY, department: null, location: null, city: null, country: null,
      jobId, requisitionId: null, sourceUrl: CAREERS_URL, applyUrl: CAREERS_URL,
      employmentType: null, experienceRequired: null, minimumQualification: eligibility,
      preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null,
      jobDescription: role, remoteStatus: null, sourceDetailComplete: false,
      sourceDetailStatus: role ? 'missing-role-location-and-vacancy-evidence' : 'missing-description',
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      nativeCardHTML: doc.outer(card), firstEverPublication: null })
  }
  return jobs
}

export const createPolicybazaarScraper=(defaults={})=>({async run(options={}) {
 const {fetchImpl=globalThis.fetch,fetchText,signal,timeoutMs=45000,now=new Date()}={...defaults,...options}
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let surface=CAREERS_URL,timer,onAbort,nativeRoleCards=[]
 const gap=(reason,cause)=>Object.assign(new Error('Policybazaar coverage gap: '+reason,{cause}),{
  code:'POLICYBAZAAR_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,nativeRoleCards,retainedResponse:retainedResponses.find(r=>r.url===CAREERS_URL)??null,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty:false,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason}),
 })
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 const deadline=performance.now()+timeoutMs
 const checkBudget=()=>{
  if(!controller.signal.aborted&&performance.now()>=deadline)controller.abort(gap('Aggregate source fetch/body/parsing deadline exceeded'))
  controller.signal.throwIfAborted()
 }
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=gap('Aggregate source fetch/body deadline exceeded');controller.abort(error);reject(error)},timeoutMs)
 })
 const collect=async()=>{
  const read=async url=>{
   surface=url;checkBudget()
   let response
   if(fetchText){
    const text=await fetchText(url,{signal:controller.signal});checkBudget()
    if(typeof text!=='string'||Buffer.byteLength(text)>4194304)throw gap('Caller-owned text response absent or oversized')
    response=new Response(text);Object.defineProperty(response,'url',{value:url})
   }else response=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html,application/json'}})
   const cancelBody=reason=>{void Promise.resolve().then(()=>response.body?.cancel?.(reason)).catch(()=>{})}
   try{checkBudget()}catch(error){cancelBody(error);throw error}
   if(response.url!==url){const error=gap('Source final URL changed');cancelBody(error);throw error}
   if(response.status!==200){const error=Object.assign(gap('Source HTTP failure'),{status:response.status});cancelBody(error);throw error}
   let body
   if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let bytes=0
    const cancel=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
    controller.signal.addEventListener('abort',cancel,{once:true})
    try{while(true){checkBudget();const {done,value}=await reader.read();checkBudget();if(done)break;bytes+=value.byteLength;if(bytes>4194304){void reader.cancel().catch(()=>{});throw gap('Source streamed body exceeds byte limit')}chunks.push(Buffer.from(value))}body=Buffer.concat(chunks).toString('utf8')}
    finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock?.()}
   }else {const error=gap('Bounded source stream unavailable');cancelBody(error);throw error}
   checkBudget()
   if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>4194304)throw gap('Source body missing or exceeds bound')
   retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
   return body
  }
  const {jobs,facts,firstParty,reason,inventoryStatus}=await collectPolicybazaarNative({read,now:typeof now==='function'?now():now,onCorporate:html=>{nativeRoleCards=extractSearchResults(html);if(!hasOfficialCareersPageSignal(html)||!hasSharedApplicationFormSignal(html))throw gap('Native careers employer/listing/form shape changed')}})
  checkBudget()
  const result=attachInventoryEvidence(jobs,{status:inventoryStatus,surface,firstParty,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:{retainedResponses,...facts,lifecycleCleanupAllowed:false}})
  attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:facts.nativeRecordCount,
   observedVacancyCount:facts.nativeRecordCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return result
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='POLICYBAZAAR_COVERAGE_GAP')throw error;throw gap('Native source transport, body or inventory unavailable: '+error.message,error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createPolicybazaarScraper(options).run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  if (process.argv.includes('--dry-run')) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.join(currentDir, 'jobs.json'), JSON.stringify(jobs, null, 2))
  } else {
    const { saveToDB } = await import('../../scraper-support/utils/saveToDB.js')
    await saveToDB(jobs, SOURCE)
  }
}
