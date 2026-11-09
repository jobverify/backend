import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { KAPIVA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KAPIVA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const CONTACT_PAGE_URL = PROVIDER_METADATA.contactPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob openings?\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /teamtailor/i,
  /workable/i,
  /darwinbox/i,
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeCloudflareEmail = (hex = '') => {
  const value = String(hex ?? '').trim()
  if (!/^[0-9a-f]+$/i.test(value) || value.length < 4 || value.length % 2 !== 0) {
    return null
  }

  const key = Number.parseInt(value.slice(0, 2), 16)
  let decoded = ''

  for (let index = 2; index < value.length; index += 2) {
    decoded += String.fromCharCode(Number.parseInt(value.slice(index, index + 2), 16) ^ key)
  }

  return decoded
}

const extractEmails = (html = '') => {
  const emails = new Set()
  const page = String(html ?? '')

  for (const match of page.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    emails.add(match[0].toLowerCase())
  }

  for (const match of page.matchAll(/\bdata-cfemail=["']([0-9a-f]+)["']/gi)) {
    const decoded = decodeCloudflareEmail(match[1])
    if (decoded) {
      emails.add(decoded.toLowerCase())
    }
  }

  return emails
}

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title\b[^>]*>\s*Kapiva\s*-\s*Buy Modern Ayurvedic Products Online for Complete Nutrition\s*<\/title>/i.test(page)
    && (
      (
        normalized.includes('HAPPY AYURVEDA CONSUMERS')
        && normalized.includes('FORMULATED BY EXPERTS AT KAPIVA ACADEMY OF AYURVEDA')
      )
      || (
        normalized.includes('Kapiva is a company of Adret Retail Private Limited')
        && /1800[-\s]274[-\s]2575/i.test(normalized)
        && normalized.includes('info@kapiva.in')
      )
    )
  }

export const hasVerifiedAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const legacyContent = normalized.includes('ABOUT US')
    && normalized.includes('Kapiva tri-dosha synergy is an ever growing family')
    && normalized.includes('Your simple guide to everyday Ayurveda')
  const currentContent = /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/kapiva\.in\/about-us\/["']/i.test(page)
    && /<meta\b[^>]*property=["']og:title["'][^>]*content=["']About Kapiva \| Science-backed Ayurveda["']/i.test(page)
    && normalized.includes('About Kapiva')
    && normalized.includes('Science-backed Ayurveda. And we can prove it.')
    && normalized.includes('From seed to your health report.')
    && normalized.includes('Kapiva is a company of Adret Retail Private Limited')

  return /<title\b[^>]*>\s*Explore Ayurveda Products for Healthy Life\s*\|\s*Kapiva\s*(?:\|\s*)?<\/title>/i.test(page)
    && (legacyContent || currentContent)
}

export const hasVerifiedContactPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const emails = extractEmails(page)

  return /<title\b[^>]*>\s*Contact Kapiva\s*\|\s*Get in Touch With Us\s*<\/title>/i.test(page)
    && normalized.includes('CONTACT US')
    && normalized.includes('For openings and collaboration:')
    && emails.has('careers@kapiva.in')
  }

export const hasPublicJobSignals = (content = '') => {
  const page = String(content ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createKapivaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (hasPublicJobSignals(homepageHtml)) {
      throw new Error('Kapiva homepage now appears to expose a public jobs surface')
    }
    if (!hasVerifiedHomepageSignal(homepageHtml)) {
      throw new Error('Kapiva verified homepage no longer matches the known first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_PAGE_URL)
    if (hasPublicJobSignals(aboutHtml)) {
      throw new Error('Kapiva about page now appears to expose a public jobs surface')
    }
    if (!hasVerifiedAboutPageSignal(aboutHtml)) {
      throw new Error('Kapiva verified about page no longer matches the known first-party surface')
    }

    const contactHtml = await fetchText(CONTACT_PAGE_URL)
    if (hasPublicJobSignals(contactHtml)) {
      throw new Error('Kapiva contact page now appears to expose a public jobs surface')
    }
    if (!hasVerifiedContactPageSignal(contactHtml)) {
      throw new Error('Kapiva verified contact page no longer matches the known first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createKapivaScraper().run(options)

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
