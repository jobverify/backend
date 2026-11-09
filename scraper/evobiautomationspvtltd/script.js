import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'evobiautomationspvtltd'
export const COMPANY = 'Evobi Automations Pvt. Ltd'
export const VERIFIED_AT = '2026-07-13'
export const HOMEPAGE_URL = 'https://evobi.in/'
export const WWW_HOMEPAGE_URL = 'https://www.evobi.in/'
export const ROBOTS_URL = 'https://evobi.in/robots.txt'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://evobi.in/career',
  'https://evobi.in/careers',
  'https://evobi.in/careers/',
  'https://evobi.in/jobs',
  'https://evobi.in/openings',
  'https://evobi.in/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasVerifiedParkedDomainSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Parked Domain name on Hostinger DNS system\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,\s*nofollow,\s*noarchive,\s*nosnippet["']/i.test(rawHtml)
    && normalized.includes('registered at')
    && normalized.includes('if this is your domain, you can manage it in your hostinger account.')
    && normalized.includes('manage domain')
    && normalized.includes('start your online journey')
    && normalized.includes('build your website today')
    && normalized.includes('prompt your website')
    && normalized.includes('power your projects with vps')
    && rawHtml.includes('window.location.hostname')
  }

export const hasDisallowAllRobotsSignal = (text) => {
  const normalized = String(text ?? '')
    .replace(/\r/g, '')
    .trim()

  return normalized === 'User-agent: *\nDisallow: /'
}

export const createEvobiAutomationsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('Evobi Automations Pvt. Ltd homepage now appears to expose public jobs')
    }
    if (!hasVerifiedParkedDomainSignal(homepageHtml)) {
      throw new Error('Evobi Automations Pvt. Ltd homepage no longer matches the verified parked-domain surface')
    }

    const wwwHomepageHtml = await fetchText(WWW_HOMEPAGE_URL)
    if (hasPublicJobsSignal(wwwHomepageHtml)) {
      throw new Error('Evobi Automations Pvt. Ltd www homepage now appears to expose public jobs')
    }
    if (!hasVerifiedParkedDomainSignal(wwwHomepageHtml)) {
      throw new Error('Evobi Automations Pvt. Ltd www homepage no longer matches the verified parked-domain surface')
    }

    const robotsTxt = await fetchText(ROBOTS_URL)
    if (!hasDisallowAllRobotsSignal(robotsTxt)) {
      throw new Error('Evobi Automations Pvt. Ltd robots.txt no longer matches the verified parked-domain surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routeHtml = await fetchText(routeUrl)
      if (hasPublicJobsSignal(routeHtml) || !hasVerifiedParkedDomainSignal(routeHtml)) {
        throw new Error(`Evobi Automations Pvt. Ltd verified no-public-careers route changed: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEvobiAutomationsScraper().run(options)

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
