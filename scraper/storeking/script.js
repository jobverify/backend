import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'storeking'
export const COMPANY = 'StoreKing'
export const HOMEPAGE_URL = 'https://storeking.in/'
export const ABOUT_URL = 'https://storeking.in/about'
export const CONTACT_URL = 'https://storeking.in/contact'
export const CAREERS_URL = 'https://storeking.in/careers'
export const CAREER_URL = 'https://storeking.in/career'
export const JOBS_URL = 'https://storeking.in/jobs'

export const createStoreKingScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
