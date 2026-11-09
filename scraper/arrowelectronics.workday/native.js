import {models} from './models.js';
import {locationEvidence,parseDetail,reconcilePages} from './parser.js';
import {createNativeRequest,WIDGET_FIXED,validateRequest} from './transport.js';
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js';
export const SEARCH='https://careers.arrow.com/us/en/search-results',BOARD='https://careers.arrow.com/us/en',WIDGET='https://careers.arrow.com/widgets';
const need=(ok,message)=>{if(!ok)throw Error('Arrow native: '+message);};
export function verifySearch(html){
 const m=models(html),a=m.app;need(a.refNum==='ARELUS'&&a.widgetApiEndpoint===WIDGET&&a.locale===WIDGET_FIXED.lang&&a.deviceType===WIDGET_FIXED.deviceType&&a.country===WIDGET_FIXED.country&&a.pageName===WIDGET_FIXED.pageName&&a.baseDomain==='https://careers.arrow.com'&&a.baseUrl==='https://careers.arrow.com/us/en/'&&a.siteType==='external'&&m.ddo.eagerLoadRefineSearch?.status===200,'native ARELUS/public client binding mismatch');return m;
}
function validateListing(row){need(typeof row.reqId==='string'&&/^R[1-9]\d*$/.test(row.reqId)&&row.jobId===row.reqId&&row.jobSeqNo==='ARELUS'+row.reqId+'ENUS'&&typeof row.title==='string'&&row.title.trim()&&typeof row.country==='string','incomplete native listing identity/country');}
export function detailURL(row){validateListing(row);const slug=row.title.replace(/\s+/g,' ').trim().normalize('NFKD').replace(/[^\w\s-]/g,'').replace(/_/g,' ').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');need(slug,'missing native detail title slug');return validateRequest('https://careers.arrow.com/us/en/job/'+row.reqId+'/'+slug);}
export function toJob(row,html,now){
 const j=parseDetail(row,html,{now,inventoryComplete:false}),d=j.nativeDetail,india=j.locationEvidence.primaryIndia||j.locationEvidence.secondaryIndia;
 return {...j,company:'Arrow Electronics',sourceUrl:detailURL(row),applyUrl:d.applyUrl??row.applyUrl??null,link:d.applyUrl??row.applyUrl??null,applicationVisited:false,applicationTargets:{listing:row.applyUrl??null,detail:d.applyUrl??null},nativeListing:row,rawHTML:html,sourceDescriptionHTML:j.jobDescriptionHtml,sourceDescription:j.jobDescription,country:india?'India':row.country,city:d.city??row.city??null,location:d.location??row.location??null,jobLocations:d.multi_location_array??d.multi_location??row.multi_location_array??row.multi_location??[],nativePlacements:{listing:{country:row.country,location:row.location,address:row.address,cityStateCountry:row.cityStateCountry,multi_location:row.multi_location,multi_location_array:row.multi_location_array},detail:{country:d.country,location:d.location,address:d.address,cityStateCountry:d.cityStateCountry,multi_location:d.multi_location,multi_location_array:d.multi_location_array},structured:j.nativeJobPosting?.jobLocation??null},postingDate:j.publication.sourcePostedDate,postedAt:j.publication.sourcePostedDate,originalPublicationDate:null,sourceRawDates:{listingPostedDate:row.postedDate??null,detailPostedDate:d.postedDate??null,jsonLdDatePosted:j.nativeJobPosting?.datePosted??null,dateCreated:d.dateCreated??null,jobUpdatedDate:d.jobUpdatedDate??null,recruitmentStartDate:d.recruitmentStartDate??null},sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,isIndia:india,scrapedAt:now};
}
export async function collect(options={}){
 const now=new Date(typeof options.now==='function'?options.now():options.now??new Date()).toISOString(),packets=[],request=createNativeRequest({...options,packets}),pages=[],jobs=[],excluded=[],failures=[];let rows=[],nativeInventoryComplete=false,closureComplete=false;
 try{
  verifySearch(await request(SEARCH));let total=null,firstPage=null;
  for(let from=0;from<50000;from+=500){
   options.signal?.throwIfAborted();const p=JSON.parse(await request(WIDGET,{method:'POST',body:{...WIDGET_FIXED,from}})).refineSearch;
   need(p?.status===200&&Number.isInteger(p.totalHits)&&p.totalHits>0&&p.totalHits<=50000&&Array.isArray(p.data?.jobs)&&Number.isInteger(p.hits)&&p.hits===p.data.jobs.length,'upstream, empty or unknown native inventory');
   if(total===null){total=p.totalHits;firstPage=p;}need(p.totalHits===total&&p.hits===Math.min(500,total-from),'pagination total drift or short page');p.data.jobs.forEach(validateListing);pages.push(p);if(from+p.hits>=total)break;
  }
  const reconciled=reconcilePages(pages,{bindingVerified:true});rows=reconciled.rows;need(reconciled.complete,'pagination or duplicate native identity: '+reconciled.failures.join(','));
  for(const row of rows){
   options.signal?.throwIfAborted();const loc=locationEvidence(row);if(!loc.primaryIndia&&!loc.secondaryIndia){excluded.push({nativeListing:row,reason:'no-native-India-placement'});continue;}
   let rawHTML=null;try{rawHTML=await request(detailURL(row));const j=toJob(row,rawHTML,now);jobs.push(j);need(j.failures.every(f=>f==='missing-description'),'detail native identity/country/lifecycle contradiction: '+j.failures.join(','));}catch(e){failures.push({stage:'detail',id:row.reqId,message:e.message,rawHTML});}
  }
  const closure=JSON.parse(await request(WIDGET,{method:'POST',body:{...WIDGET_FIXED,from:0}})).refineSearch;need(JSON.stringify(closure)===JSON.stringify(firstPage),'native closure inventory changed');closureComplete=true;nativeInventoryComplete=failures.length===0&&jobs.length+excluded.length===rows.length;
 }catch(e){failures.push({stage:'binding-pagination-or-closure',name:e.name,message:e.message});}
 return {status:nativeInventoryComplete?'coverage-gap':'partial',complete:nativeInventoryComplete,nativeInventoryComplete,closureComplete,sourceScopeComplete:false,cleanupAllowed:false,verifiedEmpty:false,listingCount:nativeInventoryComplete?rows.length:null,observedListingCount:rows.length,jobs,excluded,failures,pages,transportPackets:packets,checkedAt:now};
}
export async function runNative(options={}){
 const result=await collect(options);if(!result.nativeInventoryComplete){const e=Error('Arrow native collection incomplete; cleanup forbidden');e.nativeEvidence=result;throw e;}
 const jobs=attachInventoryEvidence(result.jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:result.pages.length,reportedTotal:result.listingCount,indiaFacetCount:result.jobs.length,verifiedAt:result.checkedAt,reason:'ARELUS-native-widget-closure-only;whole-company-legal-employer-and-first-publication-unknown;cleanup-forbidden'});
 Object.defineProperty(jobs,Symbol.for('jobverify.arrow-native-evidence'),{value:result});return jobs;
}
