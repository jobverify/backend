import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'infobellitsolutionspvtltd'
export const COMPANY = 'Infobell IT Solutions Pvt.Ltd.'
export const CAREERS_URL = 'https://www.infobellit.com/careers.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).href
  } catch {
    return null
  }
}

const extractJobId = (url) => {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').filter(Boolean).at(-1) || ''
    const withoutExtension = filename.replace(/\.[a-z0-9]+$/i, '')
    return withoutExtension ? withoutExtension.toLowerCase() : null
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = stripTags(value)
  if (!normalized) return null
  return /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const [firstPart] = normalized
    .replace(/,?\s*India$/i, '')
    .split(/[\/,]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return normalizeCity(firstPart || normalized)
}

const extractMailtoApplyUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](mailto:[^"'?#\s>]+)["']/i)
  return match?.[1] || null
}

const extractCloudflareProtectedEmail = (html) => {
  const encoded = String(html ?? '').match(/data-cfemail=["']([0-9a-f]+)["']/i)?.[1]
  if (!encoded || encoded.length < 4) return null

  const key = Number.parseInt(encoded.slice(0, 2), 16)
  let email = ''
  for (let index = 2; index < encoded.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key)
  }

  return email || null
}

const extractApplyEmail = (html) => extractMailtoApplyUrl(html)?.replace(/^mailto:/i, '')
  || extractCloudflareProtectedEmail(html)

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /Careers\s*\|\s*Infobell IT Solutions/i.test(page)
    && /Join our team today/i.test(text)
    && /Server Performance Benchmark Engineers/i.test(text)
    && /DevOps\s*&\s*DevSecOps/i.test(text)
    && /Apply Now/i.test(text)
    && /href=["']\.\/careers-detail\.html["']/i.test(page)
}

export const extractJobCards = (html) => {
  const cards = []
  const seen = new Set()
  const cardPattern = /<div class="job-card">[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<span class="d-flex">([\s\S]*?)<\/span>[\s\S]*?<a class="ib-rmore"[^>]+href=["']([^"']+)["']/gi

  for (const match of String(html ?? '').matchAll(cardPattern)) {
    const title = stripTags(match[1])
    const detailUrl = toAbsoluteUrl(match[3])
    const jobId = extractJobId(detailUrl)
    const location = normalizeLocation(match[2])

    if (!title || !detailUrl || !jobId || !location || seen.has(detailUrl)) continue
    seen.add(detailUrl)

    cards.push({
      title,
      location,
      city: deriveCity(location),
      sourceUrl: detailUrl,
      detailUrl,
      applyUrl: null,
      jobId,
      requisitionId: jobId,
    })
  }

  return cards
}

export const extractJobDetail = (html) => {
  const page = String(html ?? '')
  const title = stripTags(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || null)
  const description = stripTags(
    page.match(/<h3>\s*Job Responsibilities\s*\/\s*Skill-Set\s*<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1] || null,
  )
  const applyUrl = extractMailtoApplyUrl(page)

  return {
    title,
    description,
    applyUrl,
  }
}

export const hasVerifiedDetailSignal = (html) => {
  const text = stripTags(html) || ''
  return /Job Responsibilities\s*\/\s*Skill-Set/i.test(text)
    && /Apply today/i.test(text)
    && extractApplyEmail(html) === 'info@infobellit.com'
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createInfobellItSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Infobell IT Solutions verified first-party careers page no longer matches the expected public surface')
    }

    const listings = extractJobCards(careersHtml)
    if (listings.length === 0) {
      throw new Error('Infobell IT Solutions verified first-party careers page no longer exposes job cards')
    }

    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.detailUrl)
      if (!hasVerifiedDetailSignal(detailHtml)) {
        throw new Error('Infobell IT Solutions verified first-party detail page or apply flow changed materially')
      }

      const detail = extractJobDetail(detailHtml)
      // The current CTA is Cloudflare-obfuscated mailto; retain the public detail page as the usable application link.
      const applyUrl = listing.detailUrl

      jobs.push({
        title: detail.title || listing.title,
        company: COMPANY,
        department: null,
        location: listing.location,
        city: listing.city,
        country: 'India',
        jobId: listing.jobId,
        requisitionId: listing.requisitionId,
        sourceUrl: listing.sourceUrl,
        applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: detail.description,
        source: SOURCE,
        link: applyUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createInfobellItSolutionsScraper().run(options)

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
