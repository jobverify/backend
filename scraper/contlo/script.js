import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://contlo.com/'
export const OFFICIAL_SUCCESSOR_URL = 'https://web.superagi.com/'

export const isOfficialSuccessorSite = (html) => (
  /SuperAGI\s*\|\s*AI Super App for Work/i.test(String(html ?? ''))
  && /AI Super App for Work/i.test(String(html ?? ''))
)

export const isOfficialSuccessorRedirect = (location) => (
  (() => {
    try {
      const value = new URL(String(location ?? ''))
      return value.protocol === 'https:' && value.hostname === 'web.superagi.com'
    } catch {
      return false
    }
  })()
)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  })

  if (response.status >= 300 && response.status < 400) {
    return {
      status: response.status,
      redirected: true,
      location: response.headers.get('location') ?? '',
      html: '',
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    redirected: false,
    location: response.url,
    html: await response.text(),
  }
}

export const createContloScraper = () => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || (options.fetchText
      ? async (url) => ({
          status: 200,
          redirected: false,
          location: url,
          html: await options.fetchText(url),
        })
      : defaultFetchPage)
    const page = await fetchPage(CAREER_PAGE_URL)

    if (page.redirected) {
      if (isOfficialSuccessorRedirect(page.location)) {
        return []
      }

      throw new Error('Contlo official site redirect no longer points to the expected public successor')
    }

    if (!isOfficialSuccessorSite(page.html)) {
      throw new Error('Contlo official successor site no longer matches the expected public page')
    }

    return []
  },
})

export const run = async () => createContloScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Contlo scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'contlo')
    console.log('DB result:', result)
    process.exit(0)
  }
}
