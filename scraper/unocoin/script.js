import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {normalizeInventoryEvidence,attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import candidate from './catalog-candidate.json' with {type:'json'}

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'unocoin'
export const COMPANY = 'Unocoin'
export const FIRST_PARTY_ROOT_URL = 'https://unocoin.com/in/'

export const EDUCATION_URL = 'https://edu.unocoin.com/'
export const EMPLOYER_URL = 'https://www.linkedin.com/company/unocoin'
export const INDIA_LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=3621275&location=India'
export const WORLDWIDE_LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=3621275&location=Worldwide'
export const PROVIDER_METADATA = {...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createUnocoinScraper = (defaults = {}) => ({
  async run(options = {}) {
    const {fetchImpl = globalThis.fetch, signal, timeoutMs = 30000, now = () => new Date().toISOString()} = {...defaults, ...options}
    signal?.throwIfAborted()
    const controller = new AbortController(), retainedResponses = []
    let firstParty = false, surface = FIRST_PARTY_ROOT_URL, timer, abortListener, callerListener
    const gap = (reason, cause) => Object.assign(new Error('Unocoin coverage gap: ' + reason, {cause}), {
      code:'UNOCOIN_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
      sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
      inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty,listingComplete:false,
        pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason}),
    })
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw gap('Invalid aggregate request budget')
    const interrupted = new Promise((_, reject) => {
      abortListener = () => reject(controller.signal.reason)
      controller.signal.addEventListener('abort',abortListener,{once:true})
      callerListener = () => controller.abort(signal.reason)
      signal?.addEventListener('abort',callerListener,{once:true})
      timer = setTimeout(() => controller.abort(gap('Aggregate native fetch/body deadline exceeded')),timeoutMs)
    })
    const collect = async () => {
      const read = async url => {
        controller.signal.throwIfAborted(); surface = url
        const response = await fetchImpl(url,{signal:controller.signal,redirect:'manual',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}})
        controller.signal.throwIfAborted()
        if(response.url !== url) throw gap('Native final URL changed')
        let body
        if(response.body?.getReader) {
          const reader = response.body.getReader(), chunks = []; let bytes = 0
          const cancel = () => {void Promise.resolve(reader.cancel(controller.signal.reason)).catch(()=>{})}
          controller.signal.addEventListener('abort',cancel,{once:true})
          try {
            while(true) {
              controller.signal.throwIfAborted()
              const part = await reader.read(); controller.signal.throwIfAborted()
              if(part.done) break
              bytes += part.value.byteLength
              if(bytes > 3000000) {cancel();throw gap('Native streamed body exceeds byte limit')}
              chunks.push(Buffer.from(part.value))
            }
            body = Buffer.concat(chunks).toString('utf8')
          } finally {controller.signal.removeEventListener('abort',cancel);reader.releaseLock?.()}
        } else body = await response.text()
        controller.signal.throwIfAborted()
        if(typeof body !== 'string' || Buffer.byteLength(body)>3000000) throw gap('Native body absent or oversized')
        retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:now(),bodySHA256:createHash('sha256').update(body).digest('hex')})
        if(response.status!==200 || !body.trim()) throw Object.assign(gap('Native HTTP failure or empty body'), {status:response.status})
        const doc = document(body)
        const prune = (node, inherited = false) => {
          node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(node.attrs?.style || '')
          for(const child of node.children.filter(value=>typeof value!=='string')) prune(child,node.inactive)
        }
        prune(doc.root)
        return doc
      }
      const home = await read(FIRST_PARTY_ROOT_URL)
      if(!home.text(home.root).includes('Unocoin Technologies Private Limited')) throw gap('Official exact employer identity missing')
      firstParty = true
      const handoff = home.nodes(n => n.tag==='a' && ['https://edu.unocoin.com','https://edu.unocoin.com/'].includes(n.attrs.href)
        && /Start your new career at Unocoin\./.test(home.text(n)))
      if(handoff.length !== 1) throw gap('Active corporate Unoversity career-worded handoff missing or ambiguous')
      if(!home.nodes(n=>n.tag==='a'&&n.attrs.href==='https://in.linkedin.com/company/unocoin').length) throw gap('Active corporate exact LinkedIn employer link missing')
      const employer=await read(EMPLOYER_URL)
      if(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='Unocoin: Crypto ka Super App').length!==1
        || employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:3621275').length!==1
        || !employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{
          try {const redirect=new URL(n.attrs.href),url=new URL(redirect.searchParams.get('url'));return redirect.origin==='https://www.linkedin.com'&&redirect.pathname==='/redir/redirect'&&url.protocol==='https:'&&url.hostname==='www.unocoin.com'}catch{return false}
        })) throw gap('Native exact employer identity or reciprocal corporate domain changed')
      const listing=await read(INDIA_LISTING_URL)
      if(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='3621275'&&Object.hasOwn(n.attrs,'checked')).length!==1
        || listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn’t find a match for Jobs jobs in India').length!==1
        || listing.nodes(n=>listing.hasClass(n,'job-search-card')).length!==0) throw gap('Native India search inventory changed; role-level review required')
      const worldwide=await read(WORLDWIDE_LISTING_URL)
      if(worldwide.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='3621275'&&Object.hasOwn(n.attrs,'checked')).length!==1
        || worldwide.nodes(n=>n.tag==='h1'&&worldwide.text(n)==='We couldn’t find a match for Jobs jobs in Worldwide').length!==1
        || worldwide.nodes(n=>worldwide.hasClass(n,'job-search-card')).length!==0) throw gap('Native Worldwide search inventory changed; role-level review required')
      let educationFailure
      try {await read(EDUCATION_URL)} catch(error) {controller.signal.throwIfAborted();educationFailure=error}
      if(!educationFailure) throw gap('Unoversity now responds; renewed native recruiting inventory review required')
      surface=INDIA_LISTING_URL
      const jobs=attachInventoryEvidence([],{status:'discovery-only',surface,firstParty:true,listingComplete:false,pagesFetched:retainedResponses.length,
        reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'Exact corporate-linked native employer India and explicit Worldwide searches currently have no matches. Career-worded Unoversity handoff unavailable; whole-company inventory unresolved and cleanup disabled.'})
      Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{retainedResponses,scopedIndiaSearchObservedCards:0,educationFailure:educationFailure.message,lifecycleCleanupAllowed:false}})
      return jobs
    }
    try {return await Promise.race([collect(),interrupted])}
    catch(error) {if(signal?.aborted) throw signal.reason;if(error?.code==='UNOCOIN_COVERAGE_GAP') throw error;throw gap('Native recruiting transport or contract unavailable',error)}
    finally {clearTimeout(timer);signal?.removeEventListener('abort',callerListener);controller.signal.removeEventListener('abort',abortListener);controller.abort()}
  },
})

export const run = async (options = {}) => createUnocoinScraper(options).run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/unocoin/script.js')

if (isDirectExecution) {
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
  else {const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js');if(isDryRun)saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)}
}
