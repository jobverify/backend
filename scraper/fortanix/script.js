import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {createFirstPartyHTMLScraper} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createSourceConfig} from './parser.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='fortanix',COMPANY='Fortanix',CAREERS_URL='https://www.fortanix.com/company/careers'
export const run=async options=>{
 const jobs=await createFirstPartyHTMLScraper(createSourceConfig(options)).run(options)
 return attachInventoryEvidence(jobs,{...readInventoryEvidence(jobs),reason:'official-Fortanix-client-account337112;native-LLMS-count-and-complete-markdown/widget-ID-reconciliation;validated-Workable-India-details;whole-employer-scope-unresolved;cleanup-forbidden'})
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
