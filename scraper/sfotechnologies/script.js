import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'sfotechnologies'
export const COMPANY = 'SFO Technologies'
export const CAREER_PAGE_URL = 'https://sfotechnologies.net/about-us/careers/'
export const APPLICATION_EMAIL = 'careers.sfo@nestgroup.net'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const OPENINGS_HEADING_PATTERN = /^Current Openings$/i
const EXPERIENCE_PATTERN = /((?:\d+\+?(?:-\d+)?|\d+\s*plus)\s*(?:yrs?|Yrs))$/i
const DIVISION_PATTERN = /Division$/i
const HEADER_PATTERN = /^Sl\.?\s*No\.?\s+Position\b/i

const QUALIFICATION_MARKERS = [
  'BE/BTech/MTech',
  'BE/BTech/Mtech',
  'B.Tech/M.Tech',
  'B.Tech, MBA',
  'CA/CMA/ICWA',
  'B.Tech',
]

const DOMAIN_MARKERS = [
  'Cable & Wireharness',
  'Electro Mechanical',
  'Transportation',
  'Electronics',
  'Aerospace',
  'Finance',
]

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/[–—]/g, '-')
  .replace(/[â€“â€”]/g, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) => decodeHtml(String(value ?? ''))
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/table|\/tbody|\/thead|\/tr|\/section|\/main)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|h[1-6]|ul|ol|table|tbody|thead|tr|section|main)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const splitSkills = (value) => String(value ?? '')
  .split(/\s*,\s*/)
  .map((item) => normalizeWhitespace(String(item ?? '').replace(/\.+$/g, '')))
  .filter(Boolean)

const findQualificationMatch = (value) => {
  const haystack = String(value ?? '')
  let bestMatch = null

  for (const marker of QUALIFICATION_MARKERS) {
    const index = haystack.indexOf(marker)
    if (index === -1) continue

    if (!bestMatch || index < bestMatch.index) {
      bestMatch = { marker, index }
    }
  }

  return bestMatch
}

const splitTitleAndDomain = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { title: null, domain: null }

  for (const marker of DOMAIN_MARKERS) {
    if (normalized.endsWith(` ${marker}`)) {
      return {
        title: normalizeWhitespace(normalized.slice(0, -marker.length)),
        domain: marker,
      }
    }
  }

  return {
    title: normalized,
    domain: null,
  }
}

const normalizeDomainValue = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^[-–—]+$/.test(normalized)) {
    return null
  }

  return normalized
}

const buildJobDescription = ({
  title,
  department,
  domain,
  minimumQualification,
  experienceRequired,
  requiredSkills,
}) => {
  const parts = [
    `Official ${COMPANY} opening for ${title} in ${department}.`,
  ]

  if (domain) parts.push(`Domain: ${domain}.`)
  if (minimumQualification) parts.push(`Qualification: ${minimumQualification}.`)
  if (experienceRequired) parts.push(`Experience: ${experienceRequired}.`)
  if (requiredSkills.length > 0) parts.push(`Skills: ${requiredSkills.join(', ')}.`)
  parts.push(`Apply by emailing ${APPLICATION_EMAIL}.`)

  return normalizeWhitespace(parts.join(' '))
}

const buildStructuredOpeningJob = ({
  rowNumber,
  title,
  currentDivision,
  domain,
  minimumQualification,
  skillsText,
  experienceRequired,
}) => {
  if (!rowNumber || !title || !currentDivision || !minimumQualification || !experienceRequired) {
    return null
  }

  const requiredSkills = splitSkills(skillsText)
  const normalizedDomain = normalizeDomainValue(domain)
  const jobSlug = slugify(`${currentDivision}-${title}-${rowNumber}`)
  if (!jobSlug) return null

  return {
    title,
    company: COMPANY,
    department: currentDivision,
    location: 'India',
    city: null,
    country: 'India',
    jobId: `${SOURCE}-${jobSlug}`,
    requisitionId: `${SOURCE}-${jobSlug}`,
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: `mailto:${APPLICATION_EMAIL}`,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({
      title,
      department: currentDivision,
      domain: normalizedDomain,
      minimumQualification,
      experienceRequired,
      requiredSkills,
    }),
  }
}

