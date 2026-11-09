import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'paramtechcadservicespvtltd'
export const COMPANY = 'Paramtech Cad Services Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://www.paramtechnologies.in/'
export const ABOUT_URL = 'https://www.paramtechnologies.in/about-us.php'
export const CONTACT_URL = 'https://www.paramtechnologies.in/contact-us.php'
export const CAREERS_URL = 'https://www.paramtechnologies.in/career.php'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

// The first-party domain now consistently brands as Paramtech Engineering Services while
// keeping the same first-party about, contact, and careers shell for this exact-name row.
const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/[‘’]/g, "'")

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOB_LISTING_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob title\b/i,
  /\bjob description\b/i,
  /\bopen positions?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /href=["'][^"']*\/apply(?:\/|["'])/i,
  /class=["'][^"']*job-card[^"']*["']/i,
  /class=["'][^"']*opening-card[^"']*["']/i,
  /\blocation:\s*[a-z]/i,
]

const hasCareerNavLink = (html) =>
  /<a[^>]*href=["']career\.php["'][^>]*>\s*Careers\s*<\/a>/i.test(String(html ?? ''))

const hasContactNavLink = (html) =>
  /<a[^>]*href=["']contact-us\.php["'][^>]*>\s*Contact Us\s*<\/a>/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Paramtech Engineering Services Private Limited\s*<\/title>/i.test(page)
    && hasCareerNavLink(page)
    && hasContactNavLink(page)
    && normalized.includes('empowering innovation with the spirit of giving')
    && normalized.includes('product design')
    && normalized.includes('we specialize in innovative product design services tailored to meet the unique needs of the automotive, manufacturing, industrial, and heavy engineering sectors')
    && normalized.includes('spot-18, suite no')
    && normalized.includes('pimple saudagar, rahatani, pune')
    && normalized.includes('info@paramtechnologies.in')
    && normalized.includes('+91 87702 67488')
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Paramtech Engineering Services Private Limited\s*<\/title>/i.test(page)
    && normalized.includes('who we are')
    && normalized.includes('paramtech engineering services private limited is an engineering partner to global oems')
    && normalized.includes("for 17+ years we've covered the full product lifecycle")
    && normalized.includes('with 7,500+ successful placements')
    && normalized.includes('helping ourselves by helping others')
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Paramtech Engineering Services Private Limited\s*<\/title>/i.test(page)
    && normalized.includes('contact us')
    && normalized.includes('reach us')
    && normalized.includes('paramtech engineering services private limited.')
    && normalized.includes('spot-18, suite no')
    && normalized.includes('pimple saudagar, rahatani, pune')
    && normalized.includes('+91 87702 67488')
    && normalized.includes('info@paramtechnologies.in')
    && normalized.includes('send us an inquiry')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Paramtech Engineering Services Private Limited\s*<\/title>/i.test(page)
    && hasCareerNavLink(page)
    && hasContactNavLink(page)
    && normalized.includes('join paramtech engineering services private limited, where innovation, engineering excellence, and a people-first culture drive everything we do.')
    && normalized.includes('current openings')
    && normalized.includes('coming soon... stay tuned')
    && normalized.includes('cad/cae engineers')
    && normalized.includes('testing & validation engineers')
}

export const hasPublicJobListingsSignal = (html) =>
  PUBLIC_JOB_LISTING_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasNoPublicJobListingsSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('current openings')
    && normalized.includes('coming soon... stay tuned')
    && normalized.includes('cad/cae engineers')
    && normalized.includes('testing & validation engineers')
    && !hasPublicJobListingsSignal(html)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createParamtechCadServicesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Paramtech CAD Services homepage no longer matches the verified exact-company surface')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Paramtech CAD Services about page no longer matches the verified first-party surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('Paramtech CAD Services contact page no longer matches the verified first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Paramtech CAD Services careers page no longer matches the verified empty-shell surface')
    }

    if (!hasNoPublicJobListingsSignal(careersHtml)) {
      throw new Error('Paramtech CAD Services careers page now exposes public job listings or changed shape')
    }

    return []
  },
})

export const run = async (options = {}) => createParamtechCadServicesScraper().run(options)

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
