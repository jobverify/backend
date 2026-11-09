import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'
import { isExactPublicJobUrl } from '../../rewriting/publicPostingDescription.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nashtechlabs'
export const COMPANY = 'Nash Tech Labs'
export const HOMEPAGE_URL = 'https://www.nashtechlabs.com/'
export const CAREERS_URL = 'https://www.nashtechlabs.com/careers'

const COMPANY_DOMAIN = 'nashtechlabs.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#039;|&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

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

const countMatches = (value, pattern) => [...String(value ?? '').matchAll(pattern)].length

const extractItemSegments = (html) => {
  const page = String(html ?? '')
  const marker = '<div class="uui-career07_item">'
  const startIndexes = [...page.matchAll(/<div class="uui-career07_item">/g)].map((match) => match.index)
    .filter((index) => Number.isInteger(index))

  if (startIndexes.length === 0) return []

  return startIndexes.map((startIndex, index) => {
    const endIndex = index + 1 < startIndexes.length
      ? startIndexes[index + 1]
      : page.indexOf('</section>', startIndex)

    return page.slice(startIndex, endIndex > startIndex ? endIndex : undefined)
  })
}

const extractDetailValues = (segmentHtml) => {
  const sanitized = String(segmentHtml ?? '').replace(/<svg[\s\S]*?<\/svg>/gi, '')

  return [...sanitized.matchAll(
    /<div class="uui-career07_detail-wrapper">[\s\S]*?<div>([^<]+)<\/div>\s*<\/div>/gi,
  )]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const parseEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /^(full|part)[-\s]?time$|^contract$|^intern(ship)?$/i.test(normalized)
    ? normalized
    : null
}

const parseExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /\b(year|month)s?\b/i.test(normalized) ? normalized : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*India(?:&#8217;|&rsquo;|'|’)s Leading OEM &amp; ODM Electronics Manufacturer \| NTL\s*<\/title>/i.test(page)
    && /Fastest Growing Innovation Center/i.test(text)
    && /five decades of manufacturing excellence of Nash Industries/i.test(text)
    && /exporting to over 15 countries/i.test(text)
    && /Address Head Quarters/i.test(text)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  const itemCount = countMatches(page, /<div class="uui-career07_item">/gi)
  const pdfCount = countMatches(page, /href="https:\/\/cdn\.prod\.website-files\.com\/66a9e20e39727c40cabc8902\/[^"]+\.pdf"/gi)

  return /<title>\s*careers\s*<\/title>/i.test(page)
    && /We(?:&#8217;|&rsquo;|'|’)re hiring!/i.test(text)
    && /We(?:&#8217;|&rsquo;|'|’)re looking for talented people/i.test(text)
    && /Apply with us/i.test(text)
    && itemCount >= 5
    && pdfCount >= 3
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Nash Tech Labs verified first-party careers page no longer matches the known public shell')
  }

  const jobs = extractItemSegments(html).map((segmentHtml) => {
    const title = normalizeWhitespace(
      segmentHtml.match(/<div class="uui-career07_heading">([\s\S]*?)<\/div>/i)?.[1],
    )
    const department = normalizeWhitespace(
      segmentHtml
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .match(/class="uui-badge-3[^"]*"[\s\S]*?<div>([^<]+)<\/div>/i)?.[1],
    )
    const detailValues = extractDetailValues(segmentHtml)
    const location = detailValues[0] || null
    const employmentType = parseEmploymentType(detailValues[1])
    const experienceRequired = parseExperienceRequired(detailValues[1])
    const sourceUrl = buildAbsoluteUrl(
      segmentHtml.match(/href="([^"]+\.pdf)"/i)?.[1] ?? CAREERS_URL,
      CAREERS_URL,
    )

    if (!title || !department || !location || !sourceUrl) return null

    const jobKey = slugify(`${title} ${department} ${location}`)

    return {
      title,
      company: COMPANY,
      department,
      location,
      city: normalizeWhitespace(location.split(',')[0]),
      country: 'India',
      jobId: `${SOURCE}-${jobKey}`,
      requisitionId: `${SOURCE}-${jobKey}`,
      sourceUrl,
      applyUrl: null,
      employmentType,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    }
  }).filter(Boolean)

  if (jobs.length !== 5) {
    throw new Error('Nash Tech Labs verified first-party careers page changed materially')
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

const publicPdfUrl = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'cdn.prod.website-files.com'
      && url.pathname.startsWith('/66a9e20e39727c40cabc8902/') && /\.pdf$/i.test(url.pathname)
  } catch { return false }
}
const identityText = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export const recoverNashPdfDescription = (job, response) => {
  if (!publicPdfUrl(job.sourceUrl) || !(response?.status >= 200 && response.status < 300)
    || !isExactPublicJobUrl(response.url, job.sourceUrl) || typeof response.text !== 'string') return null
  const text = identityText(response.text)
  if (!text.includes('nashtechlabs') || !identityText(job.title) || !identityText(job.department)
    || !text.includes(identityText(job.title)) || !text.includes(identityText(job.department))) return null
  return { sourceDescription: response.text }
}

const defaultFetchPdfText = async (job, { signal } = {}) => {
  if (!publicPdfUrl(job.sourceUrl)) return null
  const response = await fetch(job.sourceUrl, { signal: signal
    ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf' } })
  if (!response.ok || !/application\/pdf/i.test(response.headers.get('content-type') || '')
    || !isExactPublicJobUrl(response.url, job.sourceUrl)) return null
  const { extractTextFromPdfBuffer } = await import('../../scraper-support/shared/pdfText.js')
  const text = await extractTextFromPdfBuffer(Buffer.from(await response.arrayBuffer()), { signal, timeoutMs: 30000 })
  return { status: response.status, url: response.url, text }
}

export const createNashTechLabsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchPdfText, now: overrideNow, signal,
    detailEnrichmentBudgetMs } = {}) {
    signal?.throwIfAborted()
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Nash Tech Labs verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicJobs(careersHtml)
    // Injected page-only transports do not authorize unrelated real requests.
    // Production reads only PDFs linked by the freshly verified careers page.
    const pdfReader = fetchPdfText || (fetchText === defaultFetchText ? defaultFetchPdfText : null)
    const hydrated = pdfReader ? await hydrateSourceDescriptions(jobs, { signal, detailEnrichmentBudgetMs,
      fetchDetail: async (job, options) => recoverNashPdfDescription(job, await pdfReader(job, options)),
    }) : jobs

    return hydrated.map((job) => normalizeScrapedJob({
      ...job,
      ...(job.sourceDescription ? { sourceDetailComplete: false,
        sourceDetailFailureKind: 'pdf-completeness-unverified' } : {}),
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
      scrapedAt: (overrideNow || now)(),
    }, {
      companyName: COMPANY,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
      countryFilter: 'India',
    }))
  },
})

export const run = async (options = {}) => createNashTechLabsScraper().run(options)

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
