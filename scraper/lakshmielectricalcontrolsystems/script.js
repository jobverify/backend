import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lakshmielectricalcontrolsystems'
export const COMPANY = 'Lakshmi Electrical Control Systems'
export const HOMEPAGE_URL = 'https://www.lecsindia.com/'
export const CAREERS_URL = 'https://www.lecsindia.com/careers'
export const CONTACT_URL = 'https://www.lecsindia.com/contact-us/'
export const VERIFIED_ON = '2026-10-03'
export const VERIFIED_SURFACE_SUMMARY = "Verified on October 3, 2026 that Careers at LECS India is backed by its official public jobs API. Three roles observed; one explicitly based in Coimbatore exported, two without public job location evidence excluded."

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN = /href=["']https?:\/\/(?:www\.)?lecsindia\.com\/(?:careers?|jobs?|join-us|work-with-us|openings?|vacanc(?:y|ies))(?:[\/#?][^"']*)?["']|href=["']\/(?:careers?|jobs?|join-us|work-with-us|openings?|vacanc(?:y|ies))(?:[\/#?][^"']*)?["']/i

const CAREER_LIKE_TEXT_PATTERN = />\s*(?:careers?|jobs?|job openings|current openings|join us|work with us)\s*</i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bview all openings\b/i,
  /\bopen roles\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bupload your resume\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /\bresume upload\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/[’‘]/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 10000,
})

const defaultFetchTextWithExtendedTimeout = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 90000,
})

const isExtendedTimeoutFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const fetchVerifiedText = async (
  url,
  fetchText,
  fetchTextWithExtendedTimeout,
) => {
  try {
    return await fetchText(url)
  } catch (error) {
    if (!isExtendedTimeoutFallbackError(error)) {
      throw error
    }

    return fetchTextWithExtendedTimeout(url)
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(html)
  const hasLegacyHomepageSignal = normalized.includes('control panel manufacturers | smart meter manufacturers - lecs ltd')
    && normalized.includes('lakshmi electrical control systems limited (lecs)')
    && normalized.includes('control panels')
    && normalized.includes('engineering plastic components')
    && normalized.includes('smart meters')
    && normalized.includes('industries we serve')
    && normalized.includes('factory address lakshmi electrical control systems limited')
    && normalized.includes('arasur, coimbatore - 641 407 tamilnadu, india')
    && normalized.includes('info@lecsindia.com')

  const hasCurrentHomepageSignal = /<title>\s*(?:lecs|Discover Control Panel Manufacturer Solutions \| LECS India)\s*<\/title>/i.test(page)
    && normalized.includes('ev chargers')
    && normalized.includes('what we offer')
    && normalized.includes('industries we serve')
    && normalized.includes('credentials')
    && normalized.includes('lecs excels in providing unmatched solutions')

  return hasLegacyHomepageSignal || hasCurrentHomepageSignal
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*careers\s*\|\s*lecs india\s*<\/title>/i.test(page)
    && normalized.includes('menu home about us product industries investors partner with us photo gallery careers news contact us lecs')
    && normalized.includes('careers | lecs india')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeText(html)
  const hasPhoneSignal =
    normalized.includes('phone: +91-422-6616500')
    || normalized.includes('+91-422-6616500')

  const hasLegacyContactBlock = normalized.includes('lakshmi electrical control systems limited, arasur, coimbatore - 641 407, tamilnadu, india')
    && normalized.includes("let's talk")
    && normalized.includes('other than business enquiry e-mail us')
    && normalized.includes('contact@lecsindia.com')

  const hasCurrentContactBlock = normalized.includes('get in touch')
    && normalized.includes('factory address')
    && normalized.includes('arasur, coimbatore - 641 407 tamilnadu, india')

  const hasCurrentContactExperience = normalized.includes("let's connect")
    && normalized.includes('email us at')
    && normalized.includes('give us a call at')
    && normalized.includes('contact@lecsindia.com')
    && normalized.includes('lakshmi electrical control systems limited')
    && normalized.includes('arasur, coimbatore')

  return (normalized.includes('contact us') || normalized.includes("let's connect"))
    && hasPhoneSignal
    && normalized.includes('info@lecsindia.com')
    && (hasLegacyContactBlock || hasCurrentContactBlock || hasCurrentContactExperience)
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))
  || CAREER_LIKE_TEXT_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))


export const CURRENT_JOBS_API_URL = 'https://api.lecsindia.com/job'

