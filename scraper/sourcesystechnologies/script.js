import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='sourcesystechnologies',COMPANY='Sourcesys Technologies',HOMEPAGE_URL='https://www.sourcesys.co/',CAREERS_URL='https://www.sourcesys.co/careers'
// Historical constants are retained for import compatibility; no current native declaration authorizes requesting these routes.
export const CHECKED_NO_JOBS_ROUTE_URLS=['https://www.sourcesys.co/career','https://www.sourcesys.co/jobs','https://www.sourcesys.co/current-openings','https://www.sourcesys.co/join-us']
export const createSourcesysTechnologiesScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
