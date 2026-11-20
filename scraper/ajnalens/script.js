import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {AJNALENS_CATALOG} from './catalog.js'
import {runCurrentScope} from './currentScope20261120.js'
export const SOURCE='ajnalens',COMPANY='AjnaLens',PROVIDER_METADATA=AJNALENS_CATALOG,CAREERS_URL=AJNALENS_CATALOG.companyCareerPage,HOMEPAGE_URL=AJNALENS_CATALOG.homepageUrl,APPLICATION_URL=AJNALENS_CATALOG.applicationUrl
export const createAjnaLensScraper=()=>({run:runCurrentScope})
export const run=options=>createAjnaLensScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
