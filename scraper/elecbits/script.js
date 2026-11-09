import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://elecbits.in/'
export const CAREERS_URL = 'https://elecbits.in/careers/'
export const APPLY_EMAIL = 'careers@elecbits.in'

const COMPANY = 'Elecbits'
const SOURCE = 'elecbits'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const titleFromHref = (href) => {
  const filename = href.split('/').pop() || ''
  return normalizeWhitespace(
    filename
      .replace(/\.docx\.pdf$/i, '')
      .replace(/\.pdf$/i, '')
      .replace(/^JD[-_]?/i, '')
      .replace(/^EB[-_]?/i, '')
      .replace(/^Eb[-_]?/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\bSDE\b/i, 'SDE')
      .replace(/\bJD\b/gi, '')
      .trim(),
  )
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml)
  const title = extractTitle(rawHtml)

  return /href=["'][^"']*\/careers\/?["']/i.test(rawHtml)
    && (
      title === 'Electronics Manufacturing and Supply Chain Solutions Elecbits'
      || /elecbits/i.test(title)
    )
    && (
      /Azoox Technologies Private Limited/i.test(rawHtml)
      || /Elecbits is your Full-Stack Electronics Partner/i.test(normalized)
      || /Electronics Manufacturing and Supply Chain Solutions/i.test(normalized)
    )
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml)
  const title = extractTitle(rawHtml)

  return /^(?:Careers\s*-\s*Elecbits|Careers at Elecbits Join Electronics Innovation Team)$/i
    .test(title)
    && /Shape India's future with hardware/i.test(normalized)
    && /Join the Team/i.test(normalized)
    && /https:\/\/elecbits\.in\/elecbits-jd-[^"'\s<]+\/?/i.test(rawHtml)
}

export const extractPublicListings = (html) => {
  const page = String(html ?? '')
  const jobs = []
  const seenUrls = new Set()

  for (const match of page.matchAll(/<a\b[^>]*href="(https:\/\/elecbits\.in\/elecbits-jd-[^"]+\/?)"[^>]*>[\s\S]*?<\/a>/gi)) {
    const sourceUrl = buildAbsoluteUrl(match[1], CAREERS_URL)
    if (!sourceUrl || seenUrls.has(sourceUrl)) continue

    const lookback = page.slice(Math.max(0, match.index - 1600), match.index)
    const nearbyHeadings = [...lookback.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    const visibleTitle = nearbyHeadings.length
      ? stripTags(nearbyHeadings[nearbyHeadings.length - 1][1])
      : null
    const visibleLocation = [...lookback.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((item) => stripTags(item[1]))
      .filter(Boolean)
      .pop()
    const title = visibleTitle || titleFromHref(match[1])

    if (!sourceUrl || !title) continue
    seenUrls.add(sourceUrl)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: visibleLocation || 'India',
      city: null,
      country: 'India',
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl,
      applyUrl: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
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

export const createElecbitsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Elecbits homepage no longer matches the verified official public site')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Elecbits careers page no longer matches the verified official public jobs surface')
    }

    return extractPublicListings(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createElecbitsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Elecbits scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
