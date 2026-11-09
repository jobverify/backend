import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'https://careplix.com'

export const CAREERS_URL = `${BASE_URL}/careers`
export const EXPECTED_PAGE_TITLE = 'CarePlix | AI Health OS & Face Scan Vitals'
export const REQUIRED_PAGE_SIGNALS = [
  "We're Hiring",
  'Build the Future of Healthcare Intelligence',
  'Open Positions',
]
export const KNOWN_ROLE_TITLES = [
  'Senior ML Engineer',
  'Product Designer',
  'Backend Engineer (Go/Python)',
  'Clinical Validation Specialist',
  'Enterprise Sales Director',
  'DevOps Engineer',
]

const CURRENT_SHELL_SCRIPT_PATTERN = /\/assets\/index-[^"']+\.js/i
const INDIA_CITY_PATTERN = /\b(bengaluru|bangalore|mumbai|gurugram|gurgaon|delhi|noida|pune|hyderabad|chennai|kolkata)\b/i
const LOCATION_HINT_PATTERN = /\b(india|remote|hybrid|on-site|onsite|bengaluru|bangalore|mumbai|gurugram|gurgaon|delhi|noida|pune|hyderabad|chennai|kolkata)\b/i
const EMPLOYMENT_TYPE_PATTERN = /\b(full[\s-]?time|part[\s-]?time|contract|intern(ship)?|temporary)\b/i
const ROLE_KEYWORD_PATTERN = /\b(engineer|designer|specialist|director|sales|product|clinical|backend|devops|developer|scientist|architect|manager|research)\b/i
const BUNDLE_PUBLIC_ROLE_SIGNAL_PATTERNS = [
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bapply now\b/i,
  /\/careers\/[a-z0-9-]+/i,
  /\b(?:Senior ML Engineer|Product Designer|Backend Engineer|Clinical Validation Specialist|Enterprise Sales Director|DevOps Engineer)\b/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, BASE_URL).toString()
  } catch {
    return null
  }
}

export const extractScriptAssetUrls = (html) => [
  ...String(html ?? '').matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi),
]
  .map((match) => buildAbsoluteUrl(match[1]))
  .filter(Boolean)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const unique = (items) => [...new Set(items.filter(Boolean))]

const extractPageText = (html) => normalizeWhitespace(
  stripTags(String(html ?? ''))
) || ''

const extractPageTitle = (html) => normalizeWhitespace(
  extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, html),
)

const looksLikeRoleTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  const lower = normalized.toLowerCase()
  if (REQUIRED_PAGE_SIGNALS.some((signal) => signal.toLowerCase() === lower)) return false
  if (normalized === EXPECTED_PAGE_TITLE) return false
  if (normalized.length > 90) return false
  if (/[.?!:;]/.test(normalized)) return false

  return KNOWN_ROLE_TITLES.includes(normalized) || ROLE_KEYWORD_PATTERN.test(normalized)
}

const looksLikeLocation = (value) => LOCATION_HINT_PATTERN.test(normalizeWhitespace(value) || '')

const looksLikeEmploymentType = (value) => EMPLOYMENT_TYPE_PATTERN.test(normalizeWhitespace(value) || '')

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const match = normalized.match(EMPLOYMENT_TYPE_PATTERN)
  if (!match) return null
  return normalizeWhitespace(match[0].replace(/full[\s-]?time/i, 'Full-time').replace(/part[\s-]?time/i, 'Part-time'))
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  const indiaCityMatch = normalized.match(INDIA_CITY_PATTERN)
  if (indiaCityMatch) return indiaCityMatch[0]

  return normalized
    .replace(/^Hybrid\s*-\s*/i, '')
    .split(',')[0]
    ?.trim() || null
}

const isIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  return /india/i.test(normalized || '') || INDIA_CITY_PATTERN.test(normalized || '')
}

const buildSourceUrl = ({ anchorId, applyUrl }) => {
  if (anchorId) return `${CAREERS_URL}#${anchorId}`
  return applyUrl || CAREERS_URL
}

