import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'integrate'
export const COMPANY = 'Integrate'
export const HOMEPAGE_URL = 'https://www.integrate.com/'
export const CAREERS_URL = 'https://www.integrate.com/company/careers/'
export const JOB_BOARD_SLUG = 'integratecom-inc'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&rsquo;/gi, '’')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')
  .replace(/\u2011|\u2012|\u2013|\u2014|\u2212/g, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value) => pattern.exec(String(value ?? ''))?.[1] ?? null

const parseNextData = (html) => {
  const payload = extractFirst(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    html,
  )

  if (!payload) {
    throw new Error('Integrate verified Rippling surface no longer exposes __NEXT_DATA__')
  }

  return JSON.parse(payload)
}

const getPageProps = (nextData) => nextData?.props?.pageProps ?? nextData?.pageProps ?? null

const isVerifiedBoardSlug = (value) => normalizeWhitespace(value) === JOB_BOARD_SLUG

const isIndiaLocation = (location) => /(?:^|[^a-z])(india|in)(?:[^a-z]|$)/i.test(location ?? '')

const normalizeIsoDate = (value) => {
  const text = normalizeWhitespace(value)
  if (!text) return null

  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(text)
  return isoMatch ? isoMatch[1] : text
}

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractExperienceRequired = (value) => {
  const match = normalizeWhitespace(value).match(/\b(\d+\s*-\s*\d+\s+years?)\b/i)
  return match ? match[1] : null
}

const extractRequiredSkills = (descriptionHtml) => [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripHtml(match[1]))
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = stripHtml(rawHtml).toLowerCase()

  return /<title>\s*Lead Management &amp; Data Governance Solution \| Integrate\s*<\/title>/i.test(rawHtml)
    && /href=["']https:\/\/www\.integrate\.com\/company\/careers\/["']/i.test(rawHtml)
    && normalized.includes('clean data. faster action. pipeline that converts.')
    && normalized.includes('pipeline integrity layer')
    && normalized.includes('martech stack')
    && normalized.includes('function without')
}

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Integrate Careers \| Enterprise Marketing Software Jobs \| Integrate\s*<\/title>/i.test(rawHtml)
    && /<h1[^>]*>\s*Careers At Integrate\s*<\/h1>/i.test(rawHtml)
    && /data-job-board-id=["']integratecom-inc["']/i.test(rawHtml)
    && /ats\.rippling\.com\/embed\/integratecom-inc\/jobs\?s=https%3A%2F%2Fwww\.integrate\.com%2Fcompany%2Fcareers/i.test(rawHtml)
}

export const extractEmbeddedJobBoard = (html) => {
  const rawHtml = String(html ?? '')
  const slug = extractFirst(/data-job-board-id=["']([^"']+)["']/i, rawHtml)
  const embedUrl = toAbsoluteUrl(
    extractFirst(
      /<(?:iframe|div)\b[^>]*(?:data-lazy-src|src)=["']([^"']*ats\.rippling\.com\/embed\/[^"']+)["']/i,
      rawHtml,
    ),
    CAREERS_URL,
  )

  if (!isVerifiedBoardSlug(slug) || !embedUrl) {
    throw new Error('Integrate verified careers page no longer exposes the expected Rippling job board')
  }

  return { slug, embedUrl }
}

export const extractEmbedListings = (html) => {
  const pageProps = getPageProps(parseNextData(html))
  const board = pageProps?.apiData?.jobBoard
  const queries = pageProps?.dehydratedState?.queries

  if (!isVerifiedBoardSlug(board?.slug) || !/Integrate/i.test(String(board?.companyName ?? ''))) {
    throw new Error('Integrate verified Rippling embed no longer resolves to the expected board')
  }

  const listingsQuery = Array.isArray(queries)
    ? queries.find((query) => JSON.stringify(query?.queryKey ?? []).includes('"job-posts"'))
    : null
  const items = listingsQuery?.state?.data?.items

  if (!Array.isArray(items)) {
    throw new Error('Integrate verified Rippling embed no longer exposes job listings data')
  }

  return items
    .map((item) => {
      const indiaLocation = Array.isArray(item?.locations)
        ? item.locations.find((location) => (
          String(location?.countryCode ?? '').toUpperCase() === 'IN'
          || normalizeWhitespace(location?.country) === 'India'
          || isIndiaLocation(location?.name)
        ))
        : null

      if (!indiaLocation) return null

      return {
        title: normalizeWhitespace(item?.name),
        jobId: normalizeWhitespace(item?.id),
        requisitionId: normalizeWhitespace(item?.id),
        department: normalizeWhitespace(item?.department?.name),
        location: normalizeWhitespace(indiaLocation.name),
        city: normalizeWhitespace(indiaLocation.city) || null,
        country: normalizeWhitespace(indiaLocation.country) || 'India',
        workplaceType: normalizeWhitespace(indiaLocation.workplaceType),
        sourceUrl: toAbsoluteUrl(item?.url, 'https://ats.rippling.com/'),
      }
    })
    .filter((item) => item?.title && item?.jobId && item?.sourceUrl)
}

export const extractJobDetail = (html) => {
  const pageProps = getPageProps(parseNextData(html))
  const jobPost = pageProps?.apiData?.jobPost

  if (!isVerifiedBoardSlug(jobPost?.board?.slug) || !/Integrate/i.test(String(jobPost?.companyName ?? ''))) {
    throw new Error('Integrate verified job detail no longer resolves to the expected Rippling board')
  }

  const location = normalizeWhitespace(jobPost?.workLocations?.[0])
  const descriptionHtml = String(jobPost?.description ?? '')
  const jobDescription = stripHtml(descriptionHtml)

  return {
    title: normalizeWhitespace(jobPost?.name),
    jobId: normalizeWhitespace(jobPost?.id),
    requisitionId: normalizeWhitespace(jobPost?.id),
    department: normalizeWhitespace(jobPost?.department?.name),
    location,
    city: null,
    country: isIndiaLocation(location) ? 'India' : null,
    employmentType: normalizeWhitespace(jobPost?.employmentType?.id) || normalizeWhitespace(jobPost?.employmentType?.label),
    experienceRequired: extractExperienceRequired(jobDescription),
    jobDescription,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeIsoDate(jobPost?.createdOn),
    sourceUrl: toAbsoluteUrl(jobPost?.url, 'https://ats.rippling.com/'),
    applyUrl: toAbsoluteUrl(jobPost?.url, 'https://ats.rippling.com/'),
  }
}

export const createIntegrateScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Integrate verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Integrate verified careers page no longer matches the known first-party jobs surface')
    }

    const { embedUrl } = extractEmbeddedJobBoard(careersHtml)
    const listings = extractEmbedListings(await fetchText(embedUrl))

    const jobs = []
    for (const listing of listings) {
      const detail = extractJobDetail(await fetchText(listing.sourceUrl))

      if (!isIndiaLocation(detail.location)) {
        continue
      }

      jobs.push({
        ...detail,
        company: COMPANY,
        link: detail.applyUrl || detail.sourceUrl,
        source: SOURCE,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createIntegrateScraper().run(options)

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
