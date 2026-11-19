import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentSvaya} from './currentNative20261119.js'
export {SOURCE,COMPANY,COMPANY_DOMAIN,HOMEPAGE_URL,CAREERS_URL,readSvayaHomepage,readSvayaListing,readSvayaRole} from './currentNative20261119.js'
export const ATS_PLATFORM='official-company-careers'
export const OPEN_POSITIONS_URL='https://svayarobotics.com/careers/'
export const createSvayaRoboticsScraper=({now}={})=>({run:options=>runCurrentSvaya({...options,...(!options?.now&&now?{now}:{})})})
export const run=options=>runCurrentSvaya(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,'svayarobotics')
}