const buildJobRecord = ({
  title,
  department = null,
  location = null,
  sourceUrl = null,
  applyUrl = null,
  employmentType = null,
  jobDescription = null,
  jobId = null,
  publicExperienceChecked = false,
}) => {
  const normalizedTitle = normalizeWhitespace(title)
  const normalizedLocation = normalizeWhitespace(location)
  const normalizedApplyUrl = buildAbsoluteUrl(applyUrl)
  const normalizedSourceUrl = buildAbsoluteUrl(sourceUrl) || CAREERS_URL
  const normalizedJobId = normalizeWhitespace(jobId) || slugify(normalizedTitle)

  return {
    title: normalizedTitle,
    company: 'CarePlix',
    department: normalizeWhitespace(department),
    location: normalizedLocation,
    city: extractCity(normalizedLocation),
    country: isIndiaLocation(normalizedLocation) ? 'India' : null,
    jobId: normalizedJobId,
    requisitionId: normalizedJobId,
    sourceUrl: normalizedSourceUrl,
    applyUrl: normalizedApplyUrl,
    employmentType: normalizeEmploymentType(employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(jobDescription),
    ...(publicExperienceChecked ? { publicExperienceChecked: true } : {}),
  }
}

const decodeJsString = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n'),
)

const buildMailtoApplyUrl = (title) =>
  `mailto:careers@careplix.com?subject=${encodeURIComponent(`Application for ${title}`)}`

export const extractPublicListingsFromBundle = (bundleText) => [
  ...String(bundleText ?? '').matchAll(
    /\{title:"((?:\\.|[^"])*)",department:"((?:\\.|[^"])*)",location:"((?:\\.|[^"])*)",type:"((?:\\.|[^"])*)",description:"((?:\\.|[^"])*)"\}/g,
  ),
]
  .map((match) => {
    const title = decodeJsString(match[1])
    const department = decodeJsString(match[2])
    const location = decodeJsString(match[3])
    const employmentType = decodeJsString(match[4])
    const jobDescription = decodeJsString(match[5])
    const jobId = slugify(title)

    if (!looksLikeRoleTitle(title) || !jobId) return null

    return buildJobRecord({
      title,
      department,
      location,
      sourceUrl: `${CAREERS_URL}#${jobId}`,
      applyUrl: buildMailtoApplyUrl(title),
      employmentType,
      jobDescription,
      jobId,
      publicExperienceChecked: true,
    })
  })
  .filter(Boolean)

export const hasOfficialCareersSurface = (html) => {
  const title = extractPageTitle(html)
  if (title !== EXPECTED_PAGE_TITLE) return false

  const text = extractPageText(html)
  const legacyPublicRolesSurface = REQUIRED_PAGE_SIGNALS.every((signal) => text.includes(normalizeWhitespace(signal)))
  const currentClientShell = extractScriptAssetUrls(html)
    .some((url) => CURRENT_SHELL_SCRIPT_PATTERN.test(url))
    && !BUNDLE_PUBLIC_ROLE_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

  return legacyPublicRolesSurface || currentClientShell
}

export const hasVerifiedNoPublicCareersBundleSignal = (bundleText) => {
  const rawText = String(bundleText ?? '')
  const text = normalizeWhitespace(rawText) || ''

  return /careers\s*:\s*\{\s*title\s*:\s*["']Join Our Team["']/i.test(rawText)
    && /Express your interest in career opportunities/i.test(text)
    && !BUNDLE_PUBLIC_ROLE_SIGNAL_PATTERNS.some((pattern) => pattern.test(rawText))
}

const extractOpenPositionsSection = (html) => {
  const source = String(html ?? '')
  const markerIndex = source.search(/Open Positions/i)
  if (markerIndex < 0) return source
  return source.slice(markerIndex)
}

const extractCardContainers = (html) => {
  const source = extractOpenPositionsSection(html)
  const matches = [
    ...source.matchAll(/<(article|li|div|section)\b([^>]*)>([\s\S]*?)<\/\1>/gi),
  ]

  return matches
    .map((match) => ({
      attributes: match[2] || '',
      html: match[3] || '',
      raw: match[0] || '',
      index: match.index ?? 0,
    }))
    .filter((card) => /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i.test(card.html))
}

const extractHeading = (html) => normalizeWhitespace(
  extractFirst(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i, html, (match) => stripTags(match[1])),
)

const extractLines = (html) => unique([
  ...String(html ?? '').matchAll(/<(p|li|span)[^>]*>([\s\S]*?)<\/\1>/gi),
].map((match) => stripTags(match[2])))

const extractBestApplyUrl = (html) => {
  const links = [...String(html ?? '').matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: buildAbsoluteUrl(match[1]),
      text: stripTags(match[2]) || '',
    }))
    .filter((link) => link.href)

  const preferred = links.find((link) => /\b(apply|job|role|position|opening)\b/i.test(link.text) || /\/(careers|career|jobs)\b/i.test(link.href))
  return preferred?.href || links[0]?.href || null
}

