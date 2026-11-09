import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'rsasecurityapplications'
export const COMPANY = 'RSA Security Applications'
export const CAREERS_URL = 'https://www.rsa.com/rsa-careers/'
export const JOBS_URL = 'https://ats.rippling.com/rsa-security/jobs'
export const JOB_BOARD_SLUG = 'rsa-security'
export const OFFICIAL_BOARD_COMPANY = 'RSA Security'
const VERIFIED_CAREERS_PAGE_SIGNALS = [
  'Our Culture',
  'Rewards, Benefits, and Growth',
  'RSA Values',
  'Join RSA to build your career',
  'and secure the most secure.',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&rsquo;/gi, '’')
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')
  .replace(/\u2011|\u2012|\u2013|\u2014|\u2212/g, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, ' ')
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
    throw new Error('RSA Security Applications verified Rippling surface no longer exposes __NEXT_DATA__')
  }

  return JSON.parse(payload)
}

const getPageProps = (nextData) => nextData?.props?.pageProps ?? nextData?.pageProps ?? null

const getDehydratedQueries = (pageProps) => pageProps?.dehydratedState?.queries

const isVerifiedBoardSlug = (value) => normalizeWhitespace(value) === JOB_BOARD_SLUG

const isVerifiedBoardCompany = (value) => normalizeWhitespace(value) === OFFICIAL_BOARD_COMPANY

const isExplicitIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  return normalized === 'India'
    || normalized.endsWith(', India')
    || /^Remote\s*\((?:[^)]*,\s*)?India\)$/i.test(normalized)
}

const toAbsoluteUrl = (value, baseUrl = JOBS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeIsoDate = (value) => {
  const text = normalizeWhitespace(value)
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text)
  return match ? match[1] : null
}

const extractExperienceRequired = (value) => {
  const match = normalizeWhitespace(value).match(/\b(\d+\s*(?:\+|-\s*\d+)\s*years?)\b/i)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractRequiredSkills = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripHtml(match[1]))
  .filter(Boolean)

const getJobPostsQuery = (queries) => {
  if (!Array.isArray(queries)) return null

  return queries.find((query) => {
    const queryKey = query?.queryKey ?? []
    return Array.isArray(queryKey) && queryKey[2] === 'job-posts'
  }) ?? null
}

const normalizeListing = (item) => {
  const indiaLocation = Array.isArray(item?.locations)
    ? item.locations.find((location) => (
      String(location?.countryCode ?? '').toUpperCase() === 'IN'
      && isExplicitIndiaLocation(location?.name)
    ))
    : null

  if (!indiaLocation) return null

  return {
    title: normalizeWhitespace(item?.name),
    jobId: normalizeWhitespace(item?.id),
    requisitionId: normalizeWhitespace(item?.id),
    department: normalizeWhitespace(item?.department?.name),
    location: normalizeWhitespace(indiaLocation?.name),
    city: normalizeWhitespace(indiaLocation?.city) || null,
    state: normalizeWhitespace(indiaLocation?.state) || null,
    country: normalizeWhitespace(indiaLocation?.country) || 'India',
    workplaceType: normalizeWhitespace(indiaLocation?.workplaceType) || null,
    sourceUrl: toAbsoluteUrl(item?.url, JOBS_URL),
  }
}

const buildBoardPageUrl = (page) => (page === 0 ? JOBS_URL : `${JOBS_URL}?page=${page}`)

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

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = stripHtml(rawHtml)

  return /<title[^>]*>\s*RSA Careers\b/i.test(rawHtml)
    && VERIFIED_CAREERS_PAGE_SIGNALS.every((signal) => normalized.includes(signal))
    && /href=["']https:\/\/ats\.rippling\.com\/rsa-security\/jobs["']/i.test(rawHtml)
}

export const extractVerifiedJobBoardUrl = (html) => {
  if (!hasVerifiedCareersPageSignal(html)) {
    throw new Error('RSA Security Applications verified first-party careers page no longer matches the expected public surface')
  }

  const matches = [...String(html ?? '').matchAll(/href=["'](https:\/\/ats\.rippling\.com\/rsa-security\/jobs(?:[^"']*)?)["']/gi)]
  const verifiedUrl = matches
    .map((match) => toAbsoluteUrl(match[1], CAREERS_URL))
    .find((url) => url === JOBS_URL)

  if (!verifiedUrl) {
    throw new Error('RSA Security Applications verified first-party careers page no longer links to the expected Rippling board')
  }

  return verifiedUrl
}

