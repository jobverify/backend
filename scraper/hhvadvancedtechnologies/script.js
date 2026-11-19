import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'hhvadvancedtechnologies'
export const COMPANY = 'HHV Advanced Technologies'
export const HOMEPAGE_URL = 'https://hhvadvancedtech.com/'
export const CAREERS_URL = 'https://hhvadvancedtech.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
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
  const normalized = decodeHtml(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const htmlToLines = (value) => {
  const text = decodeHtml(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span[^>]*class="[^"]*\bw-text-block\b[^"]*"[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return text
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
}

const extractAccordionBlocks = (html) => {
  const doc = document(String(html ?? ''))
  return doc.nodes(node => node.tag === 'div' && Object.hasOwn(node.attrs, 'data-accordion-item')
    && (node.attrs.class || '').split(/\s+/).some(name => /^accordion_/.test(name))).map(doc.outer)
}

const extractLabeledValue = (lines, label) => {
  const line = lines.find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`))
  if (!line) return null

  return normalizeWhitespace(line.slice(label.length + 1))
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/[&/]| and /i.test(normalized)) return null

  return normalized.split(',').map((part) => normalizeWhitespace(part)).find(Boolean) ?? null
}

const extractJobDescription = (lines) => {
  let startIndex = lines.findIndex((line) => /^Job Description:?$/i.test(line))
  if (startIndex === -1) startIndex = lines.findIndex((line) => /^Responsibilities:?$/i.test(line))
  const applyIndex = lines.findIndex((line) => /^APPLY NOW$/i.test(line))

  if (startIndex === -1) return null

  const descriptionLines = lines
    .slice(startIndex + 1, applyIndex === -1 ? undefined : applyIndex)
    .map((line) => normalizeWhitespace(line.replace(/^●\s*/u, '')))
    .filter(Boolean)

  return normalizeWhitespace(descriptionLines.join(' '))
}

const extractApplyUrl = (block) => {
  const matches = [...String(block ?? '').matchAll(/href="(https:\/\/hhvadvancedtech\.com\/apply-now\?post=[^"]+)"/gi)]
  if (matches.length !== 1) return null

  try {
    const url = new URL(decodeHtml(matches[0][1]))
    return url.origin === 'https://hhvadvancedtech.com' && url.pathname === '/apply-now'
      && !url.username && !url.password && !url.hash && url.searchParams.getAll('post').length === 1
      && url.searchParams.get('post')?.trim() ? url.href : null
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Optical Component Manufacturer\s*\|\s*Thin Film Technology\s*<\/title>/i.test(page)
    && /<meta[^>]+property="og:title"[^>]+content="HHV Advanced Technologies"/i.test(page)
    && /href="\/careers"/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*HHV Advanced Tech\s*<\/title>/i.test(page)
    && /href="\/careers#current-openings"/i.test(page)
    && /The following are the current openings at HHV Advanced Technologies\./i.test(page)
    && /data-accordion-item="/i.test(page)
    && /accordion__heading/i.test(page)
    && /https:\/\/hhvadvancedtech\.com\/apply-now\?post=/i.test(page)
}

const readCareersPage = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('HHV Advanced Technologies careers page no longer matches the verified official public careers surface')
  }

  const blocks = extractAccordionBlocks(html), records = []
  const jobs = blocks.map((block) => {
    const title = stripTags(
      block.match(/<h3[^>]*class="[^"]*accordion__heading[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1],
    )
    const applyUrl = extractApplyUrl(block)
    const lines = htmlToLines(block)

    if (!title || !applyUrl || lines.length === 0) return null
    const location = extractLabeledValue(lines, 'Location')
    if (!/^(?:Chennai & Mumbai|Dabaspet, Bangalore)$/i.test(location || '')) {
      throw new Error('HHV native work location is outside the reviewed India worksites')
    }
    records.push({ title, accordionHTML: block, sourceDescription: lines.filter(line => !/^APPLY NOW$/i.test(line)).join('\n'),
      documentSHA256: createHash('sha256').update(block).digest('hex') })

    return {
      title,
      company: COMPANY,
      department: extractLabeledValue(lines, 'Department'),
      location,
      city: deriveCity(location),
      state: null,
      country: 'India',
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: extractLabeledValue(lines, 'Years of Experience'),
      minimumQualification: extractLabeledValue(lines, 'Education Qualification'),
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: extractJobDescription(lines),
      remoteStatus: 'On-site',
    }
  }).filter(Boolean)

  if (jobs.length === 0 || jobs.length !== blocks.length) {
    throw new Error('HHV Advanced Technologies verified public careers page no longer exposes parseable openings')
  }

  for (const job of jobs) {
    if (!job.jobId || !job.applyUrl || !job.location || !job.jobDescription) {
      throw new Error('HHV Advanced Technologies verified careers accordion markup changed')
    }
  }

  if (new Set(jobs.map(job => job.jobId)).size !== jobs.length) throw new Error('HHV native role identity is duplicated')
  return { jobs, records }
}

export const extractJobsFromCareersPage = html => readCareersPage(html).jobs

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  attempts: 1, redirect: 'manual', signal: options.signal,
  includeResponseMetadata: options.includeResponseMetadata === true,
})

export const createHhvAdvancedTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal } = {}) {
    const get = async url => {
      signal?.throwIfAborted()
      const response = await fetchText(url, { signal, includeResponseMetadata: true })
      signal?.throwIfAborted()
      if (typeof response === 'string') return response
      if (response?.status !== 200 || response.url !== url || typeof response.html !== 'string') {
        throw new Error('HHV Advanced Technologies first-party response identity changed')
      }
      return response.html
    }
    const homepageHtml = await get(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('HHV Advanced Technologies homepage no longer matches the verified official careers handoff')
    }

    const careersHtml = await get(CAREERS_URL)
    const { jobs, records } = readCareersPage(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const reasons = [], failures = []
    const signature = value => JSON.stringify(value.jobs.map((job, index) => ({ jobId: job.jobId, title: job.title,
      location: job.location, applyUrl: job.applyUrl, description: value.records[index].sourceDescription })))
    let pagesFetched = 1
    try {
      const closing = readCareersPage(await get(CAREERS_URL)); pagesFetched++
      if (signature(closing) !== signature({ jobs, records })) reasons.push('closing-native-inventory-changed')
    } catch (error) {
      signal?.throwIfAborted()
      reasons.push('closing-native-inventory-unavailable'); failures.push({ stage: 'closing-inventory', message: error.message })
    }
    if (selectedJobs.length !== jobs.length) reasons.push('configured-native-role-limit')
    const output = selectedJobs.map((job, index) => ({
      ...job,
      sourceDescription: records[index].sourceDescription, jobDescription: records[index].sourceDescription,
      nativeSourceRecord: { ...records[index], sourceUrl: CAREERS_URL,
        publisherDocumentSHA256: createHash('sha256').update(careersHtml).digest('hex') },
      nativeHiringOrganization: { name: COMPANY },
      nativeEmployerBinding: { method: 'explicit-first-party-careers-employer-and-own-accordion', surface: CAREERS_URL,
        statement: 'The following are the current openings at HHV Advanced Technologies.' },
      nativeCountryEvidence: { method: 'explicit-native-reviewed-india-worksite', location: job.location },
      nativeBoardListingComplete: reasons.length === 0, nativeCollectionFailures: failures,
      sourceDetailComplete: true, sourceScopeComplete: false, sourceListingComplete: false,
      lifecycleCleanupAllowed: false, applicationVisited: false, sourcePublicationDateUnavailable: true,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
    attachSourceObservationEvidence(output, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: jobs.length,
      observedVacancyCount: jobs.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    return attachInventoryEvidence(output, { status: 'coverage-gap', surface: CAREERS_URL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, reportedTotal: jobs.length, indiaFacetCount: jobs.length,
      pagesFetched, verifiedAt: now(), reason: (reasons.length ? reasons.join(';') : 'native-accordion-inventory-reconciled')
        + ';company-wide-scope-unverified' })
  },
})

export const run = async (options = {}) => createHhvAdvancedTechnologiesScraper().run(options)

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
