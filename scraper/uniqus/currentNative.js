import {createHash} from 'node:crypto'
import {createZohoNativeInventoryScraper} from '../../scraper-support/utils/zohoNativeInventory.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCurrentPublicTransport} from './currentPublicTransport.js'
const profiles={
 uniqus:{source:'uniqus',company:'Uniqus',companyDomain:'uniqus.com',officialUrl:'https://uniqus.com/careers/',
  boardUrl:'https://uniqusus.zohorecruit.com/jobs/Careers-at-Uniqus',pageName:'Careers-at-Uniqus',orgId:'717173000000454128',pageId:'717173000003530045',nativeCompany:'Uniqus Consultech Inc'},
 wissentechnology:{source:'wissentechnology',company:'Wissen Technology',companyDomain:'wissen.com',
  corporateUrl:'https://wissen.com/career/opportunities-wissen-technology',boardUrl:'https://careers.wissen.com/jobs/Careers',
  orgId:'80238000000244522',pageId:'80238000000244670',nativeCompany:'Wissen Technology Pvt. Ltd.',allowDetailOnlyState:true},
 scaleflex:{source:'scaleflex',company:'Scaleflex',companyDomain:'scaleflex.com',officialUrl:'https://portals.scaleflex.com/s/xJfYX5yl/en/home',
  boardUrl:'https://scaleflex.zohorecruit.eu/jobs/Careers',orgId:'76849000000413527',pageId:'76849000000413673',nativeCompany:'Scaleflex',
  organizationType:'staffing',employerClientName:'Scaleflex'},
}
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
// Inventory order is not role identity. Keep every record field and every
// envelope field in the comparison, sorting only this native record array.
const inventoryState=payload=>stable({...payload,data:[...payload.data].sort((a,b)=>a.id.localeCompare(b.id))})
function checkWissenHandoff(html,fail){
 const raw=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true})
 const scripts=raw.nodes(n=>n.tag==='script'&&!n.attrs.src&&/rec_embed_js.load/.test(n.raw))
 if(activeHead(html).titles[0]!=='Careers in Wissen Technology | Best Place to Work | Wissen'
  ||visible.nodes(n=>n.attrs.id==='rec_job_listing_div'&&n.tag==='div').length!==1||scripts.length!==1
  ||createHash('sha256').update(scripts[0].raw).digest('hex')!=='1ac1e806c5d379208ed7fe267217d5e064af48f8d7418e0b572cc3a564f9d185')throw fail('current corporate embed program or active native handoff changed')
}
export async function runCurrentZohoSource(source,options={}){
 const config=profiles[source];if(!config)throw Error('Unknown current native source')
 const io=createCurrentPublicTransport(source,[new URL(config.boardUrl).origin,...[config.officialUrl,config.corporateUrl].filter(Boolean).map(url=>new URL(url).origin)],options)
 if(config.corporateUrl)checkWissenHandoff((await io.fetchPage(config.corporateUrl)).html,io.fail)
 const jobs=await createZohoNativeInventoryScraper(config).run({...options,signal:io.signal,detailConcurrency:1,fetchPage:io.fetchPage,fetchJson:io.fetchJson})
 const base=new URL(config.boardUrl).origin+'/recruit/v2/public/Job_Openings',suffix='?source=CareerSite&pagename='+encodeURIComponent(config.pageName||'Careers')
 for(const job of jobs){
  const url=base+'/'+job.jobId+suffix,original=io.records.get(url),closing=await io.fetchJson(url)
  if(stable(original)!==stable(closing))throw io.fail('closing full native role identity or criteria changed')
  Object.assign(job,{sourceNativeDetailRecord:structuredClone(original.data[0]),sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
 }
 const listing=io.records.get(base+suffix),finalListing=await io.fetchJson(base+suffix)
 if(!Array.isArray(finalListing?.data)||finalListing.data.some(r=>typeof r?.id!=='string')
  ||inventoryState(listing)!==inventoryState(finalListing))throw io.fail('closing full native listing changed after details')
 if(config.corporateUrl)checkWissenHandoff((await io.fetchPage(config.corporateUrl)).html,io.fail)
 else{
  const page=await io.fetchPage(config.officialUrl),doc=readVisibleNativeDocument(page.html,{strict:true})
  if(!doc.nodes(n=>n.tag==='a'&&n.attrs.href===config.boardUrl).length)throw io.fail('closing active exact employer handoff changed')
 }
 const audit={source,nativeRecords:listing.data,nativeActiveRecords:listing.data.filter(r=>r.Publish&&!r.Is_Locked),nativeRoleDetails:[...io.records].filter(([url])=>url.includes('/Job_Openings/')).map(([url,payload])=>({url,payload})),
  closingSelectedFullCriteriaReconciled:true,selectedNativeDetailCount:jobs.length,closingNativeListingReconciled:true,
  receipts:io.receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 options.onAudit?.(audit)
 const evidence=readInventoryEvidence(jobs)
 attachInventoryEvidence(jobs,{...evidence,status:'discovery-only',listingComplete:false,indiaFacetCount:null,pagesFetched:io.receipts.length,
  reason:evidence.reason+';current-exact-native-organization-page-country-full-criteria-and-closing-models;company-scope-unqualified'})
 attachSourceObservationEvidence(jobs,{source,recordKind:'vacancy-rows',observedRecordCount:listing.data.length,
  observedVacancyCount:listing.data.length,sourceScopeComplete:false})
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 return jobs
}
