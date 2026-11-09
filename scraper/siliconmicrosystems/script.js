import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://www.simsindia.net/'
export const CAREER_ROUTE_URL = 'https://www.simsindia.net/career'
export const APPLICATION_EMAIL = 'career@simsindia.net'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*Silicon Microsystems\s*<\/title>/i
const HOMEPAGE_DESCRIPTION_PATTERN =
  /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*Silicon Microsystems\s*\(SIMS India\)[^"']*["']/i
const HOMEPAGE_OG_URL_PATTERN =
  /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/simsindia\.net\/?["']/i
const MAIN_BUNDLE_PATTERN =
  /<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i
const CAREER_CHUNK_PATTERN =
  /"\/career"\s*:\s*\(\)\s*=>[\s\S]*?import\("\.\/(Career-[^"]+\.js)"\)/i
const MAILTO_PATTERN = /mailto:([A-Z0-9._%+-]+@simsindia\.net)/i
const JOB_LIST_TOKEN = 'F'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/javascript,text/javascript;q=0.9,*/*;q=0.8',
  },
  label: 'siliconmicrosystems',
  timeoutMs: 15000,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const inferRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

const formatLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'

  if (/^(south india|across india)\b/i.test(normalized)) {
    return `${normalized}, India`
  }

  return normalized
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const formatSectionDescription = (section) => {
  const parts = []

  if (section?.title) parts.push(`${section.title}:`)
  if (Array.isArray(section?.paragraphs) && section.paragraphs.length) {
    parts.push(section.paragraphs.join(' '))
  }
  if (section?.subtitle) parts.push(section.subtitle)
  if (section?.compensationBulletsIntro) parts.push(section.compensationBulletsIntro)
  if (Array.isArray(section?.bullets) && section.bullets.length) {
    parts.push(section.bullets.join(' '))
  }
  if (Array.isArray(section?.subsections)) {
    for (const subsection of section.subsections) {
      if (subsection?.title) parts.push(`${subsection.title}:`)
      if (Array.isArray(subsection?.bullets) && subsection.bullets.length) {
        parts.push(subsection.bullets.join(' '))
      }
    }
  }

  return normalizeWhitespace(parts.join(' '))
}

const formatRichSections = (sections) =>
  normalizeWhitespace(
    (Array.isArray(sections) ? sections : [])
      .map((section) => formatSectionDescription(section))
      .filter(Boolean)
      .join(' '),
  )

const extractArrayLiteral = (source, variableName) => {
  const page = String(source ?? '')
  const token = `${variableName}=[`
  const tokenIndex = page.indexOf(token)

  if (tokenIndex < 0) return null

  const startIndex = tokenIndex + token.length - 1
  let bracketDepth = 0
  let inString = false
  let quote = null
  let isEscaped = false

  for (let index = startIndex; index < page.length; index += 1) {
    const char = page[index]

    if (inString) {
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === quote) {
        inString = false
        quote = null
      }

      continue
    }

    if (char === '"' || char === '\'') {
      inString = true
      quote = char
      continue
    }

    if (char === '[') {
      bracketDepth += 1
      continue
    }

    if (char === ']') {
      bracketDepth -= 1

      if (bracketDepth === 0) {
        return page.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

const isIdentifierStart = (char) => /[A-Za-z_$]/.test(char)
const isIdentifierPart = (char) => /[A-Za-z0-9_$]/.test(char)

const convertJsLiteralToJson = (literal) => {
  const source = String(literal ?? '')
  let output = ''
  let inString = false
  let quote = null
  let isEscaped = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (isEscaped) {
        output += char
        isEscaped = false
        continue
      }

      if (char === '\\') {
        output += char
        isEscaped = true
        continue
      }

      if (char === quote) {
        output += '"'
        inString = false
        quote = null
        continue
      }

      output += quote === '\'' && char === '"' ? '\\"' : char
      continue
    }

    if (char === '"' || char === '\'') {
      inString = true
      quote = char
      output += '"'
      continue
    }

    if (isIdentifierStart(char)) {
      let cursor = index + 1

      while (cursor < source.length && isIdentifierPart(source[cursor])) {
        cursor += 1
      }

      const identifier = source.slice(index, cursor)
      let lookahead = cursor

      while (lookahead < source.length && /\s/.test(source[lookahead])) {
        lookahead += 1
      }

      if (source[lookahead] === ':') {
        output += `"${identifier}"`
      } else if (identifier === 'true' || identifier === 'false' || identifier === 'null') {
        output += identifier
      } else {
        output += `"${identifier}"`
      }

      index = cursor - 1
      continue
    }

    output += char
  }

  return output
}

const parseJsLiteralArray = (literal) => JSON.parse(convertJsLiteralToJson(literal))

const extractApplicationEmail = (bundleSource) =>
  normalizeWhitespace(String(bundleSource ?? '').match(MAILTO_PATTERN)?.[1]) || APPLICATION_EMAIL

const extractSectionMap = (bundleSource, jobSummaries) => {
  const sectionsByName = new Map()
  const names = new Set(
    jobSummaries
      .map((job) => normalizeWhitespace(job.richSections))
      .filter(Boolean),
  )

  for (const name of names) {
    const literal = extractArrayLiteral(bundleSource, name)
    if (!literal) continue
    sectionsByName.set(name, parseJsLiteralArray(literal))
  }

  return sectionsByName
}

export const buildSearchUrl = () => HOMEPAGE_URL

export const buildApplyUrl = ({ title, jobId, applicationEmail = APPLICATION_EMAIL }) =>
  `mailto:${applicationEmail}?subject=${encodeURIComponent(
    `Application for ${title}${jobId ? ` (${jobId})` : ''}`,
  )}`

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return (
    HOMEPAGE_TITLE_PATTERN.test(page)
    && HOMEPAGE_DESCRIPTION_PATTERN.test(page)
    && HOMEPAGE_OG_URL_PATTERN.test(page)
  )
}

export const extractMainBundleUrl = (html) => {
  const relativeUrl = normalizeWhitespace(String(html ?? '').match(MAIN_BUNDLE_PATTERN)?.[1])
  if (!relativeUrl) return null
  return new URL(relativeUrl, HOMEPAGE_URL).toString()
}

export const extractCareerChunkUrl = (mainBundleSource) => {
  const filename = normalizeWhitespace(String(mainBundleSource ?? '').match(CAREER_CHUNK_PATTERN)?.[1])
  if (!filename) return null
  return new URL(filename, new URL('/assets/', HOMEPAGE_URL)).toString()
}

export const extractSearchResults = (careerBundleSource) => {
  const jobListLiteral = extractArrayLiteral(careerBundleSource, JOB_LIST_TOKEN)
  if (!jobListLiteral) {
    throw new Error('Silicon Microsystems career bundle no longer exposes the expected job list')
  }

  const jobSummaries = parseJsLiteralArray(jobListLiteral)
  const applicationEmail = extractApplicationEmail(careerBundleSource)
  const sectionMap = extractSectionMap(careerBundleSource, jobSummaries)

  return jobSummaries.map((job) => {
    const sections = sectionMap.get(job.richSections) || []
    const location = formatLocation(job.location)

    return {
      title: normalizeWhitespace(job.title),
      company: 'Silicon Microsystems',
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId: normalizeWhitespace(job.jobId),
      requisitionId: normalizeWhitespace(job.jobId),
      sourceUrl: CAREER_ROUTE_URL,
      applyUrl: buildApplyUrl({
        title: normalizeWhitespace(job.title),
        jobId: normalizeWhitespace(job.jobId),
        applicationEmail,
      }),
      employmentType: null,
      experienceRequired: normalizeWhitespace(job.experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: formatRichSections(sections),
      remoteStatus: inferRemoteStatus(location),
    }
  })
}

export const createSiliconMicrosystemsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText

    const homepageHtml = await fetchText(buildSearchUrl())
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Silicon Microsystems homepage no longer matches the verified official site')
    }

    const mainBundleUrl = extractMainBundleUrl(homepageHtml)
    if (!mainBundleUrl) {
      throw new Error('Silicon Microsystems homepage no longer exposes the expected published app bundle')
    }

    const mainBundleSource = await fetchText(mainBundleUrl)
    const careerChunkUrl = extractCareerChunkUrl(mainBundleSource)
    if (!careerChunkUrl) {
      throw new Error('Silicon Microsystems main bundle no longer exposes the expected career route')
    }

    const careerBundleSource = await fetchText(careerChunkUrl)
    const jobs = extractSearchResults(careerBundleSource)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'siliconmicrosystems',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createSiliconMicrosystemsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Silicon Microsystems scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'siliconmicrosystems')
    console.log('DB result:', result)
    process.exit(0)
  }
}
