import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kgisl'
export const COMPANY = 'KGISL'
export const HOMEPAGE_URL = 'https://www.kgisl.com/'
export const CAREERS_URL = 'https://www.kgisl.com/careers'
export const CURRENT_OPENINGS_URL = 'https://www.kgisl.com/current-openings/'
export const CANDIDATE_HOME_URL = 'https://careerxai.kgisl.com/ajax/candidate_home?form=wepportal'
export const VERIFIED_ON = '2026-10-09'
export const VERIFIED_SURFACE_SUMMARY =
  "Verified on October 9, 2026 that the official KGISL current-openings page embeds https://careerx.kgisl.com/#/careers. Its verified first-party client consumes the complete public vacancies array from /careerxai/api/public/careers/vacancies. The live array contains 23 unique roles: 20 explicitly in India and 3 in Malaysia. All 20 India public details were verified against listing identities, locations and experience, with full descriptions and client-advertised apply routes. Unavailable or malformed inventory remains a failure."

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNAVAILABLE_ERROR_PATTERN =
  /(?:http 500|http 504|gateway timeout|timed out|timeout|operation was aborted due to timeout|connect timeout|und_err_connect_timeout|fetch failed|econnreset|unable to|getaddrinfo|enotfound)/i

const HOMEPAGE_SIGNALS = [
  'AI & ML driven Insurance & capital market products | Digital Transformation',
  'Get Your Workforce Ready for The Future',
  'Powered by Empathy',
  'Experienced by Outcomes',
  'A closer look at who we are and our values',
  'Careers',
]

const CAREERS_SIGNALS = [
  'Career Opportunities - KGiSL Technologies',
  'Join our talent network',
  'Current Openings',
  'Register on our Candidate Portal and get notified when new roles that match your skills open up.',
  'tag@kgisl.com',
]

const CURRENT_OPENINGS_SIGNALS = [
  'Career opportunities | KGiSL Technologies',
  'Current Openings',
  'careerxai.kgisl.com/ajax/candidate_home?form=wepportal',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/[“”]/g, '"')
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toLowerText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  signal,
  timeoutMs: 15000,
})

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractBlock = (html, startIndex) => {
  let depth = 0
  let cursor = startIndex

  while (cursor < html.length) {
    const nextOpen = html.indexOf('<div', cursor)
    const nextClose = html.indexOf('</div>', cursor)

    if (nextClose === -1) return null

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      cursor = nextOpen + 4
      continue
    }

    depth -= 1
    cursor = nextClose + 6

    if (depth === 0) {
      return html.slice(startIndex, cursor)
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = toLowerText(html)
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal.toLowerCase()))
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = toLowerText(html)
  return CAREERS_SIGNALS.every((signal) => normalized.includes(signal.toLowerCase()))
}

export const hasOfficialCurrentOpeningsSignal = (html) => {
  const normalized = toLowerText(html)

  return normalized.includes('career opportunities | kgisl technologies')
    && normalized.includes('current openings')
}

export const hasOfficialCandidateHomeSignal = (html) => {
  const normalized = toLowerText(html)

  return normalized.includes('current openings')
    && normalized.includes('vacancy id:')
    && normalized.includes('job-card')
    && normalized.includes('apply-btn')
    && /(?:https?:\/\/careerxai\.kgisl\.com)?\/resume\/webportal_vacancy_apply_resume\//i.test(String(html ?? ''))
}

export const CURRENT_PORTAL_URL = 'https://careerx.kgisl.com/#/careers'
export const CURRENT_INVENTORY_URL = 'https://careerx.kgisl.com/careerxai/api/public/careers/vacancies'
const CURRENT_PORTAL_ROOT = 'https://careerx.kgisl.com/'
export const extractCandidateHomeUrl = (html) => {
  const urls = [...String(html ?? '').matchAll(/<iframe\b[^>]*src=["']([^"']+)["']/gi)]
    .map(match => toAbsoluteUrl(match[1], CURRENT_OPENINGS_URL))
    .filter(url => url === CANDIDATE_HOME_URL || url === CURRENT_PORTAL_URL)
  return urls.length === 1 ? urls[0] : null
}

