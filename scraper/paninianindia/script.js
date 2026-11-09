import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'paninianindia'
export const COMPANY = 'Paninian India'
export const COMPANY_DOMAIN = 'svayatt.co.in'
export const HOMEPAGE_URL = 'https://www.svayatt.co.in/'
export const HOMEPAGE_ALIAS_URLS = [
  'https://paninian.com/',
  'https://paninian.in/',
]
export const CAREERS_URL = 'https://www.svayatt.co.in/blank-19'
export const OPEN_POSITIONS_URL = 'https://www.svayatt.co.in/blank-24'
export const SHARED_APPLY_EMAIL = 'careers_india@paninian.com'
export const SHARED_APPLY_URL = `mailto:${SHARED_APPLY_EMAIL}`
export const MISSING_ROUTE_URLS = [
  'https://www.svayatt.co.in/careers',
  'https://www.svayatt.co.in/career',
  'https://www.svayatt.co.in/jobs',
  'https://www.svayatt.co.in/join-us',
]
export const EXPECTED_JOB_TITLES = [
  'Aerospace Structural Engineer',
  'Avionics and Flight Control Engineer',
  'Business Development Manager',
  'C++ Developer',
  'CAD Engineer',
  'CFD Simulation Engineer',
  'Combustion Systems Engineer',
  'Composite Fabrication Technician',
  'Control Systems Engineer',
  'Electromechanical Assembly Expert',
  'Engineering Manager',
  'Fabrication Technician',
  'Java Developer',
  'JavaScript Developer',
  'Materials Engineer',
  'Power Electronics Engineer',
  'Structural Engineer',
  'UX Developer',
]

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

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
) || ''

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    url.search = ''
    return url.toString()
  } catch {
    return null
  }
}

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

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
    ?.replace(/\s*\/\s*/g, ' / ')
    ?.replace(/\s*,\s*/g, ', ')

  if (!normalized) return null
  if (/, \bIndia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractPrimaryCity = (location) => {
  const normalized = normalizeWhitespace(location)?.replace(/,\s*India$/i, '')
  if (!normalized) return null

  const firstToken = normalized.split('/')[0]?.trim()
  return normalizeCity(firstToken || normalized)
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const exactYearsMatch = normalized.match(/\[\+?\s*(\d+)\s+years?\s+experience\]/i)
  if (exactYearsMatch?.[1]) {
    return `${exactYearsMatch[1]}+ years experience`
  }

  const bracketMatch = normalized.match(/\[([^\]]*?years?\s+experience)\]/i)
  return normalizeWhitespace(bracketMatch?.[1]) || null
}

const extractMinimumQualification = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\s*\[[^\]]+\]\s*$/, ''),
) || null

const normalizeSkill = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/^-+\s*/, '')
    .replace(/,+$/g, ''),
)

export const extractApplyEmail = (html) => {
  const match = String(html ?? '').match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  return match ? match[0].toLowerCase() : null
}

