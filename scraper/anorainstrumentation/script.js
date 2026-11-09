import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { parseJavaScriptLiteral } from '../../scraper-support/utils/safeLiteral.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://anoralabs.com/careers'

const SOURCE = 'anorainstrumentation'
const COMPANY = 'Anora Instrumentation Private Limited'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n'),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const canonicalizeApplyUrl = (value) => {
  if (!value) return null

  try {
    const url = new URL(value, CAREERS_PAGE_URL)
    url.protocol = 'https:'
    if (/anorasolutions\.com$/i.test(url.hostname)) {
      url.hostname = 'anoralabs.com'
    }
    return url.toString()
  } catch {
    return normalizeWhitespace(value)
  }
}

const normalizeLocation = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\bBanglore\b/gi, 'Bangalore'),
)

const extractSectionItems = (html, heading) => {
  const block = String(html ?? '').match(
    new RegExp(`<h3[^>]*>\\s*${heading}\\s*<\\/h3>([\\s\\S]*?)(?=<h3|$)`, 'i'),
  )?.[1] || ''

  return [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return (
    /Discover opportunities/i.test(page)
    && /applyforjob/i.test(page)
    && /Application Software Lead Engineer|DFT Lead Engineer|Mechanical Design Engineer|Product Development Engineer/i.test(page)
  )
}

export const extractJobUrls = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    return []
  }

  const urls = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']*applyforjob[^"']*\.html)["']/gi)) {
    const url = canonicalizeApplyUrl(match[1])
    if (url) urls.add(url)
  }

  return [...urls]
}

const isAnoraUrl = (value) => {
  try {
    return /^(?:www\.)?anoralabs\.com$/i.test(new URL(value).hostname)
  } catch {
    return false
  }
}

export const extractReactBundleUrl = (html, pageUrl = CAREERS_PAGE_URL) => {
  for (const match of String(html ?? '').matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const url = new URL(decodeHtml(match[1]), pageUrl)
      if (
        isAnoraUrl(url.toString())
        && /^\/static\/js\/main\.[a-z0-9]+\.js$/i.test(url.pathname)
      ) {
        return url.toString()
      }
    } catch {
      // Ignore unrelated malformed script URLs while looking for the first-party application bundle.
    }
  }

  return null
}

const hasOfficialReactShellSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*(?:Anora Website|Anoralabs)\s*<\/title>/i.test(page)
    && /<div\b[^>]*\bid=["']root["'][^>]*>/i.test(page)
    && /You need to enable JavaScript to run this app/i.test(page)
    && Boolean(extractReactBundleUrl(page))
}

const extractBalancedArray = (source, start) => {
  let depth = 0
  let quote = null
  let escaped = false

  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = null
      continue
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }

    if (character === '[') depth += 1
    if (character === ']') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }

  throw new Error('Anora React careers bundle contains an unterminated jobs array')
}

const replaceMinifiedBooleanLiterals = (source) => {
  let normalized = ''
  let quote = null
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      normalized += character
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = null
      continue
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character
      normalized += character
      continue
    }

    const next = source[index + 1]
    const after = source[index + 2]
    const before = source[index - 1]
    if (
      character === '!'
      && (next === '0' || next === '1')
      && !/[A-Za-z0-9_$!]/.test(before || '')
      && !/[A-Za-z0-9_$]/.test(after || '')
    ) {
      normalized += next === '0' ? 'true' : 'false'
      index += 1
      continue
    }

    normalized += character
  }

  return normalized
}

const normalizeReactJob = (record) => {
  if (
    !Number.isInteger(record?.id)
    || record.id <= 0
    || typeof record?.experienced !== 'boolean'
    || !Array.isArray(record?.requirements)
    || record.requirements.some((requirement) => !normalizeWhitespace(requirement))
    || typeof record?.preferredSkills !== 'string'
  ) {
    return null
  }

  const title = normalizeWhitespace(record.title)
  const location = normalizeLocation(record.location)
  const category = normalizeWhitespace(record.category)
  const years = normalizeWhitespace(record.years)
  const description = normalizeWhitespace(record.description)
  const requirements = record.requirements.map((requirement) => normalizeWhitespace(requirement))
  if (!title || !location || !category || !description) return null

  return {
    id: record.id,
    title,
    location,
    category,
    experienced: record.experienced,
    years,
    description,
    requirements,
    preferredSkills: normalizeWhitespace(record.preferredSkills) || '',
  }
}

