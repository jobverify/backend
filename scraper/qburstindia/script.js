import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'qburstindia'
export const COMPANY = 'Qburst India'
export const OFFICIAL_BRAND = 'QBurst'
export const CAREERS_URL = 'https://www.qburst.com/en-in/company/career/'
export const OPENINGS_URL = 'https://www.qburst.com/en-in/company/career/openings/'
export const DISPOSITION = 'official-company-careers-empty-openings'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Tuesday, August 4, 2026 that https://www.qburst.com/en-in/company/career/ was the live QBurst India first-party careers landing page with search controls, while https://www.qburst.com/en-in/company/career/openings/ presented an empty public openings state reading "Open Positions" and "We need people like you. Submit your resume for future opportunities." with a "Submit Resume" action and no visible /job-details/ links.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const JOB_BUTTON_SELECTOR = 'button[aria-label="View and Apply"]'
const DETAIL_URL_PATTERN = /\/job-details\//i
const LISTING_SECTION_HEADINGS = ['Responsibilities', 'Requirements', 'Apply For']

const buildChromiumLaunchArgs = () =>
  process.env.PUPPETEER_DISABLE_SANDBOX ? ['--no-sandbox'] : []

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const unique = (values) => [...new Set(values.map(clean).filter(Boolean))]

const normalizeLines = (value = '') => String(value)
  .split(/\r?\n/)
  .map(clean)
  .filter(Boolean)

const isIndiaLocation = (value = '') => /\bindia\b/i.test(clean(value))

const extractText = (html = '') => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim()

export const hasVerifiedCareersLandingSignal = (html = '') => {
  const rawHtml = String(html)
  const text = extractText(rawHtml)

  return /<title[^>]*>\s*Careers\s*\|\s*QBurst\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.qburst\.com\/en-in\/company\/career\/["']/i.test(rawHtml)
    && /Join a\s+High AI-Q/i.test(text)
    && /Search Open Roles/i.test(text)
    && /Recruitment Fraud Alert/i.test(text)
}

export const hasVerifiedLegacyOpeningsBoardSignal = (html = '') => {
  const rawHtml = String(html)

  return /<title[^>]*>\s*Job Openings\s*\|\s*QBurst\s*<\/title>/i.test(rawHtml)
    && /https:\/\/www\.qburst\.com\/en-in\/company\/career\/openings\//i.test(rawHtml)
    && /Match your experience with the current openings and apply where you think you fit best\./i.test(rawHtml)
    && /job-list-filter-block|count_display_text/i.test(rawHtml)
}

export const hasVerifiedOpeningsEmptyStateSignal = (html = '') => {
  const rawHtml = String(html)
  const text = extractText(rawHtml)

  return /<title[^>]*>\s*Job Openings\s*\|\s*QBurst\s*<\/title>/i.test(rawHtml)
    && /https:\/\/www\.qburst\.com\/en-in\/company\/career\/openings\//i.test(rawHtml)
    && /Open Positions/i.test(text)
    && /We need people like you\. Submit your resume for future opportunities\./i.test(text)
    && /Submit Resume/i.test(text)
    && !/\/job-details\//i.test(rawHtml)
}

export const hasVerifiedOpeningsPageSignal = (html = '') =>
  hasVerifiedLegacyOpeningsBoardSignal(html) || hasVerifiedOpeningsEmptyStateSignal(html)

export const extractJobCardSummary = (lines = []) => {
  const filtered = lines
    .map(clean)
    .filter(Boolean)
    .filter((line) => !/^View and Apply$/i.test(line))

  return {
    jobId: filtered[0] || null,
    title: filtered[1] || null,
    location: filtered[2] || null,
    experienceRequired: filtered.find((line, index) => index >= 3 && /\byrs?\b/i.test(line)) || null,
    previewText: filtered.slice(4).join(' ') || null,
  }
}

export const extractSectionLines = (lines = [], heading, nextHeadings = []) => {
  const normalizedHeading = clean(heading).toLowerCase()
  const headingIndex = lines.findIndex((line) => clean(line).toLowerCase() === normalizedHeading)
  if (headingIndex === -1) return []

  const stopHeadings = nextHeadings.map((value) => clean(value).toLowerCase())
  const values = []

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = clean(lines[index])
    if (!line) continue
    if (stopHeadings.some((value) => line.toLowerCase().startsWith(value))) break
    values.push(line)
  }

  return values
}

export const normalizeQburstLocation = (summaryLocation, detailLocations = []) => {
  const summary = clean(summaryLocation)
  const locations = detailLocations
    .flatMap((value) => clean(value).split(','))
    .map(clean)
    .filter(Boolean)
    .filter(isIndiaLocation)

  if (isIndiaLocation(summary)) return summary
  if (locations.length > 1) return 'Multiple Cities, India'
  if (locations.length === 1) {
    const single = locations[0].replace(/^India\s*-\s*/i, '')
    return /\bindia\b/i.test(single) ? single : `${single}, India`
  }

  return null
}

