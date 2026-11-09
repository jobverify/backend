import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vivriticapital'
export const COMPANY = 'Vivriti Capital'
export const HOMEPAGE_URL = 'https://www.vivriticapital.com/'
export const CAREERS_URL = 'https://www.vivriticapital.com/work-with-us.html'
export const ABOUT_URL = 'https://www.vivriticapital.com/vivriti-group.html'
export const CONTACT_URL = 'https://www.vivriticapital.com/contact-us.html'
export const DARWINBOX_HANDOFF_URL = 'https://vivriti.darwinbox.in'
export const DARWINBOX_CAREERS_URL = DARWINBOX_HANDOFF_URL + '/ms/candidate/careers'
export const DARWINBOX_COMPANY_ID = 'main'

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_HANDOFF_URL,
  pageSize: 100,
})

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/vivriti\.darwinbox\.in\b/i)
  return match ? normalizeWhitespace(match[0]) : null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Financial services companies | Vivriti Capital')
    && normalized.includes('Vivriti Capital Limited')
    && normalized.includes('Public Notice')
    && normalized.includes('Careers All the hot jobs that are open at Vivriti Capital')
    && normalized.includes('sales@vivriticapital.com')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Career | Vivriti Capital')
    && normalized.includes('People Are at the Heart of What We Do')
    && normalized.includes('Join Our Team')
    && normalized.includes('Discover roles across various departments')
    && normalized.includes('Use our filters to find opportunities')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Vivriti Group | financial solutions')
    && normalized.includes('Vivriti Means Progress')
    && ((normalized.includes('Vivriti Group is the pioneering Mid-Market Lender')
      && normalized.includes('Vivriti Capital, established in 2017, is a fintech NBFC'))
      || (normalized.includes('Vivriti Next is the operating & holding company')
        && normalized.includes('Vivriti Capital Limited (VCL)')
        && normalized.includes('Vivriti Asset Management (VAM)')))
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Contact us | Vivriti Capital')
    && /Prestige Zackria Metropolitan, No\.200\/1-8, (?:2nd|8th) Floor, Block 1, Anna Salai, Chennai 600002/.test(normalized)
    && normalized.includes('sales@vivriticapital.com')
    && normalized.includes('grievanceredressal@vivriticapital.com')
}

export const hasExplicitDarwinboxEmptyInventory = html =>
  /<title>\s*Vivriti\s*<\/title>/i.test(html)
  && /\b(?:there are no current job openings|no current job openings available)\b/i.test(normalizeWhitespace(html))
  && !/"@type"\s*:\s*"JobPosting"|href=["'][^"']*\/jobs?\//i.test(html)

export const createVivritiCapitalScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchListingPage,
    maxPages,
    signal,
  } = {}) {
    const fetchOfficialPage = async (url) => {
      signal?.throwIfAborted()
      const html = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return html
    }

    const homepageHtml = await fetchOfficialPage(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Vivriti Capital homepage no longer matches the verified official site')
    }

    const careersHtml = await fetchOfficialPage(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Vivriti Capital careers page no longer matches the verified official surface')
    }
    if (extractOfficialDarwinboxUrl(careersHtml) !== DARWINBOX_HANDOFF_URL) {
      throw new Error('Vivriti Capital Darwinbox handoff no longer matches the verified official surface')
    }

    const aboutHtml = await fetchOfficialPage(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Vivriti Capital about page no longer matches the verified official site')
    }

    const contactHtml = await fetchOfficialPage(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('Vivriti Capital contact page no longer matches the verified official site')
    }

    return darwinboxScraper.run({
      fetchListingPage,
      maxPages,
      signal,
    })
  },
})

export const run = async (options = {}) => createVivritiCapitalScraper().run(options)

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
