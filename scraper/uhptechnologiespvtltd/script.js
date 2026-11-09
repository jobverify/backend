import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const UHP_CAREERS_URL = 'https://uhptech.com/careers/'
export const KAS_CAREERS_URL = 'https://kasgroup.in/careers/'
export const COMPANY_DETAILS_URL = 'https://uhptechnologies.greythr.com/hire/api/career/get_company_details/'
export const LOCATION_LOOKUP_URL='https://uhptechnologies.greythr.com/hire/api/greythr/emp-category/'
export const JOBS_API_URL = 'https://uhptechnologies.greythr.com/hire/api/career/published_jobs/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&#8211;|&#8212;/gi, '-')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const stripTagsPreservingLines = (value) =>
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&#8211;|&#8212;/gi, '-')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const toLines = (value) =>
  stripTagsPreservingLines(value)
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const activeRoleDescription=html=>{
 const doc=readVisibleNativeDocument(String(html??''),{strict:true}),escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
 const render=n=>typeof n==='string'?n:n.inert||['script','style','title'].includes(n.tag)?'':n.tag==='root'?n.children.map(render).join(''):'<'+n.tag+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+n.children.map(render).join('')+'</'+n.tag+'>'
 return doc.nodes(n=>n.tag==='root').map(render).join('')
}

const mandatoryWorksiteResidence=html=>{
 const doc=readVisibleNativeDocument(String(html??''),{strict:true}),statements=[]
 let context='role',conditionalContext=null
 const walk=(node,blocked=false)=>{
  if(node.inert)return
  blocked=blocked||['blockquote','pre','code','samp','footer','address','aside'].includes(node.tag)||/(?:example|company|contact|corporate)/i.test((node.attrs.id||'')+' '+(node.attrs.class||''))
  if(!blocked&&(/^(?:h[1-6]|p|li)$/.test(node.tag))){
   const text=doc.text(node)
   if(/^(?:about\s+(?:the\s+)?(?:company|employer)|company\s+(?:overview|background)|examples?|for illustration)\b/i.test(text))context='corporate'
   else if(/^(?:job description|about the role|role overview|responsibilities|requirements|eligibility)\s*:?$/i.test(text))context='role'
   if(context==='role'&&(/\b(?:if|when|unless|subject to|depending on|as (?:needed|required|necessary)|optional|conditional(?:ly)?)\b/i.test(text)||/^(?:travel|mobility|client[- ]service geography)\s*:?$/i.test(text)))conditionalContext=text
   if(context==='role'&&!/\b(?:examples?|illustrat(?:ion|ive)|company policy|we serve|our clients)\b/i.test(text)){
    for(const sentence of text.split(/(?<=[.!?])\s+/)){
     const match=sentence.match(/^(Candidate must stay at customer location anywhere in ([A-Za-z][A-Za-z -]+)\.)$/i)
     if(match)statements.push({statement:match[1],countryLabel:match[2],conditionalContext,qualifiedContext:conditionalContext==null})
    }
   }
  }
  for(const child of node.children.filter(n=>typeof n!=='string'))walk(child,blocked)
 }
 doc.nodes(n=>n.tag==='root').forEach(root=>walk(root))
 return statements
}

export const hasUhpCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\b[^<]*Uhp Tech/i.test(page)
    && /UHP Technologies Pvt\.?\s*Ltd/i.test(page)
    && /Explore Careers at UHP Tech/i.test(page)
    && /https:\/\/www\.kasgroup\.in\/careers\//i.test(page)
}

export const hasKasGroupHandoffSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\b[^<]*KAS Group/i.test(page)
    && /KAS Group is a dynamic conglomerate of UHP Technologies Pvt Ltd/i.test(page)
    && /https:\/\/uhptechnologies\.greythr\.com\/hire\/jobs\//i.test(page)
}

const hasCompanyDetailsSignal = (payload) => {
  const companyName = normalizeWhitespace(payload?.company_name)
  const website = normalizeWhitespace(payload?.other_details?.website)
  const linkedIn = normalizeWhitespace(payload?.other_details?.social?.in)

  return companyName === 'M/S UHP TECHNOLOGIES Pvt Ltd'
    && /kasgroup\.in/i.test(website || '')
    && /linkedin\.com\/company\/uhp-technologies/i.test(linkedIn || '')
}

