import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runWorkdayWithPartialFallback, runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
const dir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='blackstone'
export const COMPANY='Blackstone'
export const CAREERS_URL='https://www.blackstone.com/careers/careers-blackstone/'
const baseUrl='https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Careers'
const board={tenant:'blackstone',site:'Blackstone_Careers',baseUrl,scraperDir:dir}
const campus={tenant:'blackstone',site:'Blackstone_Campus_Careers',baseUrl:'https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Campus_Careers',scraperDir:path.join(dir,'boards/campus')}
const settings={source:SOURCE,company:COMPANY,employerPattern:/^\d+ Blackstone COE India Private Limited$/,boards:[board,campus]}
const fallback={...settings,boards:[{...board,baseUrl:baseUrl+'?locations=d480b8d24fe310015bdde132ce210000',scraperDir:path.join(dir,'boards/india-fallback')},campus]}
export const run=async options=>{
  try{return await runWorkdayWithPartialFallback(settings,fallback,options)}
  catch(error){
    options?.signal?.throwIfAborted()
    if(error?.failureKind!=='incomplete_location_scope' || !error.sourceFullScopeFailure)throw error
    // The campus attempt is current and recorded. Its unresolved secondary
    // geography cannot discard verified India rows or certify India-empty.
    const jobs=await runVerifiedWorkdayBoardUnion({...fallback,boards:[fallback.boards[0]],completeSourceScope:false,
      scopeReason:'experienced-native-india-subset-campus-geography-unresolved'},options)
    for(const job of jobs){job.sourceFullScopeFailure=error.sourceFullScopeFailure
      job.sourceAdditionalBoardFailure={site:campus.site,name:error.name,message:error.message,failureKind:error.failureKind}}
    return jobs
  }
}
