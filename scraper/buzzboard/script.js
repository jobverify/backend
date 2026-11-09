import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE = 'buzzboard'
export const COMPANY = 'BuzzBoard'
export const OFFICIAL_BRAND = 'BuzzBoard'
export const VERIFIED_ON = '2026-08-01'
export const CAREERS_URL = 'https://www.buzzboard.ai/careers/'
export const BOARD_URL = 'https://buzzboard.applytojob.com/apply'
export const DISPOSITION = 'verified-first-party-careers-page-plus-public-jazzhr-board'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://www.buzzboard.ai/careers/ was the live first-party BuzzBoard careers surface, that it still handed applicants to the public JazzHR board at https://buzzboard.applytojob.com/apply, and that the first-party careers page publicly exposed current openings including Associate Product Manager / Product Manager, Software Engineer (Node JS Developer), and Test Engineer (Automation). This scraper validates those verified surfaces and returns the public BuzzBoard openings.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const BOARD_HOST = new URL(BOARD_URL).hostname
const BOARD_PATH = '/apply'
const GENERIC_CONTEXT_PATTERNS = [
  /\bOpen Positions\b/i,
  /\bCurrent opportunities\b/i,
  /\bJoin our team\b/i,
  /\bReady to innovate with us\?/i,
  /\bApply\b/i,
]
const LOCATION_PATTERN =
  /\b(?:remote|india|bangalore|bengaluru|hyderabad|chennai|mumbai|pune|gurugram|gurgaon|noida|delhi|kolkata|ahmedabad)\b/i
const EMPLOYMENT_TYPE_PATTERN = /\b(full[\s-]*time|part[\s-]*time|contract|internship)\b/i

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

const stripToLines = (value = '') =>
  decodeEntities(String(value))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|section|article|ul|ol|h[1-6]|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const toAbsoluteBoardUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    const url = new URL(value, baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== BOARD_HOST) return null
    if (!normalizePathname(url.pathname).startsWith(BOARD_PATH)) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

const extractJobId = (url) => {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const applyIndex = segments.indexOf('apply')

    if (applyIndex < 0) return null
    if (segments[applyIndex + 1] === 'jobs' && segments[applyIndex + 2] === 'details') {
      return segments[applyIndex + 3] || null
    }

    return segments[applyIndex + 1] || null
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const extractEmploymentTypeFromLine = (value = '') =>
  normalizeEmploymentType(String(value).match(EMPLOYMENT_TYPE_PATTERN)?.[1] || null)

const extractLocationFromLine = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\b(?:CTC|Notice Period|headquarters|head office|HQ)\b/i.test(normalized)) return null
  const location=normalized.replace(/(?:\s*[-|/\u2022\u00b7]\s*)?(?:full[\s-]*time|part[\s-]*time|contract|internship)\b.*$/i,'').replace(/\s*[-|/\u2022\u00b7]\s*$/,'').trim()
  if (LOCATION_PATTERN.test(location)) return location || null
  return null
}

const extractCityFromLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^remote\b|^india$/i.test(normalized)) return null
  return normalizeWhitespace(normalized.split(',')[0]) || null
}

const getRemoteStatus = (value) => (/^remote\b/i.test(value || '') ? 'Remote' : null)

const isGenericContextLine = (value = '') =>
  GENERIC_CONTEXT_PATTERNS.some((pattern) => pattern.test(value))

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html)
  const text = normalizeText(page)

  return /<title[^>]*>\s*Careers at BuzzBoard:\s*The Future of Autonomous Marketing Services\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.buzzboard\.ai\/careers\/["']/i.test(page)
    && /\bBuzzBoard\b/i.test(text)
    && /\bWhy work at BuzzBoard\b/i.test(text)
    && /\bOpen Positions\b/i.test(text)
    && /\bView open positions\b/i.test(text)
    && /\bautonomous digital marketing\b/i.test(text)
}

export const extractOfficialApplyUrls = (html = '') => {
  const urls = []
  const seen = new Set()

  for (const match of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = toAbsoluteBoardUrl(match[1], CAREERS_URL)
    const text = normalizeText(match[2])

    if (!url || !/\bapply\b/i.test(text || '')) continue
    if (seen.has(url)) continue

    seen.add(url)
    urls.push(url)
  }

  return urls
}

export const hasUnexpectedOfficialApplyUrl = (html = '') => {
  for (const match of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = normalizeText(match[2])
    if (!/\bapply\b/i.test(text || '')) continue

    if (!toAbsoluteBoardUrl(match[1], CAREERS_URL)) {
      return true
    }
  }

  return false
}

