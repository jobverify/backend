import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDarwinboxScraper } from '../darwinbox/script.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bharatpe'
export const COMPANY = 'BharatPe'
export const HOMEPAGE_URL = 'https://bharatpe.com/'
export const CAREERS_URL = 'https://bharatpe.com/career'
export const NATIVE_CAREERS_URL = 'https://bharatpe.darwinbox.in/ms/candidatev2/main/careers/allJobs'
export const CAREERS_ROUTE_URLS = [
  'https://bharatpe.com/careers',
  'https://bharatpe.com/careers/',
  'https://bharatpe.com/career',
  'https://bharatpe.com/career/',
  'https://bharatpe.com/jobs',
  'https://bharatpe.com/jobs/',
  'https://bharatpe.com/join-us',
  'https://bharatpe.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
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
  /recruitcrm/i,
]

const NOT_FOUND_SIGNAL_PATTERNS = [
  /\b404\b/i,
  /\bpage not found\b/i,
  /\bnot found\b/i,
  /\bdoesn'?t exist\b/i,
  /\bcan't seem to find\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isSameOfficialDomain = (value) => {
  try {
    return new URL(value || HOMEPAGE_URL).hostname === 'bharatpe.com'
  } catch {
    return false
  }
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal,
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title[^>]*>[^<]*bharatpe[^<]*<\/title>/i.test(rawHtml)
    && /bharatpe\.com/i.test(rawHtml)
    && normalized.includes('bharatpe')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  if (!isSameOfficialDomain(page.url || HOMEPAGE_URL)) {
    return false
  }

  if (hasPublicJobsSignal(page.html)) {
    return false
  }

  if (Number(page.status) === 404) {
    return true
  }

  const normalized = normalizeWhitespace(page.html).toLowerCase()
  return hasOfficialHomepageSignal(page.html)
    || NOT_FOUND_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const createBharatPeScraper = ({ fetchImpl } = {}) => ({
  async run(options = {}) {
    const { fetchPage = defaultFetchPage, signal } = options
    signal?.throwIfAborted()
    const homepage = await fetchPage(HOMEPAGE_URL, { signal })

    if (homepage.status !== 200 || !isSameOfficialDomain(homepage.url) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('BharatPe verified official homepage no longer matches the known public surface')
    }

    const home = document(homepage.html)
    const careerLinks = home.nodes(node => node.tag === 'a' && /^Careers$/i.test(home.text(node)))
      .filter(node => { try { return new URL(node.attrs.href, HOMEPAGE_URL).href.replace(/\/$/, '') === CAREERS_URL } catch { return false } })
    if (!careerLinks.length) throw new Error('BharatPe corporate careers handoff changed')
    const careersPage = await fetchPage(CAREERS_URL, { signal })
    if (careersPage.status !== 200 || !isSameOfficialDomain(careersPage.url)
      || new URL(careersPage.url).pathname.replace(/\/$/, '') !== '/career'
      || !/<title[^>]*>\s*Careers\s*-\s*BharatPe\s*<\/title>/i.test(careersPage.html)) {
      throw new Error('BharatPe corporate careers handoff changed')
    }
    const careers = document(careersPage.html)
    const nativeLinks = careers.nodes(node => node.tag === 'a' && node.attrs.href === NATIVE_CAREERS_URL && /See openings/i.test(careers.text(node)))
    if (!nativeLinks.length) throw new Error('BharatPe visible same-company Darwinbox handoff changed')
    signal?.throwIfAborted()
    const native = createDarwinboxScraper({ companyName: COMPANY, source: SOURCE,
      origin: 'https://bharatpe.darwinbox.in', companyId: 'main', pageSize: 10,
      ...(options.fetchImpl || fetchImpl ? { fetchImpl: options.fetchImpl || fetchImpl } : {}) })
    const jobs = await native.run(options)
    return mapJobsWithInventoryEvidence(jobs, job => ({ ...job, companyCareerPage: CAREERS_URL,
      companyDomain: 'bharatpe.com', atsPlatform: 'darwinbox' }))
  },
})

export const run = async (options = {}) => createBharatPeScraper().run(options)

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
