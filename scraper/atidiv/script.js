import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ATIDIV_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ATIDIV_CATALOG.source
export const COMPANY = ATIDIV_CATALOG.companyName
export const CAREERS_URL = ATIDIV_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const CERTIFICATE_ERROR_PATTERN =
  /unable to verify the first certificate|unable to get local issuer certificate|self[- ]signed certificate|certificate(?:'s)? altnames|certificate has expired/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const stripTags = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(stripTags(value))
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return CAREERS_URL
  }
}

const getSlugFromUrl = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return segments.at(-1) || SOURCE
  } catch {
    return SOURCE
  }
}

const inferWorkplaceType = (tags = []) =>
  tags.find((tag) => /remote|hybrid|on-site|onsite/i.test(tag)) || null

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Current Openings/i.test(page)
    && /Find Your(?:\s|&nbsp;|&#160;)+Next Job/i.test(page)
    && /https:\/\/(?:www\.)?atidiv\.com\/job\/senior-campaign-manager\//i.test(page)
    && /Digital Marketing/i.test(page)
}

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<a[^>]+href="([^"]*\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => {
    const href = toAbsoluteUrl(match[1])
    const innerHtml = match[2]
    const title = normalizeText(innerHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const department = normalizeText(innerHtml.match(/<span class="pr-2">([\s\S]*?)<\/span>/i)?.[1])
    const tags = [...innerHtml.matchAll(/<span>([\s\S]*?)<\/span>/gi)]
      .map((tagMatch) => normalizeText(tagMatch[1]))
      .filter(Boolean)

    if (!title) return null

    const workplaceType = inferWorkplaceType(tags)
    const slug = getSlugFromUrl(href)

    return {
      title,
      department,
      location: workplaceType,
      city: null,
      country: 'India',
      jobId: `${SOURCE}-${slug}`,
      requisitionId: slug,
      sourceUrl: href,
      applyUrl: href,
      employmentType: tags.find((tag) => /full-time|part-time|contract|internship/i.test(tag)) || null,
      workplaceType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [department, ...tags].filter(Boolean).join(' | ') || title,
    }
  })
  .filter((job) => {
    if (!job) return false
    const url = new URL(job.sourceUrl)
    return /^(?:www\.)?atidiv\.com$/i.test(url.hostname) && url.pathname.startsWith('/job/')
  })

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFallbackFetchText = async (url) => {
  const response = await fetchPageWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: `${SOURCE}-fallback`,
    timeoutMs: 20000,
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.html
}

export const hasCertificateVerificationFailure = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const code = String(error?.code ?? error?.cause?.code ?? '')

  return CERTIFICATE_ERROR_PATTERN.test(message)
    || CERTIFICATE_ERROR_PATTERN.test(causeMessage)
    || /UNABLE_TO_GET_ISSUER_CERT_LOCALLY|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN/i.test(code)
}

export const createAtidivScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchFallbackText = defaultFallbackFetchText,
    now: overrideNow,
  } = {}) {
    let careersHtml

    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (!fetchFallbackText || !hasCertificateVerificationFailure(error)) {
        throw error
      }

      careersHtml = await fetchFallbackText(CAREERS_URL)
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Atidiv careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobCards(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Atidiv careers page no longer exposes the verified current openings links')
    }

    return jobs
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        companyCareerPage: CAREERS_URL,
        company: COMPANY,
        source: SOURCE,
        companyDomain: ATIDIV_CATALOG.companyDomain,
        atsPlatform: ATIDIV_CATALOG.atsPlatform,
        link: job.applyUrl,
        scrapedAt: (overrideNow || now)(),
      }))
  },
})

export const run = async (options = {}) => createAtidivScraper().run(options)

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
