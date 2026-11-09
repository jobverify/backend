import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXPLEO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EXPLEO_CATALOG
export const SOURCE = EXPLEO_CATALOG.source
export const COMPANY = EXPLEO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EXPLEO_CATALOG.officialBrandName
export const VERIFIED_ON = EXPLEO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = EXPLEO_CATALOG.verifiedSurfaceSummary
export const OFFICIAL_CAREERS_PAGE_URL = EXPLEO_CATALOG.companyCareerPage
export const INDIA_JOBS_ROOT_URL = EXPLEO_CATALOG.indiaJobsRootUrl
export const SEARCH_WRAPPER_URL = EXPLEO_CATALOG.indiaJobsSearchWrapperUrl
export const SEARCH_IFRAME_URL = EXPLEO_CATALOG.indiaJobsSearchIframeUrl
export const OFFICIAL_JOB_DETAIL_EXAMPLE_URL = EXPLEO_CATALOG.officialJobDetailExampleUrl

export const ICIMS_USER_AGENT = 'Mozilla/5.0'

const ICIMS_HOST = 'https://expleo-jobs-in-en.icims.com'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(
    String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim(),
  )

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:div|dd|dt|h[1-6]|li|p|section|span|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const unique = (values) => [...new Set(values.filter(Boolean))]

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value, baseUrl = ICIMS_HOST) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return normalized
  }
}

const normalizeUrl = (value, baseUrl = ICIMS_HOST) => {
  const absoluteUrl = toAbsoluteUrl(value, baseUrl)
  if (!absoluteUrl) return null

  try {
    const parsed = new URL(absoluteUrl)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return absoluteUrl
  }
}

