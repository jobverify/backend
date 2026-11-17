import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'startgenie'
export const COMPANY = 'StartGenie'
export const COMPANY_DOMAIN = 'startgenie.co.in'
export const HOMEPAGE_URL = 'https://startgenie.co.in/'
export const CAREERS_URL = 'https://startgenie.co.in/careers/'
export const JOB_SITEMAP_URL = 'https://startgenie.co.in/awsm_job_openings-sitemap.xml'

export const createStartGenieScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
