import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'informatica'
export const COMPANY = 'Informatica'
export const CAREERS_URL = 'https://www.informatica.com/about-us/careers.html'
export const REDIRECT_TARGET_URL =
  'https://careers.salesforce.com/en/jobs/?search=informatica&pagesize=20#results'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308])

const defaultFetchPage = async (url, { manualRedirect = false } = {}) => {
  const response = await fetch(url, {
    redirect: manualRedirect ? 'manual' : 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const isVerifiedRedirectLocation = (value) => {
  try {
    const url = new URL(String(value ?? ''))

    return url.origin === 'https://careers.salesforce.com'
      && url.pathname === '/en/jobs/'
      && url.searchParams.get('search') === 'informatica'
      && url.searchParams.get('pagesize') === '20'
  } catch {
    return false
  }
}

export const hasVerifiedRedirectShell = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Salesforce Jobs\s*\|\s*Salesforce\s*<\/title>/i.test(page)
    && /Find your career in the Salesforce ecosystem\./i.test(page)
    && /More Salesforce Brands/i.test(page)
}

export const createInformaticaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersRedirect = await fetchPage(CAREERS_URL, { manualRedirect: true })

    if (
      !REDIRECT_STATUS_CODES.has(Number(careersRedirect?.status))
      || !isVerifiedRedirectLocation(careersRedirect?.headers?.location)
    ) {
      throw new Error('Informatica official careers redirect no longer matches the verified first-party surface')
    }

    const redirectedPage = await fetchPage(REDIRECT_TARGET_URL)

    if (
      redirectedPage?.status !== 200
      || !hasVerifiedRedirectShell(redirectedPage?.html)
    ) {
      throw new Error('Informatica redirected official jobs shell no longer matches the verified public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createInformaticaScraper().run(options)

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