export const hasVerifiedBoardSignal = (html = '') => {
  const page = String(html)
  const text = normalizeText(page)

  return /<title[^>]*>\s*BuzzBoard\s*-\s*Career Page\s*<\/title>/i.test(page)
    && /\bThanks for visiting our Career Page\b/i.test(text)
    && /\bCurrent Openings\b/i.test(text)
    && /\bView Our Website\b/i.test(text)
    && (
      /\bPowered by JazzHR\b/i.test(text)
      || (/\bPowered by\b/i.test(text) && /\binfo\.jazzhr\.com\b/i.test(page))
    )
    && /https?:\/\/(?:www\.)?buzzboard\.(?:ai|com)\b/i.test(page)
}

export const hasGenericBoardListingSignal = (html = '') => {
  const page = String(html)
  const text = normalizeText(page)

  return /<title[^>]*>\s*JazzHR\s*&raquo;\s*Job Listings\s*<\/title>/i.test(page)
    && /\bCurrent Openings\b/i.test(text)
}

export const extractVerifiedBoardJobIds = (html = '') => {
  const jobIds = new Set()

  for (const match of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = toAbsoluteBoardUrl(match[1], BOARD_URL)
    const text = normalizeText(match[2])
    const jobId = extractJobId(url)

    if (!url || !jobId) continue
    if (/^view all jobs$/i.test(text || '')) continue

    jobIds.add(jobId)
  }

  return [...jobIds]
}

const buildListingContext = (lines = []) => {
  let location = null
  let employmentType = null

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    location ||= extractLocationFromLine(line)
    employmentType ||= extractEmploymentTypeFromLine(line)
  }

  let title = null
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (isGenericContextLine(line)) continue
    if (extractLocationFromLine(line)) continue
    if (extractEmploymentTypeFromLine(line)) continue

    title = normalizeWhitespace(line)
    break
  }

  return {
    title,
    location,
    employmentType,
  }
}

export const extractOfficialOpenings = (html = '') => {
  const jobs = []
  const seen = new Set()
  const document=readNativeDocument(html),parents=new Map(),root=document.nodes(node=>node.tag==='root')[0]
  const visit=node=>{for(const child of node.children||[])if(typeof child!=='string'){parents.set(child,node);visit(child)}}
  visit(root)
  const descendants=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...(node.children||[]).filter(child=>typeof child!=='string').flatMap(child=>descendants(child,predicate))]
  const hasClass=(node,name)=>String(node.attrs.class||'').split(/\s+/).includes(name)
  const visible=readVisibleNativeDocument(html,{strict:true})
  const visibleUrls=new Set(visible.nodes(node=>node.tag==='a'&&node.attrs.href).map(node=>toAbsoluteBoardUrl(node.attrs.href,CAREERS_URL)).filter(Boolean))
  for (const anchor of document.nodes(node=>node.tag==='a'&&node.attrs.href)) {
    const applyUrl = toAbsoluteBoardUrl(anchor.attrs.href, CAREERS_URL)
    const anchorText = document.text(anchor)
    if (!applyUrl || !/\bapply\b/i.test(anchorText || '')) continue
    const jobId = extractJobId(applyUrl)
    if (!jobId || seen.has(jobId)) continue
    // Each observation belongs to its own card/article. Corporate HQ text and
    // neighbouring jobs cannot establish this role's title or country.
    let card=anchor
    while(card&&card.tag!=='article'&&!hasClass(card,'job-card'))card=parents.get(card)
    if(!card)continue
    const dedicated=descendants(card,node=>hasClass(node,'job-title'))
    const headings=dedicated.length?dedicated:descendants(card,node=>/^h[1-4]$/.test(node.tag))
    if(headings.length!==1)continue
    const title=normalizeWhitespace(document.text(headings[0]))
    const details=descendants(card,node=>hasClass(node,'job-details'))
    const paragraphs=descendants(card,node=>node.tag==='p')
    const locationLine=document.text(details[0]||paragraphs[0]||{inert:true})
    const location=extractLocationFromLine(locationLine)
    const employmentType=extractEmploymentTypeFromLine(locationLine)
    if(!title)continue
    seen.add(jobId)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCityFromLocation(location),
      // Closed affirmative grammar only. An unreviewed phrase (including an
      // exclusion ending in India) remains raw location text, not country proof.
      country: /^(?:India|Remote,\s*India)$/i.test(location || '') ? 'India' : null,
      jobId,
      requisitionId: null,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: getRemoteStatus(location),
      sourcePublisher: COMPANY,
      legalHiringEmployer: null,
      sourceNativeLocationLine: locationLine||null,
      sourceNativeListingContext: document.text(card),
      sourceVisibilityVerified: visibleUrls.has(applyUrl),
      sourceDetailComplete: false,
      sourceListingComplete: false,
      sourceScopeComplete: false,
      lifecycleCleanupAllowed: false,
    })
  }

  return jobs
}

export const hasVerifiedJobDetailSignal = (html = '', listing = {}) => {
  const page = String(html)
  const text = normalizeText(page)
  const title = normalizeWhitespace(listing?.title)

  return /\bBuzzBoard\b/i.test(text)
    && /\bApply for this position\b|\bApply Now\b/i.test(text)
    && /\bPowered by JazzHR\b/i.test(text)
    && (!title || new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text))
}

