import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAi21NativeInventory } from './nativeInventory.js'

export const SOURCE = "ai21labs"
export const COMPANY = "AI21 Labs"
export const CAREERS_URL = "https://www.ai21.com/careers/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runAi21NativeInventory(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}

