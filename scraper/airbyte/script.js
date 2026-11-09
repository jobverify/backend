import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AIRBYTE_CATALOG } from './catalog.js'
import { createAirbyteNativeScraper } from './native.js'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE=AIRBYTE_CATALOG.source
export const COMPANY=AIRBYTE_CATALOG.companyName
export const CAREERS_PAGE_URL=AIRBYTE_CATALOG.companyCareerPage
export const ASHBY_PUBLIC_BOARD_URL=AIRBYTE_CATALOG.ashbyPublicBoardUrl
export const ASHBY_JOB_BOARD_URL=AIRBYTE_CATALOG.ashbyJobBoardUrl

export const createAirbyteScraper=(defaults={})=>createAirbyteNativeScraper({
  source:SOURCE,company:COMPANY,token:'airbyte',domain:'airbyte.com',careersUrl:CAREERS_PAGE_URL,
},defaults)
export const run=(options={})=>createAirbyteScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
