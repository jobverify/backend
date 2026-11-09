import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mitsubishipowerindia'
export const COMPANY = 'Mitsubishi Power India Private Limited'
export const HOMEPAGE_URL = 'https://power.mhi.com/regions/ind/'
export const CAREERS_URL = 'https://power.mhi.com/regions/ind/careers'
export const CURRENT_OPENINGS_URL = 'https://mitsubishi.talentrecruit.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const hasLinkToTalentRecruit = (html, label) => {
  const page = String(html ?? '')
  const linkPattern = new RegExp(
    `<a[^>]+href="[^"]*mitsubishi\\.talentrecruit\\.com[^"]*"[^>]*>\\s*${label}\\s*<\\/a>`,
    'i',
  )

  return linkPattern.test(page)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return (
    /<title>\s*1 \| Mitsubishi Power India Private Limited\s*<\/title>/i.test(page)
      || /<title>\s*Mitsubishi Power India Private Limited\s*<\/title>/i.test(page)
  )
    && text.includes('Welcome to Mitsubishi Power India')
    && (
      text.includes('Mitsubishi Power India Private Limited is based at Bangalore India.')
        || text.includes('Mitsubishi Power India headquartered at Bangalore')
    )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers \| Mitsubishi Power India Private Limited\s*<\/title>/i.test(page)
    && text.includes('Come Join Us !')
    && text.includes('Current Openings')
    && text.includes('Upload Resume')
    && hasLinkToTalentRecruit(page, 'Current Openings')
    && hasLinkToTalentRecruit(page, 'Upload Resume')
}

export const hasOfficialCurrentOpeningsSignal = (html) => {
  const page = String(html ?? '')
  return (
    /<app-root\b/i.test(page) && /main\.c5020320440ba363d661\.js/i.test(page)
  ) || (
    /<title>\s*TalentRecruit Softwares\s*<\/title>/i.test(page)
      && page.includes('Please enable JavaScript to continue using this application.')
      && /<base href="\/">/i.test(page)
      && /favicon\.svg/i.test(page)
      && /<app-root\b/i.test(page)
  )
}

export const hasPublicJobListings = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createMitsubishiPowerIndiaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Mitsubishi Power India verified homepage changed; refusing to assume the careers surface still applies')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Mitsubishi Power India careers page changed; refusing to assume the verified current openings handoff still applies')
    }

    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)
    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('Mitsubishi Power India verified current openings shell changed; refusing to assume the public jobs surface still applies')
    }

    if (hasPublicJobListings(currentOpeningsHtml)) {
      throw new Error('Mitsubishi Power India current openings shell now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createMitsubishiPowerIndiaScraper().run(options)

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
