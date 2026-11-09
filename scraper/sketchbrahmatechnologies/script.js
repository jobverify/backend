import path from 'node:path'
import { parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sketchbrahmatechnologies'
export const COMPANY = 'Sketch Brahma Technologies'
export const HOMEPAGE_URL = 'https://www.sketchbrahma.com/'
export const CAREERS_URL = 'https://www.sketchbrahma.com/careers'

const COMPANY_DOMAIN = 'sketchbrahma.com'
const ATS_PLATFORM = 'official-company-careers'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CATEGORY_DEFINITIONS = [
  { role: 'Design', pattern: /\],\s*w\s*=\s*\[/ },
  { role: 'Development', pattern: /\],\s*S\s*=\s*\[/ },
  { role: 'Sales/Business', pattern: /\],\s*N\s*=\s*\[/ },
  { role: 'IT Recruiter', pattern: /\],\s*_\s*=\s*\[/ },
  { role: 'Quality Analyst', pattern: /\],\s*C\s*=\s*\[/ },
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeCategoryKey = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/\s*\/\s*/g, '/')
  || null

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const toStringArray = (value) => Array.isArray(value)
  ? Array.from(value, (item) => normalizeWhitespace(item)).filter(Boolean)
  : []

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/years?/i.test(normalized)) return normalized.replace(/\s*years?/i, ' Years')
  return `${normalized} Years`
}

const inferCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const firstSegment = normalized.split(',')[0]?.trim()
  if (!firstSegment) return null

  if (/^bangalore$/i.test(firstSegment)) return 'Bengaluru'

  return normalizeCity(firstSegment) || firstSegment
}

const extractApplyToken = (url) => {
  try {
    const parsed = new URL(url)
    return normalizeWhitespace(parsed.searchParams.get('t'))
  } catch {
    return null
  }
}

const isFirstPartyApplyUrl = (url) => {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('t')

    return parsed.protocol === 'https:'
      && parsed.hostname.toLowerCase() === 'labs.sketchbrahma.com'
      && parsed.pathname === '/apply.php'
      && /^[a-f0-9]{32,}$/i.test(token || '')
  } catch {
    return false
  }
}