const parseStructuredOpening = (line, currentDivision) => {
  const normalized = normalizeWhitespace(line)
  if (!normalized || !currentDivision) return null

  const rowMatch = normalized.match(/^(\d{2})\s+(.+)$/)
  if (!rowMatch) return null

  const [, rowNumber, body] = rowMatch
  const experienceMatch = body.match(EXPERIENCE_PATTERN)
  if (!experienceMatch) return null

  const experienceRequired = normalizeWhitespace(experienceMatch[1])
  const withoutExperience = normalizeWhitespace(body.slice(0, -experienceMatch[0].length))
  const qualificationMatch = findQualificationMatch(withoutExperience)
  if (!qualificationMatch) return null

  const prefix = normalizeWhitespace(withoutExperience.slice(0, qualificationMatch.index))
  const minimumQualification = normalizeWhitespace(qualificationMatch.marker)
  const skillsText = normalizeWhitespace(
    withoutExperience.slice(qualificationMatch.index + qualificationMatch.marker.length),
  )
  const { title, domain } = splitTitleAndDomain(prefix)
  if (!title) return null

  return buildStructuredOpeningJob({
    rowNumber,
    title,
    currentDivision,
    domain,
    minimumQualification,
    skillsText,
    experienceRequired,
  })
}

const parseSplitOpening = (sectionLines, startIndex, currentDivision) => {
  if (!currentDivision) return null

  const rowNumber = normalizeWhitespace(sectionLines[startIndex])
  if (!/^\d{2}$/.test(rowNumber || '')) {
    return null
  }

  const title = normalizeWhitespace(sectionLines[startIndex + 1])
  const domain = normalizeWhitespace(sectionLines[startIndex + 2])
  const minimumQualification = normalizeWhitespace(sectionLines[startIndex + 3])
  const skillsText = normalizeWhitespace(sectionLines[startIndex + 4])
  const experienceRequired = normalizeWhitespace(sectionLines[startIndex + 5])

  if (!EXPERIENCE_PATTERN.test(experienceRequired || '')) {
    return null
  }

  const job = buildStructuredOpeningJob({
    rowNumber,
    title,
    currentDivision,
    domain,
    minimumQualification,
    skillsText,
    experienceRequired,
  })

  if (!job) {
    return null
  }

  return {
    job,
    consumedLines: 6,
  }
}

const extractOpeningsLines = (html) => {
  const lines = stripTagsToLines(html)
  const startIndex = lines.findIndex((line) => OPENINGS_HEADING_PATTERN.test(line))
  if (startIndex === -1) {
    throw new Error('SFO careers page no longer exposes the expected Current Openings section')
  }

  const sectionLines = []

  for (const line of lines.slice(startIndex + 1)) {
    if (/^Sitemap$/i.test(line) || /^Address$/i.test(line) || /^Quick Connect$/i.test(line)) break
    sectionLines.push(line)
  }

  return sectionLines
}

export const pageIndicatesJobOpenings = (html) => {
  const text = String(html ?? '')
  return /Current Openings/i.test(text) && /careers\.sfo@nestgroup\.net/i.test(text)
}

export const extractOpenings = (html) => {
  const sectionLines = extractOpeningsLines(html)
  const jobs = []
  let currentDivision = null

  for (let index = 0; index < sectionLines.length; index += 1) {
    const line = sectionLines[index]

    if (DIVISION_PATTERN.test(line)) {
      currentDivision = line
      continue
    }

    if (HEADER_PATTERN.test(line) || /careers\.sfo@nestgroup\.net/i.test(line)) {
      continue
    }

    const job = parseStructuredOpening(line, currentDivision)
    if (job) {
      jobs.push(job)
      continue
    }

    const splitOpening = parseSplitOpening(sectionLines, index, currentDivision)
    if (splitOpening) {
      jobs.push(splitOpening.job)
      index += splitOpening.consumedLines - 1
    }
  }

  if (jobs.length === 0) {
    throw new Error('SFO careers page no longer exposes parsable structured openings')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const code = String(error?.code ?? error?.cause?.code ?? '')
  const haystack = `${message} ${causeMessage} ${code}`

  return /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to verify the first certificate|unable to/i
    .test(haystack)
}

export const createSfoTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    try {
      let html

      try {
        html = await fetchText(CAREER_PAGE_URL)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        html = await browserTextFetcher(CAREER_PAGE_URL)
      }

      const jobs = extractOpenings(html)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async () => createSfoTechnologiesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running SFO Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
