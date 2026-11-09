import path from 'node:path'
import { fileURLToPath } from 'node:url'

import PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

export const PROVIDER_METADATA = PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SAMPLE_ROLE_URL = PROVIDER_METADATA.sampleRoleUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const buildMaterialSurfaceChangeError = () => {
  const error = new Error('The verified Pramata Knowledge Solutions careers surfaces changed materially')
  error.abortRetries = true
  return error
}

export const hasVerifiedCloudflareChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    && (
      normalized.includes('Checking you before accessing www.pramata.com.')
      || normalized.includes('Checking your browser...')
    )
    && /ki-cf-botcl=1/i.test(page)
    && /www\.pramata\.com/i.test(page)
}

export const exposesStructuredPublicJobs = (html = '') =>
  /\bjob-card\b/i.test(String(html ?? ''))
  || /Solution Architect\s*-\s*Contract AI/i.test(String(html ?? ''))
  || /Current Openings/i.test(String(html ?? ''))

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      status: response.status,
      url,
      finalUrl: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    return {
      status: null,
      url,
      finalUrl: url,
      html: null,
      errorKind: error?.name === 'AbortError' ? 'timeout' : 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const createPramataKnowledgeSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of [CAREERS_URL, SAMPLE_ROLE_URL]) {
      const page = await fetchPage(url)

      if (page.errorKind) {
        throw new Error(`Failed to fetch verified Pramata Knowledge Solutions route: ${url} (${page.errorKind})`)
      }

      if (exposesStructuredPublicJobs(page.html)) {
        throw new Error('Pramata Knowledge Solutions careers page now exposes scraper-visible public jobs')
      }

      if (Number(page.status) !== 403 || !hasVerifiedCloudflareChallengeSignal(page.html)) {
        throw buildMaterialSurfaceChangeError()
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPramataKnowledgeSolutionsScraper().run(options)

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
