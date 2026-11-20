import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNipponCurrentPublication } from './currentPublication20261119.js'

export const SOURCE = "nipponexpress"
export const COMPANY = "Nippon Express"
export const CAREERS_URL = "https://www.nipponexpress.com/careers/jobs/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = '2026-11-19'
export const VERIFIED_SURFACE_SUMMARY = 'Current own exact-employer India vacancy cards and regional recruitment Contact handoff; full criteria, application controls, group inventory and cleanup remain unverified.'
export const run = options => runNipponCurrentPublication(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
