import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const SOURCE = 'smartsocsolutions'
export const COMPANY = 'SmartSoC Solutions'
export const CAREER_PAGE_URL = 'https://www.smartsocs.com/career/'
export const JOBS_AJAX_URL = 'https://www.smartsocs.com/wp-admin/admin-ajax.php'
export const COMPANY_DOMAIN = 'www.smartsocs.com'
export const ATS_PLATFORM = 'wp-job-openings'
const MAX_BYTES = 4 * 1024 * 1024
const norm = value => String(value ?? '').replace(/\s+/g,' ').trim()
const clone = value => structuredClone(value)
const requireNative = (value,message) => {
  if (!value) throw Object.assign(new Error('SmartSoC '+message),{
    failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  })
}
const one = (values,label) => {
  requireNative(values.length===1,'native '+label+' contract changed')
  return values[0]
}
const hasClass = (doc,name) => node => doc.hasClass(node,name)
const getSpecificationValues = (doc,card,name) => {
  const owners=doc.nodes(hasClass(doc,'awsm-job-specification-'+name),card)
  requireNative(owners.length<=1,'duplicate native '+name+' metadata')
  return owners.length ? doc.nodes(hasClass(doc,'awsm-job-specification-term'),owners[0]).map(node=>doc.text(node)) : []
}

// Only the literal native country prefix qualifies a row. Every other native
// value, including a foreign alternative beside India, remains held and raw.
const nativeLocation = values => {
  const matches=values.map(value=>/^India:\s*([^:;]+)$/i.exec(value))
  const qualified=values.length>0 && matches.every(match=>match && norm(match[1]))
  const cities=qualified ? matches.map(match=>norm(match[1])) : []
  const explicitCountries=[...new Set(values.map(value=>/^([^:;]+):/.exec(value)?.[1]).filter(Boolean))]
  return {location:qualified?cities.join('; ')+', India':values.join('; ')||null,city:cities[0]??null,country:qualified?'India':null,
    sourceNativeLocationValues:[...values],sourceCountryEvidence:{qualified,explicitCountries,values:[...values],
      reason:qualified?'all-native-location-values-explicitly-India':'native-role-country-absent-foreign-or-ambiguous'}}
}

