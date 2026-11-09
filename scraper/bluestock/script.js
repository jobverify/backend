import {fileURLToPath} from 'node:url'
import {readHighlights,categoryObservations} from './native.js'
import {runCurrentBluestock} from './currentNative.js'
export const CAREER_PAGE_URL='https://bluestock.in/careers/'
export const JOBS_PAGE_URL=CAREER_PAGE_URL+'jobs/'
export const COMPANY_DOMAIN='bluestock.in'
export const ATS_PLATFORM='custom-careers-pages'
export const extractHighlightedRoles=readHighlights
export const extractJobCategories=categoryObservations
export const run=(options={})=>runCurrentBluestock(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,fileURLToPath(new URL('./jobs.json',import.meta.url)))
 else await saveToDB(jobs,'bluestock')
}