const buildCardCandidate = ({ title, attributes, html, fallbackAnchorId = null }) => {
  if (!looksLikeRoleTitle(title)) return null

  const lines = extractLines(html).filter((line) => line && line !== title && !/^apply now$/i.test(line))
  const location = lines.find(looksLikeLocation) || null
  const employmentType = lines.find(looksLikeEmploymentType) || null
  const department = lines.find((line) => !looksLikeLocation(line) && !looksLikeEmploymentType(line)) || null
  const anchorId = normalizeWhitespace(
    extractFirst(/\sid="([^"]+)"/i, attributes, (match) => match[1]) || fallbackAnchorId,
  )
  const applyUrl = extractBestApplyUrl(html)

  return buildJobRecord({
    title,
    department,
    location,
    sourceUrl: buildSourceUrl({ anchorId, applyUrl }),
    applyUrl,
    employmentType,
    jobId: anchorId || slugify(title),
  })
}

const extractJobsFromCards = (html) => {
  const jobs = []

  for (const card of extractCardContainers(html)) {
    const title = extractHeading(card.html)
    const job = buildCardCandidate({
      title,
      attributes: card.attributes,
      html: card.html,
    })

    if (job) jobs.push(job)
  }

  return jobs
}

const extractJobFromKnownTitleSnippet = (html, title) => {
  const source = extractOpenPositionsSection(html)
  const match = new RegExp(escapeRegExp(title), 'i').exec(source)
  if (!match || match.index == null) return null

  const titleIndex = match.index
  const nextTitleIndex = KNOWN_ROLE_TITLES
    .filter((candidate) => candidate !== title)
    .map((candidate) => source.search(new RegExp(escapeRegExp(candidate), 'i')))
    .filter((index) => index > titleIndex)
    .sort((left, right) => left - right)[0] ?? -1

  const containerStart = [
    source.lastIndexOf('<article', titleIndex),
    source.lastIndexOf('<li', titleIndex),
    source.lastIndexOf('<div', titleIndex),
    source.lastIndexOf('<section', titleIndex),
  ]
    .filter((index) => index >= 0)
    .sort((left, right) => right - left)[0] ?? -1

  const start = containerStart >= 0 && titleIndex - containerStart < 500
    ? containerStart
    : Math.max(0, titleIndex - 120)
  const end = nextTitleIndex > titleIndex
    ? nextTitleIndex
    : Math.min(source.length, titleIndex + title.length + 1400)
  const snippet = source.slice(start, end)
  const anchorId = extractFirst(/\sid="([^"]+)"/i, snippet) || slugify(title)
  const relativeTitleIndex = snippet.search(new RegExp(escapeRegExp(title), 'i'))
  const afterTitle = relativeTitleIndex >= 0 ? snippet.slice(relativeTitleIndex) : snippet
  const lines = extractLines(afterTitle).filter((line) => line && line !== title && !/^apply now$/i.test(line))
  const location = lines.find(looksLikeLocation) || null
  const employmentType = lines.find(looksLikeEmploymentType) || null
  const department = lines.find((line) => !looksLikeLocation(line) && !looksLikeEmploymentType(line)) || null
  const applyUrl = extractBestApplyUrl(afterTitle) || extractBestApplyUrl(snippet)

  return buildJobRecord({
    title,
    department,
    location,
    sourceUrl: buildSourceUrl({ anchorId, applyUrl }),
    applyUrl,
    employmentType,
    jobId: anchorId,
  })
}

const sortJobsByAppearance = (html, jobs) => {
  const source = extractOpenPositionsSection(html)

  return [...jobs].sort((left, right) => {
    const leftIndex = source.search(new RegExp(escapeRegExp(left.title), 'i'))
    const rightIndex = source.search(new RegExp(escapeRegExp(right.title), 'i'))

    if (leftIndex === rightIndex) return left.title.localeCompare(right.title)
    if (leftIndex < 0) return 1
    if (rightIndex < 0) return -1
    return leftIndex - rightIndex
  })
}

const collectJobPostingNodes = (value, acc = []) => {
  if (Array.isArray(value)) {
    for (const item of value) collectJobPostingNodes(item, acc)
    return acc
  }

  if (!value || typeof value !== 'object') return acc

  const type = normalizeWhitespace(value['@type'])
  if (type && /jobposting/i.test(type)) {
    acc.push(value)
  }

  for (const nested of Object.values(value)) {
    collectJobPostingNodes(nested, acc)
  }

  return acc
}