const monthsToYearsLabel = (months) => {
  if (!Number.isFinite(months) || months <= 0) return null

  const years = months / 12
  const rounded = Number.isInteger(years) ? years.toString() : years.toFixed(1).replace(/\.0$/, '')
  return `${rounded} years`
}

const extractExperienceRequired = (job) => {
  const min = Number(job?.min_exp)
  const max = Number(job?.max_exp)

  if ((!Number.isFinite(min) || min <= 0) && (!Number.isFinite(max) || max <= 0)) {
    return null
  }

  const minLabel = monthsToYearsLabel(min)
  const maxLabel = monthsToYearsLabel(max)

  if (minLabel && maxLabel) {
    return `${minLabel.replace(' years', '')}-${maxLabel}`
  }

  return minLabel || maxLabel
}

const extractQualification = (description) => {
  const lines = toLines(description)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (/^(qualification|educational qualification)\b/i.test(line)) {
      const inlineValue = normalizeWhitespace(line.replace(/^(qualification|educational qualification)\s*:?\s*/i, ''))
      if (inlineValue) return inlineValue

      for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 4); nextIndex += 1) {
        const candidate = lines[nextIndex]
        if (!/^(job summary|requirements?|required skills|preferred skills|overview|experience)\b/i.test(candidate)) {
          return candidate
        }
      }
    }
  }

  return null
}

const extractLocation=job=>{
 const labels=toLines(job?.description).map(line=>line.match(/^(?:(?:Job|Work)\s+)?Location\s*:\s*(.+)$/i)?.[1]).filter(Boolean).map(normalizeWhitespace).filter(value=>!/^https?:\/\//i.test(value)&&!/^(?:in[ -]?person|on[ -]?site|hybrid|remote)$/i.test(value))
 if(new Set(labels).size>1)throw Object.assign(Error('UHP native role has contradictory workplace headers'),{abortRetries:true})
 return labels[0]||null
}

const readStructuredLocations=(job,lookup)=>{
 const ids=job.locations
 if(ids==null)return {ids:null,locations:[]}
 if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Object.assign(Error('UHP invalid/duplicate role location IDs'),{abortRetries:true})
 if(!ids.length)return {ids:[],locations:[]}
 const categoryId=lookup?.cat_extfield?.location
 if(typeof categoryId!=='string'||lookup.cat?.[categoryId]!=='Location')throw Object.assign(Error('UHP native location lookup category is unqualified'),{abortRetries:true})
 const locations=ids.map(id=>{const row=lookup.value?.[id];if(!row||row.cat_id!==categoryId||!normalizeWhitespace(row.name))throw Object.assign(Error('UHP role location ID has missing/wrong-category native lookup'),{abortRetries:true});return {id,categoryId,label:normalizeWhitespace(row.name)}})
 return {ids,locations}
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /pan india/i.test(normalized)) return null

  const cityMatch = normalized.match(/\b(Bangalore|Bengaluru|Chikhli|Gujarat)\b/i)
  if (cityMatch) {
    return cityMatch[1]
  }

  const segments = normalized.split(',').map((segment) => normalizeWhitespace(segment)).filter(Boolean)
  if (!segments.length) return null

  return segments[0]
}

const extractRemoteStatus = (job, location) => {
  const text = stripTags(job?.description) || ''

  if (
    /project sites?|customer location|anywhere in india|pan india|deployment in customer location|work location:\s*in person/i.test(text)
    || /pan india/i.test(location || '')
  ) {
    return 'On-site'
  }

  return job?.is_remote ? 'Remote' : 'On-site'
}

