import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createCyraacScraper} from './native.js'
export {createCyraacScraper}
export {extractJobCards,extractJobDescription} from './nativeRole.js'
export const CAREERS_PAGE_URL='https://cyraacs.com/careers/'
// Historical reference only; each current role supplies its own application anchor.
export const APPLY_URL='https://forms.jumpp.tech/'
export const run=options=>createCyraacScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,'cyraac')
}
