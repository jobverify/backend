import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentEnergy} from './currentNative20261115.js'

export const SOURCE='theenergycompany'
export const COMPANY='The ENERGY COMPANY'
export const HOMEPAGE_URL='https://www.energycompany.in/'
export const CAREERS_URL='https://www.energycompany.in/we-are-hiring'
export const APPLY_URL='https://www.energycompany.in/contact-us'
export const DISPOSITION='runtime-verified-recruitment'
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY='Current own native HTML role summaries and full responsibilities/qualifications reconcile scoped explicit country, exact own role-specific Jobs contact controller and fresh publisher/application/style closing. Month-only native posting dates remain inexact; company scope and cleanup remain unqualified.'
export const createTheEnergyCompanyScraper=()=>({run:runCurrentEnergy})
export const run=runCurrentEnergy

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
