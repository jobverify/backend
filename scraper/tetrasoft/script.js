import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {SOURCE,COMPANY,SURFACE as CAREERS_URL,collect} from './native.js'
export {SOURCE,COMPANY,CAREERS_URL}
export {hasOfficialCareersSignal,extractCareerCards} from './native.js'
export const HOMEPAGE_URL='https://www.tetrasoft.us/',COMPANY_DOMAIN='tetrasoft.us',APPLICATION_EMAIL='ts_tag_offshore@tetrasoft.us',ATS_PLATFORM='official-company-careers-html',VERIFIED_ON='2026-07-18'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const createTetrasoftScraper=(configuration={})=>({async run(options={}){return collect({...configuration,...options})}})
export const run=async(options={})=>createTetrasoftScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
