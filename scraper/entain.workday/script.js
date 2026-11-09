import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {run as runNative} from './native.js'
export {parseBinding,parsePage,parseDetail} from './native.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='entain'
export const COMPANY='Entain'
export const CAREERS_URL='https://entaincareers.com/'
export const DISPOSITION='current-public-native-India-tenant-surface-group-scope-partial'
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY='Current corporate Careers binds the documented public SmartRecruiters Entain token. Explicit native India records, full active/PUBLIC details, native release dates and exact configured URLs are rechecked per run; whole-group/legal-employer coverage remains unknown.'
export const run=options=>runNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
