import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import OPTRA_SYSTEMS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = OPTRA_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const PRIMARY_DOMAIN_URL = PROVIDER_METADATA.exactNamePrimaryDomainUrl
export const WWW_DOMAIN_URL = PROVIDER_METADATA.exactNameWwwDomainUrl
export const PORTFOLIO_URL = PROVIDER_METADATA.officialPortfolioReferenceUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bcurrent openings\b/i,
  /\bopen roles\b/i,
  /\bjob listings\b/i,
  /\bjoin us\b/i,
  /jobs\./i,
  /careers?/i,
  /greenhouse/i,
  /lever/i,
  /workday/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const hasOfficialPortfolioSignal = (html = '') => {
  const text = normalizeWhitespace(html) || ''

  return text.includes('Portfolio Companies')
    && text.includes('Optra Systems')
    && text.includes('www.optrasystems.com')
    && text.includes('Optra HEALTH')
}

export const hasPublicJobSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(text))
}

export const isExactNameResolutionFailure = (error) => {
  const message = String(error?.message ?? '')
  const code = String(error?.code ?? '')

  return code === 'ENOTFOUND'
    || code === 'EAI_AGAIN'
    || /could not resolve host/i.test(message)
    || /enotfound/i.test(message)
    || /getaddrinfo/i.test(message)
    || /fetch failed/i.test(message)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'optrasystems-html',
  timeoutMs: 15000,
})

export const createOptraSystemsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const portfolioHtml = await fetchText(PORTFOLIO_URL)

    if (hasPublicJobSignals(portfolioHtml)) {
      throw new Error('Optra Systems public jobs surface detected on the official portfolio reference page')
    }
    if (!hasOfficialPortfolioSignal(portfolioHtml)) {
      throw new Error('Optra Systems official portfolio reference changed materially')
    }

    let unresolvedCount = 0
    for (const url of [PRIMARY_DOMAIN_URL, WWW_DOMAIN_URL]) {
      try {
        const html = await fetchText(url)

        if (hasPublicJobSignals(html)) {
          throw new Error('Optra Systems public jobs surface detected on the exact-name domain')
        }

        throw new Error('Optra Systems verified unresolved exact-name domain changed materially')
      } catch (error) {
        if (isExactNameResolutionFailure(error)) {
          unresolvedCount += 1
          continue
        }

        throw error
      }
    }

    if (unresolvedCount !== 2) {
      throw new Error('Optra Systems verified unresolved exact-name domain changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createOptraSystemsScraper(options).run(options)

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
