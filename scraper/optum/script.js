import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run, SOURCE, COMPANY_NAME } from './currentNative.js'
export * from './currentNative.js'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
  console.log(COMPANY_NAME + ': ' + jobs.length + ' qualified native India observations; company coverage remains partial')
}
