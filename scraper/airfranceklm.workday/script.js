import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runTalentsoft } from './native.js'

export const SOURCE = "airfranceklm"
export const COMPANY = "Air France-KLM"
export const CAREERS_URL = "https://recrutement.airfrance.com/accueil.aspx?lcid=2057"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runTalentsoft(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}

