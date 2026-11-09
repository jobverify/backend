import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {TALENTICA_SOFTWARE_CATALOG} from './catalog.js'
import {createNativeTalenticaScraper} from './native.js'
export {hasOfficialCareersSignal,extractJobCards} from './nativeRole.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA=TALENTICA_SOFTWARE_CATALOG
export const SOURCE=PROVIDER_METADATA.source
export const COMPANY=PROVIDER_METADATA.companyName
export const CAREERS_URL=PROVIDER_METADATA.companyCareerPage
export const createTalenticaSoftwareScraper=(defaults={})=>createNativeTalenticaScraper(defaults)
export const run=async(options={})=>createTalenticaSoftwareScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
