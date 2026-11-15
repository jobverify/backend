import {models} from './models.js'
import {plain,locationEvidence,reconcilePages} from './parser.js'
import {verifySearch,validateListing,detailURL,toJob,SEARCH,BOARD,WIDGET} from './native.js'
import {createNativeRequest,validateRequest,WIDGET_FIXED} from './transport.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createRoleStatusReader} from './currentStatus.js'

const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Arrow current native: '+message),{softFailure:true,abortRetries:true,failureKind:'surface_drift_or_fail_closed',lifecycleCleanupAllowed:false})}
const india=value=>value==='India'||value==='IN'
const company='Arrow Electronics'
async function qualifiedRole(row,html,now,status){
 const model=models(html),app=model.app,job=toJob(row,html,now),d=job.nativeDetail,p=job.nativeJobPosting
 need(app.refNum==='ARELUS'&&app.siteType==='external'&&app.pageName==='job'
  &&app.baseDomain==='https://careers.arrow.com'&&app.baseUrl==='https://careers.arrow.com/us/en/','own public native account changed')
 need(job.failures.length===0,'own role identity/country/full criteria failed: '+job.failures.join(','))
 need(india(row.country)&&india(d.country),'own typed primary India country missing')
 need(d.companyName===company&&d.organization===company&&p?.['@type']==='JobPosting'
  &&p.hiringOrganization?.['@type']==='Organization'&&p.hiringOrganization.name===company
  &&p.hiringOrganization.sameAs===BOARD&&p.identifier?.['@type']==='PropertyValue'
  &&p.identifier.name===company&&p.identifier.value===row.reqId,'own native employer/role identity changed')
 const locations=Array.isArray(p.jobLocation)?p.jobLocation:[p.jobLocation]
 need(locations.length>0&&locations.every(l=>l?.['@type']==='Place'&&l.address?.['@type']==='PostalAddress'
  &&india(l.address.addressCountry)),'own schema typed India country missing or mixed')
 need(typeof d.description==='string'&&typeof p.description==='string'&&job.jobDescription.length>=200
  &&plain(d.description)===plain(p.description),'own native/schema full authored criteria disagree')
 const canonical=validateRequest(model.canonical)
 need(new URL(canonical).pathname.split('/job/')[1]?.split('/')[0]===row.reqId
  &&p.hiringOrganization.url===canonical,'own canonical role identity changed')
 const application=new URL(d.applyUrl)
 need(application.origin==='https://arrow.wd1.myworkdayjobs.com'&&!application.username&&!application.password
  &&!application.port&&!application.search&&!application.hash&&application.pathname.startsWith('/AC/job/')
  &&new RegExp('_'+row.reqId+'(?:-[1-9]\\d*)?/apply$').test(application.pathname)
  &&(row.applyUrl==null||row.applyUrl===d.applyUrl),'own native application account/role identity changed')
 need(['OPEN','UNKNOWN'].includes(job.lifecycle),'own native role is closed or expired')
 for(const key of ['status','jobStatus','requisitionStatus'])need(d[key]==null||d[key]===''||String(d[key]).toUpperCase()==='OPEN','own native lifecycle requires review: '+key)
 if(p.validThrough!=null&&p.validThrough!=='')need(Number.isFinite(Date.parse(p.validThrough))&&Date.parse(p.validThrough)>Date.parse(now),'own native application deadline expired or unresolved')
 const visibleState=await status.inspect(html,model)
 return {...job,company,sourceUrl:canonical,sourceDetailComplete:true,
  sourceNativeVisibleStateEvidence:visibleState,
  sourceNativeQualification:{method:'own-public-ARELUS-model-and-schema',canonicalURL:canonical,employer:company,typedCountry:'India',fullAuthoredCriteriaReconciled:true,currentVisibleRoleContradictionChecked:true}}
}
const roleContext=job=>({role:job.nativeDetail,posting:job.nativeJobPosting,canonical:job.sourceUrl,visibleState:job.sourceNativeVisibleStateEvidence})

