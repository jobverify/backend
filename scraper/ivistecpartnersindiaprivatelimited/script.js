import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { IVISTEC_PARTNERS_INDIA_PRIVATE_LIMITED_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = IVISTEC_PARTNERS_INDIA_PRIVATE_LIMITED_CATALOG.source
export const HOMEPAGE_URL = IVISTEC_PARTNERS_INDIA_PRIVATE_LIMITED_CATALOG.homepageUrl
export const ABOUT_URL = 'https://vistecpartners.com/About.html'
export const CONTACT_URL = 'https://vistecpartners.com/Contact-Us.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(p|div|li|section|article|h[1-6]|nav|a)>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const findLinks = (html = '', baseUrl = HOMEPAGE_URL) => [...String(html ?? '').matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map((match) => {
    try {
      return {
        url: new URL(match[1], baseUrl).toString(),
        text: normalizeWhitespace(match[2]),
      }
    } catch {
      return null
    }
  })
  .filter(Boolean)

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Transforming Healthcare with AI-Powered Solutions')
    && normalized.includes('Bringing automation, efficiency, and patient-centered care across the healthcare continuum.')
    && normalized.includes('Operations Team')
}

export const hasOfficialAboutSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('About Vistec Partners')
    && normalized.includes('At Vistec Partners, we are reimagining the future of healthcare.')
    && normalized.includes('Schedule a Consultation')
}

export const hasOfficialContactSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Contact Us')
    && normalized.includes('Vistec Partners')
    && (normalized.includes('Noida, India') || normalized.includes('A-43, Ground Floor Sector-63') || normalized.includes('NOIDA UP 201301'))
    && (normalized.includes('contact@vistecpartners.com') || normalized.includes('info@vistecpartners.com'))
}

export const hasNoPublicCareersSignal = (html = '') => {
  const links = findLinks(html)
  return !links.some(({ url, text }) =>
    /(?:careers?|jobs?|join-us|join with us|openings?)/i.test(`${url} ${text}`),
  )
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIvistecPartnersIndiaPrivateLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('iVistec Partners India Private Limited verified homepage no longer matches the pinned official surface')
    }
    if (!hasNoPublicCareersSignal(homepageHtml)) {
      throw new Error('iVistec Partners India Private Limited public careers surface appeared on the verified homepage')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('iVistec Partners India Private Limited verified about page no longer matches the pinned official surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('iVistec Partners India Private Limited verified contact page no longer matches the pinned official surface')
    }
    if (!hasNoPublicCareersSignal(contactHtml)) {
      throw new Error('iVistec Partners India Private Limited public careers surface appeared on the verified contact page')
    }

    return []
  },
})

export const run = async (options = {}) => createIvistecPartnersIndiaPrivateLimitedScraper().run(options)

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
