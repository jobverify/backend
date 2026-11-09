import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { fetchTextWithRetry, fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { incomplete, readNativePage } from './native.js'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='fis', COMPANY='FIS', BASE_URL='https://careers.fisglobal.com', SEARCH_PATH='/us/en/search-results'
const shared=createPhenomScraper({companyName:COMPANY,source:SOURCE,baseUrl:BASE_URL,searchPath:SEARCH_PATH,scraperDir:currentDir})
const text = x => typeof x==='string'?x.normalize('NFC').replace(/\s+/g,' ').trim():null
const equal = (a,b) => text(a)===text(b)
const countryNames=new Map(),displayCountry=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const code=String.fromCharCode(a,b),name=displayCountry.of(code)
  if(name!==code&&!['ZZ','EU','EZ','UN','XA','XB','QO'].includes(code)){countryNames.set(code.toLowerCase(),code);countryNames.set(name.toLowerCase(),code)}
}
for(const [name,code] of [['Hong Kong','HK'],['United States of America','US']])countryNames.set(name.toLowerCase(),code)
const countryCode = value => typeof value==='string'?countryNames.get(text(value).toLowerCase())??null:null
const india = value => countryCode(value)==='IN'
const joined = parts => parts.map(text).filter(Boolean).join(', ')
const externalVisibility = value => Array.isArray(value)&&value.every(item=>typeof item==='string')&&value.includes('external')
const budget = (x,fallback) => Number.isFinite(Number(x))&&Number(x)>=0?Number(x):fallback
const nativeDate = raw => {
  if(raw==null||raw==='')return {state:'unknown',raw,precision:null}
  if(typeof raw!=='string')return {state:'invalid',raw,precision:null}
  const m=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2}))?$/.exec(raw)
  if(!m)return {state:'invalid',raw,precision:null}
  const day=raw.slice(0,10),calendar=new Date(day+'T00:00:00Z')
  if(!Number.isFinite(calendar.getTime())||calendar.toISOString().slice(0,10)!==day
    ||m[4]!=null&&(Number(m[4])>23||Number(m[5])>59||Number(m[6]||0)>59))return {state:'invalid',raw,precision:null}
  const timestamp=Date.parse(raw)
  return Number.isFinite(timestamp)?{state:'valid',raw,timestamp,precision:m[4]==null?'utc-day':'timestamp'}:{state:'invalid',raw,precision:null}
}
const publication = (listing,job,posting) => {
  const fields={listingPostedDate:listing.postedDate??null,detailPostedDate:job?.postedDate??null,jsonLdDatePosted:posting?.datePosted??null}
  const parsed=Object.values(fields).map(nativeDate),invalid=parsed.some(p=>p.state==='invalid')
  const candidates=parsed.filter(p=>p.state==='valid').sort((a,b)=>a.timestamp-b.timestamp)
  return {value:invalid?null:candidates[0]?.raw??null,valid:!invalid,evidence:{...fields,
    dateCreated:job?.dateCreated??null,jobUpdatedDate:job?.jobUpdatedDate??null,
    selection:'earliest-valid-native-publication-field-without-creation-or-crawl-time',
    reconciliation:invalid?'invalid':candidates.length?'reconciled':'unknown',originalPublicationVerified:false}}
}
const closing = (listing,job,posting) => {
  const fields={jsonLdValidThrough:posting?.validThrough??null,detailValidThrough:job?.validThrough??null,
    detailExpiryDate:job?.expiryDate??null,detailClosingDate:job?.closingDate??null,
    listingValidThrough:listing.validThrough??null,listingExpiryDate:listing.expiryDate??null,listingClosingDate:listing.closingDate??null}
  const parsed=Object.values(fields).map(nativeDate),candidates=parsed.filter(p=>p.state==='valid')
  const malformed=parsed.some(p=>p.state==='invalid')
  const conflict=candidates.some(p=>p.timestamp!==candidates[0].timestamp||p.precision!==candidates[0].precision)
  return {value:malformed||conflict?null:candidates[0]?.raw??null,valid:!malformed&&!conflict,
    precision:malformed||conflict?'unverified':candidates[0]?.precision??'unknown',
    evidence:{...fields,reconciliation:malformed?'invalid':conflict?'conflicting':candidates.length?'reconciled':'unknown'}}
}
const validApply = (url,id) => {
  try{
    if(typeof url!=='string'||url.includes('\\'))return false
    const u=new URL(url)
    if(u.origin!=='https://fis.wd5.myworkdayjobs.com'||u.username||u.password||u.search||u.hash
      ||/%(?:2f|5c)/i.test(u.pathname))return false
    decodeURIComponent(u.pathname)
    return new RegExp('^/SearchJobs/job/[A-Za-z0-9_-]+/[A-Za-z0-9][A-Za-z0-9._~%+-]*_'+id+'(?:-\\d+)?/apply$').test(u.pathname)
  }catch{return false}
}
const validCanonical = (value,id,sequence) => {
  try{
    if(typeof value!=='string'||value.includes('\\')||/\/(?:\.|%2e)(?:\.|%2e)?(?:\/|$)/i.test(value))return false
    const url=new URL(value),route=/^\/us\/en\/job\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname)
    if(url.origin!==BASE_URL||url.username||url.password||url.search||url.hash||!route
      ||![id,sequence].includes(route[1])||/%(?:2f|5c)/i.test(url.pathname))return false
    decodeURIComponent(url.pathname)
    return true
  }catch{return false}
}
const officeProof = (job,posting) => {
  const offices=job.multi_location, places=Array.isArray(posting?.jobLocation)?posting.jobLocation:[posting?.jobLocation]
  if(!Array.isArray(offices)||!offices.length||offices.length!==places.length)return null
  const proved=[]
  for(const office of offices){
    if(!office||typeof office!=='object'||Array.isArray(office))return null
    const {city,state,country,cityStateCountry,location,address,postalCode}=office
    if(![city,country,cityStateCountry,location,address,postalCode].every(v=>typeof v==='string'&&v.trim())||state!=null&&typeof state!=='string')return null
    if(!equal(cityStateCountry,joined([city,state,country]))||!equal(location,address))return null
    // Preserve street addresses verbatim; derive scope from typed office fields,
    // corroborated against JSON-LD, never city substrings in free-text addresses.
    if(!equal(location.split(',').at(-1),country))return null
    for(const [field,expected] of [[office.cityState,joined([city,state])],[office.cityCountry,joined([city,country])],[office.stateCountry,joined([state,country])]]){
      if(field!=null&&!equal(field,expected))return null
    }
    const matching=places.filter(place=>{
      const a=place?.address,c=a?.addressCountry&&typeof a.addressCountry==='object'?a.addressCountry.name:a?.addressCountry
      return equal(a?.addressLocality,city)&&equal(a?.addressRegion||'',state||'')&&equal(c,country)&&equal(a?.postalCode,postalCode)
        &&(a?.streetAddress==null||typeof a.streetAddress==='string'&&equal(a.streetAddress,address))
    })
    if(matching.length!==1)return null
    proved.push(office)
  }
  if(new Set(proved.map(o=>joined([o.city,o.state,o.country,o.postalCode]))).size!==proved.length)return null
  return proved
}
const detailFailure = (job,kind,evidence={}) => ({...job,...evidence,jobDescription:null,sourceDetailComplete:false,sourceDetailFailureKind:kind})
const corroborate = (listing,html,raw) => {
  const model=readNativePage(html),job=model.ddo?.jobDetail?.data?.job,posting=model.posting
  const status=model.ddo?.jobDetail?.status
  if(!job||!posting||status!=null&&status!==200||model.ddo.jobDetail.error||model.ddo.jobDetail.success===false)throw incomplete('missing successful detail model')
  const posted=publication(raw,job,posting),deadline=closing(raw,job,posting)
  const nativeEvidence={postingDate:posted.value,closingDate:deadline.value,sourceClosingDateIsExact:deadline.precision==='timestamp',
    sourceClosingDatePrecision:deadline.precision,sourceNativeDetail:job,sourceNativeJobPosting:posting,sourceNativeCanonical:model.canonical,
    sourceNativeMLDescription:job.ml_Description??null,sourceNativePublicationEvidence:posted.evidence,sourceNativeClosingEvidence:deadline.evidence}
  const id=raw.jobId,expectedSequence=raw.jobSeqNo,postingId=typeof posting.identifier==='string'?posting.identifier:posting.identifier?.value
  const primaryCountry=countryCode(raw.country)
  if(job.jobId!==id||job.reqId!==id||job.jobSeqNo!==expectedSequence||postingId!==id||!equal(job.title,raw.title)||!equal(posting.title,raw.title)
    ||!validCanonical(model.canonical,id,expectedSequence)
    ||posting.hiringOrganization?.url!=null&&!validCanonical(posting.hiringOrganization.url,id,expectedSequence)
    ||job.companyValue!=='FIS'||job.companyName!=='FIS Global'||posting.hiringOrganization?.name!=='FIS Global'
    ||posting.hiringOrganization?.sameAs!==BASE_URL+'/us/en'||job.jobReqStatus!=='OPEN'
    ||job.siteType!=='external'||!['External','Internal/External'].includes(job.visibilityType)||!externalVisibility(job.jobVisibility)
    ||!validApply(raw.applyUrl,id)||job.applyUrl!==raw.applyUrl
    ||!primaryCountry||![job.country,job.standardisedCountry,job.ml_country].every(value=>countryCode(value)===primaryCountry))return detailFailure(listing,'identity-mismatch',nativeEvidence)
  const offices=officeProof(job,posting),primary=offices?.find(o=>countryCode(o.country)===primaryCountry&&equal(o.city,raw.city)&&equal(o.state||'',raw.state||''))
  const target=offices?.find(o=>india(o.country))
  if(!primary||!target||!equal(raw.cityStateCountry,primary.cityStateCountry)||!equal(job.cityStateCountry,primary.cityStateCountry)
    ||!equal(job.city,primary.city)||!equal(job.state||'',primary.state||'')||!equal(job.postalCode,primary.postalCode))return detailFailure(listing,'identity-mismatch',nativeEvidence)
  if(!posted.valid||!deadline.valid)return detailFailure(listing,!posted.valid?'invalid-publication':'invalid-closing-date',nativeEvidence)
  const normalized=shared.extractJobDetail(html,listing)
  // JobPosting is the complete employer-authored JD. ML content is a shortened
  // projection, retained only as separate native evidence. Decode exactly once
  // with the protected helper; retain the exact original string in JobPosting.
  const nativeDescription=typeof posting.description==='string'?decodeNativeEntities(posting.description):null
  if(!nativeDescription||/&(?:lt|#0*60|#x0*3c);\s*\/?[a-z]/i.test(nativeDescription)
    ||!extractActiveDescription(nativeDescription))return detailFailure(listing,'missing-content',nativeEvidence)
  return {...listing,...normalized,company:COMPANY,source:SOURCE,jobId:id,requisitionId:id,title:raw.title,
    sourceUrl:listing.sourceUrl,applyUrl:raw.applyUrl,link:raw.applyUrl,country:'India',city:target.city,
    location:target.cityStateCountry,locations:offices.filter(o=>india(o.country)).map(o=>o.cityStateCountry),
    jobDescription:nativeDescription,postingDate:posted.value,closingDate:deadline.value,
    sourceClosingDateIsExact:deadline.precision==='timestamp',sourceClosingDatePrecision:deadline.precision,sourceDetailComplete:true,
    sourceDetailFailureKind:undefined,publicExperienceChecked:true,sourceNativeListing:raw,sourceNativeLocations:job.multi_location,
    ...nativeEvidence,
    sourceDescriptionEvidence:{authoritativeField:'JobPosting.description',decoding:'one-pass-protected-decodeNativeEntities',
      validation:'protected-extractActiveDescription',mlProjectionUsed:false},
    sourceEmployerEvidence:{companyValue:job.companyValue,companyName:job.companyName,hiringOrganization:posting.hiringOrganization,
      scope:'FIS companyValue on official FIGLUS board',legalEmployerVerified:false}}
}

const requestDetail = async (fetcher,url,signal) => {
  signal.throwIfAborted()
  let onAbort
  const aborted=new Promise((_,reject)=>{onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true})})
  try{return await Promise.race([fetcher(url,{signal}),aborted])}finally{signal.removeEventListener('abort',onAbort);signal.throwIfAborted()}
}
export const run = async (options={}) => {
  const defaultText=(url,request={})=>fetchTextWithRetry(url,{...request,attempts:1,timeoutMs:15000,headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}})
  const defaultJson=(url,request={})=>fetchJsonWithRetry(url,{...request,attempts:1,timeoutMs:15000})
  const getText=options.fetchText||defaultText,getJson=options.fetchJson||defaultJson,rawListings=new Map()
  const getListingPage=async (url,request)=>{
    const html=await getText(url,request),{app,ddo}=readNativePage(html)
    if(app?.widgetApiEndpoint!==BASE_URL+'/widgets'||app.refNum!=='FIGLUS'||app.pageName!=='search-results'
      ||app.country!=='us'||app.locale!=='en_us'||app.deviceType!=='desktop'
      ||!ddo?.siteConfig?.data?.siteSettings?.refineSearch?.enabledFacets?.includes('companyValue'))throw incomplete('missing official FIGLUS company facet binding')
    return html
  }
  const getInventory=async (url,request)=>{
    if(url!==BASE_URL+'/widgets'||request.method!=='POST')throw incomplete('unadvertised inventory request')
    const body={...JSON.parse(request.body),selected_fields:{companyValue:['FIS']},all_fields:['country','companyValue'],size:500}
    const response=await getJson(url,{...request,body:JSON.stringify(body)}),r=response?.refineSearch
    if(r?.status!==200||!Array.isArray(r.data?.jobs)||r.hits!==r.data.jobs.length
      ||JSON.stringify(r.data.ui_selections?.companyValue)!=='["FIS"]'
      ||Object.keys(r.data.ui_selections).some(k=>k!=='companyValue')
      ||r.data.aggregations?.find(a=>a.field==='companyValue')?.value?.FIS!==r.totalHits)throw incomplete('unreconciled FIS company filter or native counts')
    for(const raw of r.data.jobs){
      if(!/^JR\d+$/.test(raw.jobId)||raw.reqId!==raw.jobId||raw.jobSeqNo!=='FIGLUS'+raw.jobId+'EXTERNAL'
        ||raw.siteType!=='external'||!['External','Internal/External'].includes(raw.visibilityType)||!externalVisibility(raw.jobVisibility)
        ||raw.companyValue!=null&&raw.companyValue!=='FIS'||!validApply(raw.applyUrl,raw.jobId))throw incomplete('invalid FIS native listing identity')
      const previous=rawListings.get(raw.jobId)
      if(previous&&JSON.stringify(previous)!==JSON.stringify(raw))throw incomplete('native listing changed across pages')
      rawListings.set(raw.jobId,raw)
    }
    // Native Hong Kong is ISO3166 HK. The shared Intl table uses the longer
    // display name. Normalize this exact typed foreign alias only; rawListings
    // and transport evidence retain the original label and full native payload.
    return {...response,refineSearch:{...r,data:{...r.data,jobs:r.data.jobs.map(raw=>raw.country==='Hong Kong'?{...raw,country:'HK'}:raw)}}}
  }
  const jobs=await shared.run({...options,fetchText:getListingPage,fetchJson:getInventory,useWidgetApi:true,detailEnrichmentBudgetMs:0})
  const listingEvidence=readInventoryEvidence(jobs),signal=options.signal
  const detailBudget=budget(options.detailEnrichmentBudgetMs??process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS,180000)
  const controller=new AbortController(),detailSignal=signal?AbortSignal.any([signal,controller.signal]):controller.signal
  const timer=detailBudget>0?setTimeout(()=>controller.abort(incomplete('detail budget expired')),detailBudget):null
  let next=0
  try{
    if(detailBudget>0)await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{
      while(!detailSignal.aborted){
        const index=next++;if(index>=jobs.length)return
        const listing=jobs[index],raw=rawListings.get(listing.jobId)
        try{jobs[index]=corroborate(listing,await requestDetail(getText,listing.sourceUrl,detailSignal),raw)}
        catch{signal?.throwIfAborted();jobs[index]=detailFailure(listing,detailSignal.aborted?'budget-exhausted':'upstream')}
      }
    }))
  }finally{if(timer)clearTimeout(timer)}
  signal?.throwIfAborted()
  const allDetails=jobs.every(job=>job.sourceDetailComplete===true)
  for(const job of jobs){
    const raw=rawListings.get(job.jobId)
    job.sourceNativeListing??=raw
    if(!job.sourceNativePublicationEvidence){const posted=publication(raw,null,null);job.postingDate=posted.value;job.sourceNativePublicationEvidence=posted.evidence}
    if(!allDetails||listingEvidence?.listingComplete!==true)job.sourceListingComplete=false
  }
  return attachInventoryEvidence(jobs,!allDetails?{...listingEvidence,status:'discovery-only',listingComplete:false,
    reason:'FIS company inventory collected but one or more India details unverified; preserve existing vacancies'}:listingEvidence)
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(!process.argv.includes('--dry-run'))throw new Error('FIS standalone execution requires --dry-run; persistence belongs to the managed runner')
  const {saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  saveToFile(await run(),path.join(currentDir,'jobs.json'))
}
