import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runWorkdayWithPartialFallback } from '../../scraper-support/shared/workdayBoardUnion.js'
import { runBlackRockEarlyCareers, readBlackRockEarlyCareersScope } from '../../scraper-support/shared/blackrockTalnet.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const dir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='blackrock'
export const COMPANY='BlackRock'
export const CAREERS_URL='https://careers.blackrock.com/search-jobs'
const baseUrl='https://blackrock.wd1.myworkdayjobs.com/en-US/BlackRock_Professional'
const board={tenant:'blackrock',site:'BlackRock_Professional',baseUrl,scraperDir:dir}
const settings={source:SOURCE,company:COMPANY,employerPattern:/BlackRock/,requireEmployer:false,completeSourceScope:true,boards:[board]}
// Exact observed India location IDs include the separately verified M11 office.
// The result remains a subset when global geography cannot reconcile.
const locations=['131d7f8fcf9f0108d331d757f750f5cd','131d7f8fcf9f01c37cbb7257f7507dcd','131d7f8fcf9f014033ba3257f75037cd','866218765a69100195e38a8b9cc40000']
const fallback={...settings,boards:[{...board,baseUrl:baseUrl+'?'+new URLSearchParams(locations.map(id=>['locations',id])),scraperDir:path.join(dir,'boards/india-fallback')}]}
export async function reconcileBlackRockEarlyCareers(jobs,options={}){
  const evidence=readInventoryEvidence(jobs)
  try{
    const early=await runBlackRockEarlyCareers({signal:options.signal,now:options.now,fetchText:options.fetchText})
    const checked=readInventoryEvidence(early),scope=readBlackRockEarlyCareersScope(early)
    if(!checked?.listingComplete || checked.indiaFacetCount!==0 || early.length!==0 || !scope?.finalInventoryRechecked)throw Error('Early-careers India scope is incomplete')
    const summary={surface:scope.surface,scope:scope.scope,recordKind:'program-records-not-eligible-vacancy-count',reportedProgramRecords:scope.programs.length,observedIndia:0,
      stableInventory:true,programs:scope.programs.map(p=>({id:p.id,countries:p.countries,countryCodes:p.countryCodes,cities:p.cities}))}
    const mapped=jobs.map(job=>({...job,sourceEarlyCareersInventory:summary}))
    return attachInventoryEvidence(mapped,{...evidence,reason:evidence?.listingComplete?'all-current-official-blackrock-recruitment-surfaces-india-checked':evidence?.reason})
  }catch(error){
    options.signal?.throwIfAborted()
    return attachInventoryEvidence(jobs.map(job=>({...job,sourceListingComplete:false,
      sourceEarlyCareersFailure:{name:error.name,message:error.message}})),{...evidence,status:'coverage-gap',listingComplete:false,reportedTotal:null,indiaFacetCount:null,
      reason:'blackrock-early-careers-scope-unavailable'})
  }
}
export const run=async(options={})=>reconcileBlackRockEarlyCareers(await runWorkdayWithPartialFallback(settings,fallback,options),options)
