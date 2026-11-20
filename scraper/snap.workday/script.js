import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentPublications} from './currentPublished20261120.js'
export {PROVIDER_METADATA} from './catalog.js'

export const SOURCE = "snap"
export const COMPANY = "Snap"
export const CAREERS_URL = "https://careers.snap.com/jobs"
export const DISPOSITION = 'current-own-native-publication-partials'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current own native Snap public job IDs, titles, offices, publication and same-ID handoffs are paired. Streamed native criteria remain partial; legal employer, formal requisition, company inventory and application activation stay unverified.'
export const createSnapScraper=({now=()=>new Date().toISOString()}={})=>({run:options=>runCurrentPublications({...options,now:options?.now??now})})
export const run=options=>createSnapScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
