import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {collect} from './native.js'
import {PRESTO_CATALOG} from './catalog.js'
export {hasOfficialCareersPageSignal,extractLinkedInJobId,extractInlineJobPostings} from './native.js'
export const PROVIDER_METADATA=PRESTO_CATALOG,SOURCE=PRESTO_CATALOG.source,COMPANY=PRESTO_CATALOG.companyName,OFFICIAL_BRAND_NAME=PRESTO_CATALOG.officialBrandName,VERIFIED_ON=PRESTO_CATALOG.verifiedOn,VERIFIED_SURFACE_SUMMARY=PRESTO_CATALOG.verifiedSurfaceSummary,HOMEPAGE_URL=PRESTO_CATALOG.homepageUrl,OFFICIAL_CAREERS_URL=PRESTO_CATALOG.companyCareerPage,OFFICIAL_JOBS_SCRIPT_URL=PRESTO_CATALOG.officialJobsScriptUrl

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const createPrestoScraper=(configuration={})=>({async run(options={}){return collect({...configuration,...options})}})
export const run=async(options={})=>createPrestoScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
