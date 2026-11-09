import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aabasoft'
export const COMPANY = 'Aabasoft'
export const COMPANY_DOMAIN = 'aabasoft.com'
export const VERIFIED_AT = '2026-10-03'
export const HOMEPAGE_URL = 'https://www.aabasoft.com/in-en/'
export const CAREERS_URL = 'https://www.aabasoft.com/in-en/career/'
export const CURRENT_CAREERS_URL = 'https://aabasoft.com/in-en/join-our-team/'
export const CURRENT_API_URL = 'https://cmsweb.aabasoft.info/api/list/filter'
export const SCRAPER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CURRENT_CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  countryFilter: 'India',
  atsPlatform: 'official-company-careers',
  paginationStrategy: 'complete-paginated-first-party-cms-job-feed',
  extractionStrategy:
    'verified-official-homepage+verified-current-careers-page+first-party-cms-api+india-city-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;|&#x27;/gi, "'")
  .replace(/&ndash;/gi, '–')
  .replace(/&mdash;/gi, '—')
  .replace(/&bull;/gi, '•')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[‐-―]/g, '-')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const extractMatch = (value, pattern) => String(value ?? '').match(pattern)?.[1] ?? null

const extractLines = (html) => {
  const matches = [...String(html ?? '').matchAll(/<(?:p|li)\b[^>]*>([\s\S]*?)<\/(?:p|li)>/gi)]
  const lines = matches
    .map((match) => stripTags(match[1]))
    .map((line) => line?.replace(/^[•*-]\s*/, '') ?? null)
    .filter(Boolean)

  if (lines.length > 0) return lines

  return stripTags(html)
    ?.split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean) ?? []
}

const extractSectionPanels = (html) => [...String(html ?? '').matchAll(
  /<div class="panel panel-default">[\s\S]*?<h4 class="panel-title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div class="panel-body">([\s\S]*?)<\/div>[\s\S]*?<\/div>\s*<\/div>/gi,
)].map((match) => ({
  heading: stripTags(match[1]),
  items: extractLines(match[2]),
}))

const extractIntroLines = (html) => {
  const leftColumn = extractMatch(
    html,
    /<div class="col-md-7 career-det-left">([\s\S]*?)<div class="panel-group"/i,
  )

  if (!leftColumn) return []

  const withoutTitle = leftColumn.replace(/<h3 class="career-head">[\s\S]*?<\/h3>/i, '')
  return extractLines(withoutTitle)
}

const extractLocationFromListingSummary = (value) => {
  const summary = normalizeText(value)
  if (!summary) return null

  const marker = summary.match(/\s+(?:location|loc)\b/i)
  if (marker) {
    const context = summary.slice(0, marker.index)
    const prepositions = [...context.matchAll(/\b(?:for|in)\s+/gi)]
    const lastPreposition = prepositions.at(-1)

    if (lastPreposition) {
      return normalizeText(context.slice(lastPreposition.index + lastPreposition[0].length))
    }
  }

  return normalizeText(
    summary.match(/\b(?:for|in)\s+(Kochi|Kannur(?:\s*\/\s*(?:TVM|Trivandrum))?|TVM|Trivandrum)\b/i)?.[1],
  )
}

const extractLocationFromDetailLines = (detailLines, title, listingSummary) => {
  const locationLine = detailLines
    .find((item) => /\b(?:job|work)?\s*location\s*[–—:-]/i.test(item))

  if (locationLine) {
    const extracted = normalizeText(
      locationLine.replace(/^.*?\b(?:job|work)?\s*location\s*[–—:-]\s*/i, ''),
    )
    if (extracted) return extracted
  }

  const titledLocation = title.match(/\(([^()]*?)\s+location\)/i)?.[1]
  if (titledLocation) {
    return normalizeText(titledLocation)
  }

  const trailingLocation = title.match(/-\s*([A-Za-z/ ,]+)\s*-\s*$/)?.[1]
  if (trailingLocation) {
    return normalizeText(trailingLocation)
  }

  return extractLocationFromListingSummary(listingSummary)
}

const normalizeLocation = (value) => {
  const location = normalizeText(value)
  if (!location) {
    return { location: null, city: null }
  }

  const primaryToken = location.split(',')[0].split('&')[0].split('/')[0]
  const city = normalizeCity(primaryToken)

  return {
    location,
    city: city || null,
  }
}

