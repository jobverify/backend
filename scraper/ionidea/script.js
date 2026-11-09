import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { hasActiveIonSurface, readIonInlineRoles } from './nativeInline.js'

import { IONIDEA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = IONIDEA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLY_URL = PROVIDER_METADATA.applyPageUrl

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
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toSlug = (value = '') => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  attempts: 1,
  signal: options.signal,
})

export const hasOfficialCareersSignal = (html = '') => {
  return hasActiveIonSurface(String(html))
  }

export const extractInlineJobs = (html = '') => {
  return readIonInlineRoles(String(html))
}

const extractLegacyHeadingRows = (html = '') => {
  const page = String(html)
  const headings = [...page.matchAll(/<h[1-6][^>]*>\s*([\s\S]*?)\s*<\/h[1-6]>/gi)]
    .map((match) => ({
      title: normalizeWhitespace(match[1]),
      index: match.index ?? 0,
      length: match[0].length,
    }))
    .filter((entry) =>
      entry.title
      && entry.title !== 'Jobs at IonIdea'
      && entry.title !== 'Unlock Your Potential: Join Our Innovative Tech Team and Shape the Future!')

  return headings.map((entry, index) => {
    const start = entry.index + entry.length
    const end = index + 1 < headings.length ? headings[index + 1].index : page.length
    const block = page.slice(start, end)
    const lines = [...block.matchAll(/<(?:p|li)[^>]*>\s*([\s\S]*?)\s*<\/(?:p|li)>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter(Boolean)

    const experienceRequired =
      lines.find((line) => /^Experience:/i.test(line))?.replace(/^Experience:\s*/i, '').trim()
      || null
    const location =
      lines.find((line) => /^Location:/i.test(line))?.replace(/^Location:\s*/i, '').trim()
      || null
    const jobDescription = lines
      .filter((line) =>
        !/^Experience:/i.test(line)
        && !/^Education:/i.test(line)
        && !/^Location:/i.test(line)
        && !/^Reports to:/i.test(line)
        && !/^Apply Here$/i.test(line))
      .join(' ')

    return {
      title: entry.title,
      experienceRequired,
      location,
      jobDescription: jobDescription || null,
    }
  }).filter((job) => job.title)
}

export const createIonideaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('IonIdea careers page no longer matches the verified first-party surface')
    }

    const jobs = extractInlineJobs(careersHtml)
      .map((job) => ({
        ...job,
        company: COMPANY,
        city: null,
        country: job.country,
        department: null,
        employmentType: null,
        jobId: null,
        requisitionId: null,
        sourceUrl: CAREERS_URL,
        applyUrl: job.applyUrl,
        link: job.applyUrl,
        source: SOURCE,
        scrapedAt: now(),
      }))
      .sort((left, right) => left.title.localeCompare(right.title))

    if (jobs.length === 0) {
      throw new Error('IonIdea careers page no longer exposes trusted inline jobs')
    }

    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: jobs.length,
      observedVacancyCount: jobs.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS_URL, firstParty: true,
      listingComplete: false, pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: null,
      reason: 'ionidea-native-inline-vacancy-observations;application-targets-not-independently-read;company-scope-unconfirmed;closing-not-read' })
  },
})

export const run = async (options = {}) => createIonideaScraper(options).run(options)

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
