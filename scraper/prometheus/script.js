import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import PROMETHEUS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROMETHEUS_CATALOG.source
export const COMPANY = PROMETHEUS_CATALOG.companyName
export const PROVIDER_METADATA = PROMETHEUS_CATALOG
export const COMPANY_DOMAIN = PROMETHEUS_CATALOG.companyDomain
export const HOMEPAGE_URL = PROMETHEUS_CATALOG.homepageUrl
export const CAREERS_URL = PROMETHEUS_CATALOG.companyCareerPage
export const OVERVIEW_URL = PROMETHEUS_CATALOG.overviewUrl
export const GOVERNANCE_URL = PROMETHEUS_CATALOG.governanceUrl
export const VERIFIED_AT = PROMETHEUS_CATALOG.verifiedOn

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|â€™/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;|â€“|â€”/gi, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /Open source metrics and monitoring for your systems and services/i.test(normalized)
    && /100% open source and community-driven/i.test(normalized)
    && /Cloud Native Computing Foundation graduated project/i.test(normalized)
}

export const hasIndependentProjectOverviewSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /standalone open source project/i.test(normalized)
    && /maintained independently of any company/i.test(normalized)
    && /joined the Cloud Native Computing Foundation/i.test(normalized)
}

export const hasOpenGovernanceSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /Prometheus Governance/i.test(normalized)
    && /Steering Committee/i.test(normalized)
    && /seats on the Steering Committee are held by individuals/i.test(normalized)
    && /not by or through their respective employers/i.test(normalized)
}

export const createPrometheusScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Verified Prometheus homepage changed materially')
    }

    const overviewHtml = await fetchText(OVERVIEW_URL)
    if (!hasIndependentProjectOverviewSignal(overviewHtml)) {
      throw new Error('Verified Prometheus independent-project overview changed materially')
    }

    const governanceHtml = await fetchText(GOVERNANCE_URL)
    if (!hasOpenGovernanceSignal(governanceHtml)) {
      throw new Error('Verified Prometheus governance signal changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createPrometheusScraper().run(options)

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
