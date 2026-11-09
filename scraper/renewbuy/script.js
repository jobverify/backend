import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document as parseDocument, norm, decode } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeDate, nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { buildHttpError } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'renewbuy'
export const COMPANY_NAME = 'RenewBuy'
export const HOMEPAGE_URL = 'https://www.renewbuy.com/'
export const CAREERS_URL = 'https://www.renewbuy.com/careers'
export const PROFILE_URL = 'https://www.linkedin.com/company/renewbuyofficial/'
export const JOBS_URL = 'https://www.linkedin.com/jobs/renewbuy-jobs-worldwide?f_C=9350817&location=India'
const INDIA_STATES=new Set(['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'])
const requireFact = (value, reason) => { if (!value) throw new Error('RenewBuy ' + reason) }
const one = (values, label) => { requireFact(values.length === 1, 'missing or ambiguous ' + label); return values[0] }
const linkedinURL = raw => { const u = new URL(raw); requireFact(u.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(u.hostname) && !u.port && !u.username && !u.password && !u.hash, 'native URL authority changed'); return u }
const employerURL = raw => { const u = linkedinURL(raw); requireFact(/^\/company\/renewbuyofficial\/?$/.test(u.pathname) && [...u.searchParams.keys()].every(k => k === 'trk'), 'employer identity changed'); return u }
const roleURL = (raw, id) => { const u = linkedinURL(raw); requireFact(new RegExp('^/jobs/view/[^/]+-' + id + '$').test(u.pathname), 'native job identity changed'); requireFact([...u.searchParams.keys()].every(k => ['position','pageNum','refId','trackingId','trk'].includes(k)), 'native role query changed'); u.search = ''; return u.href }
const byClass = (doc, tag, name, root) => doc.nodes(n => n.tag === tag && doc.hasClass(n, name), root)
const document = html => {
  const doc=parseDocument(html)
  const visit=(node,inherited=false)=>{
    const style=(node.attrs.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style)
    for(const child of node.children)if(typeof child==='object')visit(child,node.inactive)
  }
  visit(doc.root)
  return doc
}

