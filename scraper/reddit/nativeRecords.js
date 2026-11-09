import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'

const metadataTypes=new Map([['Position ID','short_text'],['Recruiting Start Date','date'],['Target Hire Date','date'],['Target Hire End Date','date'],['Job Profile','single_select'],['Management Level','single_select'],['Job Family','single_select'],['Worker Sub-Type','single_select'],['Time Type','single_select'],['Pay Rate Type','single_select'],['Scheduled Weekly Hours','number'],['Company','single_select'],['Cost Center','single_select'],['Worker Type','single_select']])
const roleKeys=['absolute_url','data_compliance','internal_job_id','location','metadata','id','updated_at','requisition_id','title','company_name','first_published','language','application_deadline','content','departments','offices','ai_disclaimer','include_ai_disclaimer','ai_opt_out_request_url']
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const publication=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return null
 const day=value.slice(0,10);return new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day?value:null
}

// This stage deliberately runs before geography selection. The original JSON
// record/content/metadata remain lossless, even for foreign or unknown roles.
// Raw HR labels are observations, not a normalized employment taxonomy.
export function retainRedditNativeRecords(payload,{scrapedAt=new Date().toISOString()}={}){
 if(!plain(payload)||!Array.isArray(payload.jobs))throw Error('Verified Reddit Greenhouse payload changed materially')
 const seen=new Set()
 return payload.jobs.map(raw=>{
  if(!plain(raw)||!Number.isSafeInteger(raw.id)||raw.id<=0||seen.has(raw.id)||typeof raw.title!=='string'||!raw.title.trim()||raw.company_name!=='Reddit')throw Error('Verified Reddit native identity changed materially')
  seen.add(raw.id)
  let url;try{url=new URL(raw.absolute_url)}catch{throw Error('Verified Reddit native URL changed materially')}
  if(url.origin!=='https://job-boards.greenhouse.io'||url.pathname!==`/reddit/jobs/${raw.id}`||url.search||url.hash||url.username||url.password)throw Error('Verified Reddit native URL changed materially')
  if(typeof raw.content!=='string')throw Error('Verified Reddit native content changed materially')
  const issues=Object.keys(raw).filter(k=>!roleKeys.includes(k)).map(k=>'unreviewed-native-role-field:'+k),metadata=Array.isArray(raw.metadata)?raw.metadata:[]
  if(!Array.isArray(raw.metadata))issues.push('native-metadata-array-unavailable')
  const names=new Set()
  for(const entry of metadata){
   if(!plain(entry)||Object.keys(entry).some(k=>!['id','name','value','value_type'].includes(k))||!Number.isSafeInteger(entry.id)||typeof entry.name!=='string'||!entry.name||typeof entry.value_type!=='string'||(entry.value!==null&&typeof entry.value!=='string')){issues.push('malformed-native-metadata-entry');continue}
   if(names.has(entry.name))issues.push('repeated-native-metadata-name:'+entry.name)
   names.add(entry.name)
   if(!metadataTypes.has(entry.name)||metadataTypes.get(entry.name)!==entry.value_type)issues.push('unreviewed-native-metadata:'+entry.name)
  }
  const one=name=>{const found=metadata.filter(entry=>plain(entry)&&entry.name===name);return found.length===1&&typeof found[0].value==='string'?found[0].value:null}
  const postingDate=publication(raw.first_published)
  if(raw.first_published!=null&&!postingDate)issues.push('invalid-native-first-published')
  return {jobId:String(raw.id),title:raw.title,company:'Reddit',location:typeof raw.location?.name==='string'?raw.location.name:null,country:null,
   source:'reddit',sourceUrl:raw.absolute_url,applyUrl:raw.absolute_url,link:raw.absolute_url,
   postingDate,sourceFirstPublished:raw.first_published??null,sourceUpdatedAt:structuredClone(raw.updated_at??null),
   employmentType:null,legalHiringEmployer:one('Company'),sourcePublisher:'Reddit',
   sourceEmploymentCriteria:{workerSubType:one('Worker Sub-Type'),timeType:one('Time Type'),scheduledWeeklyHours:one('Scheduled Weekly Hours'),workerType:one('Worker Type'),payRateType:one('Pay Rate Type')},
   sourceNativeMetadata:structuredClone(raw.metadata??null),sourceNativeRecord:structuredClone(raw),sourceNativeContent:raw.content,
   jobDescription:decodeNativeEntities(raw.content),sourceNativeRequisitionId:raw.requisition_id??null,sourceCriteriaIssues:issues,sourceCriteriaReviewComplete:issues.length===0,scrapedAt}
 })
}
