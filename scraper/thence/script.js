import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {run,SOURCE} from './native20261111.js'
export * from './native20261111.js'
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