export const extractReactJobOpenings = (bundle) => {
  const source = String(bundle ?? '')
  if (
    !/["']\/careers["']/i.test(source)
    || !/["']\/job-details\/:id["']/i.test(source)
    || !/["']\/api\/apply["']/i.test(source)
    || !/APPLY FOR THIS ROLE/i.test(source)
  ) {
    throw new Error('Anora React careers bundle no longer matches the verified public routes')
  }

  const candidates = [...source.matchAll(/\[\s*\{\s*id\s*:\s*\d+\s*,\s*title\s*:/g)]
  if (candidates.length !== 1) {
    throw new Error('Anora React careers bundle no longer exposes one unambiguous jobs array')
  }

  try {
    const literal = extractBalancedArray(source, candidates[0].index)
    const parsed = parseJavaScriptLiteral(replaceMinifiedBooleanLiterals(literal))
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Expected at least one job record')
    }

    const jobs = parsed.map(normalizeReactJob)
    if (jobs.some((job) => !job) || new Set(jobs.map((job) => job.id)).size !== jobs.length) {
      throw new Error('Expected complete unique job records')
    }
    return jobs
  } catch (error) {
    throw new Error(`Anora React careers bundle contains malformed job data: ${error.message}`)
  }
}

export const extractJobDetail = (html, sourceUrl) => {
  const title = normalizeWhitespace(
    String(html ?? '').match(/<h2[^>]*>\s*([^<]+?)\s*<\/h2>/i)?.[1],
  )
  const rawLocation = normalizeLocation(
    String(html ?? '').match(/<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>\s*([^<]+?)\s*<\/p>/i)?.[1],
  )
  const city = normalizeCity(rawLocation || null)
  const qualifications = extractSectionItems(html, 'Key Qualifications')
  const responsibilities = extractSectionItems(html, 'Responsibilities')
  const additionalRequirements = extractSectionItems(html, 'Additional Requirements')
  const requiredSkills = [
    ...qualifications,
    ...responsibilities,
    ...additionalRequirements,
  ]
  const summary = stripHtml(
    String(html ?? '').match(/<h3[^>]*>\s*Summary\s*<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1],
  )
  const minimumQualification = qualifications[0] || null
  const slug = slugify(title)

  return {
    title,
    company: COMPANY,
    department: null,
    location: rawLocation ? `${rawLocation}, India` : null,
    city,
    country: 'India',
    jobId: `${SOURCE}-${slug}`,
    requisitionId: `${SOURCE}-${slug}`,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace([summary, ...requiredSkills].filter(Boolean).join(' ')),
    remoteStatus: 'On-site',
  }
}

const isIndiaLocation = (location) =>
  /\b(?:India|Chennai|Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Noida|Gurugram|Gurgaon|Delhi)\b/i
    .test(String(location ?? ''))

const mapReactJob = (opening) => {
  const jobKey = `${SOURCE}-${opening.id}`
  const sourceUrl = new URL(`/job-details/${opening.id}`, CAREERS_PAGE_URL).toString()
  const requirements = [...opening.requirements]

  return {
    title: opening.title,
    company: COMPANY,
    department: opening.category,
    location: /\bIndia\b/i.test(opening.location)
      ? opening.location
      : `${opening.location}, India`,
    city: normalizeCity(opening.location.split(',')[0].trim()),
    country: 'India',
    jobId: jobKey,
    requisitionId: jobKey,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: 'Full-time',
    experienceRequired: opening.experienced && opening.years ? `${opening.years} years` : null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: requirements,
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace([opening.description, ...requirements, opening.preferredSkills].filter(Boolean).join(' ')),
    remoteStatus: /\bremote\b/i.test(opening.location) ? 'Remote' : 'On-site',
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createAnoraInstrumentationScraper = ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText: overrideFetchText, now: overrideNow } = {}) {
    const fetcher = overrideFetchText || fetchText
    const listingHtml = await fetcher(CAREERS_PAGE_URL)
    const jobUrls = extractJobUrls(listingHtml)

    if (jobUrls.length === 0 && !hasOfficialReactShellSignal(listingHtml)) {
      throw new Error('Expected verified Anora careers surface with public opportunities')
    }

    let jobs = []
    let inventory = null

    if (jobUrls.length === 0) {
      const bundleUrl = extractReactBundleUrl(listingHtml)
      const bundle = await fetcher(bundleUrl)
      const openings = extractReactJobOpenings(bundle)
      jobs = openings
        .filter((opening) => isIndiaLocation(opening.location))
        .map(mapReactJob)
      inventory = { status: 'complete-inventory', surface: bundleUrl, firstParty: true, listingComplete: true,
        pagesFetched: 1, reportedTotal: openings.length, indiaFacetCount: jobs.length,
        verifiedAt: (overrideNow || now)(), reason: 'complete-static-native-jobs-array-used-by-current-careers-and-role-detail-routes' }
    }

    for (const jobUrl of jobUrls) {
      const detailHtml = await fetcher(jobUrl)
      const detail = extractJobDetail(detailHtml, jobUrl)

      if (!detail.title || !detail.jobId) continue

      jobs.push(detail)
    }

    const mapped = jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
    return inventory ? attachInventoryEvidence(mapped, inventory) : mapped
  },
})

export const run = async (options = {}) => createAnoraInstrumentationScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Anora Instrumentation jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
