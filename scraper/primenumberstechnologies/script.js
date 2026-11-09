import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {recruitmentJobPostings} from '../../scraper-support/utils/verifiedRecruitment.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'primenumberstechnologies'
export const COMPANY = 'Primenumbers Technologies Private Limited'
export const CAREERS_URL = 'https://primenumbers.in/careers/'

const SITE_ORIGIN = 'https://primenumbers.in'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&middot;/gi, '|')
  .replace(/&#8211;|&ndash;/gi, '–')
  .replace(/&#8212;|&mdash;/gi, '—')
  .replace(/&#8216;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\u00c2?\u00b7/g, '|')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const decodedValue = decodeHtml(value)
  if (!decodedValue) return null

  try {
    return new URL(decodedValue, baseUrl).toString()
  } catch {
    return null
  }
}

const extractText = (pattern, html) => stripTags(pattern.exec(String(html ?? ''))?.[1] ?? null)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^full[\s_-]*time$/i.test(normalized) || /^FULL_TIME$/i.test(normalized)) {
    return 'Full Time'
  }

  if (/^part[\s_-]*time$/i.test(normalized) || /^PART_TIME$/i.test(normalized)) {
    return 'Part Time'
  }

  if (/^intern(?:ship)?$/i.test(normalized) || /^INTERN$/i.test(normalized)) {
    return 'Internship'
  }

  if (/^contract$/i.test(normalized)) {
    return 'Contract'
  }

  return normalized
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase()
  if (!normalized) return null

  if (/\bbengaluru\b|\bbangalore\b/.test(normalized)) return 'Bengaluru'
  if (/\bhyderabad\b/.test(normalized)) return 'Hyderabad'
  if (/\bchennai\b/.test(normalized)) return 'Chennai'
  if (/\bmumbai\b/.test(normalized)) return 'Mumbai'
  if (/\bdelhi\b/.test(normalized)) return 'Delhi'

  return null
}

const normalizeCountry = (value) => {
  const labels=typeof value==='object'?[value?.name,value?.alpha2Code,value?.identifier]:[value]
  const countries=[...new Set(labels.map(nativeCountryName).filter(Boolean))]
  return countries.length===1?countries[0]:null
}

const validNativeDate = value => {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))?$/.test(value)
    ||!Number.isFinite(Date.parse(value)))return false
  return new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10)
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const extractJobPosting = html => {
  const postings=recruitmentJobPostings(readNativeDocument(html))
  if(postings.length>1)throw Error('Ambiguous Primenumbers JobPosting declarations')
  return postings[0]||null
}

const extractSectionLists = (descriptionHtml) => {
  const sections = []

  for (const match of String(descriptionHtml ?? '').matchAll(
    /<h3\b[^>]*>\s*([^<]+?)\s*<\/h3>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/gi,
  )) {
    const label = stripTags(match[1])
    const items = [...match[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((item) => stripTags(item[1]))
      .filter(Boolean)

    if (label && items.length > 0) {
      sections.push({ label, items })
    }
  }

  return sections
}

const buildJobDescription = (descriptionHtml) => {
  const summary = stripTags(String(descriptionHtml ?? '').split(/<h3\b/i)[0])
  const sections = extractSectionLists(descriptionHtml)
  const sectionText = sections
    .map((section) => `${section.label}: ${section.items.join(' ')}`)
    .join(' ')

  return normalizeWhitespace([summary, sectionText].filter(Boolean).join(' '))
}

const extractRequiredSkills = (descriptionHtml) => {
  const sections = extractSectionLists(descriptionHtml)
  const preferredSection = sections.find((section) => /requirements|skills/i.test(section.label))
    || sections.find((section) => /responsibilities/i.test(section.label))

  if (preferredSection) {
    return preferredSection.items
  }

  return [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const patterns = [
    /\bMinimum\s+\d+\+?\s*years?\s+of\s+experience[^.]*\.?/i,
    /\b\d+\s*[–-]\s*\d+\s*years?\s+of\s+experience[^.]*\.?/i,
    /\b\d+\+?\s*years?\s+of\s+experience[^.]*\.?/i,
    /\b\d+\s*[–-]\s*\d+\s*years?\s+experience\.?/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match) return normalizeWhitespace(match[0])
  }

  return null
}

const extractApplyUrl = html => {
  const doc=readNativeDocument(html),urls=[]
  for(const node of doc.nodes(n=>n.tag==='a'&&n.attrs.href)){
    let url
    try{url=new URL(node.attrs.href,SITE_ORIGIN)}catch{continue}
    if(url.origin===SITE_ORIGIN&&url.pathname==='/apply.html'&&!url.username&&!url.password&&!url.hash
      &&url.searchParams.getAll('t').length===1&&url.searchParams.get('t')&&url.searchParams.getAll('role').length===1
      &&[...url.searchParams.keys()].every(name=>['t','role'].includes(name)))urls.push(url.href)
  }
  return new Set(urls).size===1?urls[0]:null
}

const isOfficialDetailUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === SITE_ORIGIN && !url.username && !url.password && !url.search && !url.hash
      && /^\/careers\/[a-z0-9]+\/$/i.test(url.pathname)
  } catch {
    return false
  }
}

export const hasOfficialCareersIndexSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasCurrentBrandSurface = /<title>\s*Open Roles[\s\S]*Careers at primenumbers\.in\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/primenumbers\.in\/careers\/["']/i.test(page)
    && /Open roles at primenumbers\.in\./i.test(normalized)
    && /All roles onsite in Indiranagar,\s*Bengaluru unless noted\./i.test(normalized)
    && /href=["']\/careers\/[a-z0-9]+\/["']/i.test(page)

  if (hasCurrentBrandSurface) return true

  return /<title>\s*Open Roles\s*(?:—|&#8212;|&mdash;|-)\s*Careers at Primenumbers\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/primenumbers\.in\/careers\/["']/i.test(page)
    && /Open roles at Primenumbers\./i.test(normalized)
    && /All roles onsite in Indiranagar,\s*Bengaluru unless noted\./i.test(normalized)
    && /Primenumbers Technologies Private Limited/i.test(page)
    && /href=["']\/careers\/[a-z0-9]+\/["']/i.test(page)
}

export const extractRoleListings = (html) => {
  if (!hasOfficialCareersIndexSignal(html)) {
    throw new Error('verified Primenumbers careers index no longer matches the trusted first-party public jobs surface')
  }

  const jobs = []
  const seen = new Set()

  const document=readNativeDocument(html)
  for (const anchor of document.nodes(node=>node.tag==='a'&&document.hasClass(node,'pn-role--link')&&node.attrs.href)) {
    const sourceUrl = toAbsoluteUrl(anchor.attrs.href, CAREERS_URL)
    if (!isOfficialDetailUrl(sourceUrl) || seen.has(sourceUrl)) continue

    const locationWithDepartment = normalizeWhitespace(document.text(document.nodes(node=>document.hasClass(node,'pn-role-loc'),anchor)[0]))
    const title = normalizeWhitespace(document.text(document.nodes(node=>node.tag==='h2',anchor)[0]))
    const teaser = normalizeWhitespace(document.text(document.nodes(node=>node.tag==='p',anchor)[0]))
    const chips = document.nodes(node=>node.tag==='span'&&document.hasClass(node,'pn-chip'),anchor)
      .map(chip => normalizeWhitespace(document.text(chip)))
      .filter(Boolean)

    if (!title || !locationWithDepartment || !teaser) continue

    const [location, department] = locationWithDepartment
      .split('|')
      .map((value) => normalizeWhitespace(value))

    const employmentType = chips
      .map((chip) => normalizeEmploymentType(chip))
      .find((value) => value && /Full Time|Part Time|Internship|Contract/i.test(value))
      || null

    seen.add(sourceUrl)
    jobs.push({
      title,
      location,
      department: department || null,
      employmentType,
      sourceUrl,
      teaser,
    })
  }

  if (jobs.length === 0) {
    throw new Error('verified Primenumbers careers index changed or no trusted public role cards remain')
  }

  return jobs
}

export const hasOfficialJobDetailSignal = (html, sourceUrl) => {
  const page = String(html ?? '')
  const jobPosting = extractJobPosting(page)
  const applyUrl = extractApplyUrl(page)
  const canonicalPattern = new RegExp(
    `<link[^>]+rel=["']canonical["'][^>]+href=["']${escapeRegex(sourceUrl)}["']`,
    'i',
  )
  const organizationName = normalizeWhitespace(jobPosting?.hiringOrganization?.name)
  const organizationLegalName = normalizeWhitespace(jobPosting?.hiringOrganization?.legalName)
  const hasTrustedOrganization = organizationLegalName ? organizationLegalName === COMPANY : organizationName === COMPANY
  if(!hasTrustedOrganization)return false

  if (
    canonicalPattern.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["'](?:Primenumbers|primenumbers\.in)["']/i.test(page)
    && Boolean(jobPosting)
    && hasTrustedOrganization
    && normalizeWhitespace(jobPosting?.hiringOrganization?.sameAs) === SITE_ORIGIN
    && normalizeWhitespace(jobPosting?.url) === sourceUrl
    && normalizeWhitespace(jobPosting?.identifier?.value) !== null
    && Boolean(applyUrl)
    && /^https:\/\/primenumbers\.in\/apply\.html\?/i.test(applyUrl)
  ) {
    return true
  }

  return canonicalPattern.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Primenumbers["']/i.test(page)
    && Boolean(jobPosting)
    && normalizeWhitespace(jobPosting?.hiringOrganization?.name) === COMPANY
    && normalizeWhitespace(jobPosting?.hiringOrganization?.sameAs) === SITE_ORIGIN
    && normalizeWhitespace(jobPosting?.url) === sourceUrl
    && normalizeWhitespace(jobPosting?.identifier?.value) !== null
    && Boolean(applyUrl)
    && /^https:\/\/primenumbers\.in\/apply\.html\?/i.test(applyUrl)
}

export const extractJobDetail = (html, listing = {}) => {
  const jobPosting = extractJobPosting(html)
  if (!jobPosting) {
    throw new Error('missing trusted Primenumbers JobPosting payload')
  }

  const applyUrl = extractApplyUrl(html)
  if (!applyUrl) {
    throw new Error('missing trusted Primenumbers apply link')
  }

  const address = Array.isArray(jobPosting.jobLocation)
    ? jobPosting.jobLocation[0]?.address
    : jobPosting.jobLocation?.address
  const location = normalizeWhitespace(address?.addressLocality) || listing.location || null
  const descriptionHtml = jobPosting.description || ''
  const jobDescription = buildJobDescription(descriptionHtml)
  const jobId = normalizeWhitespace(jobPosting.identifier?.value)

  return {
    title: normalizeWhitespace(jobPosting.title) || listing.title || null,
    company: COMPANY,
    department: listing.department || null,
    location,
    city: deriveCity(location),
    country: normalizeCountry(address?.addressCountry),
    jobId,
    requisitionId: jobId,
    sourceUrl: listing.sourceUrl || normalizeWhitespace(jobPosting.url) || null,
    applyUrl,
    employmentType: normalizeEmploymentType(jobPosting.employmentType) || listing.employmentType || null,
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeDate(jobPosting.datePosted),
    closingDate: null,
    jobDescription,
  }
}

const defaultFetchText = async (url,{signal}={}) => {
  const response=await fetch(url,{signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)]),
    redirect:'manual',credentials:'omit',headers:{'User-Agent':USER_AGENT,Accept:'text/html'}})
  if(response.status!==200||response.url!==url)throw Error('Primenumbers native HTTP '+response.status+' or role URL changed')
  if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||''))throw Error('Primenumbers native content type changed')
  const reader=response.body?.getReader(),chunks=[];let size=0
  if(!reader)throw Error('Primenumbers native body unavailable')
  try{for(;;){const next=await reader.read();signal?.throwIfAborted();if(next.done)break
    size+=next.value.byteLength;if(size>2e6)throw Error('Primenumbers native body bound');chunks.push(Buffer.from(next.value))}
  }catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
  return Buffer.concat(chunks).toString('utf8')
}

