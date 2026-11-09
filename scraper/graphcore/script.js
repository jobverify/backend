import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'graphcore'
export const COMPANY = 'Graphcore'
export const OFFICIAL_CAREERS_URL = 'https://www.graphcore.ai/jobs'

export const createGraphcoreScraper = () => ({
  async run() {
    // Graphcore's official jobs page currently shows no open vacancies.
    return []
  },
})

export const run = async (options = {}) => createGraphcoreScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/graphcore/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
