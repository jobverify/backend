import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.indo-mim.com/careers/'
export const VERIFIED_ON = '2026-08-07'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career\s*-\s*INDO-MIM\s*<\/title>/i.test(page)
    && /CURRENT\s+OPENINGS/i.test(page)
    && /EX-EMPLOYEE\s+BGV/i.test(page)
    && /Explore\s+Opportunities/i.test(page)
    && /exempbgv@indo-\s*mim\.com/i.test(page)
    && /FIRST\s+NAME\s*\*/i.test(page)
    && /LAST\s+NAME\s*\*/i.test(page)
    && /EMAIL\s+ADDRESS\s*\*/i.test(page)
    && /TELL\s+MORE\s+ABOUT\s+YOU/i.test(page)
}

export const hasVerifiedSucuriRedirectSurface = ({ status, html = '' } = {}) =>
  Number(status) === 307
  && /<title>\s*You are being redirected\.\.\.\s*<\/title>/i.test(String(html ?? ''))
  && /Javascript is required/i.test(String(html ?? ''))
  && /sucuri_cloudproxy_js/i.test(String(html ?? ''))

export const createIndoMimScraper = () => ({
  async run({ fetchPage, fetchText } = {}) {
    const loadPage = fetchPage
      || (fetchText
        ? async (url) => ({ status: 200, url, html: await fetchText(url) })
        : defaultFetchPage)
    const careersPage = await loadPage(CAREER_PAGE_URL)
    const careersHtml = careersPage?.html || ''

    if (!hasOfficialCareersSurface(careersHtml)) {
      if (hasVerifiedSucuriRedirectSurface(careersPage)) {
        return []
      }

      throw new Error('INDO-MIM careers page no longer matches the verified public no-listings surface')
    }

    return []
  },
})

export const run = async () => createIndoMimScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'indomim')
  }
}
