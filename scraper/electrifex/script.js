import {runNativeElectrifex} from './nativeRun.js'
export {HOMEPAGE_URL,CAREERS_URL,extractJobs,extractNativeInventory,hasOfficialHomepageSignal,hasOfficialCareersSignal} from './nativeInventory.js'
export const createElectrifexScraper=()=>({run:runNativeElectrifex})
export const run=runNativeElectrifex