export const extractJobs = (html) => {
  const source = String(html ?? '')
  const jobs = []
  const starts = [...source.matchAll(/<div class="job-card">/gi)]

  for (const start of starts) {
    const card = extractBlock(source, start.index)
    if (!card) continue

    const jobId = normalizeWhitespace(card.match(/Vacancy ID:\s*([^<\n]+)/i)?.[1] ?? '')
    const title = normalizeWhitespace(card.match(/<div class="job-title toggle-description">([\s\S]*?)<\/div>/i)?.[1] ?? '')
    const location = normalizeWhitespace(card.match(/<div class="location mb-1">([\s\S]*?)<\/div>/i)?.[1] ?? '')
    const applyUrl = toAbsoluteUrl(
      card.match(/<a href="([^"]+)"\s*class="btn apply-btn/i)?.[1] ?? null,
      CANDIDATE_HOME_URL,
    )
    const postingDate = normalizeWhitespace(card.match(/Posted on:\s*([^<\n]+)/i)?.[1] ?? '')
    const jobDescription = normalizeWhitespace(
      card.match(/<div class="job-description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<div class="col-md-3">/i)?.[1]
      ?? card.match(/<div class="job-description">([\s\S]*?)<\/div>/i)?.[1]
      ?? '',
    )

    if (!jobId || !title || !location || !applyUrl || !jobDescription) {
      continue
    }

    jobs.push({
      title,
      location,
      jobId,
      applyUrl,
      sourceUrl: applyUrl,
      postingDate,
      jobDescription,
    })
  }

  return jobs
}

export const isVerifiedKgislUnavailableError = (error) => {
  const message = String(error?.message || error || '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNAVAILABLE_ERROR_PATTERN.test(message)
    || UNAVAILABLE_ERROR_PATTERN.test(causeCode)
    || UNAVAILABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchTextSafely = async (fetchText, url) => {
  try {
    return { ok: true, html: await fetchText(url) }
  } catch (error) {
    return { ok: false, error }
  }
}

const normalizeKgislJobs = (jobs) => jobs.map((job) => normalizeScrapedJob({
  ...job,
  company: COMPANY,
  companyCareerPage: CURRENT_OPENINGS_URL,
  atsPlatform: 'official-first-party-candidate-portal',
  publicExperienceChecked: Boolean(job.jobDescription),
}, {
  companyName: COMPANY,
  companyCareerPage: CURRENT_OPENINGS_URL,
  companyDomain: 'kgisl.com',
  atsPlatform: 'official-first-party-candidate-portal',
  countryFilter: 'India',
}))

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal, label: SOURCE, timeoutMs: 15000, attempts: 3,
})
const vacancyTitle = record => normalizeWhitespace(record.position_title)
  + (record.designation ? ' - ' + normalizeWhitespace(record.designation) : '')
const validateVacancy = record => {
  if (!/^V\d+$/.test(record?.vacancy_number || '') || !normalizeWhitespace(record.position_title)
    || !normalizeWhitespace(record.work_location) || !Number.isFinite(record.min_experience)
    || !Number.isFinite(record.max_experience) || record.min_experience < 0 || record.max_experience < record.min_experience
    || !/^[1-9]\d*$/.test(String(record.no_of_position))) throw new Error('KGISL replacement inventory record is malformed')
  if (!/-(India|Malaysia|Singapore|Thailand|Australia|United States|United Kingdom)$/i.test(record.work_location)) {
    throw new Error('KGISL replacement inventory has unresolved country location')
  }
}
const scrapeCurrentPortal = async ({ fetchText, fetchJson, signal }) => {
  signal?.throwIfAborted()
  const portal = await fetchText(CURRENT_PORTAL_ROOT)
  const scripts = [...String(portal).matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/gi)]
  if (!/<title>\s*CareerX\s*<\/title>/i.test(portal) || scripts.length !== 1
    || !/^\/assets\/index-[\w-]+\.js$/.test(scripts[0][1])) throw new Error('KGISL replacement careers client shell changed')
  const client = await fetchText(new URL(scripts[0][1], CURRENT_PORTAL_ROOT).href)
  if (!client.includes('baseURL:"/careerxai"') || !client.includes('/api/public/careers/vacancies')
    || !client.includes('/api/public/careers/vacancy/') || !client.includes('#/careers/apply/')) {
    throw new Error('KGISL replacement careers client no longer verifies the public inventory')
  }
  const payload = await fetchJson(CURRENT_INVENTORY_URL, { signal })
  if (payload?.status !== 200 || !Array.isArray(payload.response) || payload.more_records === true || payload.hasMore === true) {
    throw new Error('KGISL replacement inventory schema or pagination changed')
  }
  const ids = new Set()
  for (const record of payload.response) {
    validateVacancy(record)
    if (ids.has(record.vacancy_number)) throw new Error('KGISL replacement inventory contains duplicate identities')
    ids.add(record.vacancy_number)
  }
  const selected = payload.response.filter(record => /-India$/i.test(record.work_location))
  const jobs = await mapWithConcurrency(selected, 3, async record => {
    signal?.throwIfAborted()
    const detail = await fetchJson(CURRENT_INVENTORY_URL.replace('/vacancies', '/vacancy/') + record.vacancy_number, { signal })
    const job = detail?.response
    if (detail?.status !== 200 || !job || ['vacancy_number', 'position_title', 'designation', 'work_location', 'min_experience', 'max_experience', 'no_of_position']
      .some(key => job[key] !== record[key])) throw new Error('KGISL replacement job detail conflicts with its public listing')
    const jobDescription = normalizeWhitespace(job.job_description)
    if (!jobDescription) throw new Error('KGISL replacement job description is missing')
    const applyUrl = CURRENT_PORTAL_URL + '/apply/' + job.vacancy_number
    return { title: vacancyTitle(job), location: job.work_location, country: 'India', jobId: job.vacancy_number,
      applyUrl, sourceUrl: applyUrl, jobDescription,
      experienceRequired: job.min_experience + '-' + job.max_experience + ' years',
      requiredSkills: String(job.primary_skills || '').split(',').map(normalizeWhitespace).filter(Boolean),
    }
  })
  signal?.throwIfAborted()
  return attachInventoryEvidence(normalizeKgislJobs(jobs), {
    status: jobs.length ? 'complete-inventory' : 'verified-empty', surface: CURRENT_INVENTORY_URL,
    firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: selected.length, indiaFacetCount: selected.length,
    verifiedAt: new Date().toISOString(), reason: 'complete-first-party-client-inventory-' + payload.response.length + '-global-records',
  })
}

