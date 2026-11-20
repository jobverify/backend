import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentKayak} from './currentNative20261120.js'

export const SOURCE = "kayak"
export const COMPANY = "KAYAK"
export const CAREERS_URL = "https://www.kayak.com/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = '2026-11-20'
export const VERIFIED_SURFACE_SUMMARY = 'Current own KAYAK SSR/Ashby configured board native publication and explicit workplace countries are reconciled at closing; company-wide totals and cleanup remain unqualified.'
export const run = options => runCurrentKayak(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
