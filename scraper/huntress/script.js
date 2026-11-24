import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {run as runCurrentNative} from './currentNative20261121.js'
import {runCurrentHuntressProgramme} from './currentProgramme.js'
import {runWithCurrentProgrammeZero} from '../../scraper-support/utils/currentProgrammeZeroRecovery.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "huntress",
  "companyName": "Huntress",
  "companyDomain": "huntress.com",
  "companyCareerPage": "https://www.huntress.com/company/careers",
  "officialHomepageUrl": "https://www.huntress.com/",
  "sourceScopeComplete": false,
  "nativeEmployerNames": [
    "Huntress Labs"
  ]
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'runtime-official-ats-recovery'
export async function run(options={}){
  try{return await runWithCurrentProgrammeZero(options,{source:SOURCE,runPrimary:runCurrentNative,runProgramme:runCurrentHuntressProgramme})}
  finally{options.signal?.throwIfAborted()}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
