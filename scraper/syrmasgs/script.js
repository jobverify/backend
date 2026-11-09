import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {SURFACE} from './native.js'
import {createCurrentSyrmaScraper} from './nativeCurrentRun.js'
import {SYRMA_SGS_CATALOG as PROVIDER_METADATA} from './catalog.js'
export {PROVIDER_METADATA}
export {extractOfficialJobsUrl,hasOfficialLifeAtSignal,extractJobCards,hasOfficialJobsPageSignal,extractJobDetail} from './native.js'
export const SOURCE=PROVIDER_METADATA.source,COMPANY=PROVIDER_METADATA.companyName,COMPANY_DOMAIN=PROVIDER_METADATA.companyDomain,LIFE_AT_URL=PROVIDER_METADATA.lifeAtUrl,JOBS_URL=SURFACE,VERIFIED_AT=PROVIDER_METADATA.verifiedOn,VERIFIED_SURFACE_SUMMARY=PROVIDER_METADATA.verifiedSurfaceSummary

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const createSyrmaSgsScraper=createCurrentSyrmaScraper
export const run=async(options={})=>createSyrmaSgsScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
