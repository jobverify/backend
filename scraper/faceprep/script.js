import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://faceprep.in/'
export const CAREERS_URL = 'https://faceprep.in/careers/'
export const CONTACT_URL = 'https://faceprep.in/contact/'

export const hasOfficialSiteSignal = (html) =>
  /FACE Prep|Focus 4D Career Education Private Limited/i.test(html || '')

export const hasContactSurfaceSignal = (html) =>
  /Contact FACE Prep|canonical" href="https:\/\/faceprep\.in\/contact\/"|Reach the FACE Prep team/i.test(html || '')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    finalUrl: response.url,
    html: await response.text(),
  }
}

export const createFacePrepScraper = () => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage
    const page = await fetchPage(CAREERS_URL)
    const finalUrl = page.finalUrl || page.url || CAREERS_URL
    const html = page.html || ''

    if (!hasOfficialSiteSignal(html)) {
      throw new Error('FACE Prep careers route no longer matches the verified official public surface')
    }

    if (finalUrl !== CONTACT_URL || !hasContactSurfaceSignal(html)) {
      throw new Error('FACE Prep careers route no longer matches the verified no-public-careers contact surface')
    }

    return []
  },
})

export const run = async (options = {}) => createFacePrepScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running FACE Prep scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'faceprep')
    console.log('DB result:', result)
    process.exit(0)
  }
}