function profile(html) {
  const doc = document(html)
  employerURL(one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'company canonical').attrs.href)
  requireFact(doc.text(one(byClass(doc, 'h1', 'top-card-layout__title'), 'company title')) === COMPANY_NAME, 'company title changed')
  const link = one(doc.nodes(n => n.tag === 'a' && n.attrs['data-tracking-control-name'] === 'about_website'), 'native company website')
  const redirect = linkedinURL(link.attrs.href), target = new URL(redirect.searchParams.get('url'))
  requireFact(redirect.pathname === '/redir/redirect' && redirect.searchParams.getAll('url').length === 1 && target.href === HOMEPAGE_URL && doc.text(link).replace(/\/$/,'') === HOMEPAGE_URL.replace(/\/$/,''), 'native company website identity changed')
  const handoffs = doc.nodes(n => n.tag === 'a' && n.attrs.href?.includes('/jobs/renewbuy-jobs-worldwide'))
  requireFact(handoffs.length > 0 && handoffs.every(n => { const u = linkedinURL(n.attrs.href); return u.pathname === '/jobs/renewbuy-jobs-worldwide' && u.searchParams.getAll('f_C').length === 1 && u.searchParams.get('f_C') === '9350817' }), 'native company ID changed')
}
function board(html) {
  const doc = document(html), countText = doc.text(one(byClass(doc,'span','results-context-header__job-count'),'native count'))
  requireFact(/^\d+$/.test(countText) && Number(countText) > 0, 'unknown or empty native inventory')
  requireFact(doc.text(one(byClass(doc,'span','results-context-header__query-search'),'native query')).toLowerCase() === 'renewbuy jobs in india', 'native location query changed')
  const filters = doc.nodes(n => n.tag === 'input' && n.attrs.name === 'f_C' && Object.hasOwn(n.attrs, 'checked'))
  requireFact(filters.length === 1 && filters[0].attrs.value === '9350817', 'native employer filter changed')
  const locations = doc.nodes(n => n.tag === 'input' && n.attrs.name === 'location')
  requireFact(locations.length && locations.every(n => n.attrs.value === 'India'), 'native country control changed')
  const list = one(byClass(doc,'ul','jobs-search__results-list'),'native inventory'), cards = byClass(doc,'div','base-search-card--link',list), seen = new Set()
  requireFact(cards.length > 0 && cards.length <= 100 && cards.length <= Number(countText), 'native card count changed')
  const rows = cards.map(card => {
    const id = card.attrs['data-entity-urn']?.match(/^urn:li:jobPosting:(\d+)$/)?.[1]
    requireFact(id && !seen.has(id), 'duplicate or missing native job identity'); seen.add(id)
    const link = one(byClass(doc,'a','base-card__full-link',card),'native job link')
    const employer = one(doc.nodes(n => n.tag === 'a' && n.attrs['data-tracking-control-name'] === 'public_jobs_jserp-result_job-search-card-subtitle',card),'card employer')
    employerURL(employer.attrs.href); requireFact(doc.text(employer) === COMPANY_NAME,'native card employer changed')
    const title = doc.text(one(byClass(doc,'h3','base-search-card__title',card),'card title')), location = doc.text(one(byClass(doc,'span','job-search-card__location',card),'card geography'))
    const date = nativeDate(one(doc.nodes(n=>n.tag==='time',card),'card date').attrs.datetime,{required:true})
    requireFact(title && location, 'missing card facts')
    return {id,title,location,url:roleURL(link.attrs.href,id),date}
  })
  const lists=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw)).filter(value=>value['@type']==='ItemList')
  // ItemList is optional search-page metadata. Visible cards already require
  // the exact employer and country filters; every emitted role is independently
  // verified against its native detail. This remains a partial inventory.
  requireFact(lists.length<=1,'ambiguous structured native inventory')
  if(lists.length){
    const items=lists[0].itemListElement
    requireFact(Array.isArray(items)&&items.length===rows.length&&items.every((item,index)=>item['@type']==='ListItem'&&item.position===index+1&&norm(item.name)===rows[index].title&&item.disambiguatingDescription===COMPANY_NAME&&roleURL(item.url,rows[index].id)===rows[index].url),'structured inventory conflict')
  }
  return {rows, count:Number(countText)}
}
function detail(html, row, at, unavailableProfileStatus=null) {
  const doc = document(html), source = roleURL(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'job canonical').attrs.href,row.id)
  requireFact(source === row.url, 'canonical job conflict')
  const title = doc.text(one(byClass(doc,'h1','top-card-layout__title'),'native job title')), employer = one(byClass(doc,'a','topcard__org-name-link'),'detail employer')
  employerURL(employer.attrs.href)
  const location = doc.text(one(doc.nodes(n=>n.tag==='span'&&doc.hasClass(n,'topcard__flavor')&&doc.hasClass(n,'topcard__flavor--bullet')),'detail geography'))
  requireFact(title === row.title && doc.text(employer) === COMPANY_NAME && location === row.location, 'listing/detail employer title or geography conflict')
  if (/No longer accepting applications/.test(doc.text(doc.root))) return null
  const schemas = []
  const walk = value => { if (!value || typeof value !== 'object') return; if(Array.isArray(value)){value.forEach(walk);return} if(value['@type']==='JobPosting') schemas.push(value); if(value['@graph'])walk(value['@graph']) }
  for(const node of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')) walk(JSON.parse(node.raw))
  const schema = one(schemas,'native JobPosting'); employerURL(schema.hiringOrganization?.sameAs)
  requireFact(norm(schema.title) === title && schema.hiringOrganization?.name === COMPANY_NAME, 'structured employer/title conflict')
  if(unavailableProfileStatus){
    const identities=doc.nodes(n=>n.tag==='meta'&&n.attrs.name==='companyId')
    requireFact(identities.length===1&&identities[0].attrs.content==='9350817','native detail company ID changed')
  }
  const posted = nativeDate(schema.datePosted,{required:true}), closing = nativeDate(schema.validThrough)
  requireFact(Date.parse(row.date.iso) <= at && Date.parse(posted.iso) <= at, 'native posting date conflict')
  requireFact(!closing.iso || Date.parse(closing.iso) >= Date.parse(posted.iso), 'native expiry precedes publication')
  if(closing.iso && Date.parse(closing.iso) <= at) return null
  const places = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
  requireFact(places.length > 0 && places.length <= 32, 'missing native geography')
  const geography = places.map(place => {const a=place?.address; requireFact(a && typeof a.addressCountry === 'string','missing native country');const country=nativeCountryName(a.addressCountry);requireFact(country,'unknown native country');return {country,city:a.addressLocality||null,state:a.addressRegion||null}})
  const visibleCountry=nativeLocationCountryName(location)
  requireFact(!visibleCountry || geography.every(g=>g.country===visibleCountry),'visible/structured country conflict')
  requireFact(geography.every(g=>!g.city || location.toLowerCase().includes(g.city.toLowerCase())),'native city conflict')
  requireFact(geography.every(g=>!g.state || INDIA_STATES.has(g.state)&&location.toLowerCase().includes(g.state.toLowerCase())),'native state conflict')
  const restrictions=schema.applicantLocationRequirements ? (Array.isArray(schema.applicantLocationRequirements)?schema.applicantLocationRequirements:[schema.applicantLocationRequirements]) : []
  requireFact(restrictions.every(r=>nativeCountryName(r.name)==='India'),'secondary country restriction conflict')
  if(geography.some(g=>g.country!=='India')) return null
  const descriptions=byClass(doc,'div','show-more-less-html__markup')
  requireFact(descriptions.length<=1,'ambiguous description')
  let jd=descriptions.length?doc.text(descriptions[0])||null:null
  const structured=schema.description?document(decode(schema.description)):null, schemaJD=structured?structured.text(structured.root)||null:null
  requireFact(!jd || !schemaJD || jd.replace(/\s/g,'')===schemaJD.replace(/\s/g,''),'description conflict')
  if(unavailableProfileStatus){
    // A restricted profile cannot supply identity from a historical capture.
    // Every recovered live role must independently identify the exact native
    // company account, corporate domain and legal employer in visible content.
    const identity=/(?:^|\s)Company\s*:\s*RenewBuy\.com\s*\(\s*D2C Insurance Broking Private Limited\s*\)(?=\s|$)/
    requireFact(jd&&schemaJD&&identity.test(jd)&&identity.test(schemaJD),'native legal employer/domain self-identification unavailable')
  }
  if(jd){
    let substance=doc.inner(descriptions[0])
    for(const heading of doc.nodes(n=>['strong','h1','h2','h3','h4','h5','h6'].includes(n.tag),descriptions[0]))substance=substance.replace(doc.outer(heading),'')
    const content=document(substance)
    if(!content.text(content.root)||jd.length<80||/^(?:tbd|to be (?:added|updated)|coming soon|job description|responsibilities)\.?$/i.test(jd))jd=null
    if(unavailableProfileStatus){
      const roleContent=content.text(content.root).replace(/(?:^|\s)Company\s*:\s*RenewBuy\.com\s*\(\s*D2C Insurance Broking Private Limited\s*\)(?=\s|$)/g,' ')
      if(norm(roleContent).length<80)jd=null
    }
  }
  if(unavailableProfileStatus)requireFact(jd,'native substantive description unavailable')
  const apply=doc.nodes(n=>n.tag==='button'&&n.attrs.id==='topbar-apply')
  requireFact(apply.length===1&&doc.text(apply[0])==='Apply','missing active native application')
  const login=doc.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='public_jobs_nav-header-signin')
  requireFact(login.length>0&&login.every(n=>{const u=linkedinURL(n.attrs.href);return u.pathname==='/login'&&u.searchParams.getAll('session_redirect').length===1&&roleURL(u.searchParams.get('session_redirect'),row.id)===source}),'application role conflict')
  const geo=geography[0]
  return {source:SOURCE,company:COMPANY_NAME,jobId:row.id,requisitionId:null,title,location,city:geo.city,state:geo.state,country:'India',jobDescription:jd,postingDate:posted.iso < row.date.iso ? posted.iso : row.date.iso,listingPostingDate:row.date.raw,nativeDetailPostingDate:posted.raw,closingDate:closing.iso,sourceUrl:source,applyUrl:source,link:source,applicationRequiresAccount:true,sourceListingComplete:false,sourceDescription:jd?'native-visible-description':null,sourceDetailComplete:Boolean(jd),sourceDetailStatus:jd?'verified':'description-unavailable',sourceScopeComplete:false,lifecycleCleanupAllowed:false,...(unavailableProfileStatus?{nativeEmployerVerification:'native-detail-company-id-and-legal-domain',nativeCompanyProfileUnavailableStatus:unavailableProfileStatus}:{})}
}

