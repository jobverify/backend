import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'germancentreforopensource'
export const COMPANY = 'German centre for open source'
export const HOMEPAGE_URL = 'https://www.zendis.de/'
export const CAREERS_URL = 'https://www.zendis.de/karriere'
export const RECRUITEE_COMPANY_ID = '105958'
export const RECRUITEE_OFFERS_URL = `https://api.recruitee.com/c/${RECRUITEE_COMPANY_ID}/careers/offers/`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(current openings|open roles|open positions|job openings|vacancies|apply now|apply here|job description|view jobs|join our team)\b|jobs\.lever\.co|boards\.greenhouse\.io|job-boards\.greenhouse\.io|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|workable\.com|personio\.[^"' ]*\/job/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(value)

const fetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const normalized = stripHtml(html).toLowerCase()

  return normalized.includes('zendis')
    && /digitale souver/i.test(normalized)
    && /handlungsf/i.test(normalized)
    && /zentrum/i.test(normalized)
    && /verwaltung/i.test(normalized)
    && (normalized.includes('karriere') || String(html ?? '').includes('/karriere'))
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = stripHtml(html).toLowerCase()

  return /digitale souver/i.test(normalized)
    && normalized.includes('teamwork')
    && normalized.includes('offene stellen')
    && normalized.includes('recruiting kontakt')
    && normalized.includes('recruiting@zendis.de')
}

export const hasPublicJobsSignal = (html) => PUBLIC_JOBS_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasVerifiedRecruiteeWidget = (html) =>
  /id=["']recruitee-careers["']/i.test(String(html ?? ''))
  && new RegExp(`["']?companies["']?\\s*:\\s*\\[${RECRUITEE_COMPANY_ID}\\]`).test(String(html ?? ''))
  && /jobs-widget\.recruiteecdn\.com\/widget\.js/i.test(String(html ?? ''))

const extractIndiaOffers = (payload) => (Array.isArray(payload?.offers) ? payload.offers : [])
  .filter((offer) => String(offer?.country_code ?? '').toUpperCase() === 'IN')
  .map((offer) => ({
    title: offer.sharing_title || offer.title || offer.slug,
    company: COMPANY,
    department: offer.category_code || null,
    location: offer.location || 'India',
    city: String(offer.location || '').split(',')[0].trim() || null,
    country: 'India',
    jobId: String(offer.id || offer.slug),
    requisitionId: String(offer.id || offer.slug),
    sourceUrl: offer.careers_url,
    applyUrl: offer.careers_url,
    employmentType: offer.employment_type || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: offer.created_at || null,
    closingDate: offer.close_at || null,
    jobDescription: null,
    remoteStatus: offer.on_site === false ? 'Remote' : 'On-site',
  }))

export const matchesVerifiedNoJobsSurface = (homepageHtml, careersHtml) =>
  hasOfficialHomepageSignal(homepageHtml)
  && hasOfficialCareersSignal(careersHtml)
  && !hasPublicJobsSignal(homepageHtml)
  && !hasPublicJobsSignal(careersHtml)
  && hasVerifiedRecruiteeWidget(careersHtml)

export const createGermanCentreForOpenSourceScraper = () => ({
  async run({ fetchText: fetchTextImpl = fetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchTextImpl(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('ZenDiS homepage no longer matches the verified official public surface')
    }

    const careersHtml = await fetchTextImpl(CAREERS_URL)

    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('ZenDiS homepage now appears to expose job listings')
    }

    if (hasPublicJobsSignal(careersHtml)) {
      throw new Error('ZenDiS public careers page now appears to expose job listings')
    }

    if (!matchesVerifiedNoJobsSurface(homepageHtml, careersHtml)) {
      throw new Error('ZenDiS careers page no longer matches the verified no-listings public surface')
    }

    const offersPayload = JSON.parse(await fetchTextImpl(RECRUITEE_OFFERS_URL))
    const jobs = extractIndiaOffers(offersPayload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'zendis.recruitee.com',
      atsPlatform: 'recruitee',
    }))
  },
})

export const run = async (options = {}) => createGermanCentreForOpenSourceScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
