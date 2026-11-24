import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentPublished } from './currentPublished20261120.js'

export const SOURCE = "macquariegroup"
export const COMPANY = "Macquarie Group"
export const CAREERS_URL = "https://www.macquarie.com/in/en/careers.html"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current own Macquarie native selected India publication; legal employer, formal requisition, application backend and whole-company inventory/cleanup remain held.'
export const createMacquarieScraper = () => ({ run: runCurrentPublished })
export const run = options => createMacquarieScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
