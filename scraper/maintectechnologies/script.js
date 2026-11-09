import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { MAINTEC_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MAINTEC_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialJobsArchiveSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Job Openings\s*-\s*Maintec\s*<\/title>/i.test(page)
    && page.includes('CICS System programmer')
    && page.includes('DB2 System programmer')
    && page.includes('Mainframe DB2 DBA')
    && page.includes('India Office')
    && page.includes('Bengaluru')
}

const normalizeJobLink = (url = '') => {
  const normalized = String(url ?? '').trim()
  if (!normalized) return null
  if (/\/jobs\/(?:feed|page)\/?$/i.test(normalized)) return null
  return normalized.replace(/\/?$/, '/')
}

export const extractJobLinks = (html = '') =>
  [...String(html ?? '').matchAll(/https:\/\/maintec\.com\/jobs\/[a-z0-9-]+\/?/gi)]
    .map((match) => normalizeJobLink(match[0]))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)

const extractPrimaryDetailContent = (html = '') =>
  String(html ?? '').match(/<h1[^>]*>[\s\S]*?(?:<div class="awsm-job-form"|<\/body>)/i)?.[0] ?? String(html ?? '')

const isExpiredDetailPage = (html = '') => {
  const content = extractPrimaryDetailContent(html)
  return /This role is no longer available\./i.test(content)
    || /Sorry!\s*This job has expired\./i.test(content)
}

const hasUsHoursSignal = (html = '') => {
  const content = extractPrimaryDetailContent(html)
  return /US Eastern hours/i.test(content)
    || /US Eastern(?: Time Zone)? business hours/i.test(content)
}

const hasTrustworthyIndiaJobSignal = (html = '') => {
  const content = extractPrimaryDetailContent(html)
  return /Location\s*[:\-]?\s*(?:Bengaluru|Bangalore|Chennai|Mumbai|Pune|Hyderabad|Noida)[^<\n]*India/i.test(content)
}

const hasCurrentArchiveDetailShellSignal = (html = '') => {
  const page = String(html ?? '')
  return /Apply for this position/i.test(page)
    && /US Office/i.test(page)
    && /India Office/i.test(page)
}

export const createMaintecTechnologiesScraper = ({
  fetchText = defaultFetchText,
} = {}) => ({
  async run() {
    const archiveHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialJobsArchiveSignal(archiveHtml)) {
      throw new Error('Maintec Technologies verified first-party jobs archive no longer matches the trusted surface')
    }

    const representativeLinks = extractJobLinks(archiveHtml)

    if (representativeLinks.length === 0) {
      throw new Error('Maintec Technologies archive no longer exposes trusted first-party job detail links')
    }

    for (const url of representativeLinks) {
      const detailHtml = await fetchText(url)

      if (hasTrustworthyIndiaJobSignal(detailHtml)) {
        throw new Error('Maintec Technologies now exposes trustworthy India job metadata; re-verify before scraping')
      }

      if (
        isExpiredDetailPage(detailHtml)
        || hasUsHoursSignal(detailHtml)
        || hasCurrentArchiveDetailShellSignal(detailHtml)
      ) {
        continue
      }

      throw new Error('Maintec Technologies representative detail pages no longer match the verified ambiguous, non-India, or expired pattern')
    }

    return []
  },
})

export const run = async (options = {}) => createMaintecTechnologiesScraper(options).run()

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
