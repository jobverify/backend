import {createHash} from 'node:crypto'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'

export const CORPORATE='https://myoperator.com/careers',BOARD='https://careers.myoperator.com/jobs/Careers'
export const API='https://careers.myoperator.com/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers'
const detailURL=id=>'https://careers.myoperator.com/recruit/v2/public/Job_Openings/'+id+'?source=CareerSite&pagename=Careers'
const fail=(message,fields={})=>firstPartyFailure('myoperator',message,fields)
const need=(ok,message)=>{if(!ok)throw fail(message,{nativeAuthorityFailure:true})}
const hash=value=>createHash('sha256').update(value).digest('hex')
const same=(a,b)=>canonicalNativeRecord(a)===canonicalNativeRecord(b)
const keys=(row,allowed)=>row&&typeof row==='object'&&!Array.isArray(row)&&same(Object.keys(row).sort(),[...allowed].sort())
const baseFields=['Posting_Title','Is_Locked','City','Industry','Job_Description','Work_Experience','Job_Type','Job_Opening_Name','State','Country','id','Publish','Date_Opened','Keep_on_Career_Site']
const profile={pageJson:'1ada2b8c87c0ae6d496f704cecc332b87f30a1b4374c48e8a4d371244923c340',moduleMeta:'87fc0cb6b86de78fdfb4ecd97ddf02ae0922d153560d84e5f065173c865f1d40'}
function corporate(html){
 const doc=readVisibleNativeDocument(html,{strict:true})
 need(doc.nodes(n=>n.tag==='title').length===1&&/<title>Careers at MyOperator \| Build, Scale, and Lead With Ownership<\/title>/.test(html),'Current corporate employer title changed')
 need(doc.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD&&clean(doc.text(n))).length>0,'Current visible exact employer handoff unavailable')
}
export function readMyOperatorPortal(html){
 const doc=readNativeDocument(html)
 need(doc.nodes(n=>n.tag==='title').length===1&&doc.nodes(n=>n.tag==='title')[0].raw==='Careers at MyOperator','Current native employer title changed')
 need(doc.nodes(n=>n.tag==='base').length===0,'Unreviewed native base')
 const read=id=>{const rows=doc.nodes(n=>n.tag==='input'&&n.attrs.type==='hidden'&&n.attrs.id===id);need(rows.length===1,'Missing or ambiguous original native '+id);let value;try{value=JSON.parse(rows[0].attrs.value)}catch{throw fail('Malformed native '+id)}return {value,raw:rows[0].attrs.value}}
 for(const [id,digest]of Object.entries(profile))need(hash(read(id).raw)===digest,'Current native field/layout declarations require review')
 const meta=read('meta').value,org=meta?.org_info
 need(org?.id==='163599000000320471'&&org.company_name==='MyOperator'&&org.website==='https://myoperator.com/'&&org.type==='internal'&&org.hide_company_name===false,
  'Native employer organization identity changed')
 need(meta.page_id==='163599000003109531'&&meta.page_name==='Careers'&&meta.list_url===BOARD&&meta.source==='CareerSite'&&meta.employee_portal===false&&meta.portal_user?.is_loggedin===false&&meta.date_format==='dd/MM/yyyy','Native public employer/page state changed')
 const rows=read('jobs').value;need(Array.isArray(rows)&&rows.length<=200,'Native embedded inventory missing or excessive')
 return {rows,meta}
}
function json(body){try{return JSON.parse(body)}catch{throw fail('Malformed original public native JSON')}}
function dateValue(value,detail=false){
 const match=(detail?/^(\d{4})-(\d{2})-(\d{2})$/:/^(\d{2})\/(\d{2})\/(\d{4})$/).exec(value)
 need(match,'Invalid native public Date_Opened')
 const iso=detail?value:match[3]+'-'+match[2]+'-'+match[1]
 need(Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso,'Impossible native public Date_Opened')
 return iso
}
function validateRow(row,detail=false){
 need(keys(row,[...baseFields,...(detail?['$appy_url','Zip_Code']:['$url'])]),'Native role field schema changed')
 need(/^163599\d{12}$/.test(row.id)&&clean(row.Posting_Title)&&row.Posting_Title===row.Job_Opening_Name&&typeof row.Publish==='boolean'&&typeof row.Is_Locked==='boolean'&&typeof row.Keep_on_Career_Site==='boolean','Native role identity/active state changed')
 need(baseFields.filter(k=>!['Is_Locked','Publish','Keep_on_Career_Site'].includes(k)).every(k=>typeof row[k]==='string'&&Buffer.byteLength(row[k])<=256*1024),'Original native role fields unavailable')
 if(detail)need(typeof row.Zip_Code==='string','Unreviewed native postal-code hierarchy')
 dateValue(row.Date_Opened,detail)
 return row
}
function checkedUrl(url,row,apply=false){
 let parsed;try{parsed=new URL(url)}catch{throw fail('Invalid original native role URL')}
 const root=BOARD+'/'+row.id+'/'
 need(parsed.origin==='https://careers.myoperator.com'&&!parsed.username&&!parsed.password&&!parsed.hash&&parsed.pathname.startsWith(new URL(root).pathname)&&/^[-A-Za-z0-9%]+$/.test(parsed.pathname.slice(new URL(root).pathname.length))&&
  parsed.searchParams.getAll('source').length===1&&parsed.searchParams.get('source')==='CareerSite'&&[...parsed.searchParams.keys()].every(k=>['source',...(apply?['$apply']:[])].includes(k))&&
  (!apply||parsed.searchParams.getAll('$apply').length===1&&parsed.searchParams.get('$apply')==='true'),'Foreign native role/application identity')
 return url
}
export function readMyOperatorList(body,embedded){
 const payload=json(body)
 need(keys(payload,['code','data','info'])&&payload.code==='success'&&Array.isArray(payload.data)&&payload.data.length<=200,'Native jobs success/continuation contract changed')
 const info=payload.info
 need(keys(info,['layout','keys','page_name','brand_color','fields','facets'])&&info.layout===3&&info.page_name==='Careers'&&Array.isArray(info.fields)&&info.fields.every(row=>['Job_Opening_Name','City','State','Country','Industry','Job_Type','Work_Experience','Date_Opened','Job_Description','Remote_Job'].includes(row.api_name)),'Native listing fields/continuation metadata changed')
 need(payload.data.length===embedded.length,'Native embedded/API inventory count changed')
 const ids=new Set()
 for(const row of payload.data){
  validateRow(row);need(!ids.has(row.id),'Duplicate native role ID');ids.add(row.id);checkedUrl(row.$url,row)
  const matches=embedded.filter(other=>other.id===row.id),{ $url:ignored,...original}=row
  need(matches.length===1&&same({...original,Date_Opened:dateValue(row.Date_Opened)},matches[0]),'Native embedded/API full record mismatch')
 }
 return payload.data
}
export function readMyOperatorDetail(body,row){
 const value=json(body);need(keys(value,['code','data'])&&value.code==='success'&&Array.isArray(value.data)&&value.data.length===1,'Native exact full detail unavailable')
 const record=validateRow(value.data[0],true)
 for(const key of baseFields.filter(k=>!['Job_Description','Date_Opened'].includes(k)))need(record[key]===row[key],'Native listing/detail '+key+' mismatch')
 need(dateValue(record.Date_Opened,true)===dateValue(row.Date_Opened),'Native listing/detail Date_Opened mismatch')
 checkedUrl(record.$appy_url,row,true)
 const criteria=readOriginalNativeCriteria(record.Job_Description,fail)
 need(criteria.sourceDetailComplete,'Native full original criteria unavailable')
 need(!/\b(?:(?:this|the) (?:job|role|position|vacancy) (?:is |has been |has )?(?:closed|filled|expired)|(?:we are |we're )?no longer accepting applications|applications? (?:are |have been )?closed)\b/i.test(criteria.sourceDescription),'Explicit native closed or inactive role notice')
 const compact=value=>value.replace(/[\s\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'')
 if(compact(row.Job_Description)!==compact(criteria.sourceDescription))throw fail('Original criteria carriers disagree',{code:'MYOPERATOR_CRITERIA_DISAGREEMENT'})
 need(/\b(?:responsibilit(?:y|ies)|requirements|qualifications|candidate profile|skills|who you are|what you[\u2019']ll own)\b/i.test(criteria.sourceDescription),'Role-owned candidate criteria unavailable')
 return {record,criteria}
}
export async function runCurrentMyOperator(options={}){
 options.signal?.throwIfAborted()
 const maxJobs=options.maxJobs??200;need(Number.isSafeInteger(maxJobs)&&maxJobs>0&&maxJobs<=200,'Invalid native output limit')
 const observedAt=(options.now??(()=>new Date().toISOString()))();need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Invalid observation clock')
 const learned=new Set(),reader=createCurrentNativeReader(options,{source:'myoperator',admitted:[[CORPORATE,'html'],[BOARD,'html'],[API,'json']],learnedURL:url=>learned.has(url)})
 const snapshot=async()=>{const portal=readMyOperatorPortal((await reader.read(BOARD)).body);return readMyOperatorList((await reader.read(API)).body,portal.rows)}
 const facts=new Map(),holds=[]
 try{
  corporate((await reader.read(CORPORATE)).body)
  const opening=await snapshot()
  for(const row of opening){
   reader.check()
   if(row.Publish!==true||row.Is_Locked!==false){holds.push({id:row.id,reason:'native-inactive-or-locked'});continue}
   if(row.Country!=='India'){holds.push({id:row.id,reason:'native-country-unqualified'});continue}
   const url=detailURL(row.id);learned.add(url);reader.allow(url,'json')
   facts.set(row.id,{row,...readMyOperatorDetail((await reader.read(url)).body,row)})
  }
  const closing=await snapshot(),closed=new Map(closing.map(row=>[row.id,row])),stable=[]
  for(const [id,fact]of facts){
   const latest=closed.get(id)
   if(!latest||!same(fact.row,latest)||latest.Publish!==true||latest.Is_Locked!==false){holds.push({id,reason:'native-full-list-record-changed-at-closing'});continue}
   let last
   try{last=readMyOperatorDetail((await reader.read(detailURL(id))).body,latest)}
   catch(error){reader.check();if(error.code!=='MYOPERATOR_CRITERIA_DISAGREEMENT')throw error;holds.push({id,reason:'native-full-detail-changed-at-closing'});continue}
   if(!same(fact.record,last.record)){holds.push({id,reason:'native-full-detail-changed-at-closing'});continue}
   if(Date.parse(fact.record.Date_Opened)>Date.parse(observedAt)){holds.push({id,reason:'native-future-Date_Opened'});continue}
   const r=fact.record
   stable.push({...last.criteria,source:'myoperator',company:'MyOperator',title:r.Posting_Title,jobId:id,requisitionId:id,
    sourceUrl:fact.row.$url,applyUrl:r.$appy_url,link:r.$appy_url,country:'India',location:[r.City,r.State,r.Country].filter(Boolean).join(', '),city:r.City==='Remote'?null:r.City,state:r.State||null,
    employmentType:r.Job_Type,experienceRequired:r.Work_Experience,department:r.Industry,postingDate:r.Date_Opened,nativeDateOpened:r.Date_Opened,
    nativePublicationDateProvenance:'original-public-Zoho-Date_Opened',nativeFirstEverPublicationUnverified:true,closingDate:null,
    remoteStatus:r.City==='Remote'?'Remote':null,sourceNativeListingRecord:fact.row,sourceNativeDetailRecord:r,
    sourceClosingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,activationVerified:false,scrapedAt:observedAt,
    companyDomain:'myoperator.com',companyCareerPage:CORPORATE,sourceEmployerScope:'official-corporate-handoff+exact-native-internal-org-and-page'})
  }
  corporate((await reader.read(CORPORATE)).body)
  const jobs=stable.slice(0,maxJobs),audit={source:'myoperator',recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,openingClosingListingMatch:same(opening,closing),
   originalOpeningRecords:opening,originalClosingRecords:closing,returnedCount:jobs.length,outputLimited:stable.length>maxJobs,holds,reader:reader.stats(),observationTime:observedAt}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:audit.reader.requests,verifiedAt:observedAt,reason:'exact-employer-native-India-original-details-and-closing-criteria-reconciled;company-scope-unqualified'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=8*1024*1024,'Native output byte budget exceeded')
  reader.check();return jobs
 }finally{reader.close()}
}
