import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aatral'
export const COMPANY = 'Aatral'
export const VERIFIED_AT = '2026-07-14'
export const HOMEPAGE_URL = 'https://aatral.io/'
export const CAREERS_URL = 'https://aatral.io/careers/'
export const GENERAL_APPLICATION_URL = 'https://aatral.io/careers/general-application/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirstMatch = (value, pattern) => String(value ?? '').match(pattern)?.[1] ?? null

const toAbsoluteUrl = (value, base = HOMEPAGE_URL) => {
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return segments.at(-1) ?? null
  } catch {
    return null
  }
}

const extractHeaderSummary = (html = '') => {
  const header = extractFirstMatch(html, /<header class="article-header">([\s\S]*?)<\/header>/i)
  if (!header) return null

  const paragraphMatches = [...header.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  return paragraphMatches.length > 0
    ? stripTags(paragraphMatches.at(-1)?.[1] ?? null)
    : null
}

const extractCareerMeta = (html = '') => {
  const metaBlock = extractFirstMatch(html, /<div class="career-meta">([\s\S]*?)<\/div>/i)
  const items = [...String(metaBlock ?? '').matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return {
    location: items[0] ?? null,
    opportunityType: items[1] ?? null,
  }
}

const hasCareersMailto = (html = '') =>
  /mailto:hr@aatral\.io\?subject=Application%3A/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Aatral \| Enterprise XR, VR and AR Solutions\s*<\/title>/i.test(page)
    && /<meta[^>]+name="description"[^>]+content="Aatral builds enterprise XR, VR and AR solutions/i.test(page)
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/aatral\.io\/"/i.test(page)
    && /https:\/\/www\.linkedin\.com\/company\/aatral-io/i.test(page)
    && /href="\/careers\/"/i.test(page)
    && text.includes('Safetizen')
    && text.includes('Kriyater 360')
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Careers at Aatral \| Aatral\s*<\/title>/i.test(page)
    && /<meta[^>]+name="description"[^>]+content="Explore careers and opportunities at Aatral/i.test(page)
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/aatral\.io\/careers\/"/i.test(page)
    && /aria-label="Open careers"/i.test(page)
    && /<h1>\s*Careers in enterprise XR, VR and AR\s*<\/h1>/i.test(page)
    && text.includes('Build Enterprise XR with Aatral')
    && hasCareersMailto(page)
    && /href="\/careers\/general-application\/"/i.test(page)
}

export const hasOfficialOpportunityPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*[^<]+ \| Aatral\s*<\/title>/i.test(page)
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/aatral\.io\/careers\/[^"]+\/"/i.test(page)
    && /<p class="eyebrow">\s*Career opportunity\s*<\/p>/i.test(page)
    && /<article class="career-detail">/i.test(page)
    && /<time[^>]+dateTime="\d{4}-\d{2}-\d{2}"/i.test(page)
    && hasCareersMailto(page)
    && text.includes('Chennai, India')
}

export const extractCareerCards = (html = '') => {
  const cards = [...String(html ?? '').matchAll(/<article class="career-card">([\s\S]*?)<\/article>/gi)]

  return cards.map((match) => {
    const cardHtml = match[1]
    const title = stripTags(extractFirstMatch(cardHtml, /<h2>([\s\S]*?)<\/h2>/i))
    const summary = stripTags(extractFirstMatch(cardHtml, /<p>([\s\S]*?)<\/p>/i))
    const { location, opportunityType } = extractCareerMeta(cardHtml)
    const sourceUrl = toAbsoluteUrl(
      extractFirstMatch(cardHtml, /<a class="button" href="([^"]+)">View opportunity<\/a>/i),
      CAREERS_URL,
    )
    const applyUrl = normalizeWhitespace(
      extractFirstMatch(cardHtml, /<a class="button primary" href="([^"]+)">[\s\S]*?Send resume[\s\S]*?<\/a>/i),
    )
    const jobId = slugFromUrl(sourceUrl)

    if (!title || !summary || !location || !sourceUrl || !applyUrl || !jobId) {
      return null
    }

    return {
      title,
      summary,
      location,
      opportunityType: opportunityType ?? null,
      sourceUrl,
      applyUrl,
      jobId,
    }
  }).filter(Boolean)
}

export const extractOpportunityDetail = (html = '') => {
  const title = stripTags(extractFirstMatch(html, /<h1>([\s\S]*?)<\/h1>/i))
  const summary = extractHeaderSummary(html)
  const { location, opportunityType } = extractCareerMeta(html)
  const postingDate = normalizeWhitespace(
    extractFirstMatch(html, /<time[^>]+dateTime="([^"]+)"/i),
  )
  const description = stripTags(
    extractFirstMatch(html, /<section class="content-section rich-content">([\s\S]*?)<\/section>/i),
  )
  const applyUrl = normalizeWhitespace(
    extractFirstMatch(html, /<a class="button primary" href="([^"]+)">[\s\S]*?Email resume to[\s\S]*?<\/a>/i),
  )

  if (!title || !summary || !location || !postingDate || !description || !applyUrl) {
    return null
  }

  return {
    title,
    summary,
    location,
    opportunityType: opportunityType ?? null,
    postingDate,
    description,
    applyUrl,
  }
}

const cityFromLocation = (location) => normalizeWhitespace(location)?.split(',')[0] ?? null

export const normalizeJob = (listing = {}, detail = {}, { now = () => new Date().toISOString() } = {}) => {
  if (!listing.jobId || !detail.title || !detail.location || !listing.sourceUrl) {
    return null
  }

  return {
    jobId: listing.jobId,
    requisitionId: listing.jobId,
    title: detail.title,
    company: COMPANY,
    department: null,
    location: detail.location,
    city: cityFromLocation(detail.location),
    country: 'India',
    link: listing.sourceUrl,
    applyUrl: detail.applyUrl,
    sourceUrl: listing.sourceUrl,
    source: SOURCE,
    employmentType: null,
    experienceRequired: null,
    jobDescription: detail.description,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: detail.postingDate,
    closingDate: null,
    scrapedAt: now(),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

export const createAatralScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Aatral verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Aatral verified careers page no longer matches the trusted first-party surface')
    }

    const listings = extractCareerCards(careersHtml)
    if (listings.length === 0) {
      throw new Error('Aatral public careers page no longer exposes verified opportunity cards')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      if (!hasOfficialOpportunityPageSignal(detailHtml)) {
        throw new Error(`Aatral verified opportunity detail no longer matches the trusted first-party surface: ${listing.sourceUrl}`)
      }

      const detail = extractOpportunityDetail(detailHtml)
      if (!detail || detail.title !== listing.title || detail.location !== listing.location) {
        throw new Error(`Aatral opportunity detail no longer matches the verified listing payload: ${listing.sourceUrl}`)
      }

      const normalized = normalizeJob(listing, detail, { now: overrideNow || now })
      if (!normalized || seenJobIds.has(normalized.jobId)) continue

      seenJobIds.add(normalized.jobId)
      jobs.push(normalized)
    }

    if (jobs.length === 0) {
      throw new Error('Aatral verified first-party careers surface no longer yields normalized India jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createAatralScraper().run(options)

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