const extractStructuredLocation = (jobPosting) => {
  const jobLocation = jobPosting.jobLocation
  if (!jobLocation) return null

  const candidates = Array.isArray(jobLocation) ? jobLocation : [jobLocation]
  for (const candidate of candidates) {
    const address = candidate?.address ?? candidate
    const parts = unique([
      normalizeWhitespace(address?.addressLocality),
      normalizeWhitespace(address?.addressRegion),
      normalizeWhitespace(address?.addressCountry),
    ])

    if (parts.length > 0) return parts.join(', ')
  }

  return null
}

const extractJobsFromStructuredData = (html) => {
  const jobs = []
  const scripts = [...String(html ?? '').matchAll(
    /<script\b[^>]*type="application\/(?:ld\+json|json)"[^>]*>([\s\S]*?)<\/script>/gi,
  )]

  for (const match of scripts) {
    const rawJson = normalizeWhitespace(match[1])
    if (!rawJson) continue

    let parsed
    try {
      parsed = JSON.parse(rawJson)
    } catch {
      continue
    }

    const postings = collectJobPostingNodes(parsed)
    for (const posting of postings) {
      const title = normalizeWhitespace(posting.title || posting.name)
      if (!looksLikeRoleTitle(title)) continue

      jobs.push(buildJobRecord({
        title,
        department: normalizeWhitespace(posting.department?.name || posting.department),
        location: extractStructuredLocation(posting),
        sourceUrl: posting.url || CAREERS_URL,
        applyUrl: posting.directApply ? posting.url : posting.applyUrl || posting.url || CAREERS_URL,
        employmentType: posting.employmentType,
        jobDescription: stripTags(posting.description),
        jobId: normalizeWhitespace(posting.identifier?.value) || slugify(title),
      }))
    }
  }

  return jobs
}

const mergeJobsByTitle = (jobs) => {
  const byTitle = new Map()

  for (const job of jobs) {
    if (!job?.title) continue
    const existing = byTitle.get(job.title)
    if (!existing) {
      byTitle.set(job.title, job)
      continue
    }

    const richer = {
      ...existing,
      ...job,
      department: job.department || existing.department,
      location: job.location || existing.location,
      city: job.city || existing.city,
      country: job.country || existing.country,
      sourceUrl: job.sourceUrl || existing.sourceUrl,
      applyUrl: job.applyUrl || existing.applyUrl,
      employmentType: job.employmentType || existing.employmentType,
      jobDescription: job.jobDescription || existing.jobDescription,
    }

    richer.sourceUrl = richer.sourceUrl || CAREERS_URL
    richer.applyUrl = richer.applyUrl || existing.applyUrl || null
    byTitle.set(job.title, richer)
  }

  return [...byTitle.values()]
}

export const extractPublicListings = (html) => {
  const cardJobs = extractJobsFromCards(html)
  const structuredJobs = extractJobsFromStructuredData(html)
  const knownTitleJobs = KNOWN_ROLE_TITLES
    .map((title) => extractJobFromKnownTitleSnippet(html, title))
    .filter(Boolean)

  const jobs = mergeJobsByTitle([
    ...cardJobs,
    ...structuredJobs,
    ...knownTitleJobs,
  ])

  return sortJobsByAppearance(
    html,
    jobs.filter((job) => job.title),
  )
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const decorateJob = (job) => ({
  ...job,
  link: job.applyUrl || job.sourceUrl,
  source: 'careplix',
  scrapedAt: new Date().toISOString(),
})

export const createCarePlixScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSurface(html)) {
      throw new Error('CarePlix careers page no longer matches the verified official public careers surface')
    }

    const jobs = extractPublicListings(html)
    if (jobs.length > 0) {
      return jobs.map(decorateJob)
    }

    const bundleUrl = extractScriptAssetUrls(html)
      .find((url) => CURRENT_SHELL_SCRIPT_PATTERN.test(url))
    if (!bundleUrl) {
      throw new Error('CarePlix careers page has no public roles and no verified client bundle')
    }

    const bundleText = await fetchText(bundleUrl)
    const bundleJobs = extractPublicListingsFromBundle(bundleText)
    if (bundleJobs.length > 0) {
      return bundleJobs.map(decorateJob)
    }

    if (!hasVerifiedNoPublicCareersBundleSignal(bundleText)) {
      throw new Error('CarePlix client bundle changed or may now expose public role listings')
    }

    return []
  },
})

export const run = async (options = {}) => createCarePlixScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running CarePlix scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'careplix')
    console.log('DB result:', result)
    process.exit(0)
  }
}