export const mapNativeUhpJob = (job,lookup) => {
  const activeDescription=activeRoleDescription(job?.description),description = stripTags(activeDescription)
  const headerLocation=extractLocation({...job,description:activeDescription}),structured=readStructuredLocations(job,lookup),residenceStatements=mandatoryWorksiteResidence(job.description),statement=residenceStatements.find(row=>row.qualifiedContext&&nativeCountryName(row.countryLabel)==='India')?.statement||null
  const suppliedCountryFields=[job.country,job.country_code,job.addressCountry].filter(value=>value!=null&&value!=='')
  const countries=[...structured.locations.map(row=>nativeLocationCountryName(row.label)),...suppliedCountryFields.map(nativeCountryName),nativeLocationCountryName(headerLocation),/\b(?:PAN India|anywhere in India)\b/i.test(headerLocation||'')?'India':null].filter(Boolean)
  if(statement&&countries.some(country=>country!=='India'))throw Object.assign(Error('UHP mandatory residence/native country contradiction'),{abortRetries:true})
  if(statement&&residenceStatements.some(row=>nativeCountryName(row.countryLabel)!=='India'))throw Object.assign(Error('UHP mandatory residence country statement contradiction'),{abortRetries:true})
  const boundRole=Boolean(job.id&&normalizeWhitespace(job.title)&&job.slug&&job.apply_url==='https://uhptechnologies.greythr.com/hire/jobs/'+job.slug)
  const residenceQualified=Boolean(statement&&boundRole&&!structured.locations.length&&!headerLocation&&suppliedCountryFields.every(value=>nativeCountryName(value)==='India'))
  if(residenceQualified)countries.push('India')
  const location=structured.locations.length?structured.locations.map(row=>row.label).join(', '):headerLocation||(residenceQualified?'India':null)
  if(new Set(countries).size>1)throw Object.assign(Error('UHP native country/location contradiction'),{abortRetries:true})
  const published=normalizeWhitespace(job.published_on_career_page)
  if(published){const match=published.match(/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/);if(!match||!Number.isFinite(Date.parse(published))||new Date(match[1]).toISOString().slice(0,10)!==match[1]||Number(match[2])>23||Number(match[3])>59||Number(match[4])>59)throw Object.assign(Error('UHP invalid native publication date/timestamp'),{abortRetries:true})}

  return {
    title: normalizeWhitespace(job?.title),
    company: 'UHP Technologies Pvt Ltd',
    department: null,
    location,
    city: null,
    country: countries[0]||null,
    jobId: normalizeWhitespace(job?.id),
    requisitionId: normalizeWhitespace(job?.req_id),
    sourceUrl: normalizeWhitespace(job?.apply_url),
    applyUrl: normalizeWhitespace(job?.apply_url),
    employmentType: normalizeWhitespace(job?.job_type),
    experienceRequired: extractExperienceRequired(job),
    minimumQualification: extractQualification(activeDescription),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job?.published_on_career_page),
    closingDate: null,
    jobDescription: description,
    remoteStatus: extractRemoteStatus({...job,description:activeDescription}, location),
    rawNativeLocationEvidence:{locationIds:structured.ids,locations:structured.locations,workplaceHeader:headerLocation,allNativeLocationHeaders:toLines(activeDescription).filter(line=>/^(?:(?:Job|Work)\s+)?Location\s*:/i.test(line)),suppliedCountryFields,nativeRemoteFlag:job.is_remote,remoteLocationLabel:job.is_remote&&!structured.locations.length?'Anywhere':null,countryQualified:Boolean(countries[0]),mandatoryWorksiteResidence:statement?{statement,allNativeResidenceStatements:residenceStatements,qualified:residenceQualified,scope:'country-only',cityQualified:false,proof:'active role-owned mandatory customer-worksite residence; no travel-only or company prose'}:null,withinCountryLocationAgreementQualified:false},
    rawNativeRoleEvidence:{identityQualified:true,createdAt:job.created_at,publishedOnCareerPage:job.published_on_career_page,descriptionHtml:job.description,applicationSubmissionQualified:false},
  }
}

const fetchNativeText = async (url,{signal,method='GET',body}={}) => {
 const request=new URL(url),surface=UHP_CAREERS_URL
 const fail=(message,fields={})=>{throw Object.assign(Error('UHP Technologies native input: '+message),{abortRetries:true,...fields,inventoryEvidence:{status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null}})}
 signal?.throwIfAborted()
 let response;try{response=await fetch(url,{method,body:method==='POST'?JSON.stringify(body??{}):undefined,headers:{'User-Agent':USER_AGENT,...(method==='POST'?{'Content-Type':'application/json'}:{}),Accept:'text/html,application/javascript,application/json;q=0.9,*/*;q=0.8'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})}catch(error){if(signal?.aborted)throw signal.reason;fail(error.message,{cause:error})}
 if(!response.ok){await response.body?.cancel();fail('HTTP '+response.status,{status:response.status,code:[401,403].includes(response.status)?'access_denied':'native_unavailable',finalUrl:response.url})}
 const final=new URL(response.url||url),samePath=final.pathname.replace(/\/$/,'')===request.pathname.replace(/\/$/,'')
 if(final.origin!==request.origin||!samePath||final.search!==request.search){await response.body?.cancel();fail('unexpected native redirect',{status:response.status,finalUrl:response.url})}
 const responseBody=await response.text();signal?.throwIfAborted();if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden)\s*<\/title>|<Code>\s*AccessDenied\s*<\/Code>/i.test(responseBody))fail('native access denial returned HTTP200',{status:response.status,code:'access_denied',finalUrl:response.url});return responseBody
}

