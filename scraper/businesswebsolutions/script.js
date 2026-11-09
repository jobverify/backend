import {fileURLToPath} from 'node:url'
import {runCurrentBusinessWeb,extractCurrentOpenJobs} from './currentNative.js'
export const CAREERS_URL='https://businesswebsolutions.in/careers/'
export const extractOpenJobs=extractCurrentOpenJobs
export const createBusinessWebSolutionsScraper=(defaults={})=>({run:options=>runCurrentBusinessWeb({...defaults,...options})})
export const run=options=>createBusinessWebSolutionsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,fileURLToPath(new URL('./jobs.json',import.meta.url)))
 else await saveToDB(jobs,'businesswebsolutions')
}