export async function runCurrentNative(options={}){
 const now=new Date(typeof options.now==='function'?options.now():options.now??new Date()).toISOString()
 const packets=[],request=createNativeRequest({...options,packets}),heldRecords=[],observations=[],staged=[]
 const status=createRoleStatusReader({...options,packets})
 const pagesFor=async phase=>{
  const pages=[];let total=null
  for(let from=0;from<50000;from+=500){
   const page=JSON.parse(await request(WIDGET,{method:'POST',body:{...WIDGET_FIXED,from}})).refineSearch
   need(page?.status===200&&Number.isInteger(page.totalHits)&&page.totalHits>0&&page.totalHits<=50000
    &&Array.isArray(page.data?.jobs)&&Number.isInteger(page.hits)&&page.hits===page.data.jobs.length,phase+' native listing status/count changed')
   total??=page.totalHits
   need(page.totalHits===total&&page.hits===Math.min(500,total-from),phase+' native pagination total drift or short page')
   page.data.jobs.forEach(validateListing);pages.push(page)
   if(from+page.hits>=total)break
  }
  const result=reconcilePages(pages,{bindingVerified:true})
  need(result.complete,phase+' native pagination/duplicate identity: '+result.failures.join(','))
  return {pages,rows:result.rows,byId:new Map(result.rows.map(row=>[row.reqId,row]))}
 }
 verifySearch(await request(SEARCH))
 const opening=await pagesFor('opening')
 const hold=(row,phase,error)=>heldRecords.push({id:row.reqId,phase,reason:error.message,originalListingRecord:row})
 for(const row of opening.rows){
  const record={originalListingRecord:row};observations.push(record)
  const location=locationEvidence(row)
  if(!location.primaryIndia&&!location.secondaryIndia){record.disposition='native-no-selected-India-placement';continue}
  try{
   const html=await request(detailURL(row));record.originalPublicPage=html
   const job=await qualifiedRole(row,html,now,status);record.originalNativeRole=job.nativeDetail;record.originalNativeJobPosting=job.nativeJobPosting
   staged.push({row,job,record})
  }catch(error){hold(row,'opening-detail',error);record.disposition='held'}
 }
 // Every opening detail is acquired before any independent closing detail.
 const closed=[]
 for(const item of staged){
  try{
   const html=await request(detailURL(item.row));item.record.closingPublicPage=html
   const current=await qualifiedRole(item.row,html,now,status)
   item.record.closingNativeRole=current.nativeDetail;item.record.closingNativeJobPosting=current.nativeJobPosting
   need(stable(roleContext(current))===stable(roleContext(item.job)),'closing full native role context changed')
   closed.push(item)
  }catch(error){hold(item.row,'closing-detail',error);item.record.disposition='held'}
 }
 const closing=await pagesFor('closing')
 verifySearch(await request(SEARCH))
 await status.close()
 const jobs=[]
 for(const item of closed){
  const row=closing.byId.get(item.row.reqId)
  if(!row||stable(row)!==stable(item.row)){hold(item.row,'closing-membership',Error('selected own native membership/criteria changed'));item.record.disposition='held';continue}
  item.record.disposition='published-current-positive'
  jobs.push({...item.job,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
   sourceNativeClosingContext:{eachFullRoleRechecked:true,ownNativeListingRechecked:true,allClosingPagesReconciled:true,currentPublicAccountRechecked:true},
   nativeClosingDetail:item.record.closingNativeRole,nativeClosingJobPosting:item.record.closingNativeJobPosting})
 }
 need(jobs.length>0,'coverage-gap: no individually verified current India roles')
 const evidence={source:'arrowelectronics',nativeRecords:observations,heldRecords,openingNativePages:opening.pages,
  closingNativePages:closing.pages,transportPackets:packets,nativeOpeningObservedTotal:opening.rows.length,nativeClosingObservedTotal:closing.rows.length,
  nativeMembershipUnchanged:opening.rows.length===closing.rows.length&&opening.rows.every(row=>stable(row)===stable(closing.byId.get(row.reqId))),
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,verifiedEmpty:false}
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence})
 attachSourceObservationEvidence(jobs,{source:'arrowelectronics',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
  pagesFetched:opening.pages.length+closing.pages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
  reason:'individually-qualified-own-native-roles-and-independent-full-detail+membership-closure;company-scope-incomplete;cleanup-forbidden'})
}
export default runCurrentNative
