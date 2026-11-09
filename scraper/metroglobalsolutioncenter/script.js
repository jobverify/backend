import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'metroglobalsolutioncenter'
export const COMPANY = 'Metro Global Solution Center Pvt. Ltd.'
export const COMPANY_DOMAIN = 'metro-gsc.in'
export const HOMEPAGE_URL = 'https://www.metro-gsc.in/'
export const CAREERS_URL = 'https://www.metro-gsc.in/careers'
export const JOBS_URL = 'https://www.metro-gsc.in/careers/jobs'
export const JOIN_US_URL = 'https://www.metro-gsc.in/join-us'
export const MISSING_ROUTE_URLS = [
  'https://www.metro-gsc.in/career',
  'https://www.metro-gsc.in/jobs',
  'https://www.metro-gsc.in/openings',
  'https://www.metro-gsc.in/current-openings',
  'https://www.metro-gsc.in/work-with-us',
]

export const API_CONFIG = {
  endpointPath: '/magsxa/magsearch/magresults/',
  siteId: '{6305DF2F-712E-4006-963F-15D4A5187C7D}',
  itemId: '{79AC8E87-20AD-483F-9749-48D15B642A1C}',
  dataSourceId: '{849536EB-BF94-4567-84A4-B0EA0236B612}',
  versionId: '{8AF7A602-D842-42B8-8A1A-BCDFF6D918BB}',
  language: 'en',
  signature: 'jb',
  defaultSortOrder: 'Md Created Date,Descending',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DETAIL_APPLY_URL_PATTERN = /^https:\/\/jobs\.smartrecruiters\.com\/METROMAKRO\//i

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (let index = 0; index < 5; index += 1) {
    const next = decoded
      .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
      .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
      .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
      .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')

    if (next === decoded) break
    decoded = next
  }

  return decoded
}

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeVisibleText = (value) => normalizeWhitespace(stripTags(value)) || ''