const buildJobDescription = ({ introLines, sections }) => {
  const lines = [...introLines]

  for (const section of sections) {
    if (!section.heading || section.items.length === 0) continue
    if (lines.length > 0) lines.push('')
    lines.push(section.heading)
    lines.push(...section.items.map((item) => `- ${item}`))
  }

  return lines.length > 0 ? lines.join('\n') : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Offshore Software Development Company Kerala, India \| Aabasoft\s*<\/title>/i.test(page)
    && /href=["']\/in-en\/career\/["']/i.test(page)
    && /Our Culture/i.test(page)
    && /Campus Placement/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Aabasoft Careers\| Aabasoft\s*<\/title>/i.test(page)
    && /Aabasoft\s*<span>\s*Career\s*<\/span>/i.test(page)
    && /Current\s*<span>\s*Openings\s*<\/span>/i.test(page)
    && /id=["']careers-list-box["']/i.test(page)
    && /href=["'][^"']*\/in-en\/CarrerDetails\/[^"']+["']/i.test(page)
    && />\s*Apply Now\s*</i.test(page)
}

export const extractListingCards = (html) => [...String(html ?? '').matchAll(
  /<article\b[^>]*class=["'][^"']*portfolio-item[^"']*["'][\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>[\s\S]*?<\/article>/gi,
)].map((match) => ({
  department: stripTags(match[1]),
  listingTitle: stripTags(match[2]),
  listingSummary: stripTags(match[3]),
  sourceUrl: toAbsoluteUrl(match[4]),
})).filter((listing) => listing.department && listing.listingTitle && listing.sourceUrl)

export const hasOfficialDetailPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*[^<]+<\/title>/i.test(page)
    && />\s*Job Details\s*</i.test(page)
    && /<h3 class="career-head">\s*[^<]+<\/h3>/i.test(page)
    && /<form[^>]+action=["']\/in-en\/carrerdetails\/["'][^>]*>/i.test(page)
    && />\s*Send Application\s*</i.test(page)
}

const extractDetailPageData = (html, sourceUrl, { department, fallbackTitle, listingSummary }) => {
  if (!hasOfficialDetailPageSignal(html)) {
    throw new Error('Aabasoft detail page no longer matches the verified first-party surface')
  }

  const title = normalizeText(
    extractMatch(html, /<h3 class="career-head">\s*([\s\S]*?)<\/h3>/i)
      || extractMatch(html, /<title>\s*([\s\S]*?)<\/title>/i)
      || fallbackTitle,
  )

  if (!title) {
    throw new Error('Aabasoft detail page no longer matches the verified first-party surface')
  }

  const introLines = extractIntroLines(html)
  const sections = extractSectionPanels(html)
  const requiredSkills = sections
    .flatMap((section) => section.items)
    .filter((item) => !/\b(?:job|work)?\s*location\s*[–—:-]/i.test(item))
  const { location, city } = normalizeLocation(
    extractLocationFromDetailLines(
      [...introLines, ...sections.flatMap((section) => section.items)],
      title,
      listingSummary,
    ),
  )
  const slug = decodeURIComponent(new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) ?? '')

  return {
    title,
    department,
    location,
    city,
    jobId: `${SOURCE}-${slugify(slug)}`,
    requisitionId: `${SOURCE}-${slugify(slug)}`,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({ introLines, sections }),
    companyCareerPage: CAREERS_URL,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchCurrentPage = async (page, pageGuid, pageSize) => {
  const response = await fetch(CURRENT_API_URL, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      parentGuid: pageGuid,
      page,
      pageSize,
      enablePagination: true,
      filters: { keyword: '', dropdowns: {} },
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${CURRENT_API_URL}`)
  return response.json()
}

export const hasCurrentHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Software Development Company Kerala, India\s*\|\s*Aabasoft\s*<\/title>/i.test(page)
    && /href=["']\/in-en\/join-our-team\/["']/i.test(page)
    && /Aabasoft Technologies India Private Limited/i.test(page)
}

export const extractCurrentCareersGuid = (html) => {
  const page = String(html ?? '')
  if (!/<title>\s*Join Us to Grow, Innovate and make an Impact\.\s*\|\s*Aabasoft\s*<\/title>/i.test(page)
    || !/id=["']jobsGrid["']/i.test(page)
    || !/Jobs Found/i.test(page)
    || !/Official Communication/i.test(page)) {
    throw new Error('Aabasoft current careers page no longer matches the verified first-party surface')
  }
  const guid = page.match(/<input\b[^>]*name=["']pageGuid["'][^>]*value=["']([0-9a-f-]{36})["']/i)?.[1]
  if (!guid) throw new Error('Aabasoft current careers page no longer exposes its job feed identifier')
  return guid
}

const normalizeCurrentPostingDate = (value) => {
  const match = String(value ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

export const normalizeCurrentJobs = (items, now) => {
  // The official careers UI reuses a title-based URL for roles in different cities.
  // CMS IDs identify distinct roles even when their application URLs match.
  const ids = new Set()
  return items.map((item) => {
    const title = normalizeText(item?.properties?.cdVacancyTitle?.value)
    const guid = String(item?.guid ?? '')
    const city = normalizeCity(item?.properties?.cdJobLocation?.value?.[0]?.name ?? '')
    const slug = slugify(title)
    const sourceUrl = `${CURRENT_CAREERS_URL}${slug}`
    if (item?.contentType !== 'careerDetails' || !title || !/^[0-9a-f-]{36}$/i.test(guid)
      || !city || !slug || ids.has(guid)) {
      throw new Error('Aabasoft current jobs inventory contains an invalid or duplicate role')
    }
    ids.add(guid)
    const department = normalizeText(item.properties.cdDepartment?.value?.[0]?.name)
    const type = normalizeText(item.properties.cdJobType?.value?.[0]?.name)
    const description = stripTags(item.properties.cdDescription?.value?.markup)
    return {
      title,
      company: COMPANY,
      department,
      location: `${city}, India`,
      city,
      country: 'India',
      jobId: guid,
      requisitionId: guid,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: type?.replace(/^Full Time$/i, 'Full-time').replace(/^Part Time$/i, 'Part-time') ?? null,
      experienceRequired: normalizeText(item.properties.cdExperience?.value),
      postingDate: normalizeCurrentPostingDate(item.properties.cdPostedDate?.value),
      jobDescription: description || null,
      companyCareerPage: CURRENT_CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
      source: SOURCE,
      link: sourceUrl,
      scrapedAt: now(),
    }
  })
}

const runCurrentCareers = async ({ fetchText, fetchCurrentPage, currentPageSize, now }) => {
  const careersHtml = await fetchText(CURRENT_CAREERS_URL)
  const pageGuid = extractCurrentCareersGuid(careersHtml)
  const first = await fetchCurrentPage(1, pageGuid, currentPageSize)
  const total = first?.pagination?.totalItems
  const totalPages = first?.pagination?.totalPages
  if (first?.success !== true || first?.parent?.guid !== pageGuid
    || first?.parent?.name !== 'Job Openings' || !Array.isArray(first?.items)
    || first?.pagination?.page !== 1 || first?.pagination?.pageSize !== currentPageSize
    || !Number.isInteger(total) || total < 0 || !Number.isInteger(totalPages)
    || totalPages !== Math.max(1, Math.ceil(total / currentPageSize)) || totalPages > 100) {
    throw new Error('Aabasoft current jobs inventory contract changed')
  }
  const items = [...first.items]
  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchCurrentPage(page, pageGuid, currentPageSize)
    if (payload?.success !== true || payload?.parent?.guid !== pageGuid
      || payload?.pagination?.page !== page || payload?.pagination?.pageSize !== currentPageSize
      || payload?.pagination?.totalItems !== total || payload?.pagination?.totalPages !== totalPages
      || !Array.isArray(payload.items)) {
      throw new Error('Aabasoft current jobs inventory page is incomplete')
    }
    items.push(...payload.items)
  }
  if (items.length !== total) throw new Error('Aabasoft current jobs inventory count is incomplete')
  return normalizeCurrentJobs(items, now)
}

export const createAabasoftScraper = ({ now = () => new Date().toISOString(), currentPageSize = 50 } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchCurrentPage = defaultFetchCurrentPage, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (hasCurrentHomepageSignal(homepageHtml)) {
      return runCurrentCareers({ fetchText, fetchCurrentPage, currentPageSize, now: overrideNow || now })
    }
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Aabasoft verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Aabasoft verified careers page no longer matches the trusted first-party surface')
    }

    const listings = extractListingCards(careersHtml)
    if (listings.length === 0) {
      throw new Error('Aabasoft careers page no longer exposes verified first-party listing cards')
    }

    const jobs = (await Promise.all(listings.map(async (listing) => extractDetailPageData(
      await fetchText(listing.sourceUrl),
      listing.sourceUrl,
      listing,
    ))))
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        company: COMPANY,
        source: SOURCE,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        country: 'India',
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      }))

    if (jobs.length === 0) {
      throw new Error('Aabasoft first-party careers surface no longer yields normalized jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createAabasoftScraper().run(options)

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
