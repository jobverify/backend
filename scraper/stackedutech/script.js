import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'stackedutech'
export const COMPANY = 'StackEdutech'
export const HOMEPAGE_URL = 'http://stackedutech.com/'
export const WWW_HOMEPAGE_URL = 'http://www.stackedutech.com/'
export const EXPECTED_REDIRECT_URL =
  'https://superglasscharlottesville.com/headlight-restoration.html/'
export const ROBOTS_URL = 'https://stackedutech.com/robots.txt'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'http://stackedutech.com/careers',
  'http://stackedutech.com/jobs',
]

export const createStackEdutechScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