const buildJobDescription = (html = '') => {
  const page = String(html)
  const match = page.match(
    /(?:About Us:|Job Description:|Job Summary:|Role Summary)([\s\S]*?)(?:Share Apply|Apply for this position|Apply Now)/i,
  )

  const normalized = normalizeText(match?.[1] || '')
  return normalizeWhitespace(
    normalized.split(
      /\b(?:Current|Expected)\s+(?:Annual\s+)?CTC\b|\bNotice Period\b|\bHuman Check\b/i,
    )[0],
  )
}

const extractExperienceRequired = (html = '') => {
  const text = normalizeText(html)

  return normalizeWhitespace(
    text.match(/\bExperience:\s*([0-9]+(?:\+)?\s*years?)/i)?.[1]
      || text.match(/\bMinimum\s+([0-9]+(?:\+)?\s*Years?)/i)?.[1]
      || null,
  )
}

export const extractJobDetail = (html = '', listing = {}) => {
  if (!hasVerifiedJobDetailSignal(html, listing)) {
    throw new Error(
      `BuzzBoard JazzHR detail page no longer matches the expected public contract: ${listing?.sourceUrl || 'unknown job'}`,
    )
  }

  return {
    company: COMPANY,
    location: listing.location,
    city: listing.city,
    country: listing.country ?? null,
    employmentType:
      extractEmploymentTypeFromLine(normalizeText(html))
      || listing.employmentType,
    experienceRequired: extractExperienceRequired(html) || listing.experienceRequired,
    jobDescription: buildJobDescription(html) || null,
    sourceNativeDetailHTML: html,
    sourceDetailComplete: false,
  }
}

const defaultFetchText = (url, {signal} = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
  signal,
})

const mergeListingWithDetail = (listing, detail = {}) => ({
  ...listing,
  ...Object.fromEntries(
    Object.entries(detail).filter(([, value]) => value != null),
  ),
})

export const createBuzzBoardScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal, onAudit=()=>{} } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL,{signal})
    signal?.throwIfAborted()
    const observations=extractOfficialOpenings(careersHtml)
    const audit={source:SOURCE,originalCareersHTML:careersHtml,observations:structuredClone(observations),unknownCountryRoleIds:observations.filter(row=>row.country===null).map(row=>row.jobId),
      originalBoardHTML:null,details:[],noNativeDetailProof:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,currentLiveQualification:false,noClosingProof:true,
      reasons:['role countries unresolved when not explicitly supplied','native board/detail/application criteria and current corporate scope unverified']}
    const emit=async stage=>{audit.stage=stage;await onAudit(structuredClone(audit));signal?.throwIfAborted()}
    await emit('careers-observations-unresolved')
    try {

    if (
      !hasOfficialCareersPageSignal(careersHtml)
      || extractOfficialApplyUrls(careersHtml).length === 0
      || hasUnexpectedOfficialApplyUrl(careersHtml)
    ) {
      throw new Error('BuzzBoard verified official careers page changed materially')
    }

    const boardHtml = await fetchText(BOARD_URL,{signal})
    signal?.throwIfAborted()
    audit.originalBoardHTML=boardHtml
    if (!hasVerifiedBoardSignal(boardHtml)) {
      throw new Error('BuzzBoard verified public JazzHR board changed materially')
    }

    const verifiedBoardJobIds = new Set(extractVerifiedBoardJobIds(boardHtml))
    const listings = observations
      .filter((listing) => verifiedBoardJobIds.size === 0 || verifiedBoardJobIds.has(listing.jobId))
    const selectedJobs = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedJobs) {
        signal?.throwIfAborted()
        const detailHtml = await fetchText(listing.sourceUrl,{signal})
        signal?.throwIfAborted()
        audit.details.push({jobId:listing.jobId,sourceUrl:listing.sourceUrl,originalHTML:detailHtml,fullCriteriaVerified:false})
        if (hasGenericBoardListingSignal(detailHtml)) {
          throw new Error('BuzzBoard native detail returned a generic listing instead of role criteria')
        }
        const job=mergeListingWithDetail(listing, extractJobDetail(detailHtml, listing))
        if(job.country==='India'&&job.sourceVisibilityVerified)jobs.push(job)
    }
    await emit('native-observations-retained-source-still-unresolved')
    const result=jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
    return attachInventoryEvidence(result,{status:'discovery-only',surface:CAREERS_URL,firstParty:false,listingComplete:false,pagesFetched:2+audit.details.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'buzzboard-country-board-details-and-source-scope-unresolved'})
    } catch(error) {
      audit.failure={name:error.name,message:error.message}
      await emit('native-verification-failed')
      throw error
    }
  },
})

export const run = async (options = {}) => createBuzzBoardScraper().run(options)