export const extractIndiaListingsFromBoardPage = (html) => {
  const pageProps = getPageProps(parseNextData(html))
  const board = pageProps?.apiData?.jobBoard
  const jobPostsQuery = getJobPostsQuery(getDehydratedQueries(pageProps))
  const data = jobPostsQuery?.state?.data
  const items = data?.items
  const page = data?.page
  const totalPages = data?.totalPages

  if (
    !isVerifiedBoardSlug(board?.slug)
    || !isVerifiedBoardCompany(board?.companyName)
    || normalizeWhitespace(board?.title) !== 'RSA Career Opportunities'
    || normalizeWhitespace(board?.boardURL) !== JOBS_URL
  ) {
    throw new Error('RSA Security Applications verified Rippling listing shell no longer resolves to the expected RSA board')
  }

  if (!Array.isArray(items) || !Number.isInteger(page) || !Number.isInteger(totalPages)) {
    throw new Error('RSA Security Applications verified Rippling listing shell no longer exposes paginated listings data')
  }

  const listings = items
    .map(normalizeListing)
    .filter((item) => item?.title && item?.jobId && item?.sourceUrl)

  return { page, totalPages, listings }
}

export const extractJobDetail = (html) => {
  const pageProps = getPageProps(parseNextData(html))
  const jobPost = pageProps?.apiData?.jobPost
  const board = pageProps?.apiData?.jobBoard ?? jobPost?.board
  const location = normalizeWhitespace(jobPost?.workLocations?.[0])
  const descriptionHtml = [
    jobPost?.description?.company,
    jobPost?.description?.role,
    typeof jobPost?.description === 'string' ? jobPost.description : null,
  ]
    .filter(Boolean)
    .join(' ')
  const jobDescription = stripHtml(descriptionHtml)

  if (
    !isVerifiedBoardSlug(board?.slug ?? jobPost?.board?.slug)
    || !isVerifiedBoardCompany(board?.companyName ?? jobPost?.companyName)
    || !isExplicitIndiaLocation(location)
  ) {
    throw new Error('RSA Security Applications verified Rippling job detail no longer resolves to the expected India job surface')
  }

  return {
    title: normalizeWhitespace(jobPost?.name),
    jobId: normalizeWhitespace(jobPost?.id ?? jobPost?.uuid),
    requisitionId: normalizeWhitespace(jobPost?.id ?? jobPost?.uuid),
    department: normalizeWhitespace(jobPost?.department?.base_department) || normalizeWhitespace(jobPost?.department?.name),
    location,
    city: location.includes(',') ? normalizeWhitespace(location.split(',')[0]) : null,
    state: normalizeWhitespace(jobPost?.location?.state) || null,
    country: 'India',
    employmentType: normalizeWhitespace(jobPost?.employmentType?.label) || normalizeWhitespace(jobPost?.employmentType?.id),
    experienceRequired: extractExperienceRequired(jobDescription),
    jobDescription,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeIsoDate(jobPost?.createdOn),
    sourceUrl: toAbsoluteUrl(jobPost?.url, JOBS_URL),
    applyUrl: toAbsoluteUrl(jobPost?.url, JOBS_URL),
  }
}

export const createRsaSecurityApplicationsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const verifiedBoardUrl = extractVerifiedJobBoardUrl(careersHtml)

    const firstBoardPage = extractIndiaListingsFromBoardPage(await fetchText(verifiedBoardUrl))
    const listings = [...firstBoardPage.listings]

    for (let page = 1; page < firstBoardPage.totalPages; page += 1) {
      const pageData = extractIndiaListingsFromBoardPage(await fetchText(buildBoardPageUrl(page)))
      listings.push(...pageData.listings)
    }

    const jobs = []
    for (const listing of listings) {
      const detail = extractJobDetail(await fetchText(listing.sourceUrl))
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

export const run = async (options = {}) => createRsaSecurityApplicationsScraper().run(options)

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
