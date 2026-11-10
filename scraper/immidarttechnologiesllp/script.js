import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchVerifiedHttpsPage } from '../../scraper-support/utils/verifiedHttps.js'
import { parseJavaScriptLiteral } from '../../scraper-support/utils/safeLiteral.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'immidarttechnologiesllp'
export const COMPANY = 'Immidart Technologies LLP'
export const HOMEPAGE_URL = 'https://www.immidart.com/'
export const CAREERS_URL = 'https://www.immidart.com/company/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeStringArray = (value) => Array.isArray(value)
  ? value.map((item) => normalizeWhitespace(item)).filter(Boolean)
  : []

const buildBundleUrl = (bundlePath) => new URL(bundlePath, HOMEPAGE_URL).toString()

const deriveLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  return normalized ? `${normalized}, India` : null
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const firstToken = normalizeWhitespace(normalized.split(',')[0])
  return firstToken ? normalizeCity(firstToken) : null
}

const sanitizeEmbeddedJob = (job) => {
  const responsibilities = normalizeStringArray(job?.responsibilities)
  const requirements = normalizeStringArray(job?.requirements)

  return {
    id: normalizeWhitespace(job?.id),
    title: normalizeWhitespace(job?.title),
    location: normalizeWhitespace(job?.location),
    experience: normalizeWhitespace(job?.experience),
    positions: Number.isFinite(job?.positions) ? job.positions : Number.parseInt(job?.positions, 10) || 0,
    department: normalizeWhitespace(job?.department)?.toLowerCase() || null,
    description: normalizeWhitespace(job?.description),
    ...(responsibilities.length > 0 ? { responsibilities } : {}),
    ...(requirements.length > 0 ? { requirements } : {}),
  }
}

const findMatchingBracketIndex = (value, startIndex) => {
  let depth = 0
  let inString = false
  let stringDelimiter = ''
  let escapeNext = false

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (inString) {
      if (char === '\\') {
        escapeNext = true
      } else if (char === stringDelimiter) {
        inString = false
        stringDelimiter = ''
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true
      stringDelimiter = char
      continue
    }

    if (char === '[') {
      depth += 1
      continue
    }

    if (char === ']') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Immidart - Global Mobility SaaS Platform\s*<\/title>/i.test(page)
    && /<meta\s+name=["']author["']\s+content=["']Immidart["']/i.test(page)
    && /<link\s+rel=["']canonical["']\s+href=["']https:\/\/www\.immidart\.com\/["']/i.test(page)
    && /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']\/assets\/[^"']+\.js["']/i.test(page)
    && /<div\s+id=["']root["']/.test(page)
}

export const extractBundlePath = (html) => {
  const match = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'](\/assets\/[^"']+\.js)["']/i.exec(
    String(html ?? ''),
  )

  return match?.[1] ?? null
}

export const hasEmbeddedCareersRoute = (bundleJs) => {
  const script = String(bundleJs ?? '')

  return script.includes('/company/careers')
    && script.includes('Explore Careers at Immidart')
    && script.includes('View Open Positions')
    && script.includes('Current Openings')
    && script.includes('Apply for this Position')
}

export const extractEmbeddedJobs = (bundleJs) => {
  const script = String(bundleJs ?? '')
  const markers = [...script.matchAll(/\b(?:const|let|var)\s+[$\w]+\s*=\s*(?=\[\s*\{\s*id\s*:\s*["'])/g)]

  if (markers.length !== 1) {
    throw new Error('Immidart embedded first-party job payload marker disappeared from the verified bundle')
  }

  const arrayStart = script.indexOf('[', markers[0].index + markers[0][0].length)
  const arrayEnd = findMatchingBracketIndex(script, arrayStart)

  if (arrayStart === -1 || arrayEnd === -1) {
    throw new Error('Immidart embedded first-party job payload is no longer parseable')
  }

  const arrayLiteral = script.slice(arrayStart, arrayEnd + 1)
  const parsed = parseJavaScriptLiteral(arrayLiteral)

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Immidart embedded first-party job payload no longer contains public openings')
  }

  if (parsed.some((job) => !job || typeof job !== 'object' || Array.isArray(job)
    || (Object.hasOwn(job, 'active') && typeof job.active !== 'boolean'))) {
    throw new Error('Immidart embedded first-party job payload has an invalid active state')
  }

  // The first-party client displays records whose active flag is not false.
  const jobs = parsed.filter((job) => job.active !== false).map(sanitizeEmbeddedJob)
  if (jobs.some((job) => !job.id || !job.title || !job.location || !job.experience || !job.department)) {
    throw new Error('Immidart embedded first-party job payload no longer contains parseable public openings')
  }
  if (new Set(jobs.map((job) => job.id)).size !== jobs.length) {
    throw new Error('Immidart embedded first-party job payload contains duplicate opening identities')
  }

  return jobs
}

export const fetchImmidartText = async (url, options = {}) => {
  const page = await fetchVerifiedHttpsPage(url, { ...options,
    allowedOrigins: ['https://www.immidart.com'], headers: { 'User-Agent': USER_AGENT } });
  if (page.status < 200 || page.status >= 300) throw new Error('Immidart HTTPS request failed');
  return page.html;
}

const defaultFetchText = fetchImmidartText

export const createImmidartTechnologiesLlpScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Immidart verified official homepage changed; refusing to scrape guessed careers data')
    }

    const homepageBundlePath = extractBundlePath(homepageHtml)
    if (!homepageBundlePath) {
      throw new Error('Immidart homepage no longer exposes the verified first-party bundle')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialHomepageSignal(careersHtml) || extractBundlePath(careersHtml) !== homepageBundlePath) {
      throw new Error('Immidart verified official careers route no longer matches the known first-party SPA shell')
    }

    const bundleJs = await fetchText(buildBundleUrl(homepageBundlePath))
    if (!hasEmbeddedCareersRoute(bundleJs)) {
      throw new Error('Immidart verified careers route no longer exposes the known embedded first-party careers flow')
    }

    return extractEmbeddedJobs(bundleJs).map((job) => ({
      title: job.title,
      company: COMPANY,
      location: deriveLocation(job.location),
      city: deriveCity(job.location),
      country: 'India',
      source: SOURCE,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      link: CAREERS_URL,
      jobId: `${SOURCE}-${job.id}`,
      requisitionId: `${SOURCE}-${job.id}`,
      department: job.department,
      experienceRequired: job.experience,
      employmentType: 'Full-time',
      remoteStatus: 'On-site',
      jobDescription: job.description,
      requiredSkills: job.requirements || [],
      preferredQualification: null,
      closingDate: null,
      postingDate: null,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createImmidartTechnologiesLlpScraper().run(options)

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