const hasHref = (html, path) => new RegExp(
  `href\\s*=\\s*["']${String(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
  'i',
).test(String(html ?? ''))

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: JOBS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/javascript,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: JOBS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractAttribute = (html, pattern) => normalizeWhitespace(String(html ?? '').match(pattern)?.[1] ?? null)

const countryFromCode = (value) => {
  const code = normalizeWhitespace(value)?.toUpperCase()
  if (code === 'IN') return 'India'
  if (code === 'DE') return 'Germany'
  if (code === 'PL') return 'Poland'
  return code || null
}

const normalizeUrl = (value, baseUrl) => {
  const decoded = decodeHtmlEntities(value)
  if (!decoded) return null

  try {
    return new URL(decoded, baseUrl).toString()
  } catch {
    return null
  }
}

export const buildMagResultsUrl = ({ pageSize = 10, offset = 0 } = {}) => {
  const url = new URL(API_CONFIG.endpointPath, HOMEPAGE_URL)
  url.searchParams.set('l', API_CONFIG.language)
  url.searchParams.set('s', API_CONFIG.siteId)
  url.searchParams.set('itemid', API_CONFIG.itemId)
  url.searchParams.set('autoFireSearch', 'true')
  url.searchParams.set('datasourceid', API_CONFIG.dataSourceId)
  url.searchParams.set('sig', API_CONFIG.signature)
  url.searchParams.set('p', String(pageSize))
  if (offset > 0) {
    url.searchParams.set('e', String(offset))
  }
  url.searchParams.set('o', API_CONFIG.defaultSortOrder)
  url.searchParams.set('v', API_CONFIG.versionId)
  return url.toString()
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return /<title>\s*Home\s*\|\s*METRO GSC IN\s*<\/title>/i.test(page)
    && page.includes('METRO GSC India is a strategic partner powering METRO&rsquo;s global transformation.')
    && page.includes('METRO Global Solution Center India')
    && text.includes('At METRO GSC India, you matter. Shape our future and your career- together with us.')
    && /href=["']\/careers["']/i.test(page)
    && /href=["']\/careers\/jobs["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return /<title>\s*Careers\s*\|\s*METRO GSC IN\s*<\/title>/i.test(page)
    && (
      text.includes('At METRO GSC India, you matter. Shape our future and your career- together with us.')
      || text.includes("At METRO GSC India, you'll help build the future of METRO from the inside out.")
    )
    && (
      hasHref(page, '/careers/our-employer-promise')
      || hasHref(page, '/careers/why-join-us')
    )
    && (
      hasHref(page, '/careers/working-at-mgsc-india')
      || hasHref(page, '/careers/people-of-mgsc-india')
    )
    && (hasHref(page, '/careers/career-development') || hasHref(page, '/careers/jobs'))
    && hasHref(page, '/careers/jobs')
}

export const hasOfficialJobsSignal = (html) => {
  const page = String(html ?? '')
  const decodedPage = decodeHtmlEntities(page)
  const text = normalizeVisibleText(page)

  return /<title>\s*Jobs\s*\|\s*METRO GSC IN\s*<\/title>/i.test(page)
    && /<meta\s+name=["']description["'][^>]*content=["']Jobs Overview["']/i.test(page)
    && decodedPage.includes('"endpoint":"//magsxa/magsearch/magresults/"')
    && decodedPage.includes(`"sig":"${API_CONFIG.signature}"`)
    && decodedPage.includes(`"datasourceid":"${API_CONFIG.dataSourceId}"`)
    && text.includes('Latest job offerings')
    && page.includes('/careers/savedjobs')
    && text.includes('Follow METRO GSC India on social media')
}

export const isVerifiedCareersRedirect = ({ status, url, html }) =>
  status === 200
  && String(url || '') === CAREERS_URL
  && hasOfficialCareersSignal(html)

export const isVerifiedMissingRoute = ({ status, url, html }) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return status === 404
    && String(url || '').endsWith('/not-found')
    && /<title>\s*not-found\s*\|\s*METRO GSC IN\s*<\/title>/i.test(page)
    && text.includes('Page not found')
}

export const hasAkamaiAccessDeniedSignal = (html = '') => {
  const page = String(html ?? '')
  const decodedPage = decodeHtmlEntities(page)
  const text = normalizeVisibleText(page)

  return /<title>\s*Access Denied\s*<\/title>/i.test(page)
    && text.includes("You don't have permission to access")
    && /errors\.edgesuite\.net/i.test(decodedPage)
}

const isAkamaiAccessDeniedError = (error) => {
  const message = String(error?.message ?? error ?? '')

  return /metro-gsc\.in\/careers\/jobs/i.test(message)
    && /(HTTP 403|Forbidden HTML response|Access Denied)/i.test(message)
}

const validateSearchResponse = (searchResponse) => {
  if (!searchResponse || typeof searchResponse !== 'object') {
    throw new Error('Metro Global Solution Center jobs API returned an invalid payload')
  }

  if (searchResponse.Signature !== API_CONFIG.signature) {
    throw new Error('Metro Global Solution Center jobs API signature changed unexpectedly')
  }

  if (searchResponse.Index !== 'sitecore_sxa_web_jobs_index') {
    throw new Error('Metro Global Solution Center jobs API index changed unexpectedly')
  }

  if (!Number.isInteger(searchResponse.Count) || searchResponse.Count < 0) {
    throw new Error('Metro Global Solution Center jobs API count is invalid')
  }

  if (!Array.isArray(searchResponse.Results)) {
    throw new Error('Metro Global Solution Center jobs API results are invalid')
  }

  return searchResponse
}

const parseListingSummary = (listingHtml) => {
  const html = String(listingHtml ?? '')

  const detailUrl = normalizeUrl(
    extractAttribute(html, /<a\b[^>]*class\s*=\s*["'][^"']*teaser__link[^"']*["'][^>]*href\s*=\s*["']([^"']+)["']/i),
    JOBS_URL,
  )
  const title = extractAttribute(html, /<h3\b[^>]*class\s*=\s*["'][^"']*field-jobname[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)
    || extractAttribute(html, /<a\b[^>]*class\s*=\s*["'][^"']*teaser__link[^"']*["'][^>]*title\s*=\s*["']([^"']+)["']/i)
  const department = extractAttribute(html, /class\s*=\s*["'][^"']*field-department[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i)
  const employmentType = extractAttribute(html, /class\s*=\s*["'][^"']*field-jobtype[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i)
  const location = extractAttribute(html, /class\s*=\s*["'][^"']*field-fulllocation[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i)
  const city = extractAttribute(html, /itemprop=["']addressLocality["'][^>]*content=["']([^"']+)["']/i)
  const countryCode = extractAttribute(html, /itemprop=["']addressCountry["'][^>]*content=["']([^"']+)["']/i)
  const companyName = extractAttribute(html, /itemprop=["']name["'][^>]*content=["']([^"']+)["']/i)
  const jobDescription = extractAttribute(html, /itemprop=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
  const postingDate = extractAttribute(html, /itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i)

  const requisitionId = detailUrl
    ? new URL(detailUrl).searchParams.get('jid')
    : extractAttribute(html, /id=["']job-([^"']+)["']/i)

  if (!detailUrl || !title || !countryCode || !companyName || !postingDate || !requisitionId) {
    throw new Error('Metro Global Solution Center listing summary no longer matches the verified jobs API shape')
  }

  if (companyName !== 'METRO Global Solution Center IN') {
    throw new Error('Metro Global Solution Center listing organization changed unexpectedly')
  }

  return {
    title,
    department,
    employmentType,
    location,
    city,
    countryCode: countryCode.toUpperCase(),
    country: countryFromCode(countryCode),
    detailUrl,
    requisitionId,
    jobDescription,
    postingDate,
  }
}

const isVerifiedAkamaiBlockedPage = ({ status, url, html }, expectedUrl) =>
  Number(status) === 403
  && String(url || '') === expectedUrl
  && hasAkamaiAccessDeniedSignal(html)

const buildListingOnlyJob = (listing) => {
  const publicExperienceEvidence = normalizeWhitespace(listing.jobDescription)

  return {
    title: listing.title,
    company: COMPANY,
    department: listing.department,
    location: listing.location || [listing.city, listing.country || 'India'].filter(Boolean).join(', ') || 'Pune, India',
    city: listing.city,
    country: listing.country || 'India',
    jobId: `${SOURCE}-${listing.requisitionId || slugify(listing.title)}`,
    requisitionId: listing.requisitionId,
    sourceUrl: listing.detailUrl,
    applyUrl: listing.detailUrl,
    employmentType: listing.employmentType,
    experienceRequired: extractExperienceRequired(publicExperienceEvidence),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: listing.postingDate,
    closingDate: null,
    jobDescription: listing.jobDescription || null,
    publicExperienceChecked: Boolean(publicExperienceEvidence),
  }
}

const extractSectionHtml = (html, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(
    new RegExp(`<h2\\b[^>]*>\\s*${escapedHeading}\\s*<\\/h2>([\\s\\S]*?)(?=<h2\\b|<footer\\b|<\\/main>|<\\/body>)`, 'i'),
  )

  return match?.[1] ?? null
}

const extractListItems = (html) => [
  ...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi),
]
  .map((match) => normalizeVisibleText(match[1]))
  .filter(Boolean)

const buildCombinedDescription = ({ detailDescription, qualifications, benefits, listingDescription }) => {
  const sections = []

  if (detailDescription) sections.push(detailDescription)
  else if (listingDescription) sections.push(listingDescription)

  if (qualifications) sections.push(`Qualifications: ${qualifications}`)
  if (benefits) sections.push(`Benefits: ${benefits}`)

  return sections.join('\n\n') || null
}

const extractExperienceRequired = (publicEvidence) => {
  const normalizedEvidence = normalizeWhitespace(publicEvidence)
  if (!normalizedEvidence) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedEvidence,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)
  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const extractJobFromDetailPage = ({ listing, detailHtml }) => {
  const detailPage = String(detailHtml ?? '')
  const headingTitle = extractAttribute(detailPage, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  const applyUrl = normalizeUrl(
    extractAttribute(detailPage, /<a\b[^>]*class=["'][^"']*job-apply[^"']*["'][^>]*href=["']([^"']+)["']/i),
    listing.detailUrl,
  )
  const detailDescription = normalizeVisibleText(extractSectionHtml(detailPage, 'Job Description'))
  const qualificationsSection = normalizeVisibleText(extractSectionHtml(detailPage, 'Qualifications'))
  const benefitsSection = normalizeVisibleText(extractSectionHtml(detailPage, 'Benefits'))
  const contactSection = normalizeVisibleText(extractSectionHtml(detailPage, 'Contact'))
  const qualificationBullets = extractListItems(extractSectionHtml(detailPage, 'Qualifications'))

  if (!headingTitle || normalizeWhitespace(headingTitle) !== normalizeWhitespace(listing.title)) {
    throw new Error(`Metro Global Solution Center detail page title drifted for "${listing.title}"`)
  }

  if (!applyUrl || !DETAIL_APPLY_URL_PATTERN.test(applyUrl)) {
    throw new Error(`Metro Global Solution Center detail page apply link drifted for "${listing.title}"`)
  }

  if (
    !/<h2\b[^>]*>\s*Job Description\s*<\/h2>/i.test(detailPage)
    || !/<h2\b[^>]*>\s*Qualifications\s*<\/h2>/i.test(detailPage)
    || !/<h2\b[^>]*>\s*(?:Benefits|Contact)\s*<\/h2>/i.test(detailPage)
  ) {
    throw new Error(`Metro Global Solution Center detail page sections drifted for "${listing.title}"`)
  }

  const jobDescription = buildCombinedDescription({
    detailDescription,
    qualifications: qualificationsSection,
    benefits: benefitsSection || contactSection,
    listingDescription: listing.jobDescription,
  })
  const publicExperienceEvidence = normalizeWhitespace([
    detailDescription,
    qualificationsSection,
    benefitsSection,
    contactSection,
    listing.jobDescription,
  ].filter(Boolean).join(' '))

  return {
    title: listing.title,
    company: COMPANY,
    department: listing.department,
    location: listing.location || 'Pune, India',
    city: listing.city,
    country: listing.country || 'India',
    jobId: `${SOURCE}-${listing.requisitionId || slugify(listing.title)}`,
    requisitionId: listing.requisitionId,
    sourceUrl: listing.detailUrl,
    applyUrl,
    employmentType: listing.employmentType,
    experienceRequired: extractExperienceRequired(publicExperienceEvidence),
    minimumQualification: qualificationsSection,
    preferredQualification: null,
    requiredSkills: qualificationBullets,
    postingDate: listing.postingDate,
    closingDate: null,
    jobDescription,
    publicExperienceChecked: Boolean(publicExperienceEvidence),
  }
}

const extractJobsFromListings = async ({
  listings = [],
  fetchText = defaultFetchText,
} = {}) => {
  const jobs = []

  for (const listing of listings) {
    if (listing.countryCode !== 'IN') continue

    try {
      const detailHtml = await fetchText(listing.detailUrl)

      if (hasAkamaiAccessDeniedSignal(detailHtml)) {
        jobs.push(buildListingOnlyJob(listing))
        continue
      }

      jobs.push(extractJobFromDetailPage({ listing, detailHtml }))
    } catch (error) {
      if (!isAkamaiAccessDeniedError(error)) {
        throw error
      }

      jobs.push(buildListingOnlyJob(listing))
    }
  }

  return jobs
}

export const extractJobsFromSearchResponse = async ({
  searchResponse,
  fetchText = defaultFetchText,
} = {}) => {
  const validated = validateSearchResponse(searchResponse)

  return extractJobsFromListings({
    listings: validated.Results.map((result) => parseListingSummary(result?.Html)),
    fetchText,
  })
}

export const createMetroGlobalSolutionCenterScraper = ({
  pageSize = 10,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    fetchText = defaultFetchText,
    now: overrideNow,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    const careersPage = await fetchPage(CAREERS_URL)
    const jobsPage = await fetchPage(JOBS_URL)
    const homepageBlocked = isVerifiedAkamaiBlockedPage(homepage, HOMEPAGE_URL)
    const careersBlocked = isVerifiedAkamaiBlockedPage(careersPage, CAREERS_URL)
    const jobsBlocked = isVerifiedAkamaiBlockedPage(jobsPage, JOBS_URL)

    if (homepageBlocked && careersBlocked && jobsBlocked) {
      return []
    }

    if (!homepageBlocked && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Metro Global Solution Center homepage no longer matches the verified first-party surface')
    }

    if (!careersBlocked && (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html))) {
      throw new Error('Metro Global Solution Center careers page no longer matches the verified first-party surface')
    }

    if (jobsBlocked || jobsPage.status !== 200 || !hasOfficialJobsSignal(jobsPage.html)) {
      throw new Error('Metro Global Solution Center jobs page no longer matches the verified first-party surface')
    }

    if (!homepageBlocked && !careersBlocked) {
      const joinUsPage = await fetchPage(JOIN_US_URL)
      if (!isVerifiedCareersRedirect(joinUsPage)) {
        throw new Error('Metro Global Solution Center join-us route no longer redirects to the verified careers page')
      }

      for (const missingRouteUrl of MISSING_ROUTE_URLS) {
        const missingRoute = await fetchPage(missingRouteUrl)

        if (!isVerifiedMissingRoute(missingRoute)) {
          throw new Error(`Metro Global Solution Center missing-route validation failed for ${missingRouteUrl}`)
        }
      }
    }

    const collectedListings = []
    let offset = 0
    let totalCount = null

    while (true) {
      const response = validateSearchResponse(
        await fetchJson(buildMagResultsUrl({ pageSize, offset })),
      )
      const rawResults = response.Results.map((result) => parseListingSummary(result?.Html))

      if (totalCount == null) {
        totalCount = response.Count
      } else if (response.Count !== totalCount) {
        throw new Error('Metro Global Solution Center jobs API total count drifted during pagination')
      }

      if (totalCount === 0) break

      if (rawResults.length === 0) {
        throw new Error('Metro Global Solution Center jobs API pagination ended unexpectedly')
      }

      collectedListings.push(...rawResults)

      offset += rawResults.length
      if (offset >= totalCount) break
    }

    const collectedJobs = await extractJobsFromListings({
      listings: collectedListings,
      fetchText,
    })

    const seenJobIds = new Set()
    const scrapedAt = (overrideNow || now)()

    return collectedJobs.map((job) => {
      if (seenJobIds.has(job.jobId)) {
        throw new Error(`Metro Global Solution Center duplicate job detected for "${job.jobId}"`)
      }
      seenJobIds.add(job.jobId)

      return {
        ...job,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt,
        companyCareerPage: JOBS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
      }
    })
  },
})

export const run = async (options = {}) => createMetroGlobalSolutionCenterScraper(options).run()

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
