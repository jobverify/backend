import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { runNativeGreatLearning } from './nativeCurrent.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'greatlearning'
export const COMPANY_NAME = 'Great Learning'
export const COMPANY = COMPANY_NAME
export const COMPANY_ID = 'main'
export const VERIFIED_ON = '2026-09-13'
export const OFFICIAL_SITE_URL = 'https://www.mygreatlearning.com/'
export const CAREERS_PAGE_URL = 'https://www.mygreatlearning.com/careers'
export const DARWINBOX_ORIGIN = 'https://greatlearning.darwinbox.in'
export const PUBLIC_ALL_JOBS_URL = `${DARWINBOX_ORIGIN}/ms/candidatev2/${COMPANY_ID}/careers/allJobs`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Great Learning Careers: Apply for Current Job Openings'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.mygreatlearning\.com\/careers["']/i.test(page)
    && (text.includes('Current openings at Great Learning') || text.includes('Join our Tribe'))
    && text.includes('team of impact-makers!')
    && /career-openings__list/i.test(page)
    && /career-openings__item/i.test(page)
}

export const extractDarwinboxJobDetailUrls = (html = '') => [
  ...String(html ?? '').matchAll(
    /data-job-link=["'](https:\/\/greatlearning\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/jobDetails\/[^"']+)["']/gi,
  ),
].map((match) => decodeHtmlEntities(match[1]))

const extractAttribute = (html, attribute) => String(html ?? '').match(
  new RegExp('\\b' + attribute + '\\s*=\\s*["\']([^"\']*)["\']', 'i'),
)?.[1] ?? null

// Balance nested tags so descriptions keep all paragraphs and bullet points.
const elementsByClass = (html, className) => {
  const page = String(html ?? '')
  const elements = []
  const openings = /<([a-z][\w-]*)\b[^>]*\bclass\s*=\s*["']([^"']*)["'][^>]*>/gi
  let opening
  while ((opening = openings.exec(page))) {
    if (!opening[2].split(/\s+/).includes(className)) continue
    const tags = new RegExp('<\\/?' + opening[1] + '\\b[^>]*>', 'gi')
    tags.lastIndex = openings.lastIndex
    let depth = 1
    let closing
    while (depth && (closing = tags.exec(page))) depth += closing[0].startsWith('</') ? -1 : 1
    if (depth) throw new Error('Great Learning incomplete role card markup')
    elements.push({ html: page.slice(opening.index, tags.lastIndex), inner: page.slice(openings.lastIndex, closing.index) })
    openings.lastIndex = tags.lastIndex
  }
  return elements
}

const toGreatLearningUrl = (value) => {
  if (!value) return null
  try {
    const url = new URL(decodeHtmlEntities(value), CAREERS_PAGE_URL)
    return url.origin === 'https://www.mygreatlearning.com' && /^\/careers\/[^/]+\/[^/]+\/?$/.test(url.pathname) ? url.toString() : null
  } catch { return null }
}

const toApplicationUrl = (value) => {
  if (!value) return null
  try {
    const url = new URL(decodeHtmlEntities(value))
    const isGoogleForm = (url.hostname === 'forms.gle' && /^\/[^/]+$/.test(url.pathname))
      || (url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/'))
    return url.protocol === 'https:' && isGoogleForm && !url.username && !url.password ? url.toString() : null
  } catch { return null }
}

export const extractGreatLearningJobs = (html = '') => {
  const listing = elementsByClass(html, 'career-openings__list')[0]?.inner
  if (!listing) throw new Error('Great Learning incomplete openings list')
  const cards = elementsByClass(listing, 'career-openings__item')
  const expectedApplications = [...listing.matchAll(/\bdata-job-link\s*=/gi)].length
  if (!cards.length || cards.length !== expectedApplications) throw new Error('Great Learning incomplete application cards')
  const seen = new Set()
  return cards.map(({ html: card }) => {
    const content = className => elementsByClass(card, className)[0]?.inner
    const title = normalizeWhitespace(content('job-position'))
    const applyUrl = toApplicationUrl(extractAttribute(card, 'data-job-link'))
    const location = normalizeWhitespace(content('location-name'))
    const sourceUrl = toGreatLearningUrl(extractAttribute(elementsByClass(card, 'job-location')[0]?.html, 'href'))
    const description = normalizeWhitespace(content('job-details'))
    const qualifications = normalizeWhitespace(content('job-qualifications'))
    if (!title || !applyUrl || !sourceUrl || !location || !description) throw new Error('Great Learning incomplete public role card')
    if (seen.has(sourceUrl)) throw new Error('Great Learning duplicate role URL declaration')
    seen.add(sourceUrl)
    return {
      title, company: COMPANY_NAME, department: null,
      location: null, nativeLocation: location, city: null, country: null,
      jobId: null, requisitionId: null, sourceUrl, applyUrl, applicationUrlIsGeneric: true,
      employmentType: null,
      experienceRequired: qualifications?.match(/\b\d+(?:\s*[\u2013-]\s*\d+|\+)?\s*years?\b/i)?.[0] ?? null,
      minimumQualification: null, preferredQualification: null, requiredSkills: [],
      postingDate: null, closingDate: null,
      jobDescription: [description, qualifications].filter(Boolean).join(' '), remoteStatus: null,
      sourceDetailComplete: false, sourceCountryScopeUnresolved: true,
      sourceDetailFailureKind: 'native-country-or-role-proof-unqualified-legacy',
    }
  })
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const createLegacyGreatLearningScraper = ({
  now = () => new Date().toISOString(),
  darwinboxScraper = createDarwinboxScraper({
    source: SOURCE,
    companyName: COMPANY_NAME,
    origin: DARWINBOX_ORIGIN,
    companyId: COMPANY_ID,
  }),
} = {}) => ({
  async run({ fetchText = defaultFetchText, signal, ...darwinboxOptions } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_PAGE_URL, { signal })
    signal?.throwIfAborted()

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified Great Learning careers page changed materially')
    }

    const cards = elementsByClass(careersHtml, 'career-openings__item')
    const legacyUrls = extractDarwinboxJobDetailUrls(careersHtml)
    const jobs = legacyUrls.length === cards.length && cards.length > 0
      ? await darwinboxScraper.run(signal ? { ...darwinboxOptions, signal } : darwinboxOptions)
      : extractGreatLearningJobs(careersHtml)
    signal?.throwIfAborted()
    const scrapedAt = now()

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      source: SOURCE,
      link: job.link || job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const createGreatLearningScraper = (defaults = {}) => ({
  async run(options = {}) {
    const combined = {...defaults, ...options}
    if (combined.maxJobs === 0 || combined.fetchResponse || combined.fetchImpl || (!combined.fetchText && !combined.darwinboxScraper)) return runNativeGreatLearning(combined)
    const legacyOptions = {...combined};delete legacyOptions.now;delete legacyOptions.darwinboxScraper
    const jobs = await createLegacyGreatLearningScraper(combined).run(legacyOptions)
    return attachInventoryEvidence(jobs.map(job=>({...job,nativeLocation:job.nativeLocation||job.location,location:null,city:null,country:null,jobId:null,requisitionId:null,canonicalRoleURL:null,sourceDetailComplete:false,sourceCountryScopeUnresolved:true,sourceDetailFailureKind:'native-country-or-role-proof-unqualified-legacy',sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false})),{status:'discovery-only',surface:CAREERS_PAGE_URL,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,reason:'text-only-legacy-observations-not-current-native-role-proof'})
  },
})
export const run = async (options = {}) => createGreatLearningScraper().run(options)

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
