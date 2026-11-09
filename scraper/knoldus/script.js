import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'knoldus'
export const COMPANY = 'Knoldus Inc'
export const LEGACY_HOMEPAGE_URL = 'https://knoldus.com/'
export const HOMEPAGE_REDIRECT_URL = 'https://www.nashtechglobal.com/'
export const CAREERS_HANDOFF_URL = 'https://www.nashtechglobal.com/careers/'
export const CAREERS_URL = 'https://careers.nashtechglobal.com/'
export const JOBS_FINDER_URL = 'https://careers.nashtechglobal.com/jobs-finder/'
export const JOBS_API_URL = 'https://careers.nashtechglobal.com/wp-json/ntc/job/get/v2'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN =
  /\b(india|noida|bengaluru|bangalore|hyderabad|pune|chennai|mumbai|gurgaon|gurugram)\b/i

const REQUIRED_BUNDLE_PATTERNS = [
  /fetch\(["']\/wp-json\/ntc\/taxonomy\/get["'],\s*\{[\s\S]*?method\s*:\s*["']POST["']/i,
  /fetch\(["']\/wp-json\/ntc\/job\/get\/v2["'],\s*\{[\s\S]*?method\s*:\s*["']POST["']/i,
  /window\.history\.pushState/i,
  /Find (?:Authentic Jobs|your dream job) in NashTech/i,
  /Open jobs/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')

const stripTags = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(stripTags(value)).toLowerCase()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

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
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    signal: createTimeoutSignal(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*IT consulting and technology services \| Custom software development company\s*<\/title>/i.test(page)
    && text.includes('nashtech is a global it consulting and technology services partner')
    && /href=["']https:\/\/careers\.nashtechglobal\.com\/?["']/i.test(page)
}

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/careers\.nashtechglobal\.com\/?|\/jobs-finder\/?)["']/i.test(String(html ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*NashTech Careers: Explore Opportunities in Tech\s*<\/title>/i.test(page)
    && text.includes('where technology meets excellence')
    && text.includes('featured jobs')
    && text.includes('ready for a new journey with us')
    && /href=["'](?:https:\/\/www\.nashtechglobal\.com\/?|\/jobs-finder\/?)["']/i.test(page)
}

export const extractJobsFinderBundleUrl = (html) => {
  const match = String(html ?? '').match(
    /<script\b[^>]*\bid=["'][^"']*rp-react-app-asset[^"']*["'][^>]*\bsrc=["']([^"']*\/wp-content\/reactpress\/apps\/job-finder\/build\/static\/js\/main\.[^"']+\.js(?:\?[^"']*)?)["']/i,
  )

  if (!match?.[1]) {
    return null
  }

  try {
    return new URL(match[1], JOBS_FINDER_URL).toString()
  } catch {
    return null
  }
}

export const hasJobsFinderShellSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Job offers - Careers\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/careers\.nashtechglobal\.com\/jobs-finder\/["']/i.test(page)
    && /<div id=["']root["']><\/div>/i.test(page)
    && (
      page.includes('https://careers.nashtechglobal.com/wp-json/')
      || /"rest_url"\s*:\s*"https:\\\/\\\/careers\.nashtechglobal\.com\\\/wp-json\\\/"/i.test(page)
    )
    && extractJobsFinderBundleUrl(page) !== null
}

export const hasVerifiedJobsBundleSignal = (bundleText) =>
  REQUIRED_BUNDLE_PATTERNS.every((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedHomepageRedirect = (page = {}) =>
  Number(page?.status) === 200
  && normalizeComparableUrl(page?.url) === normalizeComparableUrl(HOMEPAGE_REDIRECT_URL)
  && hasOfficialHomepageSignal(page?.html)
  && hasVerifiedCareersLink(page?.html)

export const isVerifiedCareersHandoff = (page = {}) =>
  Number(page?.status) === 200
  && normalizeComparableUrl(page?.url) === normalizeComparableUrl(CAREERS_URL)
  && hasOfficialCareersSignal(page?.html)
  && hasVerifiedCareersLink(page?.html)

const getTaxonomyValues = (job, taxonomyName) =>
  Array.isArray(job?.taxonomy)
    ? job.taxonomy
      .filter((item) => item?.taxonomy === taxonomyName)
      .map((item) => normalizeWhitespace(item?.name))
      .filter(Boolean)
    : []

const getFirstTaxonomyValue = (job, taxonomyName) => getTaxonomyValues(job, taxonomyName)[0] ?? null

const isIndiaLocation = (value) => INDIA_LOCATION_PATTERN.test(String(value ?? ''))

const extractIndiaLocation = (job) => getTaxonomyValues(job, 'location').find((value) => isIndiaLocation(value)) ?? null

const extractCity = (location) => {
  const cleaned = normalizeWhitespace(location)
  if (!cleaned) return null

  const [city] = cleaned.split(' - ')
  return city || null
}

const normalizeAbsoluteUrl = (value, baseUrl) => {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) return null

  try {
    return new URL(rawValue, baseUrl).toString()
  } catch {
    return null
  }
}

const extractJobSlug = (job) => {
  const fromPermalink = normalizeAbsoluteUrl(job?.post_permalink, CAREERS_URL)
  if (fromPermalink) {
    const pathSegments = new URL(fromPermalink).pathname.split('/').filter(Boolean)
    const lastSegment = pathSegments.at(-1)
    if (lastSegment) {
      return slugify(lastSegment)
    }
  }

  const fallback = [job?.post_title, extractCity(extractIndiaLocation(job))].filter(Boolean).join(' ')
  return slugify(fallback)
}

const extractPostingDate = (value) => {
  const rawValue = String(value ?? '')
  const match = rawValue.match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] ?? null
}

const extractJobDescription = (value) => normalizeWhitespace(stripTags(value)) || null

const extractRequiredSkills = (job) => {
  const values = [
    ...getTaxonomyValues(job, 'competency'),
    ...getTaxonomyValues(job, 'tag'),
  ]

  return [...new Set(values)]
}

export const mapIndiaJobs = (jobs = []) => {
  if (!Array.isArray(jobs)) {
    throw new Error('Knoldus NashTech jobs API no longer returns an array payload')
  }

  return jobs
    .filter((job) => extractIndiaLocation(job))
    .map((job) => {
      const title = normalizeWhitespace(job?.post_title)
      const sourceUrl = normalizeAbsoluteUrl(job?.post_permalink, CAREERS_URL)
      const applyUrl = normalizeAbsoluteUrl(job?.meta_data?.override_url, CAREERS_URL) || sourceUrl
      const location = extractIndiaLocation(job)
      const workplaceTypes = getTaxonomyValues(job, 'workplace-type')
      const jobSlug = extractJobSlug(job)

      if (!title || !sourceUrl || !applyUrl || !location || !jobSlug) {
        throw new Error('Knoldus NashTech jobs API no longer exposes the verified India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: getFirstTaxonomyValue(job, 'department'),
        location: workplaceTypes.length > 0
          ? `${location} / ${workplaceTypes.join(', ')}`
          : location,
        city: extractCity(location),
        country: 'India',
        jobId: `${SOURCE}-${jobSlug}`,
        requisitionId: `${SOURCE}-${jobSlug}`,
        sourceUrl,
        applyUrl,
        employmentType: getFirstTaxonomyValue(job, 'job-type'),
        experienceRequired: getFirstTaxonomyValue(job, 'experience'),
        minimumQualification: getFirstTaxonomyValue(job, 'qualification'),
        preferredQualification: null,
        requiredSkills: extractRequiredSkills(job),
        postingDate: extractPostingDate(job?.post_date),
        closingDate: null,
        jobDescription: extractJobDescription(job?.post_content),
      }
    })
}

export const createKnoldusScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: overrideNow,
  } = {}) {
    const homepage = await fetchPage(LEGACY_HOMEPAGE_URL)
    if (!isVerifiedHomepageRedirect(homepage)) {
      throw new Error('Knoldus legacy homepage redirect no longer matches the verified NashTech surface')
    }

    const careersHandoff = await fetchPage(CAREERS_HANDOFF_URL)
    if (!isVerifiedCareersHandoff(careersHandoff)) {
      throw new Error('Knoldus verified NashTech careers handoff changed materially')
    }

    const jobsFinderPage = await fetchPage(JOBS_FINDER_URL)
    if (
      jobsFinderPage.status !== 200
      || normalizeComparableUrl(jobsFinderPage.url) !== normalizeComparableUrl(JOBS_FINDER_URL)
      || !hasJobsFinderShellSignal(jobsFinderPage.html)
    ) {
      throw new Error('Knoldus verified NashTech jobs finder shell changed materially')
    }

    const bundleUrl = extractJobsFinderBundleUrl(jobsFinderPage.html)
    if (!bundleUrl) {
      throw new Error('Knoldus NashTech jobs finder no longer exposes the verified ReactPress bundle')
    }

    const bundleText = await fetchText(bundleUrl)
    if (!hasVerifiedJobsBundleSignal(bundleText)) {
      throw new Error('Knoldus NashTech jobs bundle contract changed materially')
    }

    const rawJobs = await fetchJson(JOBS_API_URL)
    const jobs = mapIndiaJobs(rawJobs)
    const scrapedAt = (overrideNow || now)()

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
      companyCareerPage: CAREERS_HANDOFF_URL,
      companyDomain: 'nashtechglobal.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createKnoldusScraper().run(options)

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
