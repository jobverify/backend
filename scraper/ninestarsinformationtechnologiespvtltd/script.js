import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ninestarsinformationtechnologiespvtltd'
export const COMPANY = 'Ninestars Information Technologies Pvt Ltd'
export const HOMEPAGE_URL = 'https://www.ninestarsglobal.com/'
export const CAREERS_HANDOFF_URL = 'https://career.ninestarsglobal.com/'
export const CAREER_ROUTE_URL = 'https://www.ninestarsglobal.com/career'

const COMPANY_DOMAIN = 'ninestarsglobal.com'
const ATS_PLATFORM = 'official-company-careers'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/â€“/g, '-')
  .replace(/â€”/g, '-')
  .replace(/â€˜|â€™/g, "'")
  .replace(/â€œ|â€�/g, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#039;|&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const buildAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

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
  const text = stripTags(page)

  return /<title>\s*Ninestars Global \| AI-Powered Automation for Life Sciences &amp; Enterprise \| 27 Years\s*<\/title>/i.test(page)
    && /Leading provider of intelligent automation solutions\./i.test(page)
    && /<meta\s+name=["']author["']\s+content=["']Ninestars["']\s*\/?>/i.test(page)
    && /<script[^>]+src=["'][^"']*\/assets\/index-[^"']+\.js["'][^>]*><\/script>/i.test(page)
    && /<div id=["']root["']><\/div>/i.test(page)
    && /Ninestars Global/i.test(text)
}

export const extractBundleAssetUrl = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["'][^>]*><\/script>/i,
  )

  return buildAbsoluteUrl(match?.[1], HOMEPAGE_URL)
}

export const hasOfficialCareersHandoffSignal = (html) =>
  /window\.location\.href\s*=\s*["']https:\/\/www\.ninestarsglobal\.com\/career["']/i.test(
    String(html ?? ''),
  )

const CAREER_BUNDLE_SIGNAL_PATTERNS = [
  /(?:[A-Za-z_$][A-Za-z0-9_$]*=)?\[\{\s*id:"[^"]+",\s*title:"[^"]+",\s*experience:"[^"]+",\s*location:"[^"]+",\s*positions:(?:"[^"]+"|\d+),\s*publishedOn:"[^"]+"/,
  /path:"\/career"/,
  /path:"\/careers".*https:\/\/career\.ninestarsglobal\.com\//,
  /Open Positions/,
  /Apply now/,
]

export const hasVerifiedCareerBundleSignal = (bundleJs) =>
  CAREER_BUNDLE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(bundleJs ?? '')))

const extractJobArrayLiteral = (bundleJs) => {
  const source = String(bundleJs ?? '')
  const markerMatch = source.match(
    /(?:[A-Za-z_$][A-Za-z0-9_$]*=)?\[\{\s*id:"[^"]+",\s*title:"[^"]+",\s*experience:"[^"]+",\s*location:"[^"]+",\s*positions:(?:"[^"]+"|\d+),\s*publishedOn:"[^"]+"/,
  )
  if (!markerMatch) {
    throw new Error('Ninestars verified first-party career bundle no longer exposes the known jobs array marker')
  }

  const startIndex = source.indexOf('[', markerMatch.index)
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

  throw new Error('Ninestars verified first-party career bundle no longer contains a complete jobs array')
}

const quoteObjectKeysForJson = (value) =>
  String(value ?? '').replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')

const toStringArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => normalizeWhitespace(item)).filter(Boolean)
    : []

const mergeRequiredSkills = (job) => {
  const listedSkills = toStringArray(job.skillsList)
  if (listedSkills.length > 0) {
    return listedSkills
  }

  const commaSeparatedSkills = normalizeWhitespace(job.skills)
    ? normalizeWhitespace(job.skills)
      .split(/\s*,\s*/)
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean)
    : []

  return [...new Set(commaSeparatedSkills)]
}

const buildJobDescription = (job) => {
  const sections = []

  if (Array.isArray(job.description) && job.description.length > 0) {
    sections.push(`Role:\n${job.description.map((item) => `- ${normalizeWhitespace(item)}`).join('\n')}`)
  }

  const technicalCompetencies = mergeRequiredSkills(job)
  if (technicalCompetencies.length > 0) {
    sections.push(`Technical Competencies:\n${technicalCompetencies.map((item) => `- ${item}`).join('\n')}`)
  }

  if (Array.isArray(job.benifits) && job.benifits.length > 0) {
    sections.push(`Benefits:\n${job.benifits.map((item) => `- ${normalizeWhitespace(item)}`).join('\n')}`)
  }

  const metaLines = [
    job.experience ? `Experience: ${normalizeWhitespace(job.experience)}` : null,
    job.education ? `Qualifications: ${normalizeWhitespace(job.education)}` : null,
    job.positions ? `Open Positions: ${job.positions}` : null,
    job.publishedOn ? `Published On: ${normalizeWhitespace(job.publishedOn)}` : null,
  ].filter(Boolean)

  if (metaLines.length > 0) {
    sections.push(metaLines.join('\n'))
  }

  return sections.join('\n\n') || null
}

export const extractBundleJobs = (bundleJs) => {
  if (!hasVerifiedCareerBundleSignal(bundleJs)) {
    throw new Error('Ninestars verified first-party career bundle no longer matches the known public jobs surface')
  }

  const parsed = JSON.parse(quoteObjectKeysForJson(extractJobArrayLiteral(bundleJs)))
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Ninestars verified first-party career bundle no longer exposes public openings')
  }

  return parsed
}

const buildNormalizedJob = (job, now) => normalizeScrapedJob({
  source: SOURCE,
  title: job.title,
  company: COMPANY,
  location: normalizeWhitespace(job.location),
  city: normalizeWhitespace(String(job.location ?? '').split(',')[0]),
  country: 'India',
  experienceRequired: normalizeWhitespace(job.experience),
  minimumQualification: normalizeWhitespace(job.education),
  requiredSkills: mergeRequiredSkills(job),
  jobDescription: buildJobDescription(job),
  jobId: `${SOURCE}-${normalizeWhitespace(job.id)}`,
  requisitionId: `${SOURCE}-${normalizeWhitespace(job.id)}`,
  sourceUrl: CAREERS_HANDOFF_URL,
  applyUrl: CAREERS_HANDOFF_URL,
  companyCareerPage: CAREERS_HANDOFF_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: ATS_PLATFORM,
  scrapedAt: now(),
}, {
  companyName: COMPANY,
  companyCareerPage: CAREERS_HANDOFF_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: ATS_PLATFORM,
  countryFilter: 'India',
})

export const createNinestarsInformationTechnologiesPvtLtdScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Ninestars Information Technologies Pvt Ltd verified official homepage no longer matches the known first-party surface')
    }

    const careersHandoffHtml = await fetchText(CAREERS_HANDOFF_URL)
    if (!hasOfficialCareersHandoffSignal(careersHandoffHtml)) {
      throw new Error('Ninestars Information Technologies Pvt Ltd verified first-party careers handoff no longer matches the known redirect shell')
    }

    const bundleUrl = extractBundleAssetUrl(homepageHtml)
    if (!bundleUrl) {
      throw new Error('Ninestars Information Technologies Pvt Ltd verified official homepage no longer exposes the known client bundle')
    }

    const bundleJs = await fetchText(bundleUrl)
    const bundleJobs = extractBundleJobs(bundleJs)
    const timestampFactory = overrideNow || now

    return bundleJobs.map((job) => buildNormalizedJob(job, timestampFactory))
  },
})

export const run = async (options = {}) =>
  createNinestarsInformationTechnologiesPvtLtdScraper().run(options)

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
