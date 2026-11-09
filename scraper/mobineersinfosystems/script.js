import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MOBINEERS_INFO_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MOBINEERS_INFO_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toSlug = (value = '') => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Career')
    && normalized.includes('Recent Jobs')
    && /\/jobs\//i.test(String(html))
  }

export const extractListingCards = (html = '') =>
  [...String(html).matchAll(/<a[^>]+href=["']([^"']*\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: new URL(match[1], CAREERS_URL).toString(),
      label: normalizeWhitespace(match[2]),
    }))
    .filter((card, index, cards) =>
      card.url && cards.findIndex((candidate) => candidate.url === card.url) === index)

const parseDetailPage = (html = '', url = '') => {
  const normalized = normalizeWhitespace(html)
  const lines = [...String(html).matchAll(/<(?:p|li)[^>]*>\s*([\s\S]*?)\s*<\/(?:p|li)>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
  const titleFromPageTitle = normalizeWhitespace(
    html.match(/<title[^>]*>\s*([\s\S]*?)\s*<\/title>/i)?.[1]
      ?.replace(/\s*-\s*Mobineers Info Systems Pvt\. Ltd\s*$/i, ''),
  )
  const headingCandidates = [...String(html).matchAll(/<h[1-3][^>]*>\s*([\s\S]*?)\s*<\/h[1-3]>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter((heading) => heading && !/Mobineers Info Systems/i.test(heading) && !/^Home$/i.test(heading))
  const title = normalizeWhitespace(
    titleFromPageTitle
      || headingCandidates[0]
      || normalized.match(/^(.+?)(?:Job Description|About the Role|JOB DESCRIPTION)/i)?.[1]
      || toSlug(url).replace(/-/g, ' '),
  )
  const jobType = lines
    .find((line) => /^Job Type:/i.test(line))
    ?.replace(/^Job Type:\s*/i, '')
    .trim()
    || normalized.match(/Job Type:\s*([A-Za-z ]+?)(?:Job Location:|Apply for this position|$)/i)?.[1]?.trim()
    || null
  const location = lines
    .find((line) => /^Job Location:/i.test(line))
    ?.replace(/^Job Location:\s*/i, '')
    .trim()
    || normalized.match(/Job Location:\s*([A-Za-z\/, ]+?)(?:Apply for this position|$)/i)?.[1]?.trim()
    || null
  const jobDescription = lines
    .filter((line) =>
      !/^Job Type:/i.test(line)
      && !/^Job Location:/i.test(line)
      && !/^Email:/i.test(line)
      && !/^Call Time:/i.test(line)
      && !/^Apply for this position$/i.test(line))
    .join(' ')

  if (!title || !location) {
    throw new Error(`Mobineers Info Systems detail page at ${url} no longer matches the trusted first-party contract`)
  }

  return {
    title,
    location,
    employmentType: jobType,
    jobDescription: jobDescription || null,
  }
}

export const createMobineersInfoSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Mobineers Info Systems careers page no longer matches the verified first-party surface')
    }

    const cards = extractListingCards(careersHtml)
    if (cards.length === 0) {
      throw new Error('Mobineers Info Systems careers page no longer exposes trusted first-party job links')
    }

    const jobs = []
    for (const card of cards) {
      const detailHtml = await fetchText(card.url)
      const details = parseDetailPage(detailHtml, card.url)
      jobs.push({
        title: details.title,
        company: COMPANY,
        location: details.location,
        city: details.location.split(/[\/,]/)[0]?.trim() || null,
        country: 'India',
        department: null,
        employmentType: details.employmentType,
        experienceRequired: null,
        jobId: toSlug(details.title),
        requisitionId: toSlug(details.title),
        sourceUrl: card.url,
        applyUrl: card.url,
        link: card.url,
        jobDescription: details.jobDescription,
        source: SOURCE,
        scrapedAt: now(),
      })
    }

    return jobs.sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createMobineersInfoSystemsScraper(options).run(options)

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
