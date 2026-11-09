import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createHash} from 'node:crypto'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {normalizeInventoryEvidence,attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import candidate from './catalog-candidate.json' with {type:'json'}

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'outlinesystems'
export const COMPANY = 'Outline Systems'
export const FIRST_PARTY_ROOT_URL = 'https://www.outlinesys.com/'

export const EMPLOYER_URL = 'https://www.linkedin.com/company/outline-systems'
export const INDIA_LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=70391&location=India'
export const WORLDWIDE_LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=70391&location=Worldwide'
export const CAREERS_URL = EMPLOYER_URL
export const SUCCESSOR_CAREERS_URL='https://www.duckcreek.com/careers/'
export const ACQUISITION_URL='https://www.duckcreek.com/resource/press-releases/duck-creek-acquires-distribution-management-provider-outline-systems-llc/'
export const SUCCESSOR_API='https://duckcreek.wd1.myworkdayjobs.com/wday/cxs/duckcreek/duckcreekcareers'
export const PROVIDER_METADATA = {...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createOutlineSystemsScraper = (defaults = {}) => ({
  async run(options = {}) {
    const {fetchImpl = globalThis.fetch, signal, timeoutMs = 30000, now = () => new Date().toISOString()} = {...defaults, ...options}
    const timestamp=()=>new Date(typeof now==='function'?now():now).toISOString()
    signal?.throwIfAborted()
    const controller = new AbortController(), retainedResponses = []
    let firstParty = false, surface = EMPLOYER_URL, timer, abortListener, callerListener
    const gap = (reason, cause) => Object.assign(new Error('Outline Systems coverage gap: ' + reason, {cause}), {
      code:'OUTLINESYSTEMS_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
      sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
      inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty,listingComplete:false,
        pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:timestamp(),reason}),
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
      const read = async (url,request={}) => {
        const {json,...fetchRequest}=request
        controller.signal.throwIfAborted(); surface = url
        const response = await fetchImpl(url,{...fetchRequest,signal:controller.signal,redirect:'manual',headers:{Accept:json?'application/json':'text/html','User-Agent':'Mozilla/5.0',...fetchRequest.headers}})
        if(controller.signal.aborted) void Promise.resolve(response.body?.cancel?.(controller.signal.reason)).catch(()=>{})
        controller.signal.throwIfAborted()
        if(response.url !== url || response.status!==200) {void Promise.resolve(response.body?.cancel?.()).catch(()=>{});throw gap('Native final URL or HTTP status changed')}
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
        } else {void Promise.resolve(response.body?.cancel?.()).catch(()=>{});throw gap('Native readable body stream unavailable; unbounded text buffering rejected')}
        controller.signal.throwIfAborted()
        if(typeof body !== 'string' || Buffer.byteLength(body)>3000000) throw gap('Native body absent or oversized')
        retainedResponses.push({url,requestBody:fetchRequest.body?JSON.parse(fetchRequest.body):undefined,finalUrl:response.url,status:response.status,body,capturedAt:timestamp(),bodySHA256:createHash('sha256').update(body).digest('hex')})
        if(response.status!==200 || !body.trim()) throw gap('Native HTTP failure or empty body')
        if(json)return JSON.parse(body)
        const doc = document(body)
        const prune = (node, inherited = false) => {
          node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style || '').replace(/\/\*[\s\S]*?\*\//g,''))
          for(const child of node.children.filter(value=>typeof value!=='string')) prune(child,node.inactive)
        }
        prune(doc.root)
        for(const node of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')) {
          let schema;try{schema=JSON.parse(node.raw)}catch{throw gap('Native structured contract invalid')}
          const hasPosting=value=>value&&typeof value==='object'&&(value['@type']==='JobPosting'||Array.isArray(value['@type'])&&value['@type'].includes('JobPosting')||Object.values(value).some(hasPosting))
          if(hasPosting(schema))throw gap('New structured vacancy requires country, date, expiry and active application review')
        }
        if(doc.nodes(n=> /(?:^|\s)(?:addressCountry|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate|jobLocation|hiringOrganization)(?:\s|$)/i.test(n.attrs.itemprop||'' ) || /JobPosting/i.test(n.attrs.itemtype||'') || n.tag==='meta'&&/^(?:addressCountry|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate|jobLocation)$/i.test(n.attrs.name||n.attrs.property||'')).length)
          throw gap('New job country, publication, expiry or identity microdata requires native review')
        return doc
      }
      const employer=await read(EMPLOYER_URL)
      if(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='Outline Systems').length!==1
        || employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:70391').length!==1
        || !employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{
          try {const redirect=new URL(n.attrs.href),url=new URL(redirect.searchParams.get('url'));return redirect.origin==='https://www.linkedin.com'&&redirect.pathname==='/redir/redirect'&&url.href==='http://www.outlinesys.com/'}catch{return false}
        })) throw gap('Native exact employer identity or reciprocal corporate domain changed')
      for(const [url,location] of [[INDIA_LISTING_URL,'India'],[WORLDWIDE_LISTING_URL,'Worldwide']]) {
        const listing=await read(url)
        if(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='70391'&&Object.hasOwn(n.attrs,'checked')).length!==1
          || !listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length
          || listing.nodes(n=>listing.hasClass(n,'job-search-card')).length!==0) throw gap('Native scoped search changed; new role-level identity, country, publication, expiry and application review required')
      }
      const acquisition=await read(ACQUISITION_URL)
      if(!acquisition.text(acquisition.root).includes('Duck Creek Acquires Distribution Management Provider Outline Systems LLC')
        || !acquisition.text(acquisition.root).includes('October 17, 2018')
        || !acquisition.text(acquisition.root).includes('ProducerOne'))throw gap('Exact acquisition and former product evidence changed')
      const successor=await read(SUCCESSOR_CAREERS_URL)
      if(!successor.nodes(n=>n.tag==='a'&&n.attrs.href==='https://duckcreek.wd1.myworkdayjobs.com/en-US/duckcreekcareers'&&successor.text(n)==='View All Jobs').length)throw gap('Official successor careers handoff changed')
      const candidates=new Map()
      for(const keyword of ['Outline','Distribution']){
        const payload={appliedFacets:{},limit:20,offset:0,searchText:keyword}
        const listing=await read(SUCCESSOR_API+'/jobs',{json:true,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
        if(!Number.isSafeInteger(listing.total)||listing.total<0||listing.total>20||!Array.isArray(listing.jobPostings)||listing.total!==listing.jobPostings.length)throw gap('Bounded successor keyword inventory incomplete or changed')
        for(const role of listing.jobPostings){
          if(!/^\/job\/[^/]+\/[^/]+_REQID\d+(?:-\d+)?$/.test(role.externalPath)||typeof role.title!=='string'||role.bulletFields?.length!==1)throw gap('Successor native candidate identity changed')
          if(candidates.has(role.externalPath)&&JSON.stringify(candidates.get(role.externalPath))!==JSON.stringify(role))throw gap('Successor keyword candidate identity conflicts')
          candidates.set(role.externalPath,role)
        }
      }
      const successorCandidates=[]
      for(const [route,card]of candidates){
        const detail=await read(SUCCESSOR_API+route,{json:true}),info=detail.jobPostingInfo
        if(!info||info.title!==card.title||info.jobReqId!==card.bulletFields[0]||info.jobPostingSiteId!=='duckcreekcareers'||typeof info.jobDescription!=='string'||typeof info.country?.descriptor!=='string'||!Array.isArray(info.additionalLocations||[]))throw gap('Native successor role detail identity or geography changed')
        const start=nativeDate(info.startDate,{required:true});if(Date.parse(start.iso)>Date.parse(timestamp()))throw gap('Native successor public date invalid or future')
        const prose=document(info.jobDescription);const description=prose.text(prose.root)
        if(/\b(?:Outline Systems|ProducerOne|Duck Creek Distribution Management)\b/i.test(description))throw gap('Successor role now explicitly identifies former entity/product; renewed country, earliest date, expiry and active application review required')
        successorCandidates.push({id:info.jobReqId,title:info.title,country:info.country.descriptor,location:info.location,additionalLocations:info.additionalLocations||[],nativePublicationDate:info.startDate,activeApplyObserved:info.canApply===true,exclusionReason:'generic-successor-role-without-exact-former-entity-binding'})
      }
      const jobs=attachInventoryEvidence([],{status:'coverage-gap',surface:INDIA_LISTING_URL,firstParty:false,listingComplete:false,pagesFetched:retainedResponses.length,
        reportedTotal:null,indiaFacetCount:null,verifiedAt:timestamp(),reason:'Exact native legacy Outline Systems employer70391 reciprocates outlinesys.com and identifies ProducerOne insurance software. Native India and Worldwide exact-employer searches observed no matching cards, not complete company emptiness. Original corporate root/careers currently unavailable; Official Duck Creek acquisition and native keyword searches/details reviewed, including a parent role with secondary Bengaluru India location, but no exact former-entity/product role binding. Successor company inventory cannot be assigned to Outline Systems. Unknown totals, cleanup disabled.'})
      Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{retainedResponses,successorCandidates,scopedSearchObservedCards:0,lifecycleCleanupAllowed:false}})
      return jobs
    }
    try {return await Promise.race([collect(),interrupted])}
    catch(error) {if(signal?.aborted) throw signal.reason;if(error?.code==='OUTLINESYSTEMS_COVERAGE_GAP') throw error;throw gap('Native recruiting transport or contract unavailable',error)}
    finally {clearTimeout(timer);signal?.removeEventListener('abort',callerListener);controller.signal.removeEventListener('abort',abortListener);controller.abort()}
  },
})

export const run = async (options = {}) => createOutlineSystemsScraper(options).run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/outlinesystems/script.js')

if (isDirectExecution) {
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
  else {const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js');if(isDryRun)saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)}
}
