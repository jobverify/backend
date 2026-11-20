import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentKbr} from './currentPublication20261119.js'
export {HOMEPAGE_URL,CAREERS_LANDING_URL,CURRENT_JOBS_URL,SNAPSHOT_URL,WORKABLE_WIDGET_URL,WORKDAY_JOBS_API_URL} from './currentPublication20261119.js'

export const createKbrScraper=({now=()=>new Date().toISOString()}={})=>({
 run:(options={})=>runCurrentKbr({...options,now:options.now??now}),
})
export const run=(options={})=>createKbrScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,'kbr')
}