const extractField = (html, label) => {
  const source = String(html ?? '')
  const escapedLabel = escapeRegex(label)
  const definitionMatch = source.match(new RegExp(
    `<dt[^>]*>[\\s\\S]*?${escapedLabel}[\\s\\S]*?<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
    'i',
  ))

  return stripTags(definitionMatch?.[1])
}

const extractJobPathInfo = (value = '') => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) {
    return { jobId: null, slug: null }
  }

  try {
    const parsed = new URL(absoluteUrl)
    const match = parsed.pathname.match(/\/jobs\/(\d+)\/([^/?#]+)\/job/i)
    if (!match) {
      return { jobId: null, slug: null }
    }

    return {
      jobId: normalizeWhitespace(match[1]),
      slug: normalizeWhitespace(match[2]),
    }
  } catch {
    return { jobId: null, slug: null }
  }
}

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      city: null,
      location: null,
    }
  }

  const match = normalized.match(/^IN-[A-Z]{2}-(.+)$/i)
  if (match) {
    const city = normalizeWhitespace(match[1])
    return {
      city,
      location: city ? `${city}, India` : null,
    }
  }

  const city = normalizeWhitespace(normalized.split(',')[0])
  return {
    city,
    location: city ? `${city}, India` : normalized,
  }
}

const isIndiaLocation = (value) => /^IN-[A-Z]{2}-/i.test(normalizeWhitespace(value) || '')

const extractJsonLdJobPosting = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed)) {
        const jobPosting = parsed.find((item) => item?.['@type'] === 'JobPosting')
        if (jobPosting) return jobPosting
      } else if (parsed?.['@type'] === 'JobPosting') {
        return parsed
      }
    } catch {
      continue
    }
  }

  return null
}

const extractDescriptionSections = (html = '') => {
  const sectionPattern = /<h2[^>]*>\s*([^<]+?)\s*<\/h2>([\s\S]*?)(?=<h2[^>]*>|$)/gi
  const sections = new Map()

  for (const match of String(html ?? '').matchAll(sectionPattern)) {
    const heading = normalizeWhitespace(match[1])?.toLowerCase()
    if (!heading) continue
    sections.set(heading, match[2])
  }

  return sections
}

const extractListItems = (html = '') => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const buildCanonicalApplyUrl = (rawApplyUrl, fallbackUrl) => {
  const normalized = normalizeUrl(rawApplyUrl, ICIMS_HOST)
  if (!normalized) return fallbackUrl || null

  try {
    const parsed = new URL(normalized)
    const canonical = new URL(parsed.pathname, parsed.origin)
    canonical.searchParams.set('apply', 'yes')

    const hashed = parsed.searchParams.get('hashed')
    if (hashed) {
      canonical.searchParams.set('hashed', hashed)
    }

    canonical.searchParams.set('mode', parsed.searchParams.get('mode') || 'apply')
    return canonical.toString()
  } catch {
    return normalized
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': ICIMS_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const buildSearchUrl = (pageIndex = 0) => (
  pageIndex > 0
    ? `${ICIMS_HOST}/jobs/search?pr=${pageIndex}&in_iframe=1`
    : SEARCH_IFRAME_URL
)

export const buildDetailUrl = ({ jobId, slug } = {}) => (
  jobId && slug ? `${ICIMS_HOST}/jobs/${jobId}/${slug}/job` : null
)

export const buildDetailFetchUrl = ({ jobId, slug } = {}) => {
  const detailUrl = buildDetailUrl({ jobId, slug })
  return detailUrl ? `${detailUrl}?in_iframe=1` : null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const source = String(html ?? '')
  return /<title>\s*Expleo \| Career : Grow Your Skills and Potential\s*<\/title>/i.test(source)
    && /Search jobs in your country/i.test(source)
    && /Everything you are\.\s*<br>\s*Anything you want to be\./i.test(source)
    && /https:\/\/expleo-jobs-in-en\.icims\.com\//i.test(source)
}

export const extractIndiaJobsRootUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a[^>]+href=["'](https:\/\/expleo-jobs-in-en\.icims\.com\/)["'][^>]*>\s*India\s*<\/a>/i,
  )
  return normalizeUrl(match?.[1], OFFICIAL_CAREERS_PAGE_URL)
}

export const hasOfficialSearchWrapperSignal = (html = '') => {
  const source = String(html ?? '')
  return /\bFIND JOBS\b/i.test(source)
    && /https:\/\/expleo-jobs-in-en\.icims\.com\//i.test(source)
    && /icims_content_iframe/i.test(source)
    && /hashed=-435712793&in_iframe=1/i.test(source)
}

export const extractSearchIframeUrl = (html = '') => {
  const source = String(html ?? '')
  const iframeMatch = source.match(
    /<iframe[^>]+id=["']icims_content_iframe["'][^>]+src=["']([^"']+)["']/i,
  )
  if (iframeMatch) {
    return normalizeUrl(iframeMatch[1].replace(/\\\//g, '/'), SEARCH_WRAPPER_URL)
  }

  const match = source.match(
    /icimsFrame\.src\s*=\s*['"]([^'"]*hashed=-435712793(?:&amp;|&)in_iframe=1)['"]/i,
  )
  const rawUrl = match?.[1]?.replace(/\\\//g, '/')
  return normalizeUrl(rawUrl, SEARCH_WRAPPER_URL)
}

export const hasOfficialListingsPageSignal = (html = '') => {
  const source = String(html ?? '')
  return /<title>\s*Job Listings at Expleo\s*<\/title>/i.test(source)
    && /\biCIMS_JobsTable\b/i.test(source)
    && /expleo-jobs-in-en\.icims\.com\/jobs\/\d+\//i.test(source)
    && /IN-[A-Z]{2}-[A-Za-z]/i.test(source)
}

export const extractNextPageUrl = (html = '') => {
  const source = String(html ?? '')
  const nextMatch = source.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)
  return nextMatch ? normalizeUrl(nextMatch[1], ICIMS_HOST) : null
}

export const extractJobCards = (html = '') => {
  const cardPattern = /<li[^>]*class=["'][^"']*iCIMS_JobCardItem[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi

  return [...String(html ?? '').matchAll(cardPattern)]
    .map((match) => {
      const cardHtml = match[1]
      const locationValue = extractField(cardHtml, 'Job Locations')
      if (!isIndiaLocation(locationValue)) return null

      const linkMatch = cardHtml.match(
        /<a[^>]+href=["']([^"']*\/jobs\/\d+\/[^"'?#\s<>]+\/job(?:\?[^"']*)?)["'][^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i,
      )
      const { jobId, slug } = extractJobPathInfo(linkMatch?.[1])
      const title = stripTags(linkMatch?.[2])
      const { city, location } = normalizeIndiaLocation(locationValue)

      if (!jobId || !slug || !title || !city || !location) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department: extractField(cardHtml, 'Job area'),
        location,
        city,
        country: 'India',
        jobId,
        requisitionId: extractField(cardHtml, 'ID'),
        sourceUrl: buildDetailUrl({ jobId, slug }),
        applyUrl: buildDetailUrl({ jobId, slug }),
        employmentType: extractField(cardHtml, 'Employment type'),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: stripTags(
          cardHtml.match(/<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
        ),
        remoteStatus: extractField(cardHtml, 'Workplace'),
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html = '', listing = {}) => {
  const jsonLd = extractJsonLdJobPosting(html)
  const descriptionSections = extractDescriptionSections(jsonLd?.description)
  const overview = stripTags(descriptionSections.get('overview'))
  const responsibilities = stripTags(descriptionSections.get('responsibilities'))
  const qualifications = stripTags(descriptionSections.get('qualifications'))
  const essentialSkills = stripTags(descriptionSections.get('essential skills'))
  const experience = stripTags(descriptionSections.get('experience'))
  const essentialSkillItems = extractListItems(descriptionSections.get('essential skills'))

  const rawApplyMatch = String(html ?? '').match(
    /<a[^>]+href=["']([^"']*mode=apply[^"']*apply=yes[^"']*|[^"']*apply=yes[^"']*mode=apply[^"']*)["'][^>]*(?:class=["'][^"']*iCIMS_ApplyOnlineButton[^"']*["']|title=["']Apply now["'])/i,
  )

  const { city, location } = normalizeIndiaLocation(
    extractField(html, 'Job Locations') || listing.location,
  )

  return {
    title: stripTags(
      String(html ?? '').match(/<h1[^>]*class=["'][^"']*iCIMS_Header[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1],
    ) || normalizeWhitespace(jsonLd?.title) || listing.title || null,
    company: listing.company || COMPANY,
    department: extractField(html, 'Job area') || listing.department || null,
    location: location || listing.location || null,
    city: city || listing.city || null,
    country: listing.country || 'India',
    jobId: listing.jobId || null,
    requisitionId: extractField(html, 'ID') || listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: buildCanonicalApplyUrl(rawApplyMatch?.[1], listing.applyUrl || listing.sourceUrl),
    employmentType: extractField(html, 'Employment type') || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: unique([
      qualifications,
      ...essentialSkillItems,
    ]),
    postingDate: normalizeWhitespace(jsonLd?.datePosted) || null,
    closingDate: null,
    jobDescription: normalizeWhitespace(
      [overview, responsibilities, qualifications, essentialSkills, experience]
        .filter(Boolean)
        .join(' '),
    ) || listing.jobDescription || null,
    remoteStatus: extractField(html, 'Workplace') || listing.remoteStatus || null,
  }
}

const hasVerifiedDetailPageSignal = (html = '', listing = {}) => {
  const jsonLd = extractJsonLdJobPosting(html)
  const detail = extractJobDetail(html, listing)

  return /<h1[^>]*class=["'][^"']*iCIMS_Header[^"']*["'][^>]*>/i.test(String(html ?? ''))
    && jsonLd?.['@type'] === 'JobPosting'
    && normalizeWhitespace(jsonLd?.title) === detail.title
    && normalizeWhitespace(jsonLd?.datePosted)
    && Boolean(detail.applyUrl)
    && /[?&]apply=yes&hashed=[^&]+&mode=apply$/i.test(detail.applyUrl)
}

export const createExpleoScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText: overrideFetchText,
    maxJobs: overrideMaxJobs = maxJobs,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const careersHtml = await fetchTextImpl(OFFICIAL_CAREERS_PAGE_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Expleo verified first-party careers page no longer matches the pinned public surface')
    }

    if (extractIndiaJobsRootUrl(careersHtml) !== INDIA_JOBS_ROOT_URL) {
      throw new Error('Expleo verified first-party careers page no longer points India to the pinned iCIMS root')
    }

    const wrapperHtml = await fetchTextImpl(SEARCH_WRAPPER_URL)

    if (!hasOfficialSearchWrapperSignal(wrapperHtml)) {
      throw new Error('Expleo verified India iCIMS wrapper no longer matches the pinned iframe handoff')
    }

    const extractedSearchIframeUrl = extractSearchIframeUrl(wrapperHtml)
    if (extractedSearchIframeUrl && extractedSearchIframeUrl !== SEARCH_IFRAME_URL) {
      throw new Error('Expleo verified India iCIMS wrapper no longer matches the pinned iframe handoff')
    }

    const jobs = []
    const seenJobIds = new Set()
    const visitedPages = new Set()
    let nextPageUrl = buildSearchUrl()

    while (nextPageUrl && !visitedPages.has(nextPageUrl)) {
      visitedPages.add(nextPageUrl)
      const listingHtml = await fetchTextImpl(nextPageUrl)

      if (!hasOfficialListingsPageSignal(listingHtml)) {
        throw new Error('Expleo verified India iCIMS listings page no longer matches the pinned public jobs surface')
      }

      for (const listing of extractJobCards(listingHtml)) {
        if (!listing.jobId || seenJobIds.has(listing.jobId)) {
          continue
        }

        seenJobIds.add(listing.jobId)
        const { jobId, slug } = extractJobPathInfo(listing.sourceUrl)
        const detailHtml = await fetchTextImpl(buildDetailFetchUrl({ jobId, slug }))

        if (!hasVerifiedDetailPageSignal(detailHtml, listing)) {
          throw new Error(`Expleo verified Expleo iCIMS detail page no longer matches the pinned contract: ${listing.sourceUrl}`)
        }

        const detail = extractJobDetail(detailHtml, listing)
        const job = {
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: now(),
        }

        jobs.push(job)

        if (overrideMaxJobs && jobs.length >= overrideMaxJobs) {
          return jobs
        }
      }

      nextPageUrl = extractNextPageUrl(listingHtml)
    }

    return jobs
  },
})

export const run = async (options = {}) => createExpleoScraper().run(options)

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
