import path from 'path'
import { fileURLToPath } from 'url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeText} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'

export const COMPANY_NAME = 'Ford Motor Pvt Ltd'
export const SOURCE = 'fordmotorpvtltd'
export const ATS_PLATFORM = 'talentbrew-radancy'
export const BASE_URL = 'https://www.careers.ford.com'
export const INDIA_FACET_ID = '1269750'
export const CAREER_PAGE_URL = `${BASE_URL}/search-jobs?acm=ALL&alrpm=${INDIA_FACET_ID}&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D`
export const RESULTS_GET_URL = `${BASE_URL}/search-jobs/results`
export const RESULTS_POST_URL = `${BASE_URL}/search-jobs/resultspost`

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const htmlToText = (value) => stripTags(value)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractAttribute = (html, name) => extractFirst(
  new RegExp(`\\b${name}="([^"]*)"`, 'i'),
  html,
)

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return normalized

  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'regular' || normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  if (normalized === 'contract') return 'Contract'
  return normalizeWhitespace(value)
}

const extractJsonLd = (html) => {
  const script = extractFirst(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,
    html,
  )
  if (!script) return null

  try {
    return JSON.parse(script)
  } catch {
    return null
  }
}

const getSectionKey = (label) => {
  const normalized = normalizeWhitespace(label)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'required skill' || normalized === 'required skills' || normalized === 'required qualifications') {
    return 'required'
  }
  if (normalized === 'preferred skill' || normalized === 'preferred skills' || normalized === 'preferred qualifications') {
    return 'preferred'
  }
  if (normalized === 'education') {
    return 'education'
  }
  return null
}

const addSectionMarkers = (html) => String(html ?? '').replace(
  /<(p|h[1-6]|strong)[^>]*>[\s\S]*?<\/\1>/gi,
  (block) => {
    const sectionKey = getSectionKey(stripTags(block))
    return sectionKey ? `[[SECTION:${sectionKey}]]` : block
  },
)

const extractSectionBlock = (html, sectionKey) => extractFirst(
  new RegExp(`\\[\\[SECTION:${sectionKey}\\]\\]([\\s\\S]*?)(?=\\[\\[SECTION:|$)`, 'i'),
  addSectionMarkers(html),
)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => htmlToText(match[1]))
  .filter(Boolean)

const extractPreferredQualification = (descriptionHtml) => {
  const items = extractListItems(extractSectionBlock(descriptionHtml, 'preferred'))
  if (items.length === 0) return null
  return items.join('; ')
}

const extractMinimumQualification = (descriptionHtml) => {
  const items = extractListItems(extractSectionBlock(descriptionHtml, 'education'))
  return items[0] || null
}

const extractRequiredSkills = (descriptionHtml) => extractListItems(
  extractSectionBlock(descriptionHtml, 'required'),
)

const extractExperienceRequired = (descriptionHtml) => {
  const descriptionText = htmlToText(descriptionHtml)
  const rangeMatch = descriptionText?.match(/(\d+\s*-\s*\d+\s*years)/i)
  if (rangeMatch) return normalizeWhitespace(rangeMatch[1])

  const plusMatch = descriptionText?.match(/(\d+\+?\s*years)/i)
  if (plusMatch) return normalizeWhitespace(plusMatch[1])

  return null
}

const extractResultsHtml = (payload) => {
  if (typeof payload === 'string') return payload
  if (payload && typeof payload === 'object') {
    return payload.results || payload.html || payload.data || ''
  }
  return ''
}

const extractSearchResultsListHtml = (payload) => {
  const html = extractResultsHtml(payload)
  const listStart = /<(?:section|div)\b[^>]*id="search-results-list"[^>]*>/i.exec(html)
  if (!listStart) return ''

  let endIndex = html.length
  const boundaryPatterns = [
    /<section\b[^>]*id="search-filters"[^>]*>/gi,
    /<div\b[^>]*class="[^"]*\bpartial\s+partial-2\b[^"]*"[^>]*>/gi,
  ]

  for (const pattern of boundaryPatterns) {
    pattern.lastIndex = listStart.index + listStart[0].length
    const boundary = pattern.exec(html)
    if (boundary && boundary.index < endIndex) {
      endIndex = boundary.index
    }
  }

  return html.slice(listStart.index, endIndex)
}

