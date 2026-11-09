import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'neuleap'
export const COMPANY = 'NeuLeap'
export const HOMEPAGE_URL = 'https://neuleap.ai/'
export const CAREERS_URL = 'https://neuleap.ai/#careers'

const COMPANY_DOMAIN = 'neuleap.ai'
const ATS_PLATFORM = 'official-company-careers'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/Ã¢â‚¬â€œ|â€“|&#8211;|&ndash;/gi, '-')
  .replace(/Ã¢â‚¬â€|â€”|&#8212;|&mdash;/gi, '-')
  .replace(/Ã¢â‚¬Ëœ|Ã¢â‚¬â„¢|â€™|&#039;|&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/Ã¢â‚¬Å“|Ã¢â‚¬ï¿½|â€œ|â€�|&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/â€¢/g, '•')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const slugify = (...parts) => normalizeWhitespace(parts.filter(Boolean).join(' '))
  .toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toStringArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => normalizeWhitespace(item)).filter(Boolean)
    : []

const appendSection = (sections, heading, items) => {
  const normalizedItems = toStringArray(items)
  if (normalizedItems.length === 0) return

  sections.push(`${heading}:\n${normalizedItems.map((item) => `- ${item}`).join('\n')}`)
}

const appendNestedSections = (sections, nestedSections = {}) => {
  if (!nestedSections || typeof nestedSections !== 'object') return

  for (const [heading, items] of Object.entries(nestedSections)) {
    const normalizedItems = toStringArray(items)
    if (normalizedItems.length === 0) continue

    sections.push(`${normalizeWhitespace(heading)}:\n${normalizedItems.map((item) => `- ${item}`).join('\n')}`)
  }
}

const buildJobDescription = (job) => {
  const sections = []
  const roleSummary = normalizeWhitespace(job.aboutRole)

  if (roleSummary) {
    sections.push(`Role:\n${roleSummary}`)
  }

  appendSection(sections, 'Responsibilities', job.keyResponsibilities)
  appendNestedSections(sections, job.keyResponsibilitiesMain)
  appendSection(sections, 'Minimum Qualifications', job.mustHaveQualifications)
  appendSection(sections, 'Preferred Qualifications', job.niceToHave)
  appendSection(sections, 'Required Skills', job.skills)
  appendSection(sections, 'What We Offer', job.whatWeOffer)

  const metaLines = [
    normalizeWhitespace(job.department) ? `Department: ${normalizeWhitespace(job.department)}` : null,
    normalizeWhitespace(job.location) ? `Location: ${normalizeWhitespace(job.location)}` : null,
    normalizeWhitespace(job.type) ? `Employment Type: ${normalizeWhitespace(job.type)}` : null,
    normalizeWhitespace(job.experience) ? `Experience: ${normalizeWhitespace(job.experience)}` : null,
  ].filter(Boolean)

  if (metaLines.length > 0) {
    sections.push(metaLines.join('\n'))
  }

  return sections.join('\n\n') || null
}

const buildMinimumQualification = (job) => {
  const qualifications = toStringArray(job.mustHaveQualifications)
  return qualifications.length > 0 ? qualifications.join(' ') : null
}

const buildPreferredQualification = (job) => {
  const qualifications = toStringArray(job.niceToHave)
  return qualifications.length > 0 ? qualifications.join(' ') : null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^full[\s-]?time$/i.test(normalized)) return 'Full-time'
  if (/^part[\s-]?time$/i.test(normalized)) return 'Part-time'
  return normalized
}

const extractText = (html) => stripTags(html).toLowerCase()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/javascript,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = extractText(page)

  return /<title>\s*NeuLeap\s*<\/title>/i.test(page)
    && /<meta\s+name=["']description["']\s+content=["']AI-Powered Enterprise Transformation["']\s*\/?>/i.test(page)
    && text.includes('transform enterprise data assets with neuleap agentic ai accelerators')
    && /aria-label=["']Go to Careers section["']/i.test(page)
    && /mailto:resume@neuleap\.ai/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = extractText(page)

  return /<div id=["']careers["'][^>]*>/i.test(page)
    && text.includes('join our ai revolution')
    && text.includes('open positions')
    && text.includes('apply now')
    && text.includes('apply for this position')
    && /resume@neuleap\.ai/i.test(page)
}

export const extractCareerBundleUrl = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/_next\/static\/chunks\/app\/page-[^"']+\.js)["'][^>]*><\/script>/i,
  )

  return buildAbsoluteUrl(match?.[1], HOMEPAGE_URL)
}

const CAREER_BUNDLE_SIGNAL_PATTERNS = [
  /\/api\/submit-application/,
  /resume@neuleap\.ai/,
  /Open Positions/,
  /Apply Now/,
  /Apply for this position/,
]

export const hasVerifiedCareerBundleSignal = (bundleJs) =>
  CAREER_BUNDLE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(bundleJs ?? '')))

