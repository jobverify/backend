import {createEmployerBoundWorkableScraper} from '../../scraper-support/utils/workableEmployerInventory.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentPublicTransport} from '../uniqus/currentPublicTransport.js'

const config={source:'lakshya',company:'Lakshya Digital',companyDomain:'lakshyadigital.com',
 careersUrl:'https://lakshyadigital.com/careers/',tenant:'lakshyadigitalglobal',
 accountUid:'26e1100d-0d4c-4840-a884-14ab40ea3d94',reconcileClosingInventory:true}
const widgetUrl='https://apply.workable.com/api/v1/widget/accounts/'+config.tenant
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)
 ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const workplace=(row,location)=>[row.shortcode,row.title,location.country,location.city,location.region].map(clean).join('|')
const widgetState=value=>stable({...value,jobs:[...value.jobs].sort((a,b)=>stable(a).localeCompare(stable(b)))})

export async function runCurrentLakshya(options={}){
 const io=createCurrentPublicTransport(config.source,['https://lakshyadigital.com','https://apply.workable.com'],options)
 const nativeRecords=new Map(),nativeDetailResponses=[],nativeListingPages=[]
 const checkWidget=widget=>{
  if(widget?.name!==config.company||!Array.isArray(widget.jobs)||widget.jobs.some(r=>!r||typeof r.shortcode!=='string'
   ||!clean(r.title)||!clean(r.country)))throw io.fail('native widget employer, role or explicit country changed')
  return widget
 }
 const openingWidget=checkWidget(await io.fetchJson(widgetUrl))
 const jobs=await createEmployerBoundWorkableScraper(config).run({...options,signal:io.signal,fetchPage:io.fetchPage,
  fetchJson:async(url,init)=>{
   const payload=await io.fetchJson(url,init)
   if(url.includes('/api/v3/')){
    nativeListingPages.push(structuredClone(payload))
    for(const row of payload.results||[])if(!nativeRecords.has(row.shortcode))nativeRecords.set(row.shortcode,structuredClone(row))
   }else if(url.includes('/api/v2/'))nativeDetailResponses.push({url,payload:structuredClone(payload)})
   return payload
  }})
 const closingWidget=checkWidget(await io.fetchJson(widgetUrl))
 if(widgetState(openingWidget)!==widgetState(closingWidget))throw io.fail('closing full native widget changed')
 const widgetWorkplaces=openingWidget.jobs.map(row=>workplace(row,{country:row.country,city:row.city,region:row.state})).sort()
 const apiWorkplaces=[...nativeRecords.values()].flatMap(row=>row.locations.map(location=>workplace(row,location))).sort()
 if(stable(widgetWorkplaces)!==stable(apiWorkplaces))throw io.fail('native widget workplace rows and complete cursor inventory disagree')
 const nativeEvidence=readInventoryEvidence(jobs)
 for(const job of jobs)Object.assign(job,{sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceListingComplete:false,
  sourceNativeDetailRecord:structuredClone(io.records.get('https://apply.workable.com/api/v2/accounts/'+config.tenant+'/jobs/'+job.jobId))})
 const audit={source:config.source,nativeRecords:[...nativeRecords.values()],nativeWidgetLocationRows:openingWidget.jobs,
  nativeListingPages,nativeDetailResponses,nativeBoardInventoryComplete:nativeEvidence.listingComplete,
  closingNativeWidgetReconciled:true,receipts:io.receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 options.onAudit?.(audit)
 attachInventoryEvidence(jobs,{...nativeEvidence,status:'discovery-only',listingComplete:false,indiaFacetCount:null,
  pagesFetched:io.receipts.length,reason:nativeEvidence.reason+';native-widget-location-rows-reconciled;company-scope-unqualified'})
 attachSourceObservationEvidence(jobs,{source:config.source,recordKind:'vacancy-rows',observedRecordCount:nativeRecords.size,
  observedVacancyCount:nativeRecords.size,sourceScopeComplete:false})
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 return jobs
}