const defaultFetchText = async (url,options={}) => {
  const response = await fetch(url, {
    signal:options.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const url = new URL(CAREER_PAGE_URL)
  const normalizedPage = Math.max(1, Number(page) || 1)

  if (normalizedPage > 1) {
    url.searchParams.set('p', String(normalizedPage))
  }

  return url.toString()
}

export const buildResultsRequestBody = ({ page = 1 } = {}) => {
  const params = new URLSearchParams()
  params.set('page', String(Math.max(1, Number(page) || 1)))
  params.set('keyword', '')
  params.set('location', '')
  params.set('facet', INDIA_FACET_ID)
  return params.toString()
}

export const extractSearchResults = (payload) => {
  const section = extractSearchResultsListHtml(payload)
  if (!section) return []

  const toListing = ({ href, jobId, title, location }) => {
    const sourceUrl = toAbsoluteUrl(href)
    const normalizedJobId = normalizeWhitespace(jobId)
    const normalizedTitle = htmlToText(title)
    const normalizedLocation = htmlToText(location)

    if (!sourceUrl || !normalizedJobId || !normalizedTitle || !normalizedLocation || !/india/i.test(normalizedLocation)) {
      return null
    }

    return {
      title: normalizedTitle,
      company: COMPANY_NAME,
      department: null,
      location: normalizedLocation,
      city: extractCity(normalizedLocation),
      country: 'India',
      jobId: normalizedJobId,
      requisitionId: normalizedJobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  }

  const listings = [...section.matchAll(
    /<a href="([^"]+)" data-job-id="([^"]+)">\s*<h2>([\s\S]*?)<\/h2>\s*<span class="job-location">([\s\S]*?)<\/span>/gi,
  )]
    .map((match) => toListing({
      href: match[1],
      jobId: match[2],
      title: match[3],
      location: match[4],
    }))

  const currentMarkupListings = [...section.matchAll(
    /<a\b([^>]*\bclass="[^"]*\bsearch-results-list__job-link\b[^"]*"[^>]*)>([\s\S]*?)<\/a>([\s\S]*?)(?=<li\b[^>]*class="[^"]*\bsearch-results-list__item\b|<\/ul>\s*<\/div>|$)/gi,
  )]
    .map((match) => {
      const location = extractFirst(
        /<li\b[^>]*class="[^"]*\bjob-location\b[^"]*"[^>]*>([\s\S]*?)<\/li>/i,
        match[3],
      )

      return toListing({
        href: extractAttribute(match[1], 'href'),
        jobId: extractAttribute(match[1], 'data-job-id'),
        title: match[2],
        location,
      })
    })

  return [...listings, ...currentMarkupListings]
    .filter(Boolean)
    .filter((listing, index, allListings) => (
      allListings.findIndex((item) => item.jobId === listing.jobId) === index
    ))
}

export const extractPaginationSummary = (payload) => {
  const html = extractResultsHtml(payload)
  const currentPage = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-current-page="(\d+)"/i, html)) || '',
    10,
  )
  const totalPages = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-total-pages="(\d+)"/i, html)) || '',
    10,
  )
  const totalJobCount = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-total-job-results="(\d+)"/i, html)) || '',
    10,
  )

  const safeCurrentPage = Number.isFinite(currentPage) ? currentPage : null
  const safeTotalPages = Number.isFinite(totalPages) ? totalPages : null

  return {
    hasNext: Boolean(
      /<a class="next"/i.test(String(html))
      || (safeCurrentPage && safeTotalPages && safeCurrentPage < safeTotalPages)
    ),
    currentPage: safeCurrentPage,
    totalPages: safeTotalPages,
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const jsonLd = extractJsonLd(html)
  const descriptionHtml = jsonLd?.description || ''
  const location = normalizeWhitespace(
    extractFirst(/<p class="ajd_header__location">([\s\S]*?)<\/p>/i, html),
  ) || [
    jsonLd?.jobLocation?.[0]?.address?.addressLocality,
    jsonLd?.jobLocation?.[0]?.address?.addressCountry,
  ].filter(Boolean).join(', ') || listing.location || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<h2 class="ajd_section__heading ajd_job-details__heading heading-2">([\s\S]*?)<\/h2>/i, html),
    ) || normalizeWhitespace(jsonLd?.title) || listing.title || null,
    company: normalizeWhitespace(jsonLd?.hiringOrganization?.name) || COMPANY_NAME,
    department: null,
    location,
    city: jsonLd?.jobLocation?.[0]?.address?.addressLocality || extractCity(location),
    country: jsonLd?.jobLocation?.[0]?.address?.addressCountry || listing.country || 'India',
    jobId: normalizeWhitespace(
      extractFirst(/data-selector-name="jobdetails"[^>]*data-org-id="[^"]+"[^>]*data-job-id="([^"]+)"/i, html),
    ) || listing.jobId || null,
    requisitionId: normalizeWhitespace(
      extractFirst(/<meta name="job-ats-req-id" content="([^"]+)"/i, html),
    ) || normalizeWhitespace(jsonLd?.identifier) || listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || normalizeWhitespace(jsonLd?.url) || null,
    applyUrl: toAbsoluteUrl(
      extractFirst(/<meta name="search-job-apply-url" content="([^"]+)"/i, html),
    ) || toAbsoluteUrl(
      extractFirst(/<a[^>]+class="[^"]*job-apply[^"]*"[^>]+href="([^"]+)"/i, html),
    ) || listing.applyUrl || listing.sourceUrl || null,
    employmentType: normalizeEmploymentType(jsonLd?.employmentType),
    experienceRequired: extractExperienceRequired(descriptionHtml),
    minimumQualification: extractMinimumQualification(descriptionHtml),
    preferredQualification: extractPreferredQualification(descriptionHtml),
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeIsoDate(jsonLd?.datePosted) || null,
    closingDate: null,
    jobDescription: htmlToText(descriptionHtml),
    remoteStatus: null,
  }
}

export const createFordMotorPvtLtdScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenJobIds = new Set()
    const pages=[],signal=options.signal,unqualified=[],observedRoles=[]
    let currentLocale=false
    const failure=message=>Object.assign(new Error('Ford native '+message),{abortRetries:true,softFailure:true,lifecycleCleanupAllowed:false})
    const read=async url=>{signal?.throwIfAborted();const html=await fetchText(url,{signal});signal?.throwIfAborted();return html}
    const finish=async()=>{
      if(!currentLocale)return jobs
      for(const opening of pages){
        const html=await read(opening.url)
        if(JSON.stringify({listings:extractSearchResults(html),summary:extractPaginationSummary(html)})!==opening.fingerprint)throw failure('closing native listing changed')
      }
      for(const observation of observedRoles){
        const closing=extractJsonLd(await read(observation.sourceUrl))
        if(JSON.stringify(closing)!==JSON.stringify(observation.native))throw failure('closing native role criteria changed')
      }
      const complete=!!pages.length&&!pages.at(-1).summary.hasNext&&jobs.length===pages[0].summary.totalJobCount&&!unqualified.length
      for(const job of jobs)Object.assign(job,{sourceDetailComplete:true,sourceListingComplete:complete,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
      return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:complete,pagesFetched:pages.length*2,reportedTotal:pages[0]?.summary.totalJobCount??null,indiaFacetCount:jobs.length,verifiedAt:new Date().toISOString(),reason:'current-official-en-locale-India-facet-and-native-full-role-criteria;closing-listings-reconciled;whole-company-scope-unqualified;withheld-native-ids:'+unqualified.join(',')})
    }

    for (let page = 1; page <= maxPages; page += 1) {
      const url=buildSearchUrl({page})
      const listingHtml = await read(url)
      if(page===1)currentLocale=listingHtml.includes('data-ajax-post-url="/en/search-jobs/resultspost"')
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)
      if(currentLocale){
        if(!/Country:\s*India/.test(listingHtml)||!listingHtml.includes('data-ajax-post-url="/en/search-jobs/resultspost"')||listings.some(row=>!/^https:\/\/www\.careers\.ford\.com\/en\/job\/[^/]+\/[^/]+\/48560\/\d+$/.test(row.sourceUrl)))throw failure('India facet or native tenant locale changed')
        pages.push({url,summary,fingerprint:JSON.stringify({listings,summary})})
      }

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await read(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)
        if(currentLocale){
          if(detail.jobId!==listing.jobId||detail.title!==listing.title)throw failure('role detail identity changed')
          const native=extractJsonLd(detailHtml),locations=readNativeDocument(detailHtml).nodes(n=>n.tag==='dd'&&(n.attrs.class??'').split(/\s+/).includes('job-detail-location'))
          if(!native||native['@type']!=='JobPosting'||native.url!==listing.sourceUrl||normalizeWhitespace(native.title)!==listing.title||!/^Ford /i.test(native.hiringOrganization?.name??''))throw failure('native role or employer identity changed')
          const address=native.jobLocation?.[0]?.address,worksite=locations.length===1?nativeText(locations[0]).trim():''
          const indiaWideAddress=address?.addressCountry===''&&address.addressLocality==='India'&&address.addressRegion===''&&address.streetAddress===''&&address.postalCode===''
          const countryWideIndia=native.jobLocation?.length===1&&indiaWideAddress&&worksite==='India'
          const remote=native.jobLocation?.[1]?.address
          const unboundedRemote=native.jobLocation?.length===2&&indiaWideAddress&&remote?.addressCountry==='Remote'&&remote.addressLocality===''&&remote.addressRegion===''&&remote.streetAddress===''&&remote.postalCode===''&&normalizeWhitespace(worksite)==='India, Remote'
          if((!/^(?:IN|India)$/i.test(address?.addressCountry??'')&&!countryWideIndia&&!unboundedRemote)||locations.length!==1||(!unboundedRemote&&!/(?:^|,)\s*India\s*$/i.test(worksite)))throw failure('native work country conflicts with India facet')
          if(countryWideIndia){detail.city=null;detail.country='India';detail.location='India'}
          if(!/^\d+$/.test(detail.requisitionId??'')||String(native.identifier?.value??native.identifier)!==detail.requisitionId)throw failure('native requisition identity changed')
          if(native.validThrough&&(!Number.isFinite(Date.parse(native.validThrough))||Date.parse(native.validThrough)<=Date.now()))throw failure('native closing date expired or malformed')
          detail.sourceNativeJobRecord=native
          if(!new RegExp('^https://apply\\.ford\\.com/en/sites/CX_1/job/'+detail.requisitionId+'/apply/email(?:[?#]|$)').test(detail.applyUrl??''))throw failure('application requisition identity changed')
          observedRoles.push({sourceUrl:listing.sourceUrl,native})
          if(unboundedRemote||!detail.jobDescription){unqualified.push(listing.jobId);continue}
        }

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: detail.company || COMPANY_NAME,
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: currentLocale ? detail.city ?? null : detail.city || listing.city,
          country: detail.country || listing.country,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType || listing.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          remoteStatus: detail.remoteStatus ?? null,
          scrapedAt: new Date().toISOString(),
          ...(currentLocale?{sourceNativeJobRecord:detail.sourceNativeJobRecord,sourceNativeEmployerName:detail.company,legalEmployer:null}:{}),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return finish()
        }
      }

      if (!summary.hasNext || (summary.totalPages && page >= summary.totalPages)) {
        break
      }
    }

    return finish()
  },
})

export const run = async (options = {}) => createFordMotorPvtLtdScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY_NAME} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