const extractCurrentCareersClientUrl = (html = '') => {
  if (!/<title>\s*Careers at LECS India \| Explore Jobs (?:&amp;|&) Career Opportunities\s*<\/title>/i.test(html)
    || !/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/(?:www\.)?lecsindia\.com\/careers["']/i.test(html)) return null
  const scriptPath = html.match(/<script[^>]+src=["'](\/_next\/static\/chunks\/app\/careers\/page-[^"']+\.js)["']/i)?.[1]
  return scriptPath ? new URL(scriptPath, HOMEPAGE_URL).toString() : null
}

const cleanJobDescription = (value = '') => String(value)
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim()

const readCurrentCareersJobs = async ({ clientUrl, fetchText, fetchJson, now, maxPages }) => {
  const client = await fetchText(clientUrl)
  if (!client.includes('https://api.lecsindia.com') || !client.includes('/job?page=')
    || !client.includes('/job/dropdown') || !client.includes('CareersHeroSection')) {
    throw new Error('LECS verified public careers client changed materially')
  }
  const jobs = []
  const seen = new Set()
  const scrapedAt = now()
  let totalJobs = null
  let unresolvedLocations = 0
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await fetchJson(CURRENT_JOBS_API_URL + '?page=' + page + '&limit=10')
    const pagination = payload?.pagination
    if (payload?.success !== true || !Array.isArray(payload.jobs)
      || !Number.isInteger(pagination?.totalJobs) || pagination.totalJobs < 0
      || pagination.currentPage !== page || typeof pagination.hasNext !== 'boolean') {
      throw new Error('LECS jobs feed changed materially or has invalid pagination')
    }
    if (totalJobs !== null && totalJobs !== pagination.totalJobs) throw new Error('LECS jobs feed total changed during pagination')
    totalJobs = pagination.totalJobs
    for (const record of payload.jobs) {
      if (!record?._id || !record.title || typeof record.description !== 'string') throw new Error('LECS jobs feed contains an invalid job')
      if (seen.has(record._id)) continue
      seen.add(record._id)
      const description = cleanJobDescription(record.description)
      const city = (record.location || '').match(/\b(Coimbatore|Chennai|Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|Noida|Gurugram)\b/i)?.[1]
        || description.match(/(?:based in|location\s*:)\s*(Coimbatore|Chennai|Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|Noida|Gurugram)\b/i)?.[1]
      if (!city) { unresolvedLocations += 1; continue }
      jobs.push({
        title: record.title, company: COMPANY, source: SOURCE,
        jobId: SOURCE + '-' + record._id, requisitionId: record._id,
        department: record.department || null, location: city + ', India', city, country: 'India',
        employmentType: /full[- ]?time/i.test(record.type || '') ? 'Full-time' : record.type || null,
        remoteStatus: null, experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
        jobDescription: description || null, postingDate: record.createdAt || null, closingDate: null,
        sourceUrl: CAREERS_URL, applyUrl: CAREERS_URL, link: CAREERS_URL,
        companyCareerPage: CAREERS_URL, companyDomain: 'lecsindia.com', atsPlatform: 'official-company-careers', scrapedAt,
      })
    }
    if (!pagination.hasNext) {
      if (seen.size !== totalJobs) throw new Error('LECS jobs feed is incomplete')
      if (unresolvedLocations && !jobs.length) throw new Error('LECS incomplete country scope: all public role locations are unverified')
      if (unresolvedLocations) for (const job of jobs) job.sourceListingComplete = false
      return jobs
    }
    if (payload.jobs.length === 0) throw new Error('LECS jobs feed returned an incomplete empty page')
  }
  throw new Error('LECS jobs feed exceeded the verified pagination limit')
}

export const createLakshmiElectricalControlSystemsScraper = ({ now = () => new Date().toISOString(), maxPages = 100 } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchTextWithExtendedTimeout = defaultFetchTextWithExtendedTimeout,
    fetchJson = (url) => fetchJsonWithRetry(url, { label: SOURCE, timeoutMs: 15000 }),
  } = {}) {
    const homepageHtml = await fetchVerifiedText(
      HOMEPAGE_URL,
      fetchText,
      fetchTextWithExtendedTimeout,
    )
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Lakshmi Electrical Control Systems verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('Lakshmi Electrical Control Systems homepage now exposes public jobs')
    }

    const careersHtml = await fetchVerifiedText(
      CAREERS_URL,
      fetchText,
      fetchTextWithExtendedTimeout,
    )
    const currentClientUrl = extractCurrentCareersClientUrl(careersHtml)
    if (currentClientUrl) return readCurrentCareersJobs({ clientUrl: currentClientUrl, fetchText, fetchJson, now, maxPages })
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Lakshmi Electrical Control Systems verified official careers page no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(careersHtml)) {
      throw new Error('Lakshmi Electrical Control Systems careers page now exposes public jobs')
    }

    const contactHtml = await fetchVerifiedText(
      CONTACT_URL,
      fetchText,
      fetchTextWithExtendedTimeout,
    )
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('Lakshmi Electrical Control Systems verified official contact surface no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(contactHtml)) {
      throw new Error('Lakshmi Electrical Control Systems contact surface now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createLakshmiElectricalControlSystemsScraper().run(options)

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