const extractArrayLiteral = (source, startIndex) => {
  let depth = 0
  let inString = false
  let quote = null
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === quote) {
        inString = false
        quote = null
      }

      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      quote = char
      continue
    }

    if (char === '[') {
      depth += 1
      continue
    }

    if (char === ']') {
      depth -= 1

      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

const quoteObjectKeysForJson = (value) =>
  String(value ?? '').replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')

const isStructuredJob = (value) =>
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && typeof value.title === 'string'
  && typeof value.aboutRole === 'string'
  && (
    typeof value.location === 'string'
    || value.location == null
    || typeof value.location === 'number'
  )

const extractStructuredJobArrays = (bundleJs) => {
  const source = String(bundleJs ?? '')
  const candidates = []

  for (let index = source.indexOf('=['); index !== -1; index = source.indexOf('=[', index + 2)) {
    const arrayStart = index + 1
    const literal = extractArrayLiteral(source, arrayStart)
    if (!literal) continue

    try {
      const parsed = JSON.parse(quoteObjectKeysForJson(literal))
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isStructuredJob)) {
        candidates.push(parsed)
      }
    } catch {
      continue
    }
  }

  return candidates
}

export const extractBundleJobs = (bundleJs) => {
  if (!hasVerifiedCareerBundleSignal(bundleJs)) {
    throw new Error('NeuLeap verified first-party page bundle no longer matches the known public jobs surface')
  }

  const candidates = extractStructuredJobArrays(bundleJs)
  if (candidates.length === 0) {
    throw new Error('NeuLeap verified first-party page bundle no longer exposes the structured openings array')
  }

  const jobs = candidates.sort((left, right) => right.length - left.length)[0]
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error('NeuLeap verified first-party page bundle no longer exposes public openings')
  }

  return jobs
}

const buildNormalizedJob = (job, now) => normalizeScrapedJob({
  source: SOURCE,
  title: normalizeWhitespace(job.title),
  company: COMPANY,
  department: normalizeWhitespace(job.department),
  location: normalizeWhitespace(job.location),
  city: normalizeWhitespace(String(job.location ?? '').split(',')[0]),
  country: 'India',
  sourceUrl: CAREERS_URL,
  applyUrl: CAREERS_URL,
  companyCareerPage: CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: ATS_PLATFORM,
  employmentType: normalizeEmploymentType(job.type),
  experienceRequired: normalizeWhitespace(job.experience),
  minimumQualification: buildMinimumQualification(job),
  preferredQualification: buildPreferredQualification(job),
  requiredSkills: toStringArray(job.skills),
  jobDescription: buildJobDescription(job),
  jobId: `${SOURCE}-${slugify(job.title, job.location || job.type || 'india')}`,
  requisitionId: `${SOURCE}-${slugify(job.title, job.location || job.type || 'india')}`,
  scrapedAt: now(),
}, {
  companyName: COMPANY,
  companyCareerPage: CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: ATS_PLATFORM,
  countryFilter: 'India',
})

export const createNeuLeapScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('NeuLeap verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('NeuLeap verified public careers surface no longer matches the known first-party jobs section')
    }

    const bundleUrl = extractCareerBundleUrl(homepageHtml)
    if (!bundleUrl) {
      throw new Error('NeuLeap verified official homepage no longer exposes the known careers page bundle')
    }

    const bundleJs = await fetchText(bundleUrl)
    const bundleJobs = extractBundleJobs(bundleJs)
    const timestampFactory = overrideNow || now

    return bundleJobs.map((job) => buildNormalizedJob(job, timestampFactory))
  },
})

export const run = async (options = {}) => createNeuLeapScraper().run(options)

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