const defaultFetchText=(url,options)=>fetchNativeText(url,options)
const defaultFetchJson=async(url,options)=>JSON.parse(await fetchNativeText(url,options))

export const createUhpTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, signal } = {}) {
    const uhpCareersHtml = await fetchText(UHP_CAREERS_URL,{signal})
    if (!hasUhpCareersSignal(uhpCareersHtml)) {
      throw new Error('The official UHP Technologies careers surface changed; refusing to scrape unverified jobs')
    }

    const kasCareersHtml = await fetchText(KAS_CAREERS_URL,{signal})
    if (!hasKasGroupHandoffSignal(kasCareersHtml)) {
      throw new Error('The official KAS Group handoff surface changed; refusing to scrape unverified jobs')
    }

    const companyDetails = await fetchJson(COMPANY_DETAILS_URL, { method: 'GET',...(signal?{signal}:{}) })
    if (!hasCompanyDetailsSignal(companyDetails)) {
      throw new Error('The official GreytHR company details no longer match UHP Technologies Pvt Ltd')
    }

    const payload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      body: {},
      ...(signal?{signal}:{}),
    })

    if(!Array.isArray(payload?.data)||!payload.data.length)throw Object.assign(Error('UHP native published role inventory is missing/unqualified'),{abortRetries:true})
    const rawJobs=payload.data,seen=new Set()
    for(const job of rawJobs){
     if(!job.id||seen.has(job.id)||!normalizeWhitespace(job.title)||!job.slug||job.apply_url!=='https://uhptechnologies.greythr.com/hire/jobs/'+job.slug)throw Object.assign(Error('UHP native role identity/application contradiction'),{abortRetries:true})
     seen.add(job.id)
    }
    const hasLocationIds=rawJobs.some(job=>Array.isArray(job.locations)&&job.locations.length),lookup=hasLocationIds?await fetchJson(LOCATION_LOOKUP_URL,{method:'GET',...(signal?{signal}:{})}):null
    const mappedJobs = rawJobs
      .map(job=>mapNativeUhpJob(job,lookup))
      .filter((job) => job.title && job.applyUrl)

    const selectedJobs = maxJobs ? mappedJobs.slice(0, maxJobs) : mappedJobs

    const result=selectedJobs.map((job) => ({
      ...job,
      source: 'uhptechnologiespvtltd',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
    return finishNativeCollection(result,{observedListingCount:rawJobs.length,pagesFetched:hasLocationIds?5:4,structuredLocationLookup:hasLocationIds?LOCATION_LOOKUP_URL:null,maxJobsApplied:Boolean(maxJobs&&mappedJobs.length>maxJobs)})
  },
})

const finishNativeCollection=(jobs,{observedListingCount=jobs.length,pagesFetched=1,now=()=>new Date().toISOString(),...extra}={})=>{
 const failures=jobs.filter(j=>!j.jobDescription||j.rawNativeRoleEvidence?.identityQualified===false).map(j=>({stage:'native-detail',nativeRoleId:j.jobId??j.sourceUrl,kind:j.rawNativeRoleEvidence?.identityQualified===false?'identity-conflict':'missing-content'}))
 const audit={source:'uhptechnologiespvtltd',observedListingCount,candidateDetails:observedListingCount,extractedDetailJobs:jobs.length-failures.length,excludedDetailJobs:0,failures,reportedTotal:null,indiaFacetCount:null,listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,observedMissingWorkplaces:jobs.filter(j=>!j.location).length,observedUnknownCountries:jobs.filter(j=>!j.country).length,rawProvenanceLimit:'Observed native rows only; employer-wide scope, exact India count, closing inventory and active application submission remain unqualified',...extra}
 for(const job of jobs){job.sourceListingComplete=false;job.sourceDetailComplete=Boolean(job.jobDescription)&&job.rawNativeRoleEvidence?.identityQualified!==false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:UHP_CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'observed-native-subset-with-unqualified-employer-scope'})
}

export const run = async (options = {}) => createUhpTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running UHP Technologies Pvt Ltd scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'uhptechnologiespvtltd')
    console.log('DB result:', result)
    process.exit(0)
  }
}