const findMatchingBracket = (text, startIndex) => {
  let depth = 0
  let quote = null
  let escaped = false

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (character === '\\') {
        escaped = true
        continue
      }
      if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '\'' || character === '"' || character === '`') {
      quote = character
      continue
    }

    if (character === '[') {
      depth += 1
      continue
    }

    if (character === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

const extractArrayLiteral = (bundleJs, pattern) => {
  const page = String(bundleJs ?? '')
  const match = pattern.exec(page)
  if (!match) return null

  const startIndex = match.index + match[0].length - 1
  const endIndex = findMatchingBracket(page, startIndex)
  if (endIndex === -1) return null

  return page.slice(startIndex, endIndex + 1)
}

const evaluateArrayLiteral = (literal, label) => {
  if (!literal) {
    throw new Error(`Sketch Brahma verified public jobs surface no longer exposes the ${label} array`)
  }

  const value = parseRemoteLiteral(literal)
  if (!Array.isArray(value)) {
    throw new Error(`Sketch Brahma verified public jobs surface no longer exposes a valid ${label} array`)
  }

  return value
}

const parseOpeningCount = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

const buildJobDescription = ({
  location,
  experienceRequired,
  responsibilities,
  requirements,
  skills,
}) => {
  const lines = []

  if (location) lines.push(`Location: ${location}`)
  if (experienceRequired) lines.push(`Experience: ${experienceRequired}`)

  const sections = [
    ['Job Responsibilities', responsibilities],
    ['Requirements', requirements],
    ['Skills', skills],
  ]

  for (const [label, items] of sections) {
    if (!items.length) continue
    lines.push('', `${label}:`)
    for (const item of items) {
      lines.push(`- ${item}`)
    }
  }

  return lines.join('\n').trim()
}

const buildRawJob = (job, department) => {
  const title = normalizeWhitespace(job?.role)
  const location = normalizeWhitespace(job?.location)
  const experienceRequired = normalizeExperience(job?.experience)
  const responsibilities = toStringArray(job?.responsibilities)
  const requirements = toStringArray(job?.requirement ?? job?.requirements)
  const skills = toStringArray(job?.skills)
  const applyUrl = toAbsoluteUrl(job?.linkTo, HOMEPAGE_URL)

  if (!title || !location || !experienceRequired || !applyUrl || !isFirstPartyApplyUrl(applyUrl)) {
    throw new Error('Sketch Brahma verified public jobs surface no longer exposes stable first-party apply links and vacancy fields')
  }

  const requisitionId = extractApplyToken(applyUrl)
  if (!requisitionId) {
    throw new Error('Sketch Brahma verified public jobs surface no longer exposes stable first-party requisition identifiers')
  }

  return {
    title,
    company: COMPANY,
    department,
    location,
    city: inferCity(location),
    country: 'India',
    jobId: `${SOURCE}-${requisitionId}`,
    requisitionId,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: 'Full-time',
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: skills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({
      location,
      experienceRequired,
      responsibilities,
      requirements,
      skills,
    }),
    remoteStatus: 'On-site',
  }
}

const buildNormalizedJob = (job, now) => {
  const normalized = normalizeScrapedJob({
    ...job,
    experienceLevel: 'Mid Level',
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    scrapedAt: now(),
  }, {
    companyName: COMPANY,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    countryFilter: 'India',
  })

  return {
    ...normalized,
    link: normalized.applyUrl || normalized.sourceUrl,
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Sketch Brahma:\s*UI UX Design Company/i.test(page)
    && /href=["'](?:https:\/\/www\.sketchbrahma\.com)?\/careers\/?["']/i.test(page)
    && /linkedin\.com\/company\/sketchbrahma/i.test(page)
    && /Sketch Brahma Technologies/i.test(page)
    && Boolean(extractBuildManifestUrlFromHomepage(page))
}

export const extractBuildManifestUrlFromHomepage = (html) => {
  const page = String(html ?? '')
  const match = page.match(/<script[^>]+src=["']([^"']*\/_buildManifest\.js)["']/i)
  if (!match) return null

  return toAbsoluteUrl(match[1], HOMEPAGE_URL)
}

export const extractCareersBundleUrlFromManifest = (manifestJs) => {
  const page = String(manifestJs ?? '')
  const routeMatch = page.match(/["']\/careers["']\s*:\s*\[([\s\S]*?)\]/)
  if (!routeMatch) return null

  const bundleMatch = routeMatch[1].match(/["'](static\/chunks\/pages\/careers-[^"']+\.js)["']/i)
  if (!bundleMatch) return null

  return toAbsoluteUrl(`/_next/${bundleMatch[1]}`, HOMEPAGE_URL)
}

export const hasOfficialCareersBundleSignal = (bundleJs) => {
  const page = String(bundleJs ?? '')

  return page.includes('Available opportunities')
    && page.includes('Sketch Brahma Technologies')
    && /Sketch Brahma:\s*Career/i.test(page)
    && /labs\.sketchbrahma\.com\/apply\.php\?t=/i.test(page)
    && /sketchbrahma\.com\//i.test(page)
}

export const extractJobsFromCareersBundle = (bundleJs) => {
  const page = String(bundleJs ?? '')
  if (!hasOfficialCareersBundleSignal(page)) {
    throw new Error('Sketch Brahma verified public careers bundle no longer matches the known first-party jobs surface')
  }

  const categoryArray = evaluateArrayLiteral(
    extractArrayLiteral(page, /(?:let|var|const)\s+k\s*=\s*\[/),
    'category-count',
  )

  const expectedCounts = new Map(
    categoryArray.map((entry) => [
      normalizeCategoryKey(entry?.role),
      parseOpeningCount(entry?.Openings),
    ]),
  )

  const jobs = []

  for (const definition of CATEGORY_DEFINITIONS) {
    const expectedCount = expectedCounts.get(normalizeCategoryKey(definition.role))
    if (!Number.isInteger(expectedCount)) {
      throw new Error(`Sketch Brahma verified public jobs surface no longer exposes the ${definition.role} opening count`)
    }

    const group = evaluateArrayLiteral(
      extractArrayLiteral(page, definition.pattern),
      definition.role,
    )

    if (group.length !== expectedCount) {
      throw new Error(`Sketch Brahma verified public jobs count mismatch for ${definition.role}`)
    }

    for (const item of group) {
      jobs.push(buildRawJob(item, definition.role))
    }
  }

  if (jobs.length === 0) {
    throw new Error('Sketch Brahma verified public jobs surface returned no public jobs')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/javascript,text/javascript;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSketchBrahmaTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now: overrideNow,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Sketch Brahma verified official homepage no longer matches the known first-party surface')
    }

    const manifestUrl = extractBuildManifestUrlFromHomepage(homepageHtml)
    if (!manifestUrl) {
      throw new Error('Sketch Brahma verified official homepage no longer exposes the first-party build manifest')
    }

    const manifestJs = await fetchText(manifestUrl)
    const careersBundleUrl = extractCareersBundleUrlFromManifest(manifestJs)
    if (!careersBundleUrl) {
      throw new Error('Sketch Brahma verified first-party build manifest no longer exposes the careers bundle')
    }

    const careersBundleJs = await fetchText(careersBundleUrl)
    if (!hasOfficialCareersBundleSignal(careersBundleJs)) {
      throw new Error('Sketch Brahma verified public careers bundle no longer matches the known first-party jobs surface')
    }

    const timestampFactory = overrideNow || now
    return extractJobsFromCareersBundle(careersBundleJs).map((job) => buildNormalizedJob(job, timestampFactory))
  },
})

export const run = async (options = {}) => createSketchBrahmaTechnologiesScraper().run(options)

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
