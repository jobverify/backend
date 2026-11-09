import path from 'node:path'
import { fileURLToPath } from 'node:url'

import fetchPageWithRetry from '../../scraper-support/utils/fetchPageWithRetry.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'prismrmc'
export const COMPANY = 'Prism RMC'
export const HOMEPAGE_URL = 'https://www.rmcindia.com/'
export const CAREERS_URL = 'https://www.rmcindia.com/join-our-team/'
export const PAGE_SITEMAP_URL = 'https://www.rmcindia.com/wp-sitemap-posts-page-1.xml'

const COMPANY_DOMAIN = 'rmcindia.com'
const DETAIL_PATH_PATTERN = /\/rmc-jobs-[a-z0-9-]+\/?$/i
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&#8217;|&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\r\n?/g, '\n')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^full[\s-]?time$/i.test(normalized)) return 'Full-time'
  if (/^part[\s-]?time$/i.test(normalized)) return 'Part-time'
  return normalized
}

const toJobId = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, HOMEPAGE_URL)
  if (!absoluteUrl) return null

  try {
    return new URL(absoluteUrl).pathname.replace(/\/+$/g, '').split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const toCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^pan india$/i.test(normalized)) return null

  const [city] = normalized.split(/[\/,]/)
  const normalizedCity = normalizeWhitespace(city)
  return normalizedCity && !/^pan india$/i.test(normalizedCity) ? normalizedCity : null
}

