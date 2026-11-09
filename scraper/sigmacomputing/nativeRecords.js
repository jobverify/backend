import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {normalizeGreenhouseSourceRoleUrl} from '../../scraper-support/utils/greenhouseSourceEvidence.js'
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const fields=['absolute_url','data_compliance','education','internal_job_id','location','metadata','id','updated_at','requisition_id','title','company_name','first_published','language','application_deadline','content','departments','offices','ai_disclaimer','include_ai_disclaimer','ai_opt_out_request_url']
const publication=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return null
 const day=value.slice(0,10);return new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day?value:null
}
export function retainSigmaNativeRecords(payload,{scrapedAt=new Date().toISOString()}={}){
 if(!plain(payload)||!Array.isArray(payload.jobs))throw Error('Sigma Computing Greenhouse jobs API response no longer matches the expected payload')
 const seen=new Set()
 return payload.jobs.map(raw=>{
  if(!plain(raw)||!Number.isSafeInteger(raw.id)||raw.id<=0||seen.has(raw.id)||typeof raw.title!=='string'||!raw.title.trim()||raw.company_name!=='Sigma Computing')throw Error('Sigma Computing native identity changed materially')
  seen.add(raw.id)
  if(!normalizeGreenhouseSourceRoleUrl(raw.absolute_url,{boardToken:'sigmacomputing',jobId:raw.id,companyCareerPage:'https://www.sigmacomputing.com/company/careers'}))throw Error('Sigma Computing native role URL changed materially')
  if(typeof raw.content!=='string'||!raw.content.trim())throw Error('Sigma Computing native full content unavailable')
  const issues=Object.keys(raw).filter(key=>!fields.includes(key)).map(key=>'unreviewed-native-role-field:'+key)
  if(raw.education!=null&&!['education_required','education_optional'].includes(raw.education))issues.push('unreviewed-native-education-requirement')
  // All actual retained metadata is null. Future criteria remain intact but
  // require review; they cannot manufacture a degree or legal hiring entity.
  if(raw.metadata!==null)issues.push('unreviewed-native-metadata')
  const postingDate=publication(raw.first_published)
  if(raw.first_published!=null&&!postingDate)issues.push('invalid-native-first-published')
  return {jobId:String(raw.id),title:raw.title,company:'Sigma Computing',sourcePublisher:'Sigma Computing',legalHiringEmployer:null,
   location:typeof raw.location?.name==='string'?raw.location.name:null,country:null,source:'sigmacomputing',sourceUrl:raw.absolute_url,applyUrl:raw.absolute_url,link:raw.absolute_url,
   postingDate,sourceFirstPublished:raw.first_published??null,sourceUpdatedAt:structuredClone(raw.updated_at??null),employmentType:null,
   sourceNativeEducation:structuredClone(raw.education??null),sourceNativeMetadata:structuredClone(raw.metadata??null),sourceNativeRecord:structuredClone(raw),sourceNativeContent:raw.content,sourceNativeRequisitionId:raw.requisition_id??null,
   jobDescription:decodeNativeEntities(raw.content),sourceCriteriaIssues:issues,sourceCriteriaSchemaKnown:issues.length===0,scrapedAt}
 })
}
