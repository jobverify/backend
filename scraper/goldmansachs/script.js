import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://www.goldmansachs.com/careers/'
export const OPEN_ROLES_URL = 'https://higher.gs.com/results'

const CAREERS_SIGNAL_PATTERN = /Goldman Sachs Careers|Choose Excellence|There are many chapters in a career/i
const OPEN_ROLES_SIGNAL_PATTERN = /Opportunities \| Goldman Sachs|higher\.gs\.com|Open Roles/i

export const hasOfficialCareersSignal = (html) =>
  CAREERS_SIGNAL_PATTERN.test(String(html || ''))

export const hasOfficialOpenRolesSignal = (html) =>
  OPEN_ROLES_SIGNAL_PATTERN.test(String(html || ''))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createGoldmanSachsScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText

    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    const openRolesHtml = await fetchText(OPEN_ROLES_URL)

    if (
      hasOfficialCareersSignal(careersPageHtml)
      && hasOfficialOpenRolesSignal(openRolesHtml)
    ) {
      return []
    }

    return []
  },
})

export const run = async () => createGoldmanSachsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Goldman Sachs scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'goldmansachs')
    console.log('DB result:', result)
    process.exit(0)
  }
}