export const createRenewBuyScraper = () => ({
  async run({fetchImpl=globalThis.fetch,signal,timeoutMs=120000,requestTimeoutMs=15000,maxJobs=3,now=()=>new Date().toISOString(),nativeRecovery=true}={}) {
    signal?.throwIfAborted()
    requireFact(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=540000,'invalid timeout')
    requireFact(Number.isInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'invalid request timeout')
    requireFact(maxJobs==null||Number.isInteger(maxJobs)&&maxJobs>0,'invalid maxJobs')
    const controller=new AbortController(), abort=()=>controller.abort(signal.reason)
    signal?.addEventListener('abort',abort,{once:true})
    let timer, listener, activeReader, bytes=0, pages=0
    const deadline=new Promise((_,reject)=>{listener=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',listener,{once:true});timer=setTimeout(()=>controller.abort(new DOMException('RenewBuy aggregate request deadline exceeded','TimeoutError')),timeoutMs)})
    const requestTimeouts=new WeakSet()
    const read=async (url,requireSuccess=false,official=false)=>{
      controller.signal.throwIfAborted()
      const local=new AbortController(),readSignal=AbortSignal.any([controller.signal,local.signal])
      let response,reader,phase='headers',readTimer,abortRead
      const cancel=reason=>{try{Promise.resolve(reader?reader.cancel(reason):response?.body?.cancel?.(reason)).catch(()=>{})}catch{}}
      const interrupted=new Promise((_,reject)=>{
        abortRead=()=>{cancel(readSignal.reason);reject(readSignal.reason)}
        readSignal.addEventListener('abort',abortRead,{once:true})
        readTimer=setTimeout(()=>{
          if(readSignal.aborted)return
          const error=Object.assign(new Error('RenewBuy request timeout awaiting '+phase),{name:'TimeoutError',code:'RENEWBUY_REQUEST_TIMEOUT',requestUrl:url,phase,abortRetries:true,...(response?{observedHTTPStatus:response.status}:{})})
          requestTimeouts.add(error);local.abort(error)
        },requestTimeoutMs)
      })
      const operation=Promise.resolve().then(async()=>{
        readSignal.throwIfAborted()
        response=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html'},signal:readSignal})
        if(readSignal.aborted){cancel(readSignal.reason);readSignal.throwIfAborted()}
        requireFact(response.url===url,'response authority changed')
        if(official)requireFact(response.status===403,'official surface changed; review newly available content')
        if(requireSuccess&&response.status!==200){
          pages++
          const error=Object.assign(buildHttpError(response,url),{requestUrl:url,finalUrl:response.url})
          error.message='RenewBuy native source unavailable: '+error.message
          cancel(error);throw error
        }
        phase='body'
        let html=''
        if(response.body?.getReader){
          reader=response.body.getReader();activeReader=reader
          const chunks=[];let size=0
          try{for(;;){const p=await reader.read();readSignal.throwIfAborted();if(p.done)break;size+=p.value.byteLength;requireFact(size<=4*1024*1024,'body bound exceeded');chunks.push(Buffer.from(p.value))}html=Buffer.concat(chunks).toString('utf8')}
          finally{try{reader.releaseLock()}catch{}if(activeReader===reader)activeReader=null}
        }else html=await response.text()
        readSignal.throwIfAborted();bytes+=Buffer.byteLength(html);requireFact(Buffer.byteLength(html)<=4*1024*1024&&bytes<=32*1024*1024,'aggregate body bound exceeded');pages++
        return {status:response.status,html}
      })
      try{return await Promise.race([operation,interrupted])}
      catch(error){cancel(error);throw error}
      finally{clearTimeout(readTimer);readSignal.removeEventListener('abort',abortRead)}
    }
    const task=(async()=>{
      const checkedAt=now();requireFact(Number.isFinite(Date.parse(checkedAt)),'invalid verification time')
      const blocked=[],officialAvailability=[];let corporateTimedOut=false
      for(const url of [HOMEPAGE_URL,CAREERS_URL]){
        if(corporateTimedOut){officialAvailability.push({url,status:null,state:'not-read-after-same-origin-timeout'});continue}
        try{const page=await read(url,false,true);requireFact(page.status===403&&/forbidden/i.test(page.html),'official surface changed; review newly available content');blocked.push(page.status);officialAvailability.push({url,status:page.status,state:'unavailable-http'})}
        catch(error){
          controller.signal.throwIfAborted()
          if(!nativeRecovery||!requestTimeouts.has(error))throw error
          corporateTimedOut=true
          officialAvailability.push({url,status:null,state:'unavailable',failureKind:'request-timeout',phase:error.phase,...(error.observedHTTPStatus!=null?{observedHTTPStatus:error.observedHTTPStatus}:{})})
        }
      }
      if(!nativeRecovery)return attachInventoryEvidence([],{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:pages,reportedTotal:null,indiaFacetCount:null,verifiedAt:checkedAt,reason:'Official homepage and careers HTTP '+blocked.join('/')+'; inventory unknown; corporate outbound hiring handoff unverified.'})
      let unavailableProfile=null
      try{const company=await read(PROFILE_URL,true);profile(company.html)}catch(error){
        if(error.requestUrl!==PROFILE_URL||![403,429].includes(error.status))throw error
        unavailableProfile=error
      }
      const listing=await read(JOBS_URL,true);const inventory=board(listing.html),jobs=[]
      let interruption=null
      for(const row of [...inventory.rows].sort((a,b)=>b.date.iso.localeCompare(a.date.iso))){
        if(jobs.length>=(maxJobs??Infinity))break
        if(/\b(?:dummy|test job|sample job)\b/i.test(row.title))continue
        const page=await read(row.url)
        if(page.status!==200){interruption='Native detail HTTP '+page.status+'; stopped without retry.';break}
        const job=detail(page.html,row,Date.parse(checkedAt),unavailableProfile?.status);if(job)jobs.push({...job,scrapedAt:checkedAt})
      }
      if(unavailableProfile&&!jobs.length)throw unavailableProfile
      if(!interruption){const confirm=await read(JOBS_URL,true);requireFact(JSON.stringify(board(confirm.html))===JSON.stringify(inventory),'native inventory changed during collection')}
      const identityReason=unavailableProfile?'profile HTTP '+unavailableProfile.status+' unavailable; each role independently verifies native company ID 9350817, exact RenewBuy employer/profile, and visible/structured Company: RenewBuy.com (D2C Insurance Broking Private Limited) self-identification':'native reciprocal company website verified'
      Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,officialAvailability},enumerable:false})
      const corporateReason=corporateTimedOut?'corporate request timeout; corporate availability and outbound handoff unknown':'corporate outbound handoff unavailable (HTTP 403)'
      return attachInventoryEvidence(jobs,{status:'discovery-only',surface:JOBS_URL,firstParty:false,listingComplete:false,pagesFetched:pages,reportedTotal:inventory.count,indiaFacetCount:null,verifiedAt:checkedAt,reason:'Employer-published LinkedIn subset verified through exact RenewBuy company ID 9350817; '+identityReason+'; '+corporateReason+', pagination incomplete; no cleanup.'+(interruption?' '+interruption:'')})
    })()
    try{return await Promise.race([task,deadline])}catch(error){
      signal?.throwIfAborted()
      controller.abort(error)
      const wrapped=new Error(error.message,{cause:error});wrapped.name=error.name;wrapped.code='RENEWBUY_COVERAGE_GAP';wrapped.lifecycleCleanupAllowed=false
      for(const key of ['status','requestUrl','finalUrl','abortRetries','retryDelayMs'])if(error[key]!=null)wrapped[key]=error[key]
      wrapped.inventoryEvidence=normalizeInventoryEvidence({status:'coverage-gap',surface:error.requestUrl||JOBS_URL,firstParty:false,listingComplete:false,pagesFetched:pages,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'RenewBuy source unavailable or changed; current inventory unknown: '+error.message})
      throw wrapped
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',listener);try{Promise.resolve(activeReader?.cancel(controller.signal.reason)).catch(()=>{})}catch{}}
  },
})
export const run=options=>createRenewBuyScraper().run(options)
const currentDir=path.dirname(fileURLToPath(import.meta.url))
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const jobs=await run();const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)
}
