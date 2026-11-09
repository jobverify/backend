import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createHash} from 'node:crypto'
import {parseJavaScriptLiteral,decodeJavaScriptStringLiteral} from '../../scraper-support/utils/safeLiteral.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {isNativeBareCityInPublicScope} from '../../scraper-support/shared/nativeCityScope.js'
import {normalizeInventoryEvidence,attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import candidate from './catalog-candidate.json' with {type:'json'}

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'letsventure'
export const COMPANY = 'LetsVenture'
export const FIRST_PARTY_ROOT_URL='https://lvxventures.com/'
export const REBRAND_URL='https://lvxventures.com/lvx-in-news/letsventure-rebrands-as-lvx-and-expands-into-growth-stage-investment'
export const EMPLOYER_URL='https://www.linkedin.com/company/lvxventures'
export const INDIA_LISTING_URL='https://www.linkedin.com/jobs/search/?f_C=3325282&location=India'
export const WORLDWIDE_LISTING_URL='https://www.linkedin.com/jobs/search/?f_C=3325282&location=Worldwide'
export const CAREERS_URL='https://letsventure.zohorecruit.in/jobs/Careers'
export const API_URL='https://letsventure.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'
export const SEED_URL='https://www.linkedin.com/jobs/view/marketing-manager-at-lvx-4466053550'
export const PROVIDER_METADATA = {...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createLetsVentureScraper = (defaults = {}) => ({
  async run(options = {}) {
    const {fetchImpl = globalThis.fetch, signal, timeoutMs = 30000, now = () => new Date().toISOString()} = {...defaults, ...options}
    const timestamp=()=>new Date(typeof now==='function'?now():now).toISOString()
    signal?.throwIfAborted()
    const controller = new AbortController(), retainedResponses = []
    let firstParty = false, surface = EMPLOYER_URL, timer, abortListener, callerListener
    const gap = (reason, cause) => Object.assign(new Error('LetsVenture coverage gap: ' + reason, {cause}), {
      code:'LETSVENTURE_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
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
        if(response.url !== url || response.status!==200) {void Promise.resolve(response.body?.cancel?.()).catch(()=>{});throw gap(`Native final URL or HTTP status changed (${response.status})`)}
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
      const official=await read(FIRST_PARTY_ROOT_URL)
      if(!official.nodes(n=>n.tag==='a'&&n.attrs.href==='https://www.linkedin.com/company/lvxventures/').length)throw gap('Current corporate native employer identity association changed')
      const rebrand=await read(REBRAND_URL)
      if(!rebrand.text(rebrand.root).includes('LetsVenture rebrands as LVX')||!rebrand.text(rebrand.root).includes('Bengaluru-based venture capital firm LetsVenture has rebranded itself as LVX'))throw gap('Official exact employer rebrand proof changed')
      const employer=await read(EMPLOYER_URL)
      if(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='LVX').length!==1||employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:3325282').length!==1
        ||!employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&new URL(u.searchParams.get('url')).href==='https://lvxventures.com/'}catch{return false}}))throw gap('Native exact LVX employer or reciprocal corporate identity changed')
      const inspectIndependentSearches=async()=>{for(const [url,location] of [[INDIA_LISTING_URL,'India'],[WORLDWIDE_LISTING_URL,'Worldwide']]){
        const listing=await read(url)
        if(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='3325282'&&Object.hasOwn(n.attrs,'checked')).length!==1
          ||!listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length||listing.nodes(n=>listing.hasClass(n,'job-search-card')).length)throw gap('Native scoped search changed; new exact role/country/date/expiry/application review required')
      }}
      const board=await read(CAREERS_URL)
      const hidden=(doc,id)=>{const nodes=doc.nodes(n=>n.tag==='input'&&n.attrs.type==='hidden'&&n.attrs.id===id);if(nodes.length!==1)throw gap('Native exact hidden carrier missing or ambiguous');return JSON.parse(nodes[0].attrs.value)}
      const identity=meta=>{if(meta.org_info?.company_name!=='LVX Ventures'||meta.org_info.id!=='57569000000209005'||meta.page_id!=='57569000000209123'||meta.page_name!=='Careers'||meta.list_url!==CAREERS_URL||meta.source!=='CareerSite')throw gap('Native Zoho exact employer/page identity changed')}
      identity(hidden(board,'meta'))
      const embedded=hidden(board,'jobs'),api=await read(API_URL,{json:true})
      if(api.code!=='success'||api.info?.page_name!=='Careers'||!Array.isArray(api.data)||!Array.isArray(embedded)||api.data.length!==embedded.length||api.data.length>50)throw gap('Native portal/API inventory incomplete or malformed')
      for(const scope of [api,api.info])for(const field of ['more_records','moreRecords','hasMore','has_more','next','next_page','nextPage','nextCursor','next_cursor','cursor','continuationToken','pagination'])if(scope[field]!=null&&scope[field]!==false&&scope[field]!=='')throw gap('Native pagination requires full inventory review')
      const ids=new Set(),excludedNativeCandidates=[],nativeCandidates=[],publicJobs=[]
      const reviewFields=record=>{for(const key of Object.keys(record))if(/countr|location|address|province|region|date|expiry|valid.?through|(?:published|posted|modified|created)[_-]?(?:at|time)/i.test(key)&&!['Country','Date_Opened'].includes(key))throw gap('New native geography/publication/expiry field requires reconciliation')}

      for(const row of api.data){
        reviewFields(row)
        if(!/^\d+$/.test(row.id)||ids.has(row.id)||typeof row.Posting_Title!=='string'||row.Job_Opening_Name!==row.Posting_Title||row.Publish!==true||row.Is_Locked!==false||row.Remote_Job!=='Yes'||row.Country||row.State||row.City)throw gap('New native role identity, active state or explicit geography requires reconciliation')
        ids.add(row.id)
        const carrier=embedded.find(v=>v.id===row.id)
        if(carrier)reviewFields(carrier)
        if(!carrier||carrier.Posting_Title!==row.Posting_Title||carrier.Country||carrier.City||carrier.Remote_Job!==true||carrier.Publish!==true||carrier.Is_Locked!==false)throw gap('Embedded/API role identity/geography differs')
        const target=new URL(row.$url)
        if(target.origin!=='https://letsventure.zohorecruit.in'||!new RegExp('^/jobs/Careers/'+row.id+'/[^/]+$').test(target.pathname)||target.search!=='?source=CareerSite')throw gap('Native role URL differs from identity')
        const detail=await read(row.$url),scripts=detail.nodes(n=>n.tag==='script').map(n=>n.raw||'')
        const records=scripts.flatMap(script=>[...script.matchAll(/\bvar jobs\s*=\s*JSON\.parse\(('(?:\\.|[^'\\])*')\)\s*;/g)])
        const metas=scripts.flatMap(script=>[...script.matchAll(/\bvar meta\s*=\s*(\{[^\n]*\})\s*;/g)])
        if(records.length!==1||metas.length!==1)throw gap('Exact native detail payload missing or ambiguous')
        const meta=parseJavaScriptLiteral(metas[0][1]);identity(meta);if(meta.detail_url!==row.$url)throw gap('Native detail canonical identity changed')
        const items=JSON.parse(decodeJavaScriptStringLiteral(records[0][1])),job=items[0]
        if(items.length!==1||job?.id!==row.id||job.Posting_Title!==row.Posting_Title||job.Job_Opening_Name!==row.Posting_Title||job.Country||job.State||job.City||job.Publish!==true||job.Is_Locked!==false||job.Remote_Job!==true)throw gap('Native detail identity, active state or country changed')
        reviewFields(job)
        // The rendered native detail explicitly labels Date_Opened "Posted on".
        // Do not drop this original public date merely because country is null.
        const posted=job.Date_Opened
        if(typeof posted!=='string'||!/^\d{4}-\d\d-\d\d$/.test(posted)||!Number.isFinite(+new Date(posted))||new Date(posted).toISOString().slice(0,10)!==posted)throw gap('Native public posting date missing or invalid')
        for(const carrier of [row,embedded.find(v=>v.id===row.id)])if(carrier.Date_Opened!=null&&carrier.Date_Opened!==posted)throw gap('Native publication date carriers disagree')
        const rawDescription=typeof job.Job_Description==='string'?job.Job_Description:null
        const text=extractActiveDescription(rawDescription)
        const core=rawDescription&&extractActiveDescription(rawDescription.replace(/<(h[1-6]|strong|b)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,''))
        const key=value=>String(value||'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()
        const sourceDescription=text&&core&&key(core)!==key(job.Posting_Title)&&!/^(?:responsibilities|requirements)\s*[:.!]*$/i.test(core)?rawDescription:null
        const fact={id:job.id,title:job.Posting_Title,sourceUrl:row.$url,country:null,remote:true,nativeDateOpened:posted,nativeDateOpenedIsPublicationDate:true,sourceDescription}
        nativeCandidates.push(fact)
        if(+new Date(posted)>+new Date(timestamp()))excludedNativeCandidates.push({...fact,exclusionReason:'native-future-publication'})
        else if(isNativeBareCityInPublicScope('Remote'))publicJobs.push({
          ...fact,source:SOURCE,company:COMPANY,jobId:job.id,requisitionId:null,location:'Remote',city:'Remote',
          link:row.$url,applyUrl:row.$url,postingDate:posted,postedAt:posted,closingDate:null,
          nativePublicationDate:posted,nativePublicationDateProvenance:'native-rendered-Posted-on-Date_Opened',
          jobDescription:sourceDescription,sourceDetailComplete:sourceDescription!==null,sourceDetailStatus:sourceDescription===null?'missing-description':'complete',
          sourceEmploymentType:job.Job_Type??null,sourceExperienceRequired:job.Work_Experience??null,
          sourceListingComplete:false,sourceScopeComplete:false,sourceGeographyComplete:false,lifecycleCleanupAllowed:false,
        })
      }
      const independentDiscoveryGaps=[]
      let scopedSearchObservedCards=null
      try{
      await inspectIndependentSearches()
      scopedSearchObservedCards=0
      const seed=await read(SEED_URL)
      if(seed.nodes(n=>n.tag==='h1'&&seed.text(n)==='Marketing Manager').length!==1||seed.nodes(n=>n.tag==='a'&&seed.hasClass(n,'topcard__org-name-link')&&seed.text(n)==='LVX'&&new URL(n.attrs.href).pathname==='/company/lvxventures').length!==1
        ||seed.nodes(n=>n.tag==='span'&&seed.hasClass(n,'topcard__flavor--bullet')&&seed.text(n)==='Mumbai, Maharashtra, India').length!==1)throw gap('Native independent exact role identity or country changed')
      if(seed.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&new URL(n.attrs.href).protocol==='https:'&&new URL(n.attrs.href).pathname===new URL(SEED_URL).pathname&&['www.linkedin.com','in.linkedin.com'].includes(new URL(n.attrs.href).hostname)).length!==1)throw gap('Native independent role canonical identity changed')
      const primary=seed.nodes(n=>seed.hasClass(n,'top-card-layout__entity-info'))
      const age=seed.nodes(n=>seed.hasClass(n,'posted-time-ago__text')).map(n=>seed.text(n))
      if(primary.length!==1||seed.nodes(n=>n.tag==='time',primary[0]).length||age.length!==1||age[0]!=='1 month ago')throw gap('New primary role publication evidence requires earliest date/age reconciliation')
      excludedNativeCandidates.push({id:'4466053550',title:'Marketing Manager',country:'India',nativePublicationDate:null,nativeAgeText:age[0],sourceUrl:SEED_URL,exclusionReason:'native-month-old-publication-without-precise-first-date;earliest-age-unresolved'})
      }catch(error){
        if(controller.signal.aborted)throw controller.signal.reason
        independentDiscoveryGaps.push({surface,reason:error.message})
      }
      const jobs=attachInventoryEvidence(publicJobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:false,listingComplete:false,pagesFetched:retainedResponses.length,
        reportedTotal:null,indiaFacetCount:null,verifiedAt:timestamp(),reason:'Official rebrand and reciprocal native LVX identity validated. '+nativeCandidates.length+' native Zoho Remote role details follow existing location policy with countries null and original public Posted-on dates preserved without refresh. '+(independentDiscoveryGaps.length?'Independent discovery unavailable: '+independentDiscoveryGaps.map(g=>g.reason).join('; '):'One independent India Marketing Manager month-old age remains unresolved. Scoped no-match searches do not prove company emptiness.')+' Unknown whole-company totals and cleanup disabled.'})
      Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{retainedResponses,nativeCandidates,excludedNativeCandidates,scopedSearchObservedCards,independentDiscoveryGaps,lifecycleCleanupAllowed:false}})
      return jobs
    }
    try {return await Promise.race([collect(),interrupted])}
    catch(error) {if(signal?.aborted) throw signal.reason;if(error?.code==='LETSVENTURE_COVERAGE_GAP') throw error;throw gap('Native recruiting transport or contract unavailable',error)}
    finally {clearTimeout(timer);signal?.removeEventListener('abort',callerListener);controller.signal.removeEventListener('abort',abortListener);controller.abort()}
  },
})

export const run = async (options = {}) => createLetsVentureScraper(options).run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/letsventure/script.js')

if (isDirectExecution) {
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
  else {const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js');if(isDryRun)saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)}
}
