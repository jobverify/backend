import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import SANKALP_SEMICONDUCTOR_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SANKALP_SEMICONDUCTOR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const SEARCH_OPENINGS_HOST_URL = PROVIDER_METADATA.searchOpeningsHostUrl
export const JOB_OPPORTUNITIES_EMAIL = PROVIDER_METADATA.jobOpportunitiesEmail

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const hasHomepageSignal = (html) => {
  const source = String(html ?? '')

  return /<title>\s*Sankalp Semiconductor - End-to-End Analog and Mixed Signal Solution\s*<\/title>/i.test(source)
    && /Search Openings/i.test(source)
    && /END-TO-END SEMICONDUCTOR SERVICES/i.test(source)
}

export const hasContactPageSignal = (html) => {
  const source = String(html ?? '')

  return /Contact us/i.test(source)
    && /For Job Opportunities/i.test(source)
    && /sankalp-recruit@hcl\.com/i.test(source)
}

export const extractSearchOpeningsUrl = (html) => {
  const source = String(html ?? '')
  const match = source.match(
    /<a\b[^>]*href=(["'])(https?:\/\/[^"']*sankalpsemi\.alchemus\.com[^"']*)\1[^>]*>\s*Search Openings\s*<\/a>/i,
  )

  return normalizeWhitespace(match?.[2])
}

export const hasPublicJobBoardSignal = (html) => {
  const source = String(html ?? '')

  return /Search Openings/i.test(source)
    && /\b(job|jobs|openings|vacanc(?:y|ies))\b/i.test(source)
    && /India/i.test(source)
}

export const isConnectivityError = (error) => {
  const messages = []
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    messages.push(`${current.code || ''} ${current.message || current}`)
    current = current.cause
  }

  return /ENOTFOUND|EAI_AGAIN|getaddrinfo|Could not resolve host|Failed to connect|fetch failed|network|timeout|UND_ERR_CONNECT_TIMEOUT|HTTP 5\d\d/i.test(
    normalizeWhitespace(messages.join(' ')) || '',
  )
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const buildDiscoveryOnlyEvidence = (now, surface) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: surface || HOMEPAGE_URL,
    firstParty: true,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: now(),
    reason: 'Sankalp Semiconductor verified first-party surface is currently unavailable; public inventory cannot be verified.',
  })

export const createSankalpSemiconductorScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    probeText = defaultFetchText,
  } = {}) {
    const fetchRequiredText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (isConnectivityError(error)) {
          error.inventoryEvidenceSurface = url
        }
        throw error
      }
    }

    let homepageHtml
    try {
      homepageHtml = await fetchRequiredText(HOMEPAGE_URL)
    } catch (error) {
      if (isConnectivityError(error)) {
        return buildDiscoveryOnlyEvidence(now, error.inventoryEvidenceSurface)
      }
      throw error
    }

    if (!hasHomepageSignal(homepageHtml)) {
      throw new Error('Sankalp Semiconductor homepage no longer matches the verified public surface')
    }

    let contactHtml
    try {
      contactHtml = await fetchRequiredText(CONTACT_URL)
    } catch (error) {
      if (isConnectivityError(error)) {
        return buildDiscoveryOnlyEvidence(now, error.inventoryEvidenceSurface)
      }
      throw error
    }

    if (!hasContactPageSignal(contactHtml)) {
      throw new Error('Sankalp Semiconductor contact page no longer matches the verified public surface')
    }

    const searchOpeningsUrl = extractSearchOpeningsUrl(homepageHtml)
    if (!searchOpeningsUrl || !searchOpeningsUrl.startsWith(SEARCH_OPENINGS_HOST_URL)) {
      throw new Error('Sankalp Semiconductor ATS handoff no longer matches the verified exact-name surface')
    }

    try {
      const atsHtml = await probeText(searchOpeningsUrl)
      if (hasPublicJobBoardSignal(atsHtml)) {
        throw new Error('Sankalp Semiconductor ATS handoff now exposes a public jobs surface')
      }
    } catch (error) {
      if (!isConnectivityError(error)) {
        throw error
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSankalpSemiconductorScraper(options).run(options)

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