export const createKgislScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, signal } = {}) {
    signal?.throwIfAborted()
    const readText = url => fetchText(url, { signal })
    const homepageResult = await fetchTextSafely(readText, HOMEPAGE_URL)
    if (homepageResult.ok && !hasOfficialHomepageSignal(homepageResult.html)) {
      throw new Error('KGISL verified official homepage no longer matches the known public surface')
    }

    const careersResult = await fetchTextSafely(readText, CAREERS_URL)
    if (careersResult.ok && !hasOfficialCareersSignal(careersResult.html)) {
      throw new Error('KGISL verified official careers page no longer matches the known public surface')
    }

    const currentOpeningsResult = await fetchTextSafely(readText, CURRENT_OPENINGS_URL)
    if (currentOpeningsResult.ok && !hasOfficialCurrentOpeningsSignal(currentOpeningsResult.html)) {
      throw new Error('KGISL verified current openings page no longer matches the known public surface')
    }

    let candidateHomeUrl = CANDIDATE_HOME_URL
    if (currentOpeningsResult.ok) {
      candidateHomeUrl = extractCandidateHomeUrl(currentOpeningsResult.html)
      if (candidateHomeUrl !== CANDIDATE_HOME_URL && candidateHomeUrl !== CURRENT_PORTAL_URL) {
        throw new Error('KGISL current openings page no longer links to the verified candidate portal')
      }
    }

    const officialWrappersUnavailable = [homepageResult, careersResult, currentOpeningsResult].some(
      (result) => !result.ok,
    )

    if (officialWrappersUnavailable && ![homepageResult, careersResult, currentOpeningsResult].every(
      (result) => result.ok || isVerifiedKgislUnavailableError(result.error),
    )) {
      throw new Error('KGISL verified first-party wrappers failed in an unexpected way')
    }

    if (candidateHomeUrl === CURRENT_PORTAL_URL) return scrapeCurrentPortal({ fetchText: readText, fetchJson, signal })

    const candidateHomeResult = await fetchTextSafely(readText, CANDIDATE_HOME_URL)
    if (!candidateHomeResult.ok) {
      throw candidateHomeResult.error
    }

    const candidateHomeHtml = candidateHomeResult.html
    if (!hasOfficialCandidateHomeSignal(candidateHomeHtml)) {
      throw new Error('KGISL candidate portal no longer matches the verified public surface')
    }

    const extractedJobs = extractJobs(candidateHomeHtml)

    if (extractedJobs.length === 0) {
      throw new Error('KGISL candidate portal no longer exposes the verified public job cards')
    }

    return normalizeKgislJobs(extractedJobs)
  },
})

export const run = async (options = {}) => createKgislScraper().run(options)

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