export const extractRichTextSegments = (html) => [...String(html ?? '').matchAll(
  /<div[^>]+data-testid=["']richTextElement["'][^>]*>\s*<h([1-6])[^>]*class=["'][^"']*\bwixui-rich-text__text\b[^"']*["'][^>]*>([\s\S]*?)<\/h\1>\s*<\/div>/gi,
)]
  .map((match) => {
    const lines = decodeHtmlEntities(match[2])
      .replace(/<br\b[^>]*\/?>/gi, '\n')
      .replace(/<\/?(?:span|a|strong|em|p|div|section|article)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean)

    return {
      html: match[2],
      lines,
      text: normalizeWhitespace(lines.join(' ')),
    }
  })
  .filter((segment) => segment.text)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Home\s*\|\s*Paninian Svayatt Portal\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.svayatt\.co\.in\/?["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Paninian Svayatt Portal["']/i.test(page)
    && normalized.includes('the unified platform for autonomous systems')
    && /href=["']mailto:info@paninian\.com["']/i.test(page)
    && /linkedin\.com\/company\/paninian-india-pvt-ltd/i.test(page)
}

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/www\.svayatt\.co\.in\/blank-19|\/blank-19)["']/i.test(String(html ?? ''))
  && normalizeText(html).includes('job openings')

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Careers\s*\|\s*Paninian Svayatt Portal\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.svayatt\.co\.in\/blank-19\/?["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Paninian Svayatt Portal["']/i.test(page)
    && normalized.includes('paninian aerospace is seeking to talent accross various disciplines')
    && normalized.includes('join us to make an impact')
    && normalized.includes(SHARED_APPLY_EMAIL)
}

export const hasVerifiedOpenPositionsLink = (html) =>
  /href=["'](?:https:\/\/www\.svayatt\.co\.in\/blank-24|\/blank-24)["']/i.test(String(html ?? ''))
  && normalizeText(html).includes('view open positions')

export const hasOfficialOpenPositionsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*open positions\s*\|\s*Paninian Svayatt Portal\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.svayatt\.co\.in\/blank-24\/?["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Paninian Svayatt Portal["']/i.test(page)
    && normalized.includes('open positions')
    && normalized.includes('job title')
    && normalized.includes('min qualification')
    && normalized.includes('skills')
    && normalized.includes('hyderabad')
    && normalized.includes('bangalore')
}

export const isVerifiedHomepageAlias = ({ status, url, html }) =>
  status === 200
  && normalizeUrl(url) === HOMEPAGE_URL
  && hasOfficialHomepageSignal(html)
  && hasVerifiedCareersLink(html)

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')

  return status === 404
    && /<title>\s*404 Error:\s*Page Not Found\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex["']/i.test(page)
    && /404-NotBranded/i.test(page)
    && /classic-error-pages-statics/i.test(page)
    && !hasOfficialOpenPositionsSignal(page)
}

const buildJobDescription = ({ minimumQualification, experienceRequired, requiredSkills }) => normalizeWhitespace([
  minimumQualification ? `Minimum qualification: ${minimumQualification}.` : null,
  experienceRequired ? `Experience: ${experienceRequired}.` : null,
  requiredSkills.length ? `Skills: ${requiredSkills.join('; ')}.` : null,
  `Apply via ${SHARED_APPLY_EMAIL}.`,
].filter(Boolean).join(' ')) || null

const buildRoleFromSegments = ({ titleSegment, locationSegment, qualificationSegment, skillsSegment }) => {
  const title = normalizeWhitespace(titleSegment?.text)
  const location = normalizeLocation(locationSegment?.text)
  const minimumQualification = extractMinimumQualification(qualificationSegment?.text)
  const experienceRequired = extractExperienceRequired(qualificationSegment?.text)
  const requiredSkills = (skillsSegment?.lines || [])
    .map((line) => normalizeSkill(line))
    .filter(Boolean)

  if (!title || !location || !minimumQualification || requiredSkills.length === 0) {
    throw new Error('Paninian India verified open positions grid changed shape')
  }

  const jobId = `${SOURCE}-${slugify(title)}`
  if (!jobId) {
    throw new Error(`Paninian India could not normalize a stable job identifier for ${title}`)
  }

  return {
    title,
    department: null,
    location,
    city: extractPrimaryCity(location),
    state: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: OPEN_POSITIONS_URL,
    applyUrl: SHARED_APPLY_URL,
    employmentType: null,
    workplaceType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({
      minimumQualification,
      experienceRequired,
      requiredSkills,
    }),
    remoteStatus: null,
  }
}

const extractFirstOpenPositionsSection = (html) => {
  const segments = extractRichTextSegments(html)
  const startIndex = segments.findIndex((segment, index) =>
    segment.text === 'Open Positions'
    && segments[index + 1]?.text === 'Job Title'
    && segments[index + 2]?.text === 'Location'
    && segments[index + 3]?.text === 'Min Qualification'
    && segments[index + 4]?.text === 'Skills',
  )

  if (startIndex === -1) {
    throw new Error('Paninian India verified open positions page no longer exposes the trusted jobs section heading')
  }

  const sectionStart = startIndex + 5
  const sectionEnd = segments.findIndex((segment, index) =>
    index > sectionStart
    && (
      segment.text === 'Join us to make an impact.'
      || segment.text === 'The next generation platform for affordable autonomous aerial systems'
    ),
  )

  if (sectionEnd === -1 || sectionEnd <= sectionStart) {
    throw new Error('Paninian India verified open positions page no longer exposes a bounded jobs section')
  }

  return segments.slice(sectionStart, sectionEnd)
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialOpenPositionsSignal(html)) {
    throw new Error('Paninian India verified open positions page no longer matches the trusted first-party surface')
  }

  const sectionSegments = extractFirstOpenPositionsSection(html)
  if (sectionSegments.length < 8) {
    throw new Error('Paninian India verified open positions grid changed shape')
  }

  const wrappedSkillsSegment = sectionSegments[0]
  const wrappedTitleSegments = sectionSegments.slice(-3)
  const groupedSegments = sectionSegments.slice(1, -3)

  if (!wrappedSkillsSegment?.lines?.length || wrappedTitleSegments.length !== 3 || groupedSegments.length % 4 !== 0) {
    throw new Error('Paninian India verified open positions grid changed shape')
  }

  const jobs = []

  for (let index = 0; index < groupedSegments.length; index += 4) {
    jobs.push(buildRoleFromSegments({
      titleSegment: groupedSegments[index],
      locationSegment: groupedSegments[index + 1],
      qualificationSegment: groupedSegments[index + 2],
      skillsSegment: groupedSegments[index + 3],
    }))
  }

  jobs.push(buildRoleFromSegments({
    titleSegment: wrappedTitleSegments[0],
    locationSegment: wrappedTitleSegments[1],
    qualificationSegment: wrappedTitleSegments[2],
    skillsSegment: wrappedSkillsSegment,
  }))

  const dedupedJobs = Array.from(
    new Map(jobs.map((job) => [job.jobId, job])).values(),
  ).sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))

  const extractedTitles = dedupedJobs.map((job) => job.title)
  if (
    dedupedJobs.length !== EXPECTED_JOB_TITLES.length
    || extractedTitles.some((title, index) => title !== EXPECTED_JOB_TITLES[index])
  ) {
    throw new Error('Paninian India verified open positions role set changed materially')
  }

  return dedupedJobs
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to the Paninian India scraper')
  }

  return parsed.toISOString()
}

