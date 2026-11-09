import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aviatrix'
export const COMPANY = 'Aviatrix'
export const FIRST_PARTY_CAREERS_URL = 'https://aviatrix.ai/company/careers/'

export const createAviatrixScraper = () => ({
  async run() {
    // The official page is client-rendered and has no verified public listing feed.
    return []
  },
})

export const run = async (options = {}) => createAviatrixScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/aviatrix/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
