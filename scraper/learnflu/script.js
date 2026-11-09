import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'learnflu'
export const COMPANY = 'LearnFlu'
export const HOMEPAGE_URL = 'https://learnflu.com/'
export const CAREERS_URL = 'https://learnflu.com/careers/'
export const APPLY_POPUP_HASH = '#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjE0ODYiLCJ0b2dnbGUiOmZhbHNlfQ%3D%3D'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '')).replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Learnflu\b[^<]*Where Learning Meets Opportunity/i.test(page)
    && /Where Learning Meets Opportunity/i.test(text)
    && /support@learnflu\.com/i.test(text)
    && /08041660925/i.test(text)
    && /<a[^>]+href=["']https:\/\/learnflu\.com\/careers\/["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Careers\b[^<]*Learnflu/i.test(page)
    && /Careers at LearnFlu/i.test(text)
    && /Secure The Job By Applying Below Jobs/i.test(text)
    && /name=["']Career Form["']/i.test(page)
    && /Job Profile/i.test(text)
    && /Upload Your Resume/i.test(text)
}

const ZERO_JOBS_SIGNAL_PATTERN = /\b(no current openings|no open positions|no jobs available)\b/i

const JOB_CARD_MARKER = 'data-settings="{&quot;background_background&quot;:&quot;classic&quot;}"'
const JOB_TITLE_MARKER = '<h4 class="elementor-heading-title elementor-size-default">'
const APPLY_BUTTON_TEXT = 'View Apply'

const toResolvedUrl = (value, base) => {
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

const extractJobSectionHtml = (html) => {
  const rawHtml = String(html ?? '')
  const startMarker = 'Secure The Job By Applying Below Jobs'
  const endMarker = 'Why Employers Trust Our Candidate'
  const startIndex = rawHtml.indexOf(startMarker)
  const endIndex = rawHtml.indexOf(endMarker)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return rawHtml
  }

  return rawHtml.slice(startIndex, endIndex)
}

const extractCardBlocks = (sectionHtml) =>
  sectionHtml
    .split(JOB_CARD_MARKER)
    .slice(1)
    .map((block) => block.trim())
    .filter(Boolean)

const countMatches = (value, pattern) => [...String(value ?? '').matchAll(pattern)].length

const parseCardBlock = (blockHtml) => {
  const match = String(blockHtml ?? '').match(
    /<h2 class="elementor-heading-title elementor-size-default">([^<]+)<\/h2>[\s\S]*?<h4 class="elementor-heading-title elementor-size-default">([^<]+)<\/h4>[\s\S]*?<span class="elementor-icon-list-text">([^<]+)<\/span>[\s\S]*?<span class="elementor-icon-list-text">([^<]+)<\/span>[\s\S]*?<span class="elementor-icon-list-text">([^<]+)<\/span>[\s\S]*?<span class="elementor-icon-list-text">([^<]+)<\/span>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<span class="elementor-button-text">View Apply<\/span>/i,
  )

  if (!match) {
    return null
  }

  const [
    ,
    rawDepartment,
    rawTitle,
    rawLocation,
    rawCompensation,
    rawEmploymentType,
    rawExperienceRequired,
    rawApplyHref,
  ] = match

  const department = stripTags(rawDepartment)
  const title = stripTags(rawTitle)
  const city = stripTags(rawLocation)
  const compensation = stripTags(rawCompensation)
  const employmentType = stripTags(rawEmploymentType)
  const experienceRequired = stripTags(rawExperienceRequired)
  const applyUrl = toResolvedUrl(normalizeWhitespace(rawApplyHref), CAREERS_URL)
  const location = city ? `${city}, India` : null
  const jobId = `learnflu-${slugify(`${department}-${title}-${city}`)}`

  if (!department || !title || !city || !compensation || !employmentType || !experienceRequired || !applyUrl) {
    throw new Error('LearnFlu verified careers job cards changed shape')
  }

  return {
    title,
    company: COMPANY,
    department,
    location,
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_URL,
    applyUrl,
    employmentType,
    workplaceType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation,
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  }
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('LearnFlu verified first-party careers page no longer matches the known public shell')
  }

  const sectionHtml = extractJobSectionHtml(html)
  const cardBlocks = extractCardBlocks(sectionHtml)
  const cards = cardBlocks.map((blockHtml) => parseCardBlock(blockHtml)).filter(Boolean)

  if (cards.length === 0) {
    if (ZERO_JOBS_SIGNAL_PATTERN.test(stripTags(html))) {
      return []
    }

    throw new Error('LearnFlu verified careers job cards changed shape')
  }

  const applyButtonCount = countMatches(sectionHtml, /<span class="elementor-button-text">View Apply<\/span>/gi)
  if (applyButtonCount !== cards.length) {
    throw new Error('LearnFlu verified careers job cards changed shape')
  }

  const expectedApplyUrl = toResolvedUrl(APPLY_POPUP_HASH, CAREERS_URL)
  if (!expectedApplyUrl || cards.some((card) => card?.applyUrl !== expectedApplyUrl)) {
    throw new Error('LearnFlu verified careers apply popup changed materially')
  }

  return cards.sort((left, right) =>
    left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId),
  )
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createLearnFluScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('LearnFlu verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicJobs(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'learnflu.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createLearnFluScraper().run(options)

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
