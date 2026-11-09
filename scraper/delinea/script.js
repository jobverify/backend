import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from './native.js'
export * from './native.js'

// Preserve the existing CLI entry point; catalog imports do not load persistence.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, 'delinea')
}
