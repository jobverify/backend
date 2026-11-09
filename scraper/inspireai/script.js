import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'inspireai'
export const COMPANY = 'Inspire AI'
export const CAREERS_URL = 'https://inspireai.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value).replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const getCountryFromLocation = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase() || ''

  if (normalized.includes(',')) return null
  if (normalized.includes('india')) return 'India'
  if (normalized.includes('south africa')) return 'South Africa'
  if (normalized.includes('uk') || normalized.includes('united kingdom')) return 'United Kingdom'
  if (normalized.includes('nederland') || normalized.includes('netherlands')) return 'Netherlands'
  return null
}

const getRemoteStatus = (blockHtml, location) => {
  const normalizedBlock = normalizeWhitespace(blockHtml)?.toLowerCase() || ''
  const normalizedLocation = normalizeWhitespace(location)?.toLowerCase() || ''

  if (normalizedBlock.includes('remote / hybrid') || normalizedBlock.includes('remote/hybrid')) {
    return 'Hybrid'
  }

  if (
    normalizedBlock.includes('fully remote')
    || normalizedBlock.includes('remote-first')
    || normalizedBlock.includes('remote role')
    || normalizedBlock.includes('rol op afstand')
    || normalizedBlock.includes('deze rol op afstand')
    || normalizedLocation.includes('remote')
  ) {
    return 'Remote'
  }

  if (normalizedBlock.includes('hybrid')) return 'Hybrid'
  return null
}

const getEmploymentType = (blockHtml) => {
  const normalized = normalizeWhitespace(blockHtml)?.toLowerCase() || ''
  if (normalized.includes('full-time') || normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  return null
}

const getLocation = (title, blockHtml) => {
  const block = String(blockHtml ?? '')
  const normalizedTitle = normalizeWhitespace(title)
  const explicitLocation = stripTags(
    block.match(/<strong[^>]*>\s*Location:\s*<\/strong>\s*([\s\S]*?)(?:<br\b[^>]*>|<\/p>)/i)?.[1],
  )

  if (explicitLocation) return explicitLocation

  if (/Salesforce Sales Executive - UKI/i.test(normalizedTitle) && /based in the UK/i.test(block)) {
    return 'UK'
  }

  if (/Senior Consultant - SA/i.test(normalizedTitle) && /Location:\s*South Africa Based/i.test(stripTags(block))) {
    return 'South Africa'
  }

  if (
    /Senior Salesforce Consultant - NL/i.test(normalizedTitle)
    && (/Nederland/i.test(block) || /Netherlands/i.test(block))
  ) {
    return 'Netherlands'
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)?.toLowerCase() || ''

  return /<title>\s*Careers\s*(?:&#8211;|-)\s*InspireAi\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*Careers\s*<\/h1>/i.test(page)
    && text.includes('explore our open roles')
    && /e-n-accordion-item-title-text/i.test(page)
    && /Senior Consultant - Contact Centre, Voice &amp; AI CX/i.test(page)
    && /Salesforce Sales Executive - UKI/i.test(page)
    && /Senior Consultant - SA/i.test(page)
    && /Senior Salesforce Consultant - NL/i.test(page)
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Inspire AI verified official careers surface changed or disappeared')
  }

  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<details\b[^>]*class="e-n-accordion-item"[^>]*>[\s\S]*?<div class="e-n-accordion-item-title-text">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div role="region"[\s\S]*?>([\s\S]*?)<\/div>\s*<\/details>/gi,
  )) {
    const title = stripTags(match[1])
    const blockHtml = match[2]

    if (!title || /^Future Opportunities$/i.test(title)) continue

    const applyMatch = blockHtml.match(
      /<a\b[^>]*class="[^"]*elementor-button-link[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span class="elementor-button-text">\s*(PLAY NOW|APPLY HERE)\s*<\/span>/i,
    )
    const applyUrl = buildAbsoluteUrl(decodeHtml(applyMatch?.[1] || ''))
    const location = getLocation(title, blockHtml)
    const employmentType = getEmploymentType(blockHtml)
    const remoteStatus = getRemoteStatus(blockHtml, location)
    const country = getCountryFromLocation(location)

    if (!applyUrl) {
      throw new Error(`Inspire AI verified careers role lost its public apply link: ${title}`)
    }

    jobs.push({
      title,
      location,
      applyUrl,
      sourceUrl: CAREERS_URL,
      employmentType,
      remoteStatus,
      country,
      city: null,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Inspire AI verified official careers surface changed or disappeared')
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

const isIndiaListing = (job) => job.country === 'India'

export const createInspireAiScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    return extractPublicListings(careersHtml)
      .filter(isIndiaListing)
      .map((job) => ({
        ...job,
        company: COMPANY,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        country: 'India',
        jobId: null,
        requisitionId: null,
        department: null,
        closingDate: null,
        preferredQualification: null,
        minimumQualification: null,
        requiredSkills: [],
        jobDescription: null,
        scrapedAt: (overrideNow || now)(),
      }))
  },
})

export const run = async (options = {}) => createInspireAiScraper().run(options)

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
