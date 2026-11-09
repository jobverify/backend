import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'strategicresearchinsightssri'
export const COMPANY = 'Strategic Research Insights'
export const HOMEPAGE_URL = 'https://www.srinsights.com/'
export const CAREERS_URL = 'https://www.srinsights.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'

const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Upgrade-Insecure-Requests': '1',
  'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const extractJobSlug = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/g, '')
    return pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

const htmlToText = (value) => {
  const raw = String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, text) => {
      const heading = normalizeWhitespace(text)?.replace(/:$/, '').toUpperCase()
      return heading ? `${heading}:\n` : ''
    })
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(?:ul|ol|div|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  const lines = decodeHtmlEntities(raw)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  return lines.length > 0 ? lines.join(' ') : null
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^ind\s*-\s*/i.test(normalized)) {
    return `${normalized.replace(/^ind\s*-\s*/i, '').trim()}, India`
  }

  if (/,\s*in$/i.test(normalized)) {
    return normalized.replace(/,\s*in$/i, ', India')
  }

  if (/,\s*india$/i.test(normalized)) {
    return normalized
  }

  if (/^(hyderabad|chennai)$/i.test(normalized)) {
    return `${normalized}, India`
  }

  return normalized
}

const extractCity = (value) => {
  const normalized = normalizeLocation(value)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value) || ''
  return /\b(?:hyderabad|chennai)\b/i.test(normalized)
    || /\bind\s*-/i.test(normalized)
    || /,\s*in\b/i.test(normalized)
    || /,\s*india\b/i.test(normalized)
}

const extractExperienceRequired = (value) => {
  const text = normalizeWhitespace(value) || ''
  const matchers = [
    /\b\d+\+\s*years?\s*needed\b/i,
    /\b\d+\s*-\s*\d+\s*years?\b/i,
    /\b\d+\+\s*years?\b/i,
  ]

  for (const matcher of matchers) {
    const match = text.match(matcher)?.[0]
    if (match) return normalizeWhitespace(match)
  }

  return null
}

