import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SMART_IMS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/[\u2013\u2014]/g, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s+:/g, ':')
  .trim()

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Careers\s*(?:&amp;|&)\s*Job Opportunities\s*\|\s*SmartIMS\s*<\/title>/i.test(rawHtml)
    && text.includes('Building Impactful Careers')
    && text.includes('Smart IMS India')
    && text.includes('Current Job Openings')
    && text.includes('To apply send your profile to')
}

export const decodeCloudflareEmail = (value = '') => {
  const hex = String(value ?? '').trim()
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2 !== 0) {
    return null
  }

  const key = Number.parseInt(hex.slice(0, 2), 16)
  let decoded = ''

  for (let index = 2; index < hex.length; index += 2) {
    decoded += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16) ^ key)
  }

  return decoded
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractLabeledField = (html, label) => {
  const pattern = new RegExp(
    `<strong>\\s*${escapeRegExp(label)}\\s*<\\/strong>\\s*:\\s*([\\s\\S]*?)(?:<br\\s*\\/?>|<\\/p>|<\\/li>)`,
    'i',
  )
  const match = String(html ?? '').match(pattern)
  return normalizeWhitespace(match?.[1] ?? '')
}

export const extractApplyEmail = (html = '') => {
  const cfEmail = String(html ?? '').match(/data-cfemail=["']([0-9a-f]+)["']/i)?.[1]
  const decodedCfEmail = decodeCloudflareEmail(cfEmail)
  if (decodedCfEmail) {
    return decodedCfEmail
  }

  const mailtoMatch = String(html ?? '').match(/mailto:([^"' >]+)/i)?.[1]
  return mailtoMatch ? decodeHtmlEntities(mailtoMatch) : null
}

export const extractSmartImsJobCards = (html = '') =>
  [...String(html ?? '').matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)]
    .map((match) => {
      const block = match[1]
      const rawTitle = normalizeWhitespace(
        block.match(/<div class=['"]e-n-accordion-item-title-text['"]>\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? '',
      )
      const textEditorBody = block.match(
        /<div class=['"][^'"]*elementor-widget-text-editor[^'"]*['"][^>]*>\s*([\s\S]*?)\s*<\/div>\s*<\/div>/i,
      )?.[1]
      const bodyContainers = [...block.matchAll(/<div class=['"]elementor-widget-container['"]>\s*([\s\S]*?)\s*<\/div>/gi)]
        .map((entry) => entry[1])
      const bodyHtml = textEditorBody
        || bodyContainers.find((entry) => /To apply send your profile to/i.test(entry))
        || bodyContainers[0]

      return {
        rawTitle,
        bodyHtml,
      }
    })
    .filter((card) => card.rawTitle && card.bodyHtml)

export const extractJobsFromCareersHtml = (html = '') => extractSmartImsJobCards(html)
  .map(({ rawTitle, bodyHtml }) => {
    const title = rawTitle.replace(/^Job Description:\s*/i, '').trim()
    const applyEmail = extractApplyEmail(bodyHtml)
    const location = extractLabeledField(bodyHtml, 'Location')
    const experience = extractLabeledField(bodyHtml, 'Experience')
    const team = extractLabeledField(bodyHtml, 'Team')
    const openingsCount = extractLabeledField(bodyHtml, 'No of Positions')
    const jobDescription = stripHtml(bodyHtml)

    if (!title || !location || !applyEmail) {
      return null
    }

    return {
      title,
      location,
      applyUrl: `mailto:${applyEmail}`,
      experience: experience || null,
      team: team || null,
      openingsCount: openingsCount || null,
      jobDescription,
      detailUrl: CAREERS_URL,
      sourceUrl: CAREERS_URL,
    }
  })
  .filter(Boolean)

export const createSmartImsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Smart IMS careers page changed materially')
    }

    const jobs = extractJobsFromCareersHtml(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Smart IMS careers page no longer exposes the verified current openings accordion')
    }

    return jobs
  },
})

export const run = async (options = {}) => createSmartImsScraper().run(options)

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
