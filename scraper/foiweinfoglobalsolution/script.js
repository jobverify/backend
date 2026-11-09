import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FOIWE_INFO_GLOBAL_SOLUTION_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Career\s*<\/title>/i.test(page)
    && text.includes('Join Our Team!')
    && text.includes('HR Recruiter')
    && text.includes('Full-Stack Developer')
    && text.includes('Japanese Social Media Manager')
  }

export const extractCareerListings = (html = '') => {
  const page = String(html ?? '')
  const jobs = []

  for (const match of page.matchAll(/<div class="elementor-accordion-item">([\s\S]*?)<\/div>\s*<\/div>/gi)) {
    const section = match[1]
    const title = normalizeWhitespace(section.match(/elementor-accordion-title">([\s\S]*?)<\/span>/i)?.[1])
    const summary = normalizeWhitespace(section.match(/<strong>\s*Job Summary:\s*<\/strong>([\s\S]*?)<\/p>/i)?.[1])
    const href = section.match(/<a[^>]*class="toggle-btn"[^>]*href="([^"]+)"/i)?.[1]
    if (!title || !summary || !href) continue

    jobs.push({
      title,
      summary,
      detailUrl: new URL(href, CAREERS_URL).toString(),
    })
  }

  return jobs
}

export const run = async ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)

  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('Foiwe Info Global Solution verified first-party careers page changed materially')
  }

  const listings = extractCareerListings(careersHtml)
  if (listings.length === 0) {
    throw new Error('Foiwe Info Global Solution verified first-party careers page no longer exposes trusted openings')
  }

  return listings.map((job) => ({
    title: job.title,
    company: COMPANY,
    source: SOURCE,
    sourceUrl: job.detailUrl,
    applyUrl: job.detailUrl,
    link: job.detailUrl,
    jobDescription: job.summary,
    location: 'India',
    country: 'India',
    remoteStatus: 'On-site',
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    scrapedAt: now(),
  }))
}

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
