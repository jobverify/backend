import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runAccellor } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "accellor"
export const COMPANY = "Accellor"
export { CAREERS_URL } from './native.js'

export const run = options => runAccellor(options)

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
