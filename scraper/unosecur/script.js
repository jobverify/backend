import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {CAREERS,readCareers} from './nativeModels.js'
import {runUnosecurNative} from './nativeCareers.js'
export const SOURCE='unosecur',COMPANY='Unosecur',CAREERS_URL=CAREERS
export const DISPOSITION='runtime-verified-recruitment',VERIFIED_ON='2026-11-06'
export const VERIFIED_SURFACE_SUMMARY='Corporate-declared Reczee role metadata and complete native public job-data are reconciled with the current declared client read/render contract; company inventories, application availability and cleanup remain unqualified.'
export const hasOfficialCareersSignal=html=>{try{return Boolean(readCareers(html))}catch{return false}}
export const createUnosecurScraper=(defaults={})=>({run:(options={})=>runUnosecurNative({...defaults,...options})})
export const run=(options={})=>createUnosecurScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