const extractDetailDescriptionHtml = (html) =>
  String(html ?? '').match(
    /<div id=["']brxe-dkjlpa["'][^>]*class=["'][^"']*\bbrxe-text\b[^"']*\bbody-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<h2[^>]*id=["']brxe-oednkd["']/i,
  )?.[1] || null

const extractDetailApplyUrl = (html) =>
  String(html ?? '').match(
    /<a[^>]*id=["']brxe-qnkwbz["'][^>]*href=["'](mailto:[^"']+)["'][^>]*>\s*Apply now\s*<\/a>/i,
  )?.[1] || String(html ?? '').match(/href=["'](mailto:[^"']+@srinsights\.com[^"']*)["']/i)?.[1] || null

const extractDetailLocation = (html) =>
  normalizeWhitespace(
    String(html ?? '').match(/Job Location:\s*<\/strong>\s*([^<\n]+)/i)?.[1]
      || String(html ?? '').match(/<ul[^>]*id=["']brxe-qrfrgi["'][\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1]
      || null,
  )

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*(?:Top Life Sciences Consulting Firm - Actionable Insights,\s*SRI|Best Consulting Firm in Life Sciences Industry[\s\S]*?)\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.srinsights\.com\/careers\/["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
    && /Highly Innovative Analytical Consulting Firm in the Life Sciences Industry/i.test(text)
    && /Strategic Research Insights\s*\(SRI\)/i.test(text)
    && /inquiries@srinsights\.com/i.test(page)
    && /700 Alexander Park/i.test(text)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers(?:\s*(?:\||&#8211;|–|-)\s*(?:Strategic Research Insights|Best Consulting Firm in Life Sciences Industry))?[\s\S]*?<\/title>/i.test(page)
    && /Careers at SRI/i.test(text)
    && /Available Positions/i.test(text)
    && /data-query-vars="{&quot;post_type&quot;:\[&quot;job&quot;]/i.test(page)
    && /mailto:Chennairecruiter@srinsights\.com/i.test(page)
    && /mailto:Programmingrecruiter@srinsights\.com/i.test(page)
}

export const hasOfficialJobDetailSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const descriptionHtml = extractDetailDescriptionHtml(page)

  return /Best Consulting Firm In Life Sciences Industry/i.test(page)
    && /<h1[^>]*id=["']brxe-nknjgr["'][^>]*>[\s\S]+?<\/h1>/i.test(page)
    && Boolean(descriptionHtml)
    && /How to Apply/i.test(text)
    && /Apply now/i.test(text)
    && /mailto:[^"']+@srinsights\.com/i.test(page)
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error(
      'Strategic Research Insights verified public careers page no longer matches the known public surface',
    )
  }

  const cards = [...String(html ?? '').matchAll(
    /<div class="brxe-fpttti brxe-div job-div">([\s\S]*?)<a class="brxe-kjgxgv brxe-button primary-button bricks-button bricks-background-primary" href="([^"]+)">Read More<\/a>\s*<\/div>/gi,
  )].map((match) => {
    const block = match[1]
    const readMoreUrl = toAbsoluteUrl(match[2])
    const titleUrl = toAbsoluteUrl(block.match(/<h3[^>]*>\s*<a href="([^"]+)">/i)?.[1] || null)
    const title = normalizeWhitespace(block.match(/<h3[^>]*>\s*<a href="[^"]+">([\s\S]*?)<\/a>/i)?.[1] || null)
    const summary = normalizeWhitespace(
      block.match(/<div class="brxe-hxyctx brxe-text-basic body-content-small">([\s\S]*?)<\/div>/i)?.[1] || null,
    )
    const location = normalizeWhitespace(
      block.match(/<li class="repeater-item no-link">[\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1] || null,
    )
    const jobId = extractJobSlug(readMoreUrl)

    if (!title || !summary || !location || !readMoreUrl || !jobId || (titleUrl && titleUrl !== readMoreUrl)) {
      throw new Error(
        'Strategic Research Insights verified public careers page no longer matches the known public surface',
      )
    }

    return {
      title,
      summary,
      location,
      detailUrl: readMoreUrl,
      jobId,
      requisitionId: jobId,
    }
  })

  if (cards.length === 0) {
    throw new Error(
      'Strategic Research Insights verified public careers page no longer matches the known public surface',
    )
  }

  return cards
}

export const extractIndiaJobCards = (html) =>
  extractJobCards(html).filter((card) => isIndiaLocation(card.location))

export const extractJobDetail = (html, listing = {}) => {
  if (!hasOfficialJobDetailSignal(html)) {
    throw new Error(
      'Strategic Research Insights verified first-party detail page no longer matches the known public surface',
    )
  }

  const title = normalizeWhitespace(
    String(html ?? '').match(/<h1[^>]*id=["']brxe-nknjgr["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      || listing.title
      || null,
  )
  const location = normalizeLocation(extractDetailLocation(html) || listing.location)
  const jobDescription = htmlToText(extractDetailDescriptionHtml(html))
  const applyUrl = extractDetailApplyUrl(html)

  if (!title || !location || !jobDescription || !applyUrl) {
    throw new Error(
      'Strategic Research Insights verified first-party detail page no longer matches the known public surface',
    )
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractCity(location),
    state: null,
    country: 'India',
    jobId: listing.jobId || extractJobSlug(listing.detailUrl),
    requisitionId: listing.requisitionId || listing.jobId || extractJobSlug(listing.detailUrl),
    sourceUrl: listing.detailUrl || null,
    applyUrl,
    employmentType: null,
    workplaceType: null,
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: REQUEST_HEADERS,
  label: SOURCE,
  timeoutMs: 15000,
})

export const createStrategicResearchInsightsScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error(
        'Strategic Research Insights verified official homepage no longer matches the trusted first-party surface',
      )
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const indiaCards = extractIndiaJobCards(careersHtml)
    const detailHtmlByUrl = {}

    await Promise.all(indiaCards.map(async (card) => {
      detailHtmlByUrl[card.detailUrl] = await fetchText(card.detailUrl)
    }))

    return indiaCards.map((card) => {
      const detail = extractJobDetail(detailHtmlByUrl[card.detailUrl], card)

      return {
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: 'srinsights.com',
        atsPlatform: 'official-company-careers',
      }
    })
  },
})

export const run = async (options = {}) => createStrategicResearchInsightsScraper().run(options)

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