export const extractCityFromLocation = (location) => {
  const normalized = clean(location)
  if (!normalized || /multiple cities/i.test(normalized)) return null

  const indiaPrefixed = normalized.match(/^India\s*-\s*([^,]+)/i)
  if (indiaPrefixed) return clean(indiaPrefixed[1]) || null

  return clean(normalized.split(',')[0]) || null
}

export const buildJobFromDetail = ({
  summary,
  detailLines,
  detailUrl,
  company = COMPANY,
  scrapedAt,
}) => {
  const title = clean(
    detailLines.find((line) => clean(line) === clean(summary?.title))
      || summary?.title,
  )
  const locationLines = extractSectionLines(detailLines, 'Locations', LISTING_SECTION_HEADINGS)
  const location = normalizeQburstLocation(summary?.location, locationLines)

  if (!title || !location || !isIndiaLocation(location)) return null

  const responsibilities = extractSectionLines(detailLines, 'Responsibilities', ['Requirements', 'Apply For'])
  const requirements = extractSectionLines(detailLines, 'Requirements', ['Apply For'])
  const descriptionParts = []
  if (responsibilities.length > 0) {
    descriptionParts.push(`Responsibilities: ${responsibilities.join(' ')}`)
  }
  if (requirements.length > 0) {
    descriptionParts.push(`Requirements: ${requirements.join(' ')}`)
  }

  return {
    title,
    company,
    location,
    city: extractCityFromLocation(location),
    country: 'India',
    link: detailUrl,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    jobId: clean(summary?.jobId) || clean(detailUrl.split('/').filter(Boolean).at(-1)),
    requisitionId: clean(summary?.jobId) || clean(detailUrl.split('/').filter(Boolean).at(-1)),
    department: null,
    employmentType: null,
    remoteStatus: null,
    experienceRequired: clean(summary?.experienceRequired) || null,
    minimumQualification: requirements.length > 0 ? requirements.join(' ') : null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: descriptionParts.join(' ') || null,
    source: SOURCE,
    scrapedAt,
  }
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds)
})

const dismissCookieConsent = async (page) => {
  for (const label of ['Only Necessary', 'Accept All']) {
    const button = page.getByRole('button', { name: label }).first()
    const visible = await button.isVisible().catch(() => false)
    if (!visible) continue

    await button.click({ timeout: 5000 }).catch(() => {})
    await wait(500)
    return
  }
}

const ensureVisibleJobCards = async (page, minimumCount) => {
  let count = await page.locator(JOB_BUTTON_SELECTOR).count()

  for (let attempt = 0; attempt < 20 && count < minimumCount; attempt += 1) {
    await page.mouse.wheel(0, 2500)
    await wait(600)
    count = await page.locator(JOB_BUTTON_SELECTOR).count()
  }

  if (count < minimumCount) {
    throw new Error(
      `[qburstindia] Expected at least ${minimumCount} visible job cards, found ${count}`,
    )
  }

  return count
}

const loadTargetJobCount = async (page) => {
  const text = await page.locator('body').innerText()
  const match = text.match(/We Found\s+(\d+)\s+Job Openings/i)
  return Number.parseInt(match?.[1] || '', 10) || null
}

export const scrapeOpeningsPage = async ({
  openingsUrl = OPENINGS_URL,
  maxJobs = Number.POSITIVE_INFINITY,
  now = () => new Date().toISOString(),
} = {}) => {
  void openingsUrl
  void maxJobs
  void now
  throw new Error(
    '[qburstindia] API-only migration required: no verified HTTP/API contract is available for the historical openings board; browser automation is disabled.',
  )
}

export const createQBurstIndiaScraper = ({
  maxJobs = Number.POSITIVE_INFINITY,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchHtml = defaultFetchHtml,
    scrapeJobs = scrapeOpeningsPage,
  } = {}) {
    if (maxJobs !== Number.POSITIVE_INFINITY && (!Number.isInteger(maxJobs) || maxJobs <= 0)) {
      throw new Error('[qburstindia] maxJobs must be a positive integer when provided')
    }

    const careersHtml = await fetchHtml(CAREERS_URL)
    if (!hasVerifiedCareersLandingSignal(careersHtml)) {
      throw new Error('QBurst India verified careers landing page no longer matches the trusted first-party surface')
    }

    const openingsHtml = await fetchHtml(OPENINGS_URL)
    if (!hasVerifiedOpeningsPageSignal(openingsHtml)) {
      throw new Error('QBurst India verified openings page no longer matches the trusted first-party surface')
    }

    if (hasVerifiedOpeningsEmptyStateSignal(openingsHtml)) {
      return []
    }

    return scrapeJobs({
      openingsUrl: OPENINGS_URL,
      maxJobs,
      now,
    })
  },
})

export const run = async (options = {}) => createQBurstIndiaScraper(options).run(options)

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
