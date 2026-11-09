import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PRAMATI_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PRAMATI_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LINKED_CAREERS_BOARD_URL = PROVIDER_METADATA.linkedCareersBoardUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--([\s\S]*?)-->/g, ' $1 ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8211;|&ndash;/gi, ' - ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Pramati(?:\s*&#8211;|\s*&ndash;|\s*–|\s*-)\s*Build the next/i.test(page)
    && normalized.includes('Pramati builds independent, innovative technology companies focused on profitable, well-defined markets.')
    && normalized.includes('Pramati Prism is where it all starts, our in-house accelerator which incubates products in early stage, and nurtures them before spinning them out into autonomous ventures.')
    && normalized.includes('Catch the buzz. Pramati is a happening place for everyone')
}

export const hasLinkedZappyhireCareersBoard = (html = '') =>
  /recruitcareers\.zappyhire\.com\/pramati/i.test(String(html ?? ''))

export const isExpectedMissingCareersRoute = (response = {}) =>
  response?.status === 404 && /page not found/i.test(normalizeWhitespace(response?.html ?? ''))

export const isOpaqueZappyhireShell = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && /<base\s+href=["']\/en\/["']/i.test(page)
    && !pageExposesPublicJobs(html)
}

export const pageExposesPublicJobs = (html = '') =>
  /<a[^>]+href=["'][^"']*(?:\/job\/|\/jobs\/|\/current-opening\/)[^"']*["'][^>]*>[\s\S]*?<\/a>/i.test(String(html ?? ''))

export const createPramatiTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage?.status !== 200 || !hasVerifiedHomepageSignal(homepage.html) || !hasLinkedZappyhireCareersBoard(homepage.html)) {
      throw new Error('The trusted exact-name Pramati homepage contract changed materially')
    }

    const careersRoute = await fetchPage(CAREERS_URL)
    if (!isExpectedMissingCareersRoute(careersRoute)) {
      throw new Error('The trusted Pramati exact-name careers route no longer returns the verified missing-page response')
    }

    const board = await fetchPage(LINKED_CAREERS_BOARD_URL)
    if (pageExposesPublicJobs(board?.html ?? '')) {
      throw new Error('The linked Pramati careers board now exposes public jobs and requires a scraper upgrade')
    }
    if (board?.status !== 200 || !isOpaqueZappyhireShell(board.html)) {
      throw new Error('The linked Pramati careers board no longer matches the verified opaque careers shell')
    }

    return []
  },
})

export const run = async (options = {}) => createPramatiTechnologiesScraper().run(options)

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