export const hasOfficialCareerPageSignal = html => {
  const doc=readNativeDocument(String(html??''))
  const titles=doc.nodes(node=>node.tag==='title'),canonicals=doc.nodes(node=>node.tag==='link' && node.attrs.rel==='canonical')
  const body=doc.nodes(node=>node.tag==='body')[0],text=body?doc.text(body):''
  return titles.length===1 && /^Career\s*(?:&#8211;|&ndash;|–|-)\s*SmartSoC Solutions$/i.test(norm(titles[0].raw))
    && canonicals.length===1 && canonicals[0].attrs.href===CAREER_PAGE_URL
    && doc.nodes(node=>node.tag==='a' && node.attrs.href===CAREER_PAGE_URL && doc.text(node)==='Career').length>0
    && /\b(?:Fresher Hiring|Experience Hiring)\b/.test(text) && text.includes('We are ready for you. Are you too?')
}

const nextPage = html => {
  const doc=readNativeDocument(html),controls=doc.nodes(hasClass(doc,'awsm-load-more-btn'))
  const control=one(controls,'pagination control')
  requireNative(doc.nodes(hasClass(doc,'awsm-jobs-pagination')).some(owner=>doc.nodes(node=>node===control,owner).length===1),
    'native pagination control owner absent')
  const raw=control.attrs['data-page']
  requireNative(typeof raw==='string' && /^[1-9]\d*$/.test(raw),'native pagination page contract changed')
  const page=Number(raw)
  requireNative(Number.isSafeInteger(page) && page<=10,'native pagination page exceeds reviewed bound')
  return page
}

export const extractLoadMoreRequestMetadata = html => {
  const page=String(html??''),doc=readNativeDocument(page)
  requireNative(hasOfficialCareerPageSignal(page),'career page no longer matches the verified first-party public jobs surface')
  const wrapper=one(doc.nodes(hasClass(doc,'awsm-job-wrap')),'listings carrier')
  const listings=one(doc.nodes(hasClass(doc,'awsm-job-listings'),wrapper),'listings carrier')
  requireNative(doc.nodes(hasClass(doc,'awsm-load-more-btn'),listings).length===1,
    'native pagination control owner absent')
  const base=one(doc.nodes(node=>node.tag==='input' && node.attrs.name==='awsm_pagination_base',wrapper),'pagination base metadata')
  const raw=listings.attrs['data-listings'],count=Number(raw)
  requireNative(typeof raw==='string' && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(count) && count<=100
    && Object.keys(listings.attrs).every(key=>['class','data-listings'].includes(key))
    && base.attrs.value===CAREER_PAGE_URL && nextPage(page)===1,
  'career page no longer exposes the verified loadmore contract metadata')
  return {action:'loadmore',listingsPerPage:count,paginationBase:base.attrs.value}
}

const isRecognizedEmptyState = doc => doc.nodes(node=>
  doc.hasClass(node,'awsm-b-jobs-none-container') && /\bno jobs found\b/i.test(doc.text(node))
  || doc.hasClass(node,'awsm-no-more-jobs-container') && /\bno more jobs to show\b/i.test(doc.text(node))).length>0

export const extractJobsFromAjaxHtml = html => {
  const page=String(html??''),doc=readNativeDocument(page,{sourceRanges:true})
  const cards=doc.nodes(hasClass(doc,'awsm-job-listing-item')),empty=isRecognizedEmptyState(doc)
  requireNative(!(cards.length && empty),'native cards contradict terminal empty state')
  if (empty) return []
  requireNative(cards.length>0,'jobs ajax response no longer exposes trusted public job cards')
  const ids=new Set()
  return cards.map(card=>{
    const identity=/^awsm-grid-item-([1-9]\d*)$/.exec(card.attrs.id??'')
    requireNative(identity && !ids.has(identity[1]),'duplicate or invalid native card identity')
    const jobId=identity[1];ids.add(jobId)
    const anchor=one(doc.nodes(node=>node.tag==='a' && doc.hasClass(node,'awsm-job-item'),card),'role detail URL')
    let url
    try { url=new URL(anchor.attrs.href,CAREER_PAGE_URL) } catch { requireNative(false,'native role URL invalid') }
    requireNative(url.origin==='https://www.smartsocs.com' && /^\/jobs\/[^/]+\/$/.test(url.pathname)
      && !url.search && !url.hash && !url.username && !url.password,'native role URL identity changed')
    const title=doc.text(one(doc.nodes(node=>node.tag==='h2' && doc.hasClass(node,'awsm-job-post-title'),anchor),'role title'))
    requireNative(title && Number.isInteger(card.sourceStart) && Number.isInteger(card.sourceEnd),'native role card identity/content absent')
    return {title,company:COMPANY,department:getSpecificationValues(doc,card,'job-category')[0]??null,
      ...nativeLocation(getSpecificationValues(doc,card,'job-location')),jobId,requisitionId:jobId,sourceUrl:url.href,applyUrl:null,
      employmentType:getSpecificationValues(doc,card,'job-type')[0]??null,experienceRequired:null,minimumQualification:null,
      preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,remoteStatus:null,
      sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceApplicationAuthority:false,
      sourceNativeApplicationEvidence:{applicationAuthority:false,navigationOnly:true,nativeApplicationUrl:null,reason:'listing-link-is-unqualified-detail-navigation'},
      sourceNativeCardHTML:page.slice(card.sourceStart,card.sourceEnd)}
  })
}

const defaultFetchText = async (url,options={},callerSignal) => {
  callerSignal?.throwIfAborted()
  const deadline=callerSignal?AbortSignal.any([callerSignal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)
  try {
    const response=await fetch(url,{...options,method:options.method??'GET',credentials:'omit',redirect:'error',signal:deadline,
      headers:{Accept:'text/html,application/xhtml+xml,*/*',...options.headers}})
    callerSignal?.throwIfAborted();deadline.throwIfAborted()
    await requireNativeHttpResponse(response,url,{context:'SmartSoC native HTTP',signal:deadline,callerSignal:callerSignal??null})
    callerSignal?.throwIfAborted();deadline.throwIfAborted()
    const reader=response.body?.getReader(),chunks=[]
    requireNative(reader,'native public body reader absent')
    let bytes=0,complete=false
    try {
      while (true) {
        const part=await reader.read();callerSignal?.throwIfAborted();deadline.throwIfAborted()
        if (part.done) break
        bytes+=part.value.byteLength;requireNative(bytes<=MAX_BYTES,'native public body byte bound exceeded')
        chunks.push(Buffer.from(part.value))
      }
      complete=true
    } finally {
      try { await disposeResponseReader(reader,{signal:deadline,bestEffort:!complete}) }
      finally { reader.releaseLock() }
    }
    callerSignal?.throwIfAborted();deadline.throwIfAborted()
    return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))
  } catch (error) { callerSignal?.throwIfAborted();throw error }
}

