import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { IPROGRAMMER_SOLUTIONS_CATALOG } from './catalog.js'
import { runPublishedAnnouncement } from './employerAnnouncement.js'
export {parseNativeAnnouncementPdf,fetchAnnouncementPage} from './employerAnnouncement.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = IPROGRAMMER_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'iprogrammer.com') return null
    return url.toString()
  } catch {
    return null
  }
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

export const hasVerifiedOpeningsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return /<title>\s*IT Companies in Pune for Freshers \| Experience\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Current Openings')
    && normalized.includes('ta@iprogrammer.co')
    && /<h4[^>]*>\s*<a[^>]*href=["'][^"']*\/current-opening\/[^"']+["']/i.test(html)
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  if (/remote/i.test(normalized)) return 'Remote'
  return 'On-site'
}

export const extractJobs = (html = '') => {
  const jobs = []

  const page = String(html)
  const headings = [...page.matchAll(/<h4[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h4>/gi)]
  const expectedLinks = new Set([...page.matchAll(/<a[^>]*href=["']([^"']*\/current-opening\/[^"']+)["']/gi)].map(([, href]) => toAbsoluteUrl(href)))
  for (const [index, heading] of headings.entries()) {
    const [, href, rawTitle] = heading
    const body = page.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? page.length)
    const field = label => body.match(new RegExp('<strong>\\s*'+label+'\\s*</strong>\\s*:\\s*([^<]+)<','i'))?.[1]
    const rawDescription = body.match(/<div[^>]*class=["'][^"']*\belementor-widget-text-editor\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
      || body.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]
    const rawExperience = field('Experience')
    const rawVacancies = field('Vacancies')
    const rawLocation = field('Job Location')
    const rawWorkMode = field('Work Mode')
    const title = normalizeWhitespace(rawTitle)
    const sourceUrl = toAbsoluteUrl(href)
    const location = normalizeWhitespace(rawLocation)
    const india = /^(?:India|Pune(?:,\s*Maharashtra)?(?:,\s*India)?)$/i.test(location)
    if (!title || !sourceUrl || !location || !rawDescription || !rawExperience || !rawVacancies || !rawWorkMode
      || !/^\/current-opening\/[a-z0-9-]+\/$/.test(new URL(sourceUrl).pathname)) throw new Error('iProgrammer incomplete public role card')

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: india ? `${location}, India` : location,
      city: location,
      country: india ? 'India' : null,
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: normalizeWhitespace(rawExperience),
      vacancies: normalizeWhitespace(rawVacancies),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(rawDescription),
      remoteStatus: normalizeRemoteStatus(rawWorkMode),
    })
  }

  if (!jobs.length || new Set(jobs.map(job => job.sourceUrl)).size !== expectedLinks.size || jobs.length !== expectedLinks.size || new Set(jobs.map(job => job.jobId)).size !== jobs.length) throw new Error('iProgrammer incomplete current listing')
  return jobs
}

export const createIprogrammerSolutionsScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    signal?.throwIfAborted()
    let careersHtml
    try { careersHtml = await fetchText(CAREERS_URL, { signal }) }
    finally { signal?.throwIfAborted() }
    if (!hasVerifiedOpeningsSignal(careersHtml)) {
      throw new Error('The verified iProgrammer Solutions openings surface no longer matches the trusted first-party page')
    }

    const jobs = extractJobs(careersHtml)
    if (jobs.some(job => !job.country)) {
      for (const job of jobs) job.sourceListingComplete = false
      console.warn('[iprogrammersolutions] Some role locations remain unverified; prior jobs will be preserved.')
    }
    const verifiedJobs = jobs.filter(job => job.country === 'India')
    if (!verifiedJobs.length && jobs.length) throw new Error('iProgrammer incomplete country scope: no verified India roles')
    const selectedJobs = maxJobs ? verifiedJobs.slice(0, maxJobs) : verifiedJobs
    if (selectedJobs.length < jobs.length) {
      for (const job of selectedJobs) job.sourceListingComplete = false
    }

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

// The original HTML factory remains available for its historical parser contract.
// Current production reads the fresh employer announcement and native public PDF.
export const run = async (options = {}) => typeof options.fetchText === 'function' && typeof options.fetchPage !== 'function'
  ? createIprogrammerSolutionsScraper().run(options)
  : runPublishedAnnouncement(options)

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