export const createPaninianIndiaScraper = ({ now = () => new Date() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Paninian India verified official homepage no longer matches the trusted first-party surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('Paninian India homepage no longer links to the verified first-party careers landing page')
    }

    for (const aliasUrl of HOMEPAGE_ALIAS_URLS) {
      const aliasPage = await fetchPage(aliasUrl)

      if (!isVerifiedHomepageAlias(aliasPage)) {
        throw new Error('Paninian India official company domain aliases changed materially')
      }
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Paninian India verified first-party careers landing page no longer matches the trusted surface')
    }

    if (!hasVerifiedOpenPositionsLink(careersPage.html)) {
      throw new Error('Paninian India careers landing page no longer links to the verified first-party open positions page')
    }

    if (extractApplyEmail(careersPage.html) !== SHARED_APPLY_EMAIL) {
      throw new Error('Paninian India careers landing page no longer exposes the verified shared apply email')
    }

    const openPositionsPage = await fetchPage(OPEN_POSITIONS_URL)

    if (openPositionsPage.status !== 200 || !hasOfficialOpenPositionsSignal(openPositionsPage.html)) {
      throw new Error('Paninian India verified open positions page no longer matches the trusted first-party surface')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error('Paninian India missing canonical careers routes changed materially')
      }
    }

    const scrapedAt = normalizeScrapedAt((overrideNow || now)())
    const jobs = extractPublicJobs(openPositionsPage.html)

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      companyCareerPage: OPEN_POSITIONS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createPaninianIndiaScraper().run(options)

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