export const createSmartSocSolutionsScraper = () => ({
  async run({fetchText=defaultFetchText,now=()=>new Date().toISOString(),signal,onRecords,onAudit}={}) {
    signal?.throwIfAborted()
    const checkedAt=now(),observations=[],pages=[],seen=new Set()
    const audit={source:SOURCE,observations,pages,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,
      listingComplete:false,inventoryComplete:false,lifecycleCleanupAllowed:false,applicationAuthority:false,
      legalEmployerQualified:false,detailCriteriaQualified:false,zeroVerified:false,closingInventoryCompared:false,
      reason:'legacy-native-card-discovery-only:country-alternatives-held;detail-application-company-scope-unqualified'}
    const request=async(url,options={})=>{
      signal?.throwIfAborted()
      const body=await fetchText(url,options,signal)
      signal?.throwIfAborted();requireNative(typeof body==='string' && Buffer.byteLength(body)<=MAX_BYTES,'native public text body contract changed')
      pages.push({url,method:options.method??'GET',requestBody:options.body??null,html:body})
      return body
    }
    let failed=false,failure,jobs
    try {
      const home=await request(CAREER_PAGE_URL)
      requireNative(hasOfficialCareerPageSignal(home),'career page no longer matches the verified first-party public jobs surface')
      const metadata=extractLoadMoreRequestMetadata(home)
      let page=1,terminal=false
      while (!terminal) {
        const body=new URLSearchParams({action:metadata.action,paged:String(page),listings_per_page:String(metadata.listingsPerPage)}).toString()
        const html=await request(JOBS_AJAX_URL,{method:'POST',body,headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}})
        const rows=extractJobsFromAjaxHtml(html)
        for(const row of rows){requireNative(!seen.has(row.jobId),'duplicate native identity across pagination');seen.add(row.jobId);observations.push(row)}
        if (rows.length===0) { terminal=true;continue }
        const declared=nextPage(html)
        requireNative(declared===page+1,'native pagination control repeated or skipped a page')
        page=declared
      }
      jobs=observations.filter(row=>row.country==='India' && row.sourceCountryEvidence.qualified).map(row=>({...row,
        source:SOURCE,link:row.sourceUrl,scrapedAt:checkedAt,companyCareerPage:CAREER_PAGE_URL,companyDomain:COMPANY_DOMAIN,atsPlatform:ATS_PLATFORM}))
    } catch (error) { failed=true;failure=error;audit.failureMessage=error?.message??String(error) }
    signal?.throwIfAborted()
    onRecords?.(clone(observations));signal?.throwIfAborted()
    onAudit?.(clone(audit));signal?.throwIfAborted()
    if (failed) throw failure
    attachInventoryEvidence(jobs,{status:'discovery-only',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:false,
      lifecycleCleanupAllowed:false,pagesFetched:pages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:checkedAt,reason:audit.reason})
    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,
      observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:clone(audit),configurable:true})
    return jobs
  },
})

export const run = async (options={}) => createSmartSocSolutionsScraper().run(options)