const extractTitleFromDetail = (html) =>
  normalizeWhitespace(
    String(html ?? '').match(/<title>\s*([\s\S]*?)\s*(?:&#8211;|&ndash;|-|–)\s*Prism RMC\s*<\/title>/i)?.[1],
  )

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractQualifications = (html) => extractListItems(
  String(html ?? '').match(
    /<p\b[^>]*>\s*<strong>\s*Qualifications\s*:\s*<\/strong>\s*<\/p>\s*(<ul>[\s\S]*?<\/ul>)/i,
  )?.[1] ?? '',
)

const extractDetailFields = (html) => {
  const fields = {}

  for (const match of String(html ?? '').matchAll(
    /<p\b[^>]*>\s*<strong>\s*([^:<]+)\s*:\s*<\/strong>\s*([\s\S]*?)<\/p>/gi,
  )) {
    const label = normalizeWhitespace(match[1])?.toLowerCase()
    const value = stripTags(match[2])

    if (!label || !value) continue
    fields[label] = value
  }

  return fields
}

const buildJobDescription = ({ listingDescription, detailDescription, qualifications }) => {
  const sections = []

  if (detailDescription) {
    sections.push(detailDescription)
  } else if (listingDescription) {
    sections.push(listingDescription)
  }

  if (qualifications.length > 0) {
    sections.push(`Qualifications: ${qualifications.join(' ')}`)
  }

  return sections.join('\n\n') || null
}

const hasNoOpeningsCue = (html) => /no openings|no jobs|currently no openings/i.test(stripTags(html) || '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPageSitemap = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizePageSitemapResponse = (response) => {
  if (typeof response === 'string') {
    return {
      status: 200,
      text: response,
    }
  }

  return {
    status: Number(response?.status || 0),
    text: String(response?.text ?? response?.html ?? ''),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Prism RMC\s*<\/title>/i.test(page)
    && /One of India(?:'|&#8217;|’)?s leading ready mix concrete manufacturer/i.test(text)
    && /Prism RMC Brochure/i.test(text)
    && /join-our-team/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Join our team\s*(?:&#8211;|&ndash;|-|–)\s*Prism RMC\s*<\/title>/i.test(page)
    && /Join our team/i.test(text)
    && (/href="[^"]*rmc-jobs-[^"]*"/i.test(page) || hasNoOpeningsCue(page))
}

export const hasVerifiedPageSitemapSignal = (xml) => {
  const sitemap = String(xml ?? '')
  return sitemap.includes(CAREERS_URL)
    && sitemap.includes('https://www.rmcindia.com/')
}

export const extractDetailUrlsFromSitemap = (xml) => {
  const seen = new Set()
  const urls = []

  for (const match of String(xml ?? '').matchAll(
    /<loc>(https:\/\/www\.rmcindia\.com\/rmc-jobs-[^<]+)<\/loc>/gi,
  )) {
    const url = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
}

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Prism RMC verified first-party careers page no longer matches the known public surface')
  }

  const jobs = [...String(html ?? '').matchAll(
    /<div class="grid-item\b[\s\S]*?<h3 class="item--title">\s*([\s\S]*?)<\/h3>[\s\S]*?<ul class="item--feature">([\s\S]*?)<\/ul>[\s\S]*?<div class="item-desc">([\s\S]*?)<\/div>[\s\S]*?<a class="btn[^"]*" href="([^"]*rmc-jobs-[^"]+)"/gi,
  )]
    .map((match) => {
      const title = stripTags(match[1])
      const features = extractListItems(match[2])
      const description = stripTags(match[3])
      const sourceUrl = toAbsoluteUrl(match[4], HOMEPAGE_URL)
      const jobId = toJobId(sourceUrl)

      if (!title || !sourceUrl || !DETAIL_PATH_PATTERN.test(new URL(sourceUrl).pathname) || !jobId) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department: null,
        location: features[0] || null,
        city: toCity(features[0]),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(features[1]),
        experienceRequired: features[3] || null,
        minimumQualification: features[2] || null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: description,
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    if (hasNoOpeningsCue(html)) {
      return []
    }

    throw new Error('Prism RMC careers page no longer exposes the verified public job cards')
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const fields = extractDetailFields(page)
  const qualifications = extractQualifications(page)
  const title = extractTitleFromDetail(page) || normalizeWhitespace(listing.title)
  const applyUrl = toAbsoluteUrl(
    page.match(
      /<a\b[^>]*href="([^"]*(?:forms\.gle|docs\.google\.com\/forms)[^"]*)"[^>]*>[\s\S]*?Click here to Apply/i,
    )?.[1],
    HOMEPAGE_URL,
  )
  const department = fields['job category'] || fields.department || listing.department || null
  const employmentType = normalizeEmploymentType(fields['job type'] || listing.employmentType)
  const location = fields.location || listing.location || null
  const education = fields.education || listing.minimumQualification || null
  const experienceRequired = fields.experience || listing.experienceRequired || null
  const jobDescription = buildJobDescription({
    listingDescription: listing.jobDescription,
    detailDescription: fields['job description'] || null,
    qualifications,
  })

  if (
    !title
    || !applyUrl
    || !employmentType
    || !location
    || !education
    || (listing.title && normalizeWhitespace(listing.title) !== title)
  ) {
    throw new Error('Prism RMC verified first-party job detail page changed materially')
  }

  return {
    ...listing,
    title,
    department,
    jobCategory: fields['job category'] || null,
    location,
    city: toCity(location) || listing.city || null,
    country: 'India',
    employmentType,
    experienceRequired,
    minimumQualification: education,
    preferredQualification: null,
    requiredSkills: qualifications.filter(
      (value) => normalizeWhitespace(value)?.toLowerCase() !== normalizeWhitespace(education)?.toLowerCase(),
    ),
    jobDescription,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
  }
}

export const createPrismRmcScraper = ({ maxJobs = null } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchPageSitemap = defaultFetchPageSitemap,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Prism RMC verified official homepage no longer matches the known public surface')
    }

    const pageSitemapResponse = normalizePageSitemapResponse(await fetchPageSitemap(PAGE_SITEMAP_URL))
    const pageSitemapXml = pageSitemapResponse.text
    if (
      ![200, 404].includes(pageSitemapResponse.status)
      || !hasVerifiedPageSitemapSignal(pageSitemapXml)
    ) {
      throw new Error('Prism RMC verified first-party page sitemap no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Prism RMC verified first-party careers page no longer matches the known public surface')
    }

    const listings = extractListings(careersHtml)
    const detailUrlsInSitemap = new Set(extractDetailUrlsFromSitemap(pageSitemapXml))

    if (listings.length === 0) {
      if (detailUrlsInSitemap.size === 0 && hasNoOpeningsCue(careersHtml)) {
        return []
      }

      throw new Error('Prism RMC careers page no longer exposes the verified public job cards')
    }

    if (detailUrlsInSitemap.size > 0) {
      const missingFromSitemap = listings
        .map((listing) => listing.sourceUrl)
        .filter((url) => !detailUrlsInSitemap.has(url))

      if (missingFromSitemap.length > 0) {
        throw new Error('Prism RMC careers detail URLs no longer match the verified first-party sitemap')
      }
    }

    const selectedListings = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push(normalizeScrapedJob({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        companyCareerPage: CAREERS_URL,
        atsPlatform: 'official-company-careers',
        scrapedAt: now(),
      }, {
        companyName: COMPANY,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        countryFilter: 'India',
      }))
    }

    return jobs
  },
})

export const run = async (options = {}) => createPrismRmcScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Prism RMC jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