export const createPrimenumbersTechnologiesScraper = () => ({
  async run({fetchText=defaultFetchText,now=()=>new Date().toISOString(),signal:callerSignal,sourceTimeoutMs=120000,maxJobs=Infinity}={}) {
    if(!Number.isSafeInteger(sourceTimeoutMs)||sourceTimeoutMs<=0||sourceTimeoutMs>180000
      ||maxJobs!==Infinity&&(!Number.isSafeInteger(maxJobs)||maxJobs<0))throw Error('Invalid Primenumbers native limits')
    const signal=AbortSignal.any([...(callerSignal?[callerSignal]:[]),AbortSignal.timeout(sourceTimeoutMs)])
    signal.throwIfAborted()
    const observedAt=typeof now==='function'?now():now
    if(!Number.isFinite(Date.parse(observedAt)))throw Error('Invalid Primenumbers observation time')
    const read=async url=>{signal.throwIfAborted();const html=await fetchText(url,{signal});signal.throwIfAborted()
      if(typeof html!=='string'||Buffer.byteLength(html)>2e6)throw Error('Primenumbers native body bound');return html}
    const careersHtml = await read(CAREERS_URL)
    const listings = extractRoleListings(careersHtml)
    const jobs = [],failures=[],held=[]

    for (const listing of listings.slice(0,maxJobs)) {
      try{
      const detailHtml = await read(listing.sourceUrl)
      if (!hasOfficialJobDetailSignal(detailHtml, listing.sourceUrl)) {
        throw new Error('verified Primenumbers job detail no longer matches the trusted first-party application surface')
      }

      const detail = extractJobDetail(detailHtml, listing)
      const native=extractJobPosting(detailHtml),document=readNativeDocument(detailHtml)
      const identifier=new URL(listing.sourceUrl).pathname.split('/').filter(Boolean).at(-1)
      const canonical=document.nodes(node=>node.tag==='link'&&(node.attrs.rel||'').split(/\s+/).includes('canonical'))
      if(native.identifier?.value!==identifier||native.title!==listing.title||native.title!==detail.title
        ||canonical.length!==1||canonical[0].attrs.href!==listing.sourceUrl
        ||!document.nodes(node=>node.tag==='h1').some(node=>document.text(node)===native.title)
        ||new URL(detail.applyUrl).searchParams.get('role')!==native.title)
        throw Error('Primenumbers native listing/detail identity changed')
      const activeDescription=extractActiveDescription(native.description)
      if(!activeDescription||activeDescription.length<100)throw Error('Primenumbers native full description unavailable')
      const posted=native.datePosted||null,closing=native.validThrough||null
      if([posted,closing].some(value=>value&&!validNativeDate(value))
        ||posted&&Date.parse(posted)>Date.parse(observedAt))throw Error('Primenumbers native publication date unavailable or in the future')
      if(closing&&Date.parse(closing)<=Date.parse(observedAt)){held.push({id:identifier,reason:'native-role-closed',nativeSourceRecord:native});continue}
      const places=(Array.isArray(native.jobLocation)?native.jobLocation:[native.jobLocation]).map(place=>place?.address)
      const countries=places.map(place=>normalizeCountry(place?.addressCountry)),unique=new Set(countries)
      const nativeCountry=countries.length&&countries.every(Boolean)&&unique.size===1?countries[0]:null
      const missingCountry=!nativeCountry
      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        country:nativeCountry,
        ...(missingCountry?{city:null,location:null,locations:[]}:{}),
        nativeSourceRecord:native,nativeHiringOrganization:native.hiringOrganization,nativeCountryLocations:native.jobLocation,
        sourceDescription:native.description,
        nativeFullDescriptionText:activeDescription,
        postingDate:posted,postedAt:posted,closingDate:closing,
        nativePostingDate:posted,firstEverPostedAt:null,
        postingDatePrecision:posted?(/^\d{4}-\d{2}-\d{2}$/.test(posted)?'calendar-date':'native-timestamp'):null,
        sourcePostingDateIsExact:Boolean(posted&&!/^\d{4}-\d{2}-\d{2}$/.test(posted)),
        sourceDetailComplete:!missingCountry,
        ...(missingCountry?{sourceDetailFailureKind:unique.size>1?'native-country-conflict':'native-country-unavailable'}:{}),
        sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,
        scrapedAt: observedAt,
      })
      }catch(error){signal.throwIfAborted();if(!jobs.length)throw error
        failures.push({url:listing.sourceUrl,message:error.message});break}
    }

    signal.throwIfAborted()
    const audit={observedNativeCards:listings.length,returnedRecords:jobs.length,failures,heldNativeRoles:held,
      listingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    for(const job of jobs)job.sourceNativeCollectionAudit=audit
    return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,
      reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
      reason:failures.length?'native-detail-failure-retains-earlier-roles':'observed-native-cards-without-complete-company-inventory-proof'})
  },
})

export const run = async (options = {}) => createPrimenumbersTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
